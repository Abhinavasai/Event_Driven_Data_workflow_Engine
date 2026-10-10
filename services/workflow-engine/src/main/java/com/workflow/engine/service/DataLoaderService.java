package com.workflow.engine.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.workflow.engine.domain.entity.ProcessedRecord;
import com.workflow.engine.domain.enums.RecordStatus;
import com.workflow.engine.domain.repository.ProcessedRecordRepository;
import com.workflow.engine.exception.StepExecutionException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;
import lombok.Builder;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class DataLoaderService {

    private static final Pattern IDENTIFIER = Pattern.compile("^[a-z][a-z0-9_]*$");

    private final JdbcTemplate jdbcTemplate;
    private final ProcessedRecordRepository processedRecordRepository;
    private final ObjectMapper objectMapper;
    private final WorkflowDataCacheService workflowDataCacheService;

    @Transactional
    public LoadResult loadData(UUID runId, JsonNode loadConfig) {
        String targetTable = loadConfig.path("target_table").asText(null);
        if (targetTable == null || !IDENTIFIER.matcher(targetTable).matches()) {
            throw new StepExecutionException("Invalid or missing target_table in load config");
        }
        String loadMode = loadConfig.path("load_mode").asText("insert");
        List<String> conflictColumns = readColumns(loadConfig, "conflict_columns");
        int batchSize = loadConfig.path("batch_size").asInt(1000);

        List<Map<String, Object>> rows = workflowDataCacheService.getTransformRows(runId);
        if (rows.isEmpty()) {
            rows = workflowDataCacheService.getWorkflowRows(runId);
        }
        if (rows.isEmpty()) {
            throw new StepExecutionException("No transformed data found in Redis cache for run " + runId);
        }

        ensureTableExists(targetTable, rows.getFirst().keySet());

        int inserted = 0;
        int updated = 0;
        int rejected = 0;
        List<ProcessedRecord> processed = new ArrayList<>();

        for (int i = 0; i < rows.size(); i++) {
            Map<String, Object> row = rows.get(i);
            try {
                boolean upserted = upsertRow(targetTable, row, loadMode, conflictColumns);
                if (upserted) {
                    updated++;
                } else {
                    inserted++;
                }
                processed.add(ProcessedRecord.builder()
                        .runId(runId)
                        .recordIndex(i)
                        .data(objectMapper.valueToTree(row))
                        .status(RecordStatus.LOADED)
                        .build());
            } catch (Exception ex) {
                rejected++;
                processed.add(ProcessedRecord.builder()
                        .runId(runId)
                        .recordIndex(i)
                        .data(objectMapper.valueToTree(row))
                        .status(RecordStatus.REJECTED)
                        .errorMessage(ex.getMessage())
                        .build());
            }
            if (processed.size() >= batchSize) {
                processedRecordRepository.saveAll(processed);
                processed.clear();
            }
        }
        if (!processed.isEmpty()) {
            processedRecordRepository.saveAll(processed);
        }

        return LoadResult.builder()
                .totalRows(rows.size())
                .inserted(inserted)
                .updated(updated)
                .rejected(rejected)
                .targetTable(targetTable)
                .loadMode(loadMode)
                .build();
    }

    private boolean upsertRow(String table, Map<String, Object> row, String loadMode, List<String> conflictColumns)
            throws StepExecutionException {
        List<String> columns = new ArrayList<>(row.keySet().stream().filter(this::validColumn).toList());
        if (columns.isEmpty()) {
            throw new StepExecutionException("Row has no valid columns");
        }
        String colList = String.join(", ", columns);
        String placeholders = String.join(", ", columns.stream().map(c -> "?").toList());
        Object[] values = columns.stream().map(row::get).toArray();

        if ("upsert".equalsIgnoreCase(loadMode) && !conflictColumns.isEmpty()) {
            for (String c : conflictColumns) {
                if (!validColumn(c)) {
                    throw new StepExecutionException("Invalid conflict column: " + c);
                }
            }
            List<String> updates = columns.stream()
                    .filter(c -> !conflictColumns.contains(c))
                    .map(c -> c + " = EXCLUDED." + c)
                    .toList();
            if (updates.isEmpty()) {
                updates = List.of(conflictColumns.getFirst() + " = EXCLUDED." + conflictColumns.getFirst());
            }
            String sql = "INSERT INTO " + table + " (" + colList + ") VALUES (" + placeholders + ")"
                    + " ON CONFLICT (" + String.join(", ", conflictColumns) + ") DO UPDATE SET "
                    + String.join(", ", updates);
            int affected = jdbcTemplate.update(sql, values);
            return affected > 0 && conflictColumns.stream().anyMatch(row::containsKey);
        }

        String sql = "INSERT INTO " + table + " (" + colList + ") VALUES (" + placeholders + ")";
        jdbcTemplate.update(sql, values);
        return false;
    }

    private void ensureTableExists(String table, Iterable<String> columns) {
        Integer exists = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ?",
                Integer.class,
                table);
        if (exists != null && exists > 0) {
            return;
        }
        List<String> valid = new ArrayList<>();
        columns.forEach(c -> {
            if (validColumn(c)) {
                valid.add(c);
            }
        });
        if (valid.isEmpty()) {
            throw new StepExecutionException("Cannot create target table without valid columns");
        }
        String ddl = "CREATE TABLE IF NOT EXISTS " + table + " ("
                + String.join(", ", valid.stream().map(c -> c + " TEXT").toList())
                + ", PRIMARY KEY (" + valid.getFirst() + "))";
        jdbcTemplate.execute(ddl);
    }

    private boolean validColumn(String column) {
        return column != null && IDENTIFIER.matcher(column).matches();
    }

    private static List<String> readColumns(JsonNode config, String field) {
        List<String> cols = new ArrayList<>();
        if (config.has(field) && config.get(field).isArray()) {
            config.get(field).forEach(n -> cols.add(n.asText()));
        }
        return cols;
    }

    @Data
    @Builder
    public static class LoadResult {
        private int totalRows;
        private int inserted;
        private int updated;
        private int rejected;
        private String targetTable;
        private String loadMode;
        private long durationMs;
    }
}
