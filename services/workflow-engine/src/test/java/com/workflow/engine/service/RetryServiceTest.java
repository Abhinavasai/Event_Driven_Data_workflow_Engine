package com.workflow.engine.service;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

import com.workflow.engine.config.AppProperties;
import com.workflow.engine.domain.entity.WorkflowStep;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;

@ExtendWith(MockitoExtension.class)
class RetryServiceTest {

    @Mock
    private AppProperties appProperties;

    @Mock
    private AppProperties.Retry retry;

    private RetryService retryService;

    @BeforeEach
    void setUp() {
        when(appProperties.retry()).thenReturn(retry);
        when(retry.baseDelayMs()).thenReturn(2000L);
        ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
        scheduler.initialize();
        retryService = new RetryService(appProperties, scheduler);
    }

    @Test
    void calculateBackoffIncreasesWithRetryCount() {
        long first = retryService.calculateBackoff(0, 2000);
        long second = retryService.calculateBackoff(2, 2000);
        assertTrue(second > first);
    }

    @Test
    void shouldRetryWhenBelowMax() {
        WorkflowStep step = WorkflowStep.builder().retryCount(1).maxRetries(3).build();
        assertTrue(retryService.shouldRetry(step));
    }
}
