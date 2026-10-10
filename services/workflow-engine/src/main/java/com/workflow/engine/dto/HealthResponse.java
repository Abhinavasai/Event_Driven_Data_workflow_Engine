package com.workflow.engine.dto;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class HealthResponse {

    private String status;
    private String database;
    private String redis;
    private String fileWatcher;
    private String uptime;
}
