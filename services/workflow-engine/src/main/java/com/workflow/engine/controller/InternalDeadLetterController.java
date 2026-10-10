package com.workflow.engine.controller;

import com.workflow.engine.domain.entity.DeadLetterEvent;
import com.workflow.engine.service.DeadLetterService;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/internal/dead-letter")
@RequiredArgsConstructor
public class InternalDeadLetterController {

    private final DeadLetterService deadLetterService;

    @GetMapping
    public Page<DeadLetterEvent> list(Pageable pageable) {
        return deadLetterService.listUnreplayed(pageable);
    }

    @GetMapping("/{id}")
    public DeadLetterEvent get(@PathVariable UUID id) {
        return deadLetterService.getById(id);
    }

    @PostMapping("/{id}/replay")
    public DeadLetterEvent replay(@PathVariable UUID id) {
        return deadLetterService.replay(id);
    }
}
