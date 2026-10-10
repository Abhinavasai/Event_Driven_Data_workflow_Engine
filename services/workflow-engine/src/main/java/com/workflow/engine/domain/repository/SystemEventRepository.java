package com.workflow.engine.domain.repository;

import com.workflow.engine.domain.entity.SystemEvent;
import java.time.Instant;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SystemEventRepository extends JpaRepository<SystemEvent, java.util.UUID> {

    List<SystemEvent> findByEventTypeAndCreatedAtAfterOrderByCreatedAtDesc(
            String eventType, Instant createdAt, Pageable pageable);

    List<SystemEvent> findByOrderByCreatedAtDesc(Pageable pageable);
}
