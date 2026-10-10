package com.workflow.engine.domain.repository;

import com.workflow.engine.domain.entity.WorkflowStep;
import com.workflow.engine.domain.enums.StepStatus;
import com.workflow.engine.domain.enums.StepType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface WorkflowStepRepository extends JpaRepository<WorkflowStep, UUID> {

    List<WorkflowStep> findByRunIdOrderByStepOrderAsc(UUID runId);

    Optional<WorkflowStep> findByRunIdAndStepOrder(UUID runId, int stepOrder);

    Optional<WorkflowStep> findFirstByRunIdAndStatusOrderByStepOrderAsc(UUID runId, StepStatus status);

    Optional<WorkflowStep> findByRunIdAndStepType(UUID runId, StepType stepType);

    @Query("""
            SELECT AVG(s.durationMs) FROM WorkflowStep s
            WHERE s.stepType = :stepType AND s.durationMs IS NOT NULL
            """)
    Double averageDurationMsByStepType(@Param("stepType") StepType stepType);
}
