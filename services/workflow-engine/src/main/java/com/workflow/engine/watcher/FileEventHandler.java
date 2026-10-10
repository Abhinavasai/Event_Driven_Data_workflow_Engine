package com.workflow.engine.watcher;

import com.workflow.engine.domain.entity.WorkflowDefinition;
import com.workflow.engine.domain.enums.FileType;
import com.workflow.engine.service.FileIngestionService;
import com.workflow.engine.service.WorkflowDefinitionService;
import java.nio.file.Path;
import java.util.List;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class FileEventHandler {

    private final WorkflowDefinitionService workflowDefinitionService;
    private final FileIngestionService fileIngestionService;

    public void handleCreatedFile(Path file) {
        String name = file.getFileName().toString();
        if (name.startsWith(".") || name.startsWith("~")) {
            return;
        }
        FileType fileType = detectType(name);
        if (fileType == null) {
            log.debug("Ignoring unsupported file {}", name);
            return;
        }
        List<WorkflowDefinition> definitions = workflowDefinitionService.findActiveByFileType(fileType);
        if (definitions.isEmpty()) {
            log.warn("No active workflow definition for file type {} ({})", fileType, name);
            return;
        }
        WorkflowDefinition definition = definitions.getFirst();
        log.info("Auto-ingesting {} with definition {}", file, definition.getName());
        fileIngestionService.ingestFile(file.toAbsolutePath().toString(), definition.getId(), null, "file-watcher");
    }

    private static FileType detectType(String name) {
        String lower = name.toLowerCase();
        if (lower.endsWith(".csv")) {
            return FileType.CSV;
        }
        if (lower.endsWith(".json") || lower.endsWith(".ndjson")) {
            return FileType.JSON;
        }
        return null;
    }
}
