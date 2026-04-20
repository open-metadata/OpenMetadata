package org.openmetadata.service.apps.logging;

import java.io.BufferedWriter;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;

@Slf4j
public class RunLogBuffer {
  private static final int FLUSH_INTERVAL_SECONDS = 3;

  @Getter private final String appId;
  @Getter private final String appName;
  @Getter private final String serverId;
  @Getter private final long runTimestamp;
  @Getter private final Path logFile;
  private final int maxLines;
  private final ConcurrentLinkedQueue<String> pending = new ConcurrentLinkedQueue<>();
  private final AtomicInteger totalLineCount = new AtomicInteger(0);
  private ScheduledExecutorService flusher;
  private BufferedWriter writer;

  public RunLogBuffer(
      String appId,
      String appName,
      String serverId,
      long runTimestamp,
      int maxLines,
      Path logFile) {
    this.appId = appId;
    this.appName = appName;
    this.serverId = serverId;
    this.runTimestamp = runTimestamp;
    this.maxLines = maxLines;
    this.logFile = logFile;
  }

  public void append(String line) {
    int current;
    do {
      current = totalLineCount.get();
      if (current >= maxLines) {
        return;
      }
    } while (!totalLineCount.compareAndSet(current, current + 1));
    pending.offer(line);
  }

  void startFlusher() {
    try {
      Files.createDirectories(logFile.getParent());
      writer =
          Files.newBufferedWriter(
              logFile,
              StandardCharsets.UTF_8,
              StandardOpenOption.CREATE,
              StandardOpenOption.APPEND);
    } catch (IOException e) {
      LOG.error("Failed to open log file {}: {}", logFile, e.getMessage());
      return;
    }

    flusher =
        Executors.newSingleThreadScheduledExecutor(
            r -> {
              Thread t = new Thread(r, "app-run-log-flusher-" + appName);
              t.setDaemon(true);
              return t;
            });
    flusher.scheduleWithFixedDelay(
        this::flush, FLUSH_INTERVAL_SECONDS, FLUSH_INTERVAL_SECONDS, TimeUnit.SECONDS);
  }

  void flush() {
    List<String> batch = drainPending();
    if (batch.isEmpty()) {
      return;
    }
    String batchText = String.join("\n", batch);
    writeToFile(batchText);
  }

  public void close() {
    if (flusher != null) {
      flusher.shutdown();
      try {
        flusher.awaitTermination(5, TimeUnit.SECONDS);
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
      }
    }
    flush();
    closeWriter();
  }

  public List<String> getPendingLines() {
    return new ArrayList<>(pending);
  }

  public int getTotalLineCount() {
    return totalLineCount.get();
  }

  private List<String> drainPending() {
    List<String> batch = new ArrayList<>();
    String line;
    while ((line = pending.poll()) != null) {
      batch.add(line);
    }
    return batch;
  }

  private void writeToFile(String batchText) {
    if (writer == null) {
      return;
    }
    try {
      writer.write(batchText);
      writer.newLine();
      writer.flush();
    } catch (IOException e) {
      LOG.warn("Failed to write app run logs to {}: {}", logFile, e.getMessage());
    }
  }

  private void closeWriter() {
    if (writer != null) {
      try {
        writer.close();
      } catch (IOException e) {
        LOG.warn("Failed to close log writer for {}: {}", logFile, e.getMessage());
      }
    }
  }
}
