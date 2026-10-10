package com.workflow.engine.controller;

import com.workflow.engine.domain.entity.WorkflowDefinition;
import com.workflow.engine.dto.WorkflowDefinitionRequest;
import com.workflow.engine.dto.WorkflowDefinitionResponse;
import com.workflow.engine.service.WorkflowDefinitionService;
import jakarta.validation.Valid;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/internal/workflows")
@RequiredArgsConstructor
public class InternalWorkflowController {

    private final WorkflowDefinitionService workflowDefinitionService;

    @GetMapping
    public Page<WorkflowDefinitionResponse> list(Pageable pageable) {
        return workflowDefinitionService.findAll(pageable).map(WorkflowDefinitionResponse::from);
    }

    @GetMapping("/{id}")
    public WorkflowDefinitionResponse get(@PathVariable UUID id) {
        return WorkflowDefinitionResponse.from(workflowDefinitionService.findById(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public WorkflowDefinitionResponse create(@Valid @RequestBody WorkflowDefinitionRequest request) {
        WorkflowDefinition created = workflowDefinitionService.create(request);
        return WorkflowDefinitionResponse.from(created);
    }

    @PutMapping("/{id}")
    public WorkflowDefinitionResponse update(@PathVariable UUID id, @Valid @RequestBody WorkflowDefinitionRequest request) {
        return WorkflowDefinitionResponse.from(workflowDefinitionService.update(id, request));
    }

    @PatchMapping("/{id}/activate")
    public WorkflowDefinitionResponse activate(@PathVariable UUID id) {
        return WorkflowDefinitionResponse.from(workflowDefinitionService.toggleActive(id));
    }
}
