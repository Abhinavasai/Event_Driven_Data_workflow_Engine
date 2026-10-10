package com.workflow.engine.service;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.workflow.engine.config.AppProperties;
import com.workflow.engine.domain.entity.WorkflowDefinition;
import com.workflow.engine.domain.entity.WorkflowRun;
import com.workflow.engine.domain.entity.WorkflowStep;
import com.workflow.engine.domain.enums.FileType;
import com.workflow.engine.domain.enums.StepStatus;
import com.workflow.engine.domain.enums.StepType;
import com.workflow.engine.domain.enums.WorkflowStatus;
import com.workflow.engine.domain.repository.WorkflowDefinitionRepository;
import com.workflow.engine.domain.repository.WorkflowRunRepository;
import com.workflow.engine.domain.repository.WorkflowStepRepository;
import com.workflow.engine.stream.RedisStreamPublisher;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.ValueOperations;

@ExtendWith(MockitoExtension.class)
class WorkflowStateMachineTest {

    @Mock
    private WorkflowRunRepository workflowRunRepository;
    @Mock
    private WorkflowStepRepository workflowStepRepository;
    @Mock
    private WorkflowDefinitionRepository workflowDefinitionRepository;
    @Mock
    private WorkflowRunService workflowRunService;
    @Mock
    private FileParserService fileParserService;
    @Mock
    private ValidationService validationService;
    @Mock
    private DataLoaderService dataLoaderService;
    @Mock
    private WorkflowDataCacheService workflowDataCacheService;
    @Mock
    private RedisStreamPublisher redisStreamPublisher;
    @Mock
    private RetryService retryService;
    @Mock
    private DeadLetterService deadLetterService;
    @Mock
    private AppProperties appProperties;
    @Mock
    private AppProperties.Redis redisProps;
    @Mock
    private AppProperties.Redis.Stream streams;
    @Mock
    private AppProperties.Retry retry;
    @Mock
    private StringRedisTemplate stringRedisTemplate;
    @Mock
    private ValueOperations<String, String> valueOperations;

    private final ObjectMapper objectMapper = new ObjectMapper();
    private WorkflowStateMachine stateMachine;

    @BeforeEach
    void setUp() {
        stateMachine = new WorkflowStateMachine(
                workflowRunRepository,
                workflowStepRepository,
                workflowDefinitionRepository,
                workflowRunService,
                fileParserService,
                validationService,
                dataLoaderService,
                workflowDataCacheService,
                redisStreamPublisher,
                retryService,
                deadLetterService,
                appProperties,
                objectMapper,
                stringRedisTemplate);
    }

    @Test
    void handleTransformCompleteCompletesStepAndAdvances() {
        UUID runId = UUID.randomUUID();
        UUID stepId = UUID.randomUUID();
        WorkflowStep step = WorkflowStep.builder()
                .id(stepId)
                .runId(runId)
                .stepType(StepType.TRANSFORM)
                .status(StepStatus.RUNNING)
                .stepOrder(3)
                .build();
        WorkflowRun run = WorkflowRun.builder().id(runId).definitionId(UUID.randomUUID()).status(WorkflowStatus.RUNNING).build();

        when(workflowStepRepository.findById(stepId)).thenReturn(Optional.of(step));
        when(workflowRunRepository.findById(runId)).thenReturn(Optional.of(run));
        when(workflowStepRepository.findFirstByRunIdAndStatusOrderByStepOrderAsc(runId, StepStatus.PENDING))
                .thenReturn(Optional.empty());
        when(appProperties.transformCacheKey(runId)).thenReturn("transform:cache:" + runId);

        ObjectNode result = objectMapper.createObjectNode();
        result.put("output_rows", 10);
        stateMachine.handleTransformComplete(runId, stepId, result);

        verify(workflowStepRepository).save(any(WorkflowStep.class));
        verify(workflowRunService).updateStatus(runId, WorkflowStatus.COMPLETED, null);
    }

    @Test
    void executeIngestStepParsesFile() {
        UUID runId = UUID.randomUUID();
        UUID stepId = UUID.randomUUID();
        UUID defId = UUID.randomUUID();

        WorkflowRun run = WorkflowRun.builder()
                .id(runId)
                .definitionId(defId)
                .filePath("/tmp/sample.csv")
                .status(WorkflowStatus.RUNNING)
                .build();
        WorkflowStep step = WorkflowStep.builder()
                .id(stepId)
                .runId(runId)
                .stepName("ingest")
                .stepType(StepType.INGEST)
                .stepOrder(1)
                .status(StepStatus.PENDING)
                .build();

        ArrayNode stepsConfig = objectMapper.createArrayNode();
        ObjectNode ingest = objectMapper.createObjectNode();
        ingest.put("step_name", "ingest");
        ingest.put("step_type", "INGEST");
        ingest.put("step_order", 1);
        ingest.set("config", objectMapper.createObjectNode());
        stepsConfig.add(ingest);

        WorkflowDefinition definition = WorkflowDefinition.builder()
                .id(defId)
                .fileType(FileType.CSV)
                .stepsConfig(stepsConfig)
                .build();

        when(stringRedisTemplate.opsForValue()).thenReturn(valueOperations);
        when(valueOperations.setIfAbsent(any(), any(), any(java.time.Duration.class))).thenReturn(true);
        when(workflowStepRepository.findById(stepId)).thenReturn(Optional.of(step));
        when(workflowRunRepository.findById(runId)).thenReturn(Optional.of(run));
        when(workflowDefinitionRepository.findById(defId)).thenReturn(Optional.of(definition));
        when(fileParserService.parseCsv(eq(run.getFilePath()), any())).thenReturn(List.of(Map.of("a", "1")));
        when(workflowStepRepository.findFirstByRunIdAndStatusOrderByStepOrderAsc(runId, StepStatus.PENDING))
                .thenReturn(Optional.empty());
        when(appProperties.redis()).thenReturn(redisProps);
        when(redisProps.stream()).thenReturn(streams);
        when(streams.statusEvents()).thenReturn("status:events");

        stateMachine.executeStep(runId, stepId);

        verify(workflowDataCacheService).storeWorkflowRows(eq(runId), any());
        verify(workflowStepRepository).save(any(WorkflowStep.class));
    }
}
