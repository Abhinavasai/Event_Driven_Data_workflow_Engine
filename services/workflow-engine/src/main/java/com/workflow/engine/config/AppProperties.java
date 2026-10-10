package com.workflow.engine.config;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app")
public record AppProperties(
        FileWatch fileWatch,
        Redis redis,
        Retry retry) {

    public record FileWatch(
            boolean enabled,
            List<String> directories,
            long pollIntervalMs,
            long settleMs) {}

    public record Redis(
            Stream stream,
            String consumerGroup,
            String consumerName,
            long streamMaxLen,
            String transformCachePrefix,
            long transformCacheTtlSeconds,
            String workflowDataPrefix,
            String lockPrefix,
            long lockTtlSeconds) {

        public record Stream(
                String workflowEvents,
                String transformEvents,
                String statusEvents,
                String deadLetter) {}
    }

    public record Retry(long baseDelayMs) {

        public long baseDelayMs() {
            return baseDelayMs <= 0 ? 2000L : baseDelayMs;
        }
    }

    public String transformCacheKey(java.util.UUID runId) {
        return redis.transformCachePrefix() + runId;
    }

    public String workflowDataKey(java.util.UUID runId) {
        return redis.workflowDataPrefix() + runId;
    }

    public String workflowLockKey(java.util.UUID runId) {
        return redis.lockPrefix() + runId;
    }
}
