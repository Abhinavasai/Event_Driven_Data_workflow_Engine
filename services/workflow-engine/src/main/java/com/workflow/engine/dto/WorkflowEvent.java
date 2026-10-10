package com.workflow.engine.dto;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Instant;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class WorkflowEvent {

    @Builder.Default
    private UUID eventId = UUID.randomUUID();

    private String eventType;
    @Builder.Default
    private Instant timestamp = Instant.now();
    private String sourceService;
    private UUID correlationId;
    private JsonNode payload;

    public static WorkflowEvent of(String eventType, String sourceService, UUID correlationId, JsonNode payload) {
        return WorkflowEvent.builder()
                .eventType(eventType)
                .sourceService(sourceService)
                .correlationId(correlationId)
                .payload(payload)
                .build();
    }
}
