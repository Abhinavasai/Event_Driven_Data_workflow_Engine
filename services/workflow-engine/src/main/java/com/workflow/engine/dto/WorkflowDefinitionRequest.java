package com.workflow.engine.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.workflow.engine.domain.enums.FileType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class WorkflowDefinitionRequest {

    @NotBlank
    private String name;

    private String description;

    @NotNull
    private FileType fileType;

    @NotNull
    private JsonNode stepsConfig;

    private String createdBy;
}
