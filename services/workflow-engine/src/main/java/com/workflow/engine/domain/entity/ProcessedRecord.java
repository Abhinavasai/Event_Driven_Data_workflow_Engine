package com.workflow.engine.domain.entity;

import com.fasterxml.jackson.databind.JsonNode;
import com.workflow.engine.domain.enums.RecordStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
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
@Table(name = "processed_records")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProcessedRecord {

    @Id
    @Builder.Default
    private UUID id = UUID.randomUUID();

    @Column(name = "run_id", nullable = false)
    private UUID runId;

    @Column(name = "record_index", nullable = false)
    private int recordIndex;

    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false, columnDefinition = "jsonb")
    private JsonNode data;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    @Builder.Default
    private RecordStatus status = RecordStatus.LOADED;

    @Column(name = "error_message", columnDefinition = "TEXT")
    private String errorMessage;

    @Column(name = "loaded_at", nullable = false)
    @Builder.Default
    private Instant loadedAt = Instant.now();
}
