package com.workflow.engine.controller;

import com.workflow.engine.domain.entity.WorkflowRun;
import com.workflow.engine.domain.enums.WorkflowStatus;
import com.workflow.engine.dto.WorkflowRunFilter;
import com.workflow.engine.dto.WorkflowRunResponse;
import com.workflow.engine.dto.WorkflowStepResponse;
import com.workflow.engine.service.FileIngestionService;
import com.workflow.engine.service.WorkflowRunService;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/internal/runs")
@RequiredArgsConstructor
public class InternalRunController {

    private final WorkflowRunService workflowRunService;
    private final FileIngestionService fileIngestionService;

    @GetMapping
    public Page<WorkflowRunResponse> list(
            @RequestParam(required = false) WorkflowStatus status,
            @RequestParam(required = false) UUID definitionId,
            @RequestParam(required = false) String fileName,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant dateFrom,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) Instant dateTo,
            Pageable pageable) {
        WorkflowRunFilter filter = WorkflowRunFilter.builder()
                .status(status)
                .definitionId(definitionId)
                .fileName(fileName)
                .from(dateFrom)
                .to(dateTo)
                .build();
        return workflowRunService.findAll(filter, pageable).map(this::toResponse);
    }

    @GetMapping("/{id}")
    public WorkflowRunResponse get(@PathVariable UUID id) {
        return toResponse(workflowRunService.findById(id));
    }

    @PostMapping("/{id}/retry")
    public WorkflowRunResponse retry(@PathVariable UUID id) {
        WorkflowRun run = workflowRunService.retryRun(id);
        fileIngestionService.startAsync(run.getId());
        return toResponse(run);
    }

    @PostMapping("/{id}/cancel")
    public WorkflowRunResponse cancel(@PathVariable UUID id) {
        return toResponse(workflowRunService.cancelRun(id));
    }

    private WorkflowRunResponse toResponse(WorkflowRun run) {
        List<WorkflowStepResponse> steps = workflowRunService.findSteps(run.getId()).stream()
                .map(WorkflowStepResponse::from)
                .toList();
        return WorkflowRunResponse.from(run, steps);
    }
}
