package com.workflow.engine.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.workflow.engine.domain.entity.WorkflowDefinition;
import com.workflow.engine.domain.entity.WorkflowRun;
import com.workflow.engine.domain.entity.WorkflowStep;
import com.workflow.engine.domain.enums.StepStatus;
import com.workflow.engine.domain.enums.StepType;
import com.workflow.engine.domain.enums.WorkflowStatus;
import com.workflow.engine.domain.repository.WorkflowRunRepository;
import com.workflow.engine.domain.repository.WorkflowStepRepository;
import com.workflow.engine.dto.WorkflowRunFilter;
import com.workflow.engine.exception.WorkflowException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class WorkflowRunService {

    private final WorkflowRunRepository workflowRunRepository;
    private final WorkflowStepRepository workflowStepRepository;
    private final WorkflowDefinitionService workflowDefinitionService;

    @Transactional
    public WorkflowRun createRun(
            UUID definitionId,
            String fileName,
            String filePath,
            long fileSize,
            JsonNode inputConfig,
            String createdBy,
            JsonNode metadata) {
        WorkflowDefinition definition = workflowDefinitionService.findById(definitionId);
        if (!definition.isActive()) {
            throw new WorkflowException("Workflow definition is inactive: " + definitionId);
        }
        WorkflowRun run = WorkflowRun.builder()
                .definitionId(definitionId)
                .fileName(fileName)
                .filePath(filePath)
                .fileSize(fileSize)
                .status(WorkflowStatus.PENDING)
                .inputConfig(inputConfig)
                .createdBy(createdBy)
                .metadata(metadata)
                .build();
        run = workflowRunRepository.save(run);

        ArrayNode stepsConfig = (ArrayNode) definition.getStepsConfig();
        List<WorkflowStep> steps = new ArrayList<>();
        stepsConfig.forEach(node -> {
            StepType stepType = StepType.valueOf(node.get("step_type").asText());
            WorkflowStep step = WorkflowStep.builder()
                    .runId(run.getId())
                    .stepName(node.get("step_name").asText())
                    .stepType(stepType)
                    .stepOrder(node.get("step_order").asInt())
                    .status(StepStatus.PENDING)
                    .maxRetries(node.path("max_retries").asInt(3))
                    .build();
            steps.add(step);
        });
        steps.sort(Comparator.comparingInt(WorkflowStep::getStepOrder));
        workflowStepRepository.saveAll(steps);
        return run;
    }

    @Transactional(readOnly = true)
    public WorkflowRun findById(UUID id) {
        return workflowRunRepository
                .findById(id)
                .orElseThrow(() -> new WorkflowException("Workflow run not found: " + id));
    }

    @Transactional(readOnly = true)
    public List<WorkflowStep> findSteps(UUID runId) {
        return workflowStepRepository.findByRunIdOrderByStepOrderAsc(runId);
    }

    @Transactional(readOnly = true)
    public Page<WorkflowRun> findAll(WorkflowRunFilter filter, Pageable pageable) {
        return workflowRunRepository.search(
                filter.getStatus(),
                filter.getDefinitionId(),
                filter.getFileName(),
                filter.getFrom(),
                filter.getTo(),
                pageable);
    }

    @Transactional
    public void updateStatus(UUID id, WorkflowStatus status, String errorMessage) {
        WorkflowRun run = findById(id);
        run.setStatus(status);
        run.setErrorMessage(errorMessage);
        if (status == WorkflowStatus.RUNNING && run.getStartedAt() == null) {
            run.setStartedAt(Instant.now());
        }
        if (status == WorkflowStatus.COMPLETED || status == WorkflowStatus.FAILED || status == WorkflowStatus.CANCELLED) {
            run.setCompletedAt(Instant.now());
        }
        workflowRunRepository.save(run);
    }

    @Transactional
    public WorkflowRun retryRun(UUID id) {
        WorkflowRun run = findById(id);
        if (run.getStatus() != WorkflowStatus.FAILED) {
            throw new WorkflowException("Only failed runs can be retried");
        }
        List<WorkflowStep> steps = findSteps(id);
        WorkflowStep failed = steps.stream()
                .filter(s -> s.getStatus() == StepStatus.FAILED)
                .findFirst()
                .orElse(steps.stream()
                        .filter(s -> s.getStatus() != StepStatus.COMPLETED)
                        .findFirst()
                        .orElseThrow(() -> new WorkflowException("No step to retry")));
        failed.setStatus(StepStatus.PENDING);
        failed.setErrorMessage(null);
        failed.setStartedAt(null);
        failed.setCompletedAt(null);
        failed.setDurationMs(null);
        workflowStepRepository.save(failed);
        run.setStatus(WorkflowStatus.RUNNING);
        run.setCompletedAt(null);
        run.setErrorMessage(null);
        return workflowRunRepository.save(run);
    }

    @Transactional
    public WorkflowRun cancelRun(UUID id) {
        WorkflowRun run = findById(id);
        if (run.getStatus() != WorkflowStatus.RUNNING && run.getStatus() != WorkflowStatus.PENDING) {
            throw new WorkflowException("Run cannot be cancelled in status " + run.getStatus());
        }
        findSteps(id).stream()
                .filter(s -> s.getStatus() == StepStatus.PENDING || s.getStatus() == StepStatus.RUNNING)
                .forEach(s -> {
                    s.setStatus(StepStatus.SKIPPED);
                    workflowStepRepository.save(s);
                });
        run.setStatus(WorkflowStatus.CANCELLED);
        run.setCompletedAt(Instant.now());
        return workflowRunRepository.save(run);
    }

}
