package com.workflow.engine.controller;

import com.workflow.engine.domain.enums.WorkflowStatus;
import com.workflow.engine.domain.repository.DeadLetterEventRepository;
import com.workflow.engine.domain.repository.WorkflowRunRepository;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/internal")
@RequiredArgsConstructor
public class InternalStatsController {

    private final WorkflowRunRepository workflowRunRepository;
    private final DeadLetterEventRepository deadLetterEventRepository;

    @GetMapping("/stats")
    public Map<String, Object> stats() {
        Instant startOfDay = Instant.now().truncatedTo(ChronoUnit.DAYS);
        long activeRuns = workflowRunRepository.countByStatus(WorkflowStatus.RUNNING);
        long completed = workflowRunRepository.countByStatus(WorkflowStatus.COMPLETED);
        long failed = workflowRunRepository.countByStatus(WorkflowStatus.FAILED);
        long totalFinished = completed + failed;
        double successRate = totalFinished == 0 ? 100.0 : (completed * 100.0 / totalFinished);
        long filesToday = workflowRunRepository.countByStatusAndCreatedAtAfter(WorkflowStatus.COMPLETED, startOfDay)
                + workflowRunRepository.countByStatusAndCreatedAtAfter(WorkflowStatus.FAILED, startOfDay)
                + workflowRunRepository.countByStatusAndCreatedAtAfter(WorkflowStatus.RUNNING, startOfDay);

        Map<String, Object> response = new HashMap<>();
        response.put("active_runs", activeRuns);
        response.put("success_rate_percent", Math.round(successRate * 100.0) / 100.0);
        response.put("files_processed_today", filesToday);
        response.put("dead_letter_count", deadLetterEventRepository.countByReplayedFalse());
        response.put("runs_by_status_last_7_days", runsByStatusSince(Instant.now().minus(7, ChronoUnit.DAYS)));
        return response;
    }

    private Map<String, Long> runsByStatusSince(Instant since) {
        Map<String, Long> map = new HashMap<>();
        List<Object[]> rows = workflowRunRepository.countByStatusSince(since);
        for (Object[] row : rows) {
            map.put(String.valueOf(row[0]), (Long) row[1]);
        }
        return map;
    }
}
