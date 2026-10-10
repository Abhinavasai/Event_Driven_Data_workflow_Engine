package com.workflow.engine.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.workflow.engine.domain.entity.WorkflowDefinition;
import com.workflow.engine.domain.enums.FileType;
import com.workflow.engine.domain.repository.WorkflowDefinitionRepository;
import com.workflow.engine.dto.WorkflowDefinitionRequest;
import com.workflow.engine.exception.WorkflowException;
import java.util.Iterator;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class WorkflowDefinitionService {

    private final WorkflowDefinitionRepository workflowDefinitionRepository;

    @Transactional
    public WorkflowDefinition create(WorkflowDefinitionRequest request) {
        validateStepsConfig(request.getStepsConfig());
        if (workflowDefinitionRepository.findByName(request.getName()).isPresent()) {
            throw new WorkflowException("Workflow definition already exists: " + request.getName());
        }
        WorkflowDefinition definition = WorkflowDefinition.builder()
                .name(request.getName())
                .description(request.getDescription())
                .fileType(request.getFileType())
                .stepsConfig(request.getStepsConfig())
                .active(true)
                .createdBy(request.getCreatedBy())
                .build();
        return workflowDefinitionRepository.save(definition);
    }

    @Transactional(readOnly = true)
    public WorkflowDefinition findById(UUID id) {
        return workflowDefinitionRepository
                .findById(id)
                .orElseThrow(() -> new WorkflowException("Workflow definition not found: " + id));
    }

    @Transactional(readOnly = true)
    public Page<WorkflowDefinition> findAll(Pageable pageable) {
        return workflowDefinitionRepository.findAll(pageable);
    }

    @Transactional(readOnly = true)
    public List<WorkflowDefinition> findAllActive() {
        return workflowDefinitionRepository.findByActiveTrueOrderByNameAsc();
    }

    @Transactional(readOnly = true)
    public List<WorkflowDefinition> findActiveByFileType(FileType fileType) {
        return workflowDefinitionRepository.findByActiveTrueAndFileTypeOrderByNameAsc(fileType);
    }

    @Transactional
    public WorkflowDefinition update(UUID id, WorkflowDefinitionRequest request) {
        WorkflowDefinition existing = findById(id);
        validateStepsConfig(request.getStepsConfig());
        existing.setName(request.getName());
        existing.setDescription(request.getDescription());
        existing.setFileType(request.getFileType());
        existing.setStepsConfig(request.getStepsConfig());
        return workflowDefinitionRepository.save(existing);
    }

    @Transactional
    public WorkflowDefinition toggleActive(UUID id) {
        WorkflowDefinition existing = findById(id);
        existing.setActive(!existing.isActive());
        return workflowDefinitionRepository.save(existing);
    }

    public void validateStepsConfig(JsonNode stepsConfig) {
        if (stepsConfig == null || !stepsConfig.isArray() || stepsConfig.isEmpty()) {
            throw new WorkflowException("steps_config must be a non-empty JSON array");
        }
        Iterator<JsonNode> it = stepsConfig.elements();
        while (it.hasNext()) {
            JsonNode step = it.next();
            if (!step.hasNonNull("step_name") || !step.hasNonNull("step_type") || !step.has("step_order")) {
                throw new WorkflowException("Each step requires step_name, step_type, and step_order");
            }
        }
    }
}
