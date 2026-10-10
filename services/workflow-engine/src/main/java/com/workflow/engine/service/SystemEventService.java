package com.workflow.engine.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.workflow.engine.domain.entity.SystemEvent;
import com.workflow.engine.domain.repository.SystemEventRepository;
import java.time.Instant;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class SystemEventService {

    public static final String SOURCE = "workflow-engine";

    private final SystemEventRepository systemEventRepository;

    @Transactional
    public void logEvent(String eventType, String sourceService, JsonNode payload) {
        systemEventRepository.save(SystemEvent.builder()
                .eventType(eventType)
                .sourceService(sourceService == null ? SOURCE : sourceService)
                .payload(payload)
                .createdAt(Instant.now())
                .build());
    }

    @Transactional(readOnly = true)
    public List<SystemEvent> recent(int limit) {
        return systemEventRepository.findByOrderByCreatedAtDesc(PageRequest.of(0, limit));
    }
}
