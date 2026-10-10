package com.workflow.engine.stream;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.workflow.engine.config.AppProperties;
import com.workflow.engine.dto.WorkflowEvent;
import com.workflow.engine.service.SystemEventService;
import java.util.HashMap;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.connection.stream.RecordId;
import org.springframework.data.redis.connection.stream.StreamRecords;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class RedisStreamPublisher {

    private final StringRedisTemplate stringRedisTemplate;
    private final ObjectMapper objectMapper;
    private final AppProperties appProperties;
    private final SystemEventService systemEventService;

    public RecordId publish(String streamName, WorkflowEvent event) {
        try {
            String json = objectMapper.writeValueAsString(event);
            Map<String, String> body = new HashMap<>();
            body.put("data", json);
            RecordId id = stringRedisTemplate.opsForStream().add(StreamRecords.string(body).withStreamKey(streamName));
            trimStream(streamName);
            systemEventService.logEvent(event.getEventType(), event.getSourceService(), event.getPayload());
            return id;
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to serialize workflow event", e);
        }
    }

    private void trimStream(String streamName) {
        try {
            long maxLen = appProperties.redis().streamMaxLen();
            stringRedisTemplate.opsForStream().trim(streamName, maxLen, true);
        } catch (Exception ex) {
            log.warn("Stream trim failed for {}: {}", streamName, ex.getMessage());
        }
    }
}
