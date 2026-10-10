package com.workflow.engine.controller;

import com.workflow.engine.domain.enums.StepType;
import com.workflow.engine.domain.enums.WorkflowStatus;
import com.workflow.engine.domain.repository.WorkflowRunRepository;
import com.workflow.engine.domain.repository.WorkflowStepRepository;
import java.util.HashMap;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/internal")
@RequiredArgsConstructor
public class MetricsController {

    private final WorkflowRunRepository workflowRunRepository;
    private final WorkflowStepRepository workflowStepRepository;

    @GetMapping("/metrics")
    public Map<String, Object> metrics() {
        Map<String, Object> metrics = new HashMap<>();
        metrics.put("active_runs", workflowRunRepository.countByStatus(WorkflowStatus.RUNNING));
        metrics.put("pending_runs", workflowRunRepository.countByStatus(WorkflowStatus.PENDING));
        metrics.put("completed_runs", workflowRunRepository.countByStatus(WorkflowStatus.COMPLETED));
        metrics.put("failed_runs", workflowRunRepository.countByStatus(WorkflowStatus.FAILED));
        metrics.put("avg_ingest_duration_ms", nullable(workflowStepRepository.averageDurationMsByStepType(StepType.INGEST)));
        metrics.put("avg_validate_duration_ms", nullable(workflowStepRepository.averageDurationMsByStepType(StepType.VALIDATE)));
        metrics.put("avg_load_duration_ms", nullable(workflowStepRepository.averageDurationMsByStepType(StepType.LOAD)));
        return metrics;
    }

    private static Object nullable(Double value) {
        return value == null ? 0 : value;
    }
}
