package com.workflow.engine.domain.repository;

import com.workflow.engine.domain.entity.WorkflowDefinition;
import com.workflow.engine.domain.enums.FileType;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WorkflowDefinitionRepository extends JpaRepository<WorkflowDefinition, UUID> {

    Optional<WorkflowDefinition> findByName(String name);

    Page<WorkflowDefinition> findByActiveTrue(Pageable pageable);

    List<WorkflowDefinition> findByActiveTrueAndFileTypeOrderByNameAsc(FileType fileType);

    List<WorkflowDefinition> findByActiveTrueOrderByNameAsc();
}
