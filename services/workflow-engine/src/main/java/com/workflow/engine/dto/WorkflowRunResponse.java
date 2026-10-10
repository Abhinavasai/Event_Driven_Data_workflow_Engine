package com.workflow.engine.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.workflow.engine.domain.entity.WorkflowRun;
import com.workflow.engine.domain.enums.WorkflowStatus;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class WorkflowRunResponse {

    private UUID id;
    private UUID definitionId;
    private String fileName;
    private String filePath;
    private Long fileSize;
    private WorkflowStatus status;
    private JsonNode inputConfig;
    private Instant startedAt;
    private Instant completedAt;
    private String errorMessage;
    private String createdBy;
    private JsonNode metadata;
    private Instant createdAt;
    private List<WorkflowStepResponse> steps;

    public static WorkflowRunResponse from(WorkflowRun run, List<WorkflowStepResponse> steps) {
        return WorkflowRunResponse.builder()
                .id(run.getId())
                .definitionId(run.getDefinitionId())
                .fileName(run.getFileName())
                .filePath(run.getFilePath())
                .fileSize(run.getFileSize())
                .status(run.getStatus())
                .inputConfig(run.getInputConfig())
                .startedAt(run.getStartedAt())
                .completedAt(run.getCompletedAt())
                .errorMessage(run.getErrorMessage())
                .createdBy(run.getCreatedBy())
                .metadata(run.getMetadata())
                .createdAt(run.getCreatedAt())
                .steps(steps)
                .build();
    }
}
