package com.workflow.engine.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.workflow.engine.config.AppProperties;
import com.workflow.engine.domain.entity.DeadLetterEvent;
import com.workflow.engine.domain.repository.DeadLetterEventRepository;
import com.workflow.engine.dto.WorkflowEvent;
import com.workflow.engine.exception.WorkflowException;
import com.workflow.engine.stream.RedisStreamPublisher;
import java.time.Instant;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class DeadLetterService {

    private final DeadLetterEventRepository deadLetterEventRepository;
    private final RedisStreamPublisher redisStreamPublisher;
    private final AppProperties appProperties;

    @Transactional
    public DeadLetterEvent capture(String streamName, JsonNode eventData, String errorMessage, Instant originalTimestamp) {
        DeadLetterEvent event = DeadLetterEvent.builder()
                .streamName(streamName)
                .eventData(eventData)
                .errorMessage(errorMessage)
                .originalTimestamp(originalTimestamp == null ? Instant.now() : originalTimestamp)
                .capturedAt(Instant.now())
                .replayed(false)
                .build();
        DeadLetterEvent saved = deadLetterEventRepository.save(event);
        WorkflowEvent dlEvent = WorkflowEvent.of(
                "DEAD_LETTER_CAPTURED",
                SystemEventService.SOURCE,
                null,
                eventData);
        redisStreamPublisher.publish(appProperties.redis().stream().deadLetter(), dlEvent);
        return saved;
    }

    @Transactional(readOnly = true)
    public Page<DeadLetterEvent> listUnreplayed(Pageable pageable) {
        return deadLetterEventRepository.findByReplayedFalseOrderByCapturedAtDesc(pageable);
    }

    @Transactional(readOnly = true)
    public DeadLetterEvent getById(UUID id) {
        return deadLetterEventRepository
                .findById(id)
                .orElseThrow(() -> new WorkflowException("Dead letter event not found: " + id));
    }

    @Transactional
    public DeadLetterEvent replay(UUID id) {
        DeadLetterEvent event = getById(id);
        if (event.isReplayed()) {
            throw new WorkflowException("Dead letter event already replayed: " + id);
        }
        WorkflowEvent payload = WorkflowEvent.builder()
                .eventType("REPLAY")
                .sourceService(SystemEventService.SOURCE)
                .payload(event.getEventData())
                .build();
        redisStreamPublisher.publish(event.getStreamName(), payload);
        event.setReplayed(true);
        event.setReplayedAt(Instant.now());
        return deadLetterEventRepository.save(event);
    }
}
