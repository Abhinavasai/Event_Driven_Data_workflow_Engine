package com.workflow.engine.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.workflow.engine.domain.entity.WorkflowDefinition;
import com.workflow.engine.domain.enums.FileType;
import java.time.Instant;
import java.util.UUID;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class WorkflowDefinitionResponse {

    private UUID id;
    private String name;
    private String description;
    private FileType fileType;
    private JsonNode stepsConfig;
    private boolean active;
    private String createdBy;
    private Instant createdAt;
    private Instant updatedAt;

    public static WorkflowDefinitionResponse from(WorkflowDefinition def) {
        return WorkflowDefinitionResponse.builder()
                .id(def.getId())
                .name(def.getName())
                .description(def.getDescription())
                .fileType(def.getFileType())
                .stepsConfig(def.getStepsConfig())
                .active(def.isActive())
                .createdBy(def.getCreatedBy())
                .createdAt(def.getCreatedAt())
                .updatedAt(def.getUpdatedAt())
                .build();
    }
}
