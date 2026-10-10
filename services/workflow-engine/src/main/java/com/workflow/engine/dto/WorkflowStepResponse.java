package com.workflow.engine.dto;

import com.fasterxml.jackson.databind.JsonNode;
import com.workflow.engine.domain.entity.WorkflowStep;
import com.workflow.engine.domain.enums.StepStatus;
import com.workflow.engine.domain.enums.StepType;
import java.time.Instant;
import java.util.UUID;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class WorkflowStepResponse {

    private UUID id;
    private String stepName;
    private StepType stepType;
    private int stepOrder;
    private StepStatus status;
    private Instant startedAt;
    private Instant completedAt;
    private JsonNode output;
    private int retryCount;
    private int maxRetries;
    private String errorMessage;
    private Long durationMs;

    public static WorkflowStepResponse from(WorkflowStep step) {
        return WorkflowStepResponse.builder()
                .id(step.getId())
                .stepName(step.getStepName())
                .stepType(step.getStepType())
                .stepOrder(step.getStepOrder())
                .status(step.getStatus())
                .startedAt(step.getStartedAt())
                .completedAt(step.getCompletedAt())
                .output(step.getOutput())
                .retryCount(step.getRetryCount())
                .maxRetries(step.getMaxRetries())
                .errorMessage(step.getErrorMessage())
                .durationMs(step.getDurationMs())
                .build();
    }
}
