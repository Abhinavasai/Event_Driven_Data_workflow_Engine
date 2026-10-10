package com.workflow.engine.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.workflow.engine.exception.ValidationException;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.Builder;
import lombok.Data;
import org.springframework.stereotype.Service;

@Service
public class ValidationService {

    public ValidationResult validate(List<Map<String, Object>> rows, JsonNode validationConfig) {
        if (rows == null) {
            throw new ValidationException("No rows to validate");
        }
        List<String> requiredColumns = readStringList(validationConfig, "required_columns");
        JsonNode columnTypes = validationConfig != null ? validationConfig.path("column_types") : null;
        double maxErrorRate = validationConfig != null && validationConfig.has("max_error_rate")
                ? validationConfig.get("max_error_rate").asDouble(0.05)
                : 0.05;
        boolean rejectOnError = validationConfig != null && validationConfig.path("reject_on_error").asBoolean(false);

        Map<String, Integer> errorSummary = new HashMap<>();
        int invalidRows = 0;
        List<Map<String, Object>> validRows = new ArrayList<>();
        Set<String> seenKeys = new HashSet<>();
        List<String> keyColumns = readStringList(validationConfig, "key_columns");
        if (keyColumns.isEmpty() && validationConfig != null && validationConfig.has("duplicate_key_columns")) {
            keyColumns = readStringList(validationConfig, "duplicate_key_columns");
        }

        if (!rows.isEmpty() && !requiredColumns.isEmpty()) {
            Set<String> headerKeys = rows.getFirst().keySet();
            for (String col : requiredColumns) {
                if (!headerKeys.contains(col)) {
                    increment(errorSummary, "missing_columns");
                    throw new ValidationException("Missing required column: " + col);
                }
            }
        }

        int index = 0;
        for (Map<String, Object> row : rows) {
            List<String> rowErrors = new ArrayList<>();
            for (String col : requiredColumns) {
                Object value = row.get(col);
                if (value == null || String.valueOf(value).isBlank()) {
                    rowErrors.add("null_" + col);
                    increment(errorSummary, "null_" + col);
                }
            }
            if (columnTypes != null && columnTypes.isObject()) {
                Iterator<Map.Entry<String, JsonNode>> fields = columnTypes.fields();
                while (fields.hasNext()) {
                    Map.Entry<String, JsonNode> field = fields.next();
                    if (!validateType(row.get(field.getKey()), field.getValue().asText())) {
                        rowErrors.add("type_" + field.getKey());
                        increment(errorSummary, "type_" + field.getKey());
                    }
                }
            }
            if (!keyColumns.isEmpty()) {
                String key = compositeKey(row, keyColumns);
                if (!seenKeys.add(key)) {
                    rowErrors.add("duplicate_key");
                    increment(errorSummary, "duplicate_key");
                }
            }
            if (rowErrors.isEmpty()) {
                validRows.add(row);
            } else {
                invalidRows++;
            }
            index++;
        }

        int totalRows = rows.size();
        double errorRate = totalRows == 0 ? 0.0 : (double) invalidRows / totalRows;
        boolean passed = errorRate <= maxErrorRate && !(rejectOnError && invalidRows > 0);

        return ValidationResult.builder()
                .totalRows(totalRows)
                .validRows(validRows.size())
                .invalidRows(invalidRows)
                .validRowData(validRows)
                .errorSummary(errorSummary)
                .errorRate(errorRate)
                .passed(passed)
                .build();
    }

    private static boolean validateType(Object value, String type) {
        if (value == null || String.valueOf(value).isBlank()) {
            return true;
        }
        String text = String.valueOf(value);
        return switch (type.toLowerCase()) {
            case "string" -> true;
            case "integer", "int" -> text.matches("-?\\d+");
            case "decimal", "number", "float" -> {
                try {
                    new BigDecimal(text);
                    yield true;
                } catch (NumberFormatException ex) {
                    yield false;
                }
            }
            case "date", "datetime" -> {
                try {
                    LocalDate.parse(text.length() >= 10 ? text.substring(0, 10) : text);
                    yield true;
                } catch (DateTimeParseException ex) {
                    yield false;
                }
            }
            case "boolean" -> text.equalsIgnoreCase("true") || text.equalsIgnoreCase("false");
            default -> true;
        };
    }

    private static String compositeKey(Map<String, Object> row, List<String> keyColumns) {
        StringBuilder sb = new StringBuilder();
        for (String col : keyColumns) {
            sb.append('|').append(row.get(col));
        }
        return sb.toString();
    }

    private static void increment(Map<String, Integer> summary, String key) {
        summary.merge(key, 1, Integer::sum);
    }

    private static List<String> readStringList(JsonNode config, String field) {
        List<String> values = new ArrayList<>();
        if (config != null && config.has(field) && config.get(field).isArray()) {
            config.get(field).forEach(node -> values.add(node.asText()));
        }
        return values;
    }

    @Data
    @Builder
    public static class ValidationResult {
        private int totalRows;
        private int validRows;
        private int invalidRows;
        private List<Map<String, Object>> validRowData;
        private Map<String, Integer> errorSummary;
        private double errorRate;
        private boolean passed;
    }
}
