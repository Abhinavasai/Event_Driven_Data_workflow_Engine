package com.workflow.engine.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.workflow.engine.config.AppProperties;
import com.workflow.engine.domain.entity.WorkflowDefinition;
import com.workflow.engine.domain.entity.WorkflowRun;
import com.workflow.engine.domain.enums.FileType;
import com.workflow.engine.domain.enums.WorkflowStatus;
import com.workflow.engine.dto.WorkflowEvent;
import com.workflow.engine.exception.ValidationException;
import com.workflow.engine.exception.WorkflowFileNotFoundException;
import com.workflow.engine.stream.RedisStreamPublisher;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.util.HexFormat;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class FileIngestionService {

    private final WorkflowDefinitionService workflowDefinitionService;
    private final WorkflowRunService workflowRunService;
    private final WorkflowStateMachine workflowStateMachine;
    private final RedisStreamPublisher redisStreamPublisher;
    private final AppProperties appProperties;
    private final ObjectMapper objectMapper;

    @Transactional
    public WorkflowRun ingestFile(String filePath, UUID definitionId, JsonNode inputConfig, String createdBy) {
        Path path = Path.of(filePath);
        if (!Files.exists(path) || !Files.isRegularFile(path)) {
            throw new WorkflowFileNotFoundException("File not found: " + filePath);
        }
        WorkflowDefinition definition = workflowDefinitionService.findById(definitionId);
        validateExtension(path, definition.getFileType());

        long size;
        try {
            size = Files.size(path);
        } catch (IOException e) {
            throw new ValidationException("Unable to read file size: " + e.getMessage());
        }

        ObjectNode metadata = objectMapper.createObjectNode();
        metadata.put("file_hash", "sha256:" + sha256(path));
        metadata.put("source_path", filePath);

        WorkflowRun run = workflowRunService.createRun(
                definitionId,
                path.getFileName().toString(),
                path.toAbsolutePath().toString(),
                size,
                inputConfig,
                createdBy == null ? "system" : createdBy,
                metadata);

        ObjectNode payload = objectMapper.createObjectNode();
        payload.put("run_id", run.getId().toString());
        payload.put("definition_id", definitionId.toString());
        payload.put("file_name", run.getFileName());
        payload.put("file_path", run.getFilePath());
        payload.put("file_size", size);
        payload.put("file_type", definition.getFileType().getValue());
        payload.put("created_by", run.getCreatedBy());

        WorkflowEvent event = WorkflowEvent.of(
                "FILE_RECEIVED",
                SystemEventService.SOURCE,
                run.getId(),
                payload);
        redisStreamPublisher.publish(appProperties.redis().stream().workflowEvents(), event);

        workflowRunService.updateStatus(run.getId(), WorkflowStatus.RUNNING, null);
        startAsync(run.getId());
        return run;
    }

    @Async("workflowTaskExecutor")
    public void startAsync(UUID runId) {
        workflowStateMachine.startWorkflow(runId);
    }

    private static void validateExtension(Path path, FileType fileType) {
        String name = path.getFileName().toString().toLowerCase();
        boolean ok = switch (fileType) {
            case CSV -> name.endsWith(".csv");
            case JSON -> name.endsWith(".json") || name.endsWith(".ndjson");
        };
        if (!ok) {
            throw new ValidationException("File extension does not match workflow file type " + fileType);
        }
    }

    private static String sha256(Path path) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            try (InputStream in = Files.newInputStream(path);
                    DigestInputStream din = new DigestInputStream(in, digest)) {
                din.transferTo(java.io.OutputStream.nullOutputStream());
            }
            return HexFormat.of().formatHex(digest.digest());
        } catch (Exception e) {
            return "unknown";
        }
    }
}
