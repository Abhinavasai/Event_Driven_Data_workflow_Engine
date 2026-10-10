package com.workflow.engine.controller;

import com.workflow.engine.domain.entity.WorkflowRun;
import com.workflow.engine.dto.IngestRequest;
import com.workflow.engine.dto.WorkflowRunResponse;
import com.workflow.engine.dto.WorkflowStepResponse;
import com.workflow.engine.service.FileIngestionService;
import com.workflow.engine.service.WorkflowRunService;
import jakarta.validation.Valid;
import java.util.List;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/internal")
@RequiredArgsConstructor
public class InternalTriggerController {

    private final FileIngestionService fileIngestionService;
    private final WorkflowRunService workflowRunService;

    @PostMapping("/ingest")
    @ResponseStatus(HttpStatus.CREATED)
    public WorkflowRunResponse ingest(@Valid @RequestBody IngestRequest request) {
        WorkflowRun run = fileIngestionService.ingestFile(
                request.getFilePath(),
                request.getDefinitionId(),
                request.getInputConfig(),
                request.getCreatedBy());
        List<WorkflowStepResponse> steps = workflowRunService.findSteps(run.getId()).stream()
                .map(WorkflowStepResponse::from)
                .toList();
        return WorkflowRunResponse.from(run, steps);
    }
}
