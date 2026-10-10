package com.workflow.engine.dto;

import com.workflow.engine.domain.enums.WorkflowStatus;
import java.time.Instant;
import java.util.UUID;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class WorkflowRunFilter {

    private WorkflowStatus status;
    private UUID definitionId;
    private String fileName;
    private Instant from;
    private Instant to;
}
