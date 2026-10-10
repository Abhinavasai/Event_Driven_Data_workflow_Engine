package com.workflow.engine.domain.enums;

import com.fasterxml.jackson.annotation.JsonValue;

public enum FileType {
    CSV("csv"),
    JSON("json");

    private final String value;

    FileType(String value) {
        this.value = value;
    }

    @JsonValue
    public String getValue() {
        return value;
    }

    public static FileType fromValue(String value) {
        if (value == null) {
            throw new IllegalArgumentException("file_type is required");
        }
        return switch (value.toLowerCase()) {
            case "csv" -> CSV;
            case "json" -> JSON;
            default -> throw new IllegalArgumentException("Unsupported file type: " + value);
        };
    }
}
