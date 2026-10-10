package com.workflow.engine.domain.repository;

import com.workflow.engine.domain.entity.WorkflowRun;
import com.workflow.engine.domain.enums.WorkflowStatus;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface WorkflowRunRepository extends JpaRepository<WorkflowRun, UUID> {

    long countByStatus(WorkflowStatus status);

    long countByStatusAndCreatedAtAfter(WorkflowStatus status, Instant after);

    @Query("""
            SELECT r FROM WorkflowRun r
            WHERE (:status IS NULL OR r.status = :status)
              AND (:definitionId IS NULL OR r.definitionId = :definitionId)
              AND (:fileName IS NULL OR LOWER(r.fileName) LIKE LOWER(CONCAT('%', :fileName, '%')))
              AND (:from IS NULL OR r.createdAt >= :from)
              AND (:to IS NULL OR r.createdAt <= :to)
            """)
    Page<WorkflowRun> search(
            @Param("status") WorkflowStatus status,
            @Param("definitionId") UUID definitionId,
            @Param("fileName") String fileName,
            @Param("from") Instant from,
            @Param("to") Instant to,
            Pageable pageable);

    @Query("""
            SELECT r.status, COUNT(r) FROM WorkflowRun r
            WHERE r.createdAt >= :since
            GROUP BY r.status
            """)
    List<Object[]> countByStatusSince(@Param("since") Instant since);
}
