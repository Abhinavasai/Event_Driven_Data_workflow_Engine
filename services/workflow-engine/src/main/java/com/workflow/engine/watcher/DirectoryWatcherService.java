package com.workflow.engine.watcher;

import com.workflow.engine.config.AppProperties;
import java.io.IOException;
import java.nio.file.FileSystems;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardWatchEventKinds;
import java.nio.file.WatchEvent;
import java.nio.file.WatchKey;
import java.nio.file.WatchService;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.SmartLifecycle;
import org.springframework.stereotype.Service;

@Service
@ConditionalOnProperty(prefix = "app.file-watch", name = "enabled", havingValue = "true", matchIfMissing = true)
@RequiredArgsConstructor
@Slf4j
public class DirectoryWatcherService implements SmartLifecycle {

    private final AppProperties appProperties;
    private final FileEventHandler fileEventHandler;

    private final AtomicBoolean running = new AtomicBoolean(false);
    private Thread watcherThread;
    private WatchService watchService;
    private final Map<WatchKey, Path> keys = new HashMap<>();

    @Override
    public void start() {
        if (!running.compareAndSet(false, true)) {
            return;
        }
        watcherThread = new Thread(this::watchLoop, "directory-watcher");
        watcherThread.setDaemon(true);
        watcherThread.start();
    }

    @Override
    public void stop() {
        running.set(false);
        if (watcherThread != null) {
            watcherThread.interrupt();
        }
        if (watchService != null) {
            try {
                watchService.close();
            } catch (IOException ignored) {
                // shutting down
            }
        }
    }

    @Override
    public boolean isRunning() {
        return running.get();
    }

    @Override
    public int getPhase() {
        return Integer.MAX_VALUE;
    }

    public boolean isActive() {
        return running.get();
    }

    private void watchLoop() {
        try {
            watchService = FileSystems.getDefault().newWatchService();
            for (String dir : appProperties.fileWatch().directories()) {
                Path path = Path.of(dir);
                if (!Files.isDirectory(path)) {
                    Files.createDirectories(path);
                }
                WatchKey key = path.register(watchService, StandardWatchEventKinds.ENTRY_CREATE);
                keys.put(key, path);
                log.info("Watching directory {}", path.toAbsolutePath());
            }
            while (running.get()) {
                WatchKey key = watchService.take();
                Path dir = keys.get(key);
                for (WatchEvent<?> event : key.pollEvents()) {
                    if (event.kind() != StandardWatchEventKinds.ENTRY_CREATE) {
                        continue;
                    }
                    Path child = dir.resolve((Path) event.context());
                    settleFile(child);
                    fileEventHandler.handleCreatedFile(child);
                }
                key.reset();
            }
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
        } catch (IOException ex) {
            log.error("Directory watcher failed: {}", ex.getMessage(), ex);
            running.set(false);
        }
    }

    private void settleFile(Path file) {
        long settle = appProperties.fileWatch().settleMs();
        long stableMs = 0;
        long lastSize = -1;
        while (stableMs < settle) {
            try {
                Thread.sleep(appProperties.fileWatch().pollIntervalMs());
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            }
            try {
                long size = Files.size(file);
                if (size == lastSize && size > 0) {
                    stableMs += appProperties.fileWatch().pollIntervalMs();
                } else {
                    stableMs = 0;
                    lastSize = size;
                }
            } catch (IOException ex) {
                stableMs = 0;
            }
        }
    }
}
