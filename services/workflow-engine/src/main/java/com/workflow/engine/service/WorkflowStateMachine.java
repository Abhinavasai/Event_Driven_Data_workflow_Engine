package com.workflow.engine.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.workflow.engine.config.AppProperties;
import com.workflow.engine.domain.entity.WorkflowDefinition;
import com.workflow.engine.domain.entity.WorkflowRun;
import com.workflow.engine.domain.entity.WorkflowStep;
import com.workflow.engine.domain.enums.StepStatus;
import com.workflow.engine.domain.enums.StepType;
import com.workflow.engine.domain.enums.WorkflowStatus;
import com.workflow.engine.domain.repository.WorkflowDefinitionRepository;
import com.workflow.engine.domain.repository.WorkflowRunRepository;
import com.workflow.engine.domain.repository.WorkflowStepRepository;
import com.workflow.engine.dto.WorkflowEvent;
import com.workflow.engine.exception.StepExecutionException;
import com.workflow.engine.exception.ValidationException;
import com.workflow.engine.stream.RedisStreamPublisher;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class WorkflowStateMachine {

    private final WorkflowRunRepository workflowRunRepository;
    private final WorkflowStepRepository workflowStepRepository;
    private final WorkflowDefinitionRepository workflowDefinitionRepository;
    private final WorkflowRunService workflowRunService;
    private final FileParserService fileParserService;
    private final ValidationService validationService;
    private final DataLoaderService dataLoaderService;
    private final WorkflowDataCacheService workflowDataCacheService;
    private final RedisStreamPublisher redisStreamPublisher;
    private final RetryService retryService;
    private final DeadLetterService deadLetterService;
    private final AppProperties appProperties;
    private final ObjectMapper objectMapper;
    private final org.springframework.data.redis.core.StringRedisTemplate stringRedisTemplate;

    @Async("workflowTaskExecutor")
    @Transactional
    public void startWorkflow(UUID runId) {
        workflowRunService.updateStatus(runId, WorkflowStatus.RUNNING, null);
        workflowStepRepository
                .findFirstByRunIdAndStatusOrderByStepOrderAsc(runId, StepStatus.PENDING)
                .ifPresent(step -> executeStep(runId, step.getId()));
    }

    @Transactional
    public void executeStep(UUID runId, UUID stepId) {
        if (!acquireLock(runId)) {
            log.warn("Could not acquire lock for run {}, skipping step {}", runId, stepId);
            return;
        }
        try {
            WorkflowStep step = workflowStepRepository
                    .findById(stepId)
                    .orElseThrow(() -> new StepExecutionException("Step not found: " + stepId));
            WorkflowRun run = workflowRunRepository
                    .findById(runId)
                    .orElseThrow(() -> new StepExecutionException("Run not found: " + runId));
            if (run.getStatus() == WorkflowStatus.CANCELLED) {
                return;
            }

            step.setStatus(StepStatus.RUNNING);
            step.setStartedAt(Instant.now());
            step.setErrorMessage(null);
            workflowStepRepository.save(step);
            publishStepEvent("STEP_STARTED", run, step, null);

            JsonNode stepConfig = resolveStepConfig(run.getDefinitionId(), step);
            long started = System.currentTimeMillis();
            ObjectNode output = objectMapper.createObjectNode();

            switch (step.getStepType()) {
                case INGEST -> handleIngest(run, stepConfig, output);
                case VALIDATE -> handleValidate(runId, stepConfig, output);
                case TRANSFORM -> {
                    handleTransformRequest(run, step, stepConfig, output);
                    releaseLock(runId);
                    return;
                }
                case LOAD -> handleLoad(runId, stepConfig, output);
                default -> throw new StepExecutionException("Unsupported step type: " + step.getStepType());
            }

            output.put("duration_ms", System.currentTimeMillis() - started);
            completeStep(runId, stepId, output);
        } catch (Exception ex) {
            failStep(runId, stepId, ex.getMessage());
        } finally {
            releaseLock(runId);
        }
    }

    @Transactional
    public void completeStep(UUID runId, UUID stepId, JsonNode output) {
        WorkflowStep step = workflowStepRepository.findById(stepId).orElseThrow();
        step.setStatus(StepStatus.COMPLETED);
        step.setCompletedAt(Instant.now());
        step.setOutput(output);
        if (step.getStartedAt() != null) {
            step.setDurationMs(Duration.between(step.getStartedAt(), step.getCompletedAt()).toMillis());
        }
        workflowStepRepository.save(step);

        WorkflowRun run = workflowRunRepository.findById(runId).orElseThrow();
        publishStepEvent("STEP_COMPLETED", run, step, output);
        advanceToNextStep(runId);
    }

    @Transactional
    public void failStep(UUID runId, UUID stepId, String errorMessage) {
        WorkflowStep step = workflowStepRepository.findById(stepId).orElseThrow();
        step.setRetryCount(step.getRetryCount() + 1);
        step.setErrorMessage(errorMessage);

        if (retryService.shouldRetry(step)) {
            step.setStatus(StepStatus.PENDING);
            workflowStepRepository.save(step);
            long delay = retryService.calculateBackoff(step.getRetryCount(), appProperties.retry().baseDelayMs());
            UUID finalRunId = runId;
            UUID finalStepId = stepId;
            retryService.scheduleRetry(finalRunId, finalStepId, delay, () -> executeStep(finalRunId, finalStepId));
            log.info("Scheduled retry #{} for run {} step {} in {}ms", step.getRetryCount(), runId, stepId, delay);
            return;
        }

        step.setStatus(StepStatus.FAILED);
        step.setCompletedAt(Instant.now());
        workflowStepRepository.save(step);
        workflowRunService.updateStatus(runId, WorkflowStatus.FAILED, errorMessage);

        WorkflowRun run = workflowRunRepository.findById(runId).orElseThrow();
        ObjectNode payload = objectMapper.createObjectNode();
        payload.put("run_id", runId.toString());
        payload.put("step_id", stepId.toString());
        payload.put("error_message", errorMessage);
        WorkflowEvent failed = WorkflowEvent.of("WORKFLOW_FAILED", SystemEventService.SOURCE, runId, payload);
        redisStreamPublisher.publish(appProperties.redis().stream().workflowEvents(), failed);
        deadLetterService.capture(
                appProperties.redis().stream().workflowEvents(),
                objectMapper.valueToTree(failed),
                errorMessage,
                Instant.now());
        publishStatus(run, "FAILED", errorMessage);
    }

    @Transactional
    public void advanceToNextStep(UUID runId) {
        Optional<WorkflowStep> next = workflowStepRepository.findFirstByRunIdAndStatusOrderByStepOrderAsc(
                runId, StepStatus.PENDING);
        if (next.isPresent()) {
            executeStep(runId, next.get().getId());
            return;
        }
        workflowRunService.updateStatus(runId, WorkflowStatus.COMPLETED, null);
        WorkflowRun run = workflowRunRepository.findById(runId).orElseThrow();
        WorkflowEvent completed = WorkflowEvent.of(
                "WORKFLOW_COMPLETED",
                SystemEventService.SOURCE,
                runId,
                objectMapper.createObjectNode().put("run_id", runId.toString()));
        redisStreamPublisher.publish(appProperties.redis().stream().workflowEvents(), completed);
        publishStatus(run, "COMPLETED", null);
    }

    @Transactional
    public void handleTransformComplete(UUID runId, UUID stepId, JsonNode result) {
        if (runId == null || stepId == null) {
            return;
        }
        ObjectNode output = result.isObject() ? (ObjectNode) result.deepCopy() : objectMapper.createObjectNode();
        if (!output.has("cache_key")) {
            output.put("cache_key", appProperties.transformCacheKey(runId));
        }
        completeStep(runId, stepId, output);
    }

    @Transactional
    public void handleTransformFailed(UUID runId, UUID stepId, String error, int retryCount) {
        if (runId == null || stepId == null) {
            return;
        }
        WorkflowStep step = workflowStepRepository.findById(stepId).orElseThrow();
        if (retryCount > 0) {
            step.setRetryCount(retryCount);
            workflowStepRepository.save(step);
        }
        failStep(runId, stepId, error);
    }

    private void handleIngest(WorkflowRun run, JsonNode stepConfig, ObjectNode output) {
        WorkflowDefinition definition = workflowDefinitionRepository
                .findById(run.getDefinitionId())
                .orElseThrow();
        List<Map<String, Object>> rows = switch (definition.getFileType()) {
            case CSV -> fileParserService.parseCsv(run.getFilePath(), stepConfig);
            case JSON -> fileParserService.parseJson(run.getFilePath(), stepConfig);
        };
        workflowDataCacheService.storeWorkflowRows(run.getId(), rows);
        output.put("rows_parsed", rows.size());
        if (!rows.isEmpty()) {
            ArrayNode columns = output.putArray("columns_detected");
            rows.getFirst().keySet().forEach(columns::add);
        }
        output.put("file_encoding", stepConfig.path("encoding").asText("utf-8"));
        if (run.getMetadata() != null && run.getMetadata().has("file_hash")) {
            output.put("file_hash", run.getMetadata().get("file_hash").asText());
        }
    }

    private void handleValidate(UUID runId, JsonNode stepConfig, ObjectNode output) {
        List<Map<String, Object>> rows = workflowDataCacheService.getWorkflowRows(runId);
        ValidationService.ValidationResult result = validationService.validate(rows, stepConfig);
        workflowDataCacheService.storeWorkflowRows(runId, result.getValidRowData());
        output.put("total_rows", result.getTotalRows());
        output.put("valid_rows", result.getValidRows());
        output.put("invalid_rows", result.getInvalidRows());
        output.put("error_rate", result.getErrorRate());
        output.put("passed", result.isPassed());
        ObjectNode summary = output.putObject("error_summary");
        result.getErrorSummary().forEach(summary::put);
        if (!result.isPassed()) {
            throw new ValidationException("Validation failed: error rate " + result.getErrorRate());
        }
        publishValidationCompleted(runId, output);
    }

    private void handleTransformRequest(WorkflowRun run, WorkflowStep step, JsonNode stepConfig, ObjectNode output) {
        List<Map<String, Object>> rows = workflowDataCacheService.getWorkflowRows(run.getId());
        ObjectNode payload = objectMapper.createObjectNode();
        payload.put("run_id", run.getId().toString());
        payload.put("step_id", step.getId().toString());
        payload.put("file_path", run.getFilePath());
        payload.put("file_type", workflowDefinitionRepository.findById(run.getDefinitionId()).orElseThrow().getFileType().getValue());
        payload.put("row_count", rows.size());
        payload.set("transform_config", stepConfig);
        WorkflowEvent event = WorkflowEvent.of(
                "TRANSFORM_REQUESTED",
                SystemEventService.SOURCE,
                run.getId(),
                payload);
        redisStreamPublisher.publish(appProperties.redis().stream().transformEvents(), event);
        output.put("requested", true);
        output.put("row_count", rows.size());
        step.setStatus(StepStatus.RUNNING);
        step.setOutput(output);
        workflowStepRepository.save(step);
    }

    private void handleLoad(UUID runId, JsonNode stepConfig, ObjectNode output) {
        long started = System.currentTimeMillis();
        DataLoaderService.LoadResult result = dataLoaderService.loadData(runId, stepConfig);
        output.put("total_rows", result.getTotalRows());
        output.put("inserted", result.getInserted());
        output.put("updated", result.getUpdated());
        output.put("rejected", result.getRejected());
        output.put("target_table", result.getTargetTable());
        output.put("load_mode", result.getLoadMode());
        output.put("duration_ms", System.currentTimeMillis() - started);
    }

    private JsonNode resolveStepConfig(UUID definitionId, WorkflowStep step) {
        WorkflowDefinition definition = workflowDefinitionRepository.findById(definitionId).orElseThrow();
        ArrayNode steps = (ArrayNode) definition.getStepsConfig();
        for (JsonNode node : steps) {
            if (step.getStepName().equals(node.path("step_name").asText())
                    || step.getStepType().name().equals(node.path("step_type").asText())) {
                return node.path("config");
            }
        }
        return objectMapper.createObjectNode();
    }

    private void publishValidationCompleted(UUID runId, ObjectNode output) {
        WorkflowEvent event = WorkflowEvent.of("VALIDATION_COMPLETED", SystemEventService.SOURCE, runId, output);
        redisStreamPublisher.publish(appProperties.redis().stream().workflowEvents(), event);
    }

    private void publishStepEvent(String type, WorkflowRun run, WorkflowStep step, JsonNode extra) {
        ObjectNode payload = objectMapper.createObjectNode();
        payload.put("run_id", run.getId().toString());
        payload.put("step_id", step.getId().toString());
        payload.put("step_type", step.getStepType().name());
        if (extra != null) {
            payload.set("output", extra);
        }
        redisStreamPublisher.publish(
                appProperties.redis().stream().statusEvents(),
                WorkflowEvent.of(type, SystemEventService.SOURCE, run.getId(), payload));
    }

    private void publishStatus(WorkflowRun run, String status, String message) {
        ObjectNode payload = objectMapper.createObjectNode();
        payload.put("run_id", run.getId().toString());
        payload.put("status", status);
        if (message != null) {
            payload.put("message", message);
        }
        redisStreamPublisher.publish(
                appProperties.redis().stream().statusEvents(),
                WorkflowEvent.of("RUN_STATUS", SystemEventService.SOURCE, run.getId(), payload));
    }

    private boolean acquireLock(UUID runId) {
        String key = appProperties.workflowLockKey(runId);
        Boolean ok = stringRedisTemplate.opsForValue().setIfAbsent(key, "1", Duration.ofSeconds(appProperties.redis().lockTtlSeconds()));
        return Boolean.TRUE.equals(ok);
    }

    private void releaseLock(UUID runId) {
        stringRedisTemplate.delete(appProperties.workflowLockKey(runId));
    }
}
