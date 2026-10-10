package com.workflow.engine.config;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Configuration;

@Configuration
@ConditionalOnProperty(prefix = "app.file-watch", name = "enabled", havingValue = "true", matchIfMissing = true)
public class FileWatcherConfig {
}
