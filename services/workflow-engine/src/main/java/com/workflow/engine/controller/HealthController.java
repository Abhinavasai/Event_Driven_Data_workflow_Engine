package com.workflow.engine.controller;

import com.workflow.engine.dto.HealthResponse;
import java.lang.management.ManagementFactory;
import java.time.Duration;
import java.util.Optional;
import javax.sql.DataSource;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/internal")
@RequiredArgsConstructor
public class HealthController {

    private final DataSource dataSource;
    private final StringRedisTemplate stringRedisTemplate;
    private final ObjectProvider<com.workflow.engine.watcher.DirectoryWatcherService> directoryWatcherService;
    private final long startedAt = ManagementFactory.getRuntimeMXBean().getStartTime();

    @GetMapping("/health")
    public ResponseEntity<HealthResponse> health() {
        String db = checkDatabase();
        String redis = checkRedis();
        String watcher = Optional.ofNullable(directoryWatcherService.getIfAvailable())
                .map(w -> w.isActive() ? "running" : "stopped")
                .orElse("disabled");
        boolean ok = "connected".equals(db) && "connected".equals(redis);
        HealthResponse body = HealthResponse.builder()
                .status(ok ? "ok" : "degraded")
                .database(db)
                .redis(redis)
                .fileWatcher(watcher)
                .uptime(formatUptime())
                .build();
        return ok ? ResponseEntity.ok(body) : ResponseEntity.status(503).body(body);
    }

    private String checkDatabase() {
        try (var conn = dataSource.getConnection()) {
            return conn.isValid(2) ? "connected" : "disconnected";
        } catch (Exception ex) {
            return "disconnected";
        }
    }

    private String checkRedis() {
        try {
            String pong = stringRedisTemplate.execute(connection -> connection.ping());
            return pong == null ? "disconnected" : "connected";
        } catch (Exception ex) {
            return "disconnected";
        }
    }

    private String formatUptime() {
        long uptimeMs = System.currentTimeMillis() - startedAt;
        Duration d = Duration.ofMillis(uptimeMs);
        return d.toHours() + "h " + (d.toMinutesPart()) + "m " + d.toSecondsPart() + "s";
    }
}
