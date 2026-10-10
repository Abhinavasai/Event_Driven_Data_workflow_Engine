package com.workflow.engine.service;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class FileParserServiceTest {

    private final FileParserService fileParserService = new FileParserService(new ObjectMapper());

    @TempDir
    Path tempDir;

    @Test
    void parseCsvReadsHeadersAndRows() throws Exception {
        Path csv = tempDir.resolve("orders.csv");
        Files.writeString(csv, "order_id,amount\n1,10\n2,20\n");
        List<Map<String, Object>> rows = fileParserService.parseCsv(csv.toString(), null);
        assertEquals(2, rows.size());
        assertEquals("1", rows.get(0).get("order_id"));
    }

    @Test
    void parseJsonArray() throws Exception {
        Path json = tempDir.resolve("data.json");
        Files.writeString(json, "[{\"id\":1},{\"id\":2}]");
        List<Map<String, Object>> rows = fileParserService.parseJson(json.toString(), null);
        assertEquals(2, rows.size());
    }
}
