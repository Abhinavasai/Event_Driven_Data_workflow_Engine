package com.workflow.engine.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class ValidationServiceTest {

    private final ValidationService validationService = new ValidationService();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void passesWhenRowsMeetSchema() throws Exception {
        ArrayNode config = objectMapper.createArrayNode();
        var validation = objectMapper.createObjectNode();
        ArrayNode required = validation.putArray("required_columns");
        required.add("order_id");
        required.add("amount");
        validation.put("max_error_rate", 0.1);

        List<Map<String, Object>> rows = List.of(
                Map.of("order_id", "1", "amount", "10.5"),
                Map.of("order_id", "2", "amount", "20"));

        ValidationService.ValidationResult result = validationService.validate(rows, validation);
        assertTrue(result.isPassed());
        assertTrue(result.getValidRows() == 2);
    }

    @Test
    void failsWhenErrorRateTooHigh() {
        var validation = objectMapper.createObjectNode();
        validation.putArray("required_columns").add("order_id");
        validation.put("max_error_rate", 0.0);

        List<Map<String, Object>> rows = List.of(Map.of("amount", "1"));
        ValidationService.ValidationResult result = validationService.validate(rows, validation);
        assertFalse(result.isPassed());
    }
}
