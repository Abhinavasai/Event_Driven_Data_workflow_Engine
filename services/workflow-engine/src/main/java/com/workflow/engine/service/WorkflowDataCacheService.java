package com.workflow.engine.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.workflow.engine.config.AppProperties;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

/**
 * Staging rows between INGEST/VALIDATE steps and transform cache for LOAD.
 *
 * <p>Transform results are stored as a JSON array string at {@code transform:cache:{runId}} so the
 * Python transform service and this Java service can share data without Parquet on the JVM.
 */
@Service
@RequiredArgsConstructor
public class WorkflowDataCacheService {

    private final StringRedisTemplate stringRedisTemplate;
    private final ObjectMapper objectMapper;
    private final AppProperties appProperties;

    public void storeWorkflowRows(UUID runId, List<Map<String, Object>> rows) {
        writeJson(appProperties.workflowDataKey(runId), rows, Duration.ofHours(2));
    }

    public List<Map<String, Object>> getWorkflowRows(UUID runId) {
        return readJsonList(appProperties.workflowDataKey(runId));
    }

    public void storeTransformRows(UUID runId, List<Map<String, Object>> rows) {
        Duration ttl = Duration.ofSeconds(appProperties.redis().transformCacheTtlSeconds());
        writeJson(appProperties.transformCacheKey(runId), rows, ttl);
    }

    public List<Map<String, Object>> getTransformRows(UUID runId) {
        return readJsonList(appProperties.transformCacheKey(runId));
    }

    private void writeJson(String key, List<Map<String, Object>> rows, Duration ttl) {
        try {
            String json = objectMapper.writeValueAsString(rows);
            stringRedisTemplate.opsForValue().set(key, json, ttl);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to serialize rows for Redis key " + key, e);
        }
    }

    private List<Map<String, Object>> readJsonList(String key) {
        String json = stringRedisTemplate.opsForValue().get(key);
        // Transform service may store rows in a Redis hash field "rows" (legacy).
        if (json == null || json.isBlank()) {
            Object hashRows = stringRedisTemplate.opsForHash().get(key, "rows");
            if (hashRows != null) {
                json = hashRows.toString();
            }
        }
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<>() {});
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Failed to deserialize Redis key " + key, e);
        }
    }
}
