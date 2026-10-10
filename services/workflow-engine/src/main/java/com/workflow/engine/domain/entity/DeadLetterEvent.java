package com.workflow.engine.domain.entity;

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

@Entity
@Table(name = "dead_letter_events")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DeadLetterEvent {

    @Id
    @Builder.Default
    private UUID id = UUID.randomUUID();

    @Column(name = "stream_name", nullable = false, length = 100)
    private String streamName;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(name = "event_data", nullable = false, columnDefinition = "jsonb")
    private JsonNode eventData;

    @Column(name = "error_message", nullable = false, columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "original_timestamp", nullable = false)
    private Instant originalTimestamp;

    @Column(name = "captured_at", nullable = false)
    @Builder.Default
    private Instant capturedAt = Instant.now();

    @Column(nullable = false)
    @Builder.Default
    private boolean replayed = false;

    @Column(name = "replayed_at")
    private Instant replayedAt;
}
