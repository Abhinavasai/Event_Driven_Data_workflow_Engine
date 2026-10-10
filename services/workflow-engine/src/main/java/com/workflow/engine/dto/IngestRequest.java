package com.workflow.engine.dto;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.util.UUID;
import lombok.Data;

@Data
public class IngestRequest {

    @NotBlank
    private String filePath;

    @NotNull
    private UUID definitionId;

    private JsonNode inputConfig;

    private String createdBy;
}
