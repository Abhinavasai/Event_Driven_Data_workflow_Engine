package com.workflow.engine.domain.repository;

import com.workflow.engine.domain.entity.ProcessedRecord;
import com.workflow.engine.domain.enums.RecordStatus;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProcessedRecordRepository extends JpaRepository<ProcessedRecord, UUID> {

    long countByRunId(UUID runId);

    long countByRunIdAndStatus(UUID runId, RecordStatus status);

    void deleteByRunId(UUID runId);
}
