package com.workflow.engine.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.opencsv.CSVReader;
import com.opencsv.CSVReaderBuilder;
import com.workflow.engine.exception.StepExecutionException;
import com.workflow.engine.exception.WorkflowFileNotFoundException;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class FileParserService {

    private final ObjectMapper objectMapper;

    public List<Map<String, Object>> parseCsv(String filePath, JsonNode config) {
        Path path = Path.of(filePath);
        if (!Files.exists(path)) {
            throw new WorkflowFileNotFoundException("File not found: " + filePath);
        }
        Charset charset = charset(config);
        char delimiter = config != null && config.has("delimiter")
                ? config.get("delimiter").asText(",").charAt(0)
                : ',';
        List<Map<String, Object>> rows = new ArrayList<>();
        try (CSVReader reader = new CSVReaderBuilder(new InputStreamReader(Files.newInputStream(path), charset))
                .withSkipLines(0)
                .build()) {
            String[] headers = reader.readNext();
            if (headers == null) {
                return rows;
            }
            headers = stripBom(headers);
            String[] line;
            while ((line = reader.readNext()) != null) {
                if (line.length == 0 || (line.length == 1 && line[0].isBlank())) {
                    continue;
                }
                Map<String, Object> row = new LinkedHashMap<>();
                for (int i = 0; i < headers.length; i++) {
                    String value = i < line.length ? line[i] : null;
                    row.put(headers[i].trim(), value);
                }
                rows.add(row);
            }
        } catch (IOException e) {
            throw new StepExecutionException("CSV parse failed: " + e.getMessage(), e);
        }
        return rows;
    }

    public List<Map<String, Object>> parseJson(String filePath, JsonNode config) {
        Path path = Path.of(filePath);
        if (!Files.exists(path)) {
            throw new WorkflowFileNotFoundException("File not found: " + filePath);
        }
        Charset charset = charset(config);
        try {
            String content = Files.readString(path, charset).trim();
            if (content.startsWith("[")) {
                return objectMapper.readValue(content, new TypeReference<>() {});
            }
            List<Map<String, Object>> rows = new ArrayList<>();
            try (BufferedReader reader = Files.newBufferedReader(path, charset)) {
                String line;
                while ((line = reader.readLine()) != null) {
                    if (line.isBlank()) {
                        continue;
                    }
                    rows.add(objectMapper.readValue(line, new TypeReference<>() {}));
                }
            }
            return rows;
        } catch (IOException e) {
            throw new StepExecutionException("JSON parse failed: " + e.getMessage(), e);
        }
    }

    private static Charset charset(JsonNode config) {
        if (config != null && config.has("encoding")) {
            return Charset.forName(config.get("encoding").asText("UTF-8"));
        }
        return StandardCharsets.UTF_8;
    }

    private static String[] stripBom(String[] headers) {
        if (headers.length > 0 && headers[0].startsWith("\uFEFF")) {
            headers[0] = headers[0].substring(1);
        }
        return headers;
    }
}
