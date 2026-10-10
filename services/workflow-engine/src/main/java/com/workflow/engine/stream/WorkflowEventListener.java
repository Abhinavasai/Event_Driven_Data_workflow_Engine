package com.workflow.engine.stream;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.workflow.engine.dto.WorkflowEvent;
import com.workflow.engine.service.WorkflowStateMachine;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.connection.stream.MapRecord;
import org.springframework.data.redis.stream.StreamListener;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class WorkflowEventListener implements StreamListener<String, MapRecord<String, String, String>> {

    private final ObjectMapper objectMapper;
    private final WorkflowStateMachine workflowStateMachine;
    private final RedisStreamConsumer redisStreamConsumer;

    @Override
    public void onMessage(MapRecord<String, String, String> message) {
        try {
            Map<String, String> value = message.getValue();
            String raw = value.getOrDefault("data", value.values().stream().findFirst().orElse("{}"));
            WorkflowEvent event = objectMapper.readValue(raw, WorkflowEvent.class);
            handleEvent(event, message);
        } catch (Exception ex) {
            log.error("Failed to process stream message {}: {}", message.getId(), ex.getMessage(), ex);
        }
    }

    private void handleEvent(WorkflowEvent event, MapRecord<String, String, String> message) {
        String type = event.getEventType();
        JsonNode payload = event.getPayload();
        if (payload == null) {
            return;
        }
        UUID runId = uuid(payload, "run_id");
        UUID stepId = uuid(payload, "step_id");
        if ("TRANSFORM_COMPLETED".equals(type)) {
            workflowStateMachine.handleTransformComplete(runId, stepId, payload);
            redisStreamConsumer.acknowledge(message.getStream(), StreamNames.WORKFLOW_ENGINE_GROUP, message);
        } else if ("TRANSFORM_FAILED".equals(type)) {
            String error = payload.path("error_message").asText("Transform failed");
            int retryCount = payload.path("retry_count").asInt(0);
            workflowStateMachine.handleTransformFailed(runId, stepId, error, retryCount);
            redisStreamConsumer.acknowledge(message.getStream(), StreamNames.WORKFLOW_ENGINE_GROUP, message);
        }
    }

    private static UUID uuid(JsonNode payload, String field) {
        String text = payload.path(field).asText(null);
        return text == null ? null : UUID.fromString(text);
    }
}
