package com.workflow.engine.domain.repository;

import com.workflow.engine.domain.entity.DeadLetterEvent;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DeadLetterEventRepository extends JpaRepository<DeadLetterEvent, UUID> {

    Page<DeadLetterEvent> findByReplayedFalseOrderByCapturedAtDesc(Pageable pageable);

    long countByReplayedFalse();
}
