package com.workflow.engine.service;

import com.workflow.engine.config.AppProperties;
import com.workflow.engine.domain.entity.WorkflowStep;
import java.util.Random;
import java.util.UUID;
import java.time.Instant;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class RetryService {

    private final AppProperties appProperties;
    private final ThreadPoolTaskScheduler taskScheduler;
    private final Random random = new Random();

    public long calculateBackoff(int retryCount, long baseDelayMs) {
        long base = baseDelayMs <= 0 ? appProperties.retry().baseDelayMs() : baseDelayMs;
        long exponential = base * (1L << Math.min(retryCount, 10));
        long jitter = random.nextLong(base);
        return exponential + Math.abs(jitter % base);
    }

    public boolean shouldRetry(WorkflowStep step) {
        return step.getRetryCount() < step.getMaxRetries();
    }

    public void scheduleRetry(UUID runId, UUID stepId, long delayMs, Runnable action) {
        taskScheduler.schedule(action, Instant.now().plusMillis(delayMs));
    }
}
