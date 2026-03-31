package org.openmetadata.service.apps.logging;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.LoggerContext;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.classic.spi.IThrowableProxy;
import ch.qos.logback.classic.spi.StackTraceElementProxy;
import ch.qos.logback.core.AppenderBase;
import java.io.IOException;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import org.slf4j.LoggerFactory;

/**
 * Logback appender that captures log events for internal app runs into per-run log files under
 * {@code ./logs/app-runs/{appName}/{runTimestamp}-{serverId}.log}.
 *
 * <p>Configured via the {@code logging:} section in {@code openmetadata.yaml}. Uses two-tier
 * matching: MDC for the scheduler thread, thread name prefixes for worker threads.
 */
public class AppRunLogAppender extends AppenderBase<ILoggingEvent> {
  public static final String MDC_APP_RUN_ID = "appRunId";
  public static final String MDC_APP_NAME = "appName";
  public static final String MDC_SERVER_ID = "serverId";
  public static final String MDC_APP_ID = "appId";

  private static final ConcurrentHashMap<String, RunLogBuffer> activeBuffers =
      new ConcurrentHashMap<>();

  private static final CopyOnWriteArrayList<ThreadPrefixBinding> threadPrefixBindings =
      new CopyOnWriteArrayList<>();

  private static String logDirectory = "./logs/app-runs";
  private static int maxLinesPerRun = 100_000;
  private static int maxRunsPerApp = 1;
  private static volatile boolean registered = false;

  @Override
  protected void append(ILoggingEvent event) {
    String runId = event.getMDCPropertyMap().get(MDC_APP_RUN_ID);
    if (runId != null) {
      String mdcAppName = event.getMDCPropertyMap().get(MDC_APP_NAME);
      if (mdcAppName != null) {
        RunLogBuffer buffer = activeBuffers.get(bufferKey(mdcAppName, runId));
        if (buffer != null) {
          buffer.append(formatLine(event));
          return;
        }
      }
    }

    if (!threadPrefixBindings.isEmpty()) {
      String threadName = event.getThreadName();
      for (ThreadPrefixBinding binding : threadPrefixBindings) {
        if (threadName.startsWith(binding.prefix)) {
          binding.buffer.append(formatLine(event));
          return;
        }
      }
    }
  }

  static String formatLine(ILoggingEvent event) {
    StringBuilder sb = new StringBuilder();
    sb.append(
        String.format(
            "{\"timestamp\":%d,\"level\":\"%s\",\"thread\":\"%s\",\"logger\":\"%s\",\"message\":\"%s\"",
            event.getTimeStamp(),
            event.getLevel(),
            escapeJson(event.getThreadName()),
            escapeJson(event.getLoggerName()),
            escapeJson(event.getFormattedMessage())));
    IThrowableProxy tp = event.getThrowableProxy();
    if (tp != null) {
      sb.append(",\"exception\":\"").append(escapeJson(formatThrowable(tp))).append("\"");
    }
    sb.append("}");
    return sb.toString();
  }

  private static String formatThrowable(IThrowableProxy proxy) {
    StringBuilder sb = new StringBuilder();
    Set<IThrowableProxy> seen =
        java.util.Collections.newSetFromMap(new java.util.IdentityHashMap<>());
    IThrowableProxy current = proxy;
    while (current != null && seen.add(current)) {
      if (sb.length() > 0) {
        sb.append("\nCaused by: ");
      }
      sb.append(current.getClassName()).append(": ").append(current.getMessage());
      for (StackTraceElementProxy step : current.getStackTraceElementProxyArray()) {
        sb.append("\n\tat ").append(step.getSTEAsString());
      }
      current = current.getCause();
    }
    return sb.toString();
  }

  private static String escapeJson(String value) {
    if (value == null) {
      return "";
    }
    return value
        .replace("\\", "\\\\")
        .replace("\"", "\\\"")
        .replace("\n", "\\n")
        .replace("\r", "\\r")
        .replace("\t", "\\t");
  }

  private static final String APPENDER_NAME = "APP_RUN_LOG";

  private static void ensureRegistered() {
    if (registered) {
      return;
    }
    synchronized (AppRunLogAppender.class) {
      if (registered) {
        return;
      }
      LoggerContext context = (LoggerContext) LoggerFactory.getILoggerFactory();
      Logger root = context.getLogger(Logger.ROOT_LOGGER_NAME);
      if (root.getAppender(APPENDER_NAME) != null) {
        registered = true;
        return;
      }
      AppRunLogAppender appender = new AppRunLogAppender();
      appender.setContext(context);
      appender.setName(APPENDER_NAME);
      appender.start();
      root.addAppender(appender);
      registered = true;
    }
  }

  public static String bufferKey(String appName, String runTimestamp) {
    return appName + "-" + runTimestamp;
  }

  /**
   * Start capturing logs for an app run.
   *
   * @param threadPrefixes thread name prefixes to capture (e.g. "reindex-", "om-field-fetch-").
   */
  public static RunLogBuffer startCapture(
      String appRunId, String appId, String appName, String serverId, String... threadPrefixes) {
    ensureRegistered();
    cleanupOldRuns(appName);
    long runTimestamp = Long.parseLong(appRunId);
    Path logFile = resolveLogFile(appName, runTimestamp, serverId);
    RunLogBuffer buffer =
        new RunLogBuffer(appId, appName, serverId, runTimestamp, maxLinesPerRun, logFile);
    activeBuffers.put(bufferKey(appName, appRunId), buffer);

    for (String prefix : threadPrefixes) {
      threadPrefixBindings.removeIf(b -> b.prefix.equals(prefix));
      threadPrefixBindings.add(new ThreadPrefixBinding(prefix, buffer));
    }

    buffer.startFlusher();
    return buffer;
  }

  public static void stopCapture(String appName, String appRunId) {
    RunLogBuffer buffer = activeBuffers.remove(bufferKey(appName, appRunId));
    if (buffer != null) {
      threadPrefixBindings.removeIf(b -> b.buffer == buffer);
      buffer.close();
    }
  }

  public static RunLogBuffer getBuffer(String appName, String runTimestamp) {
    return activeBuffers.get(bufferKey(appName, runTimestamp));
  }

  static void cleanupOldRuns(String appName) {
    List<Long> timestamps = listRunTimestamps(appName);
    if (timestamps.size() <= maxRunsPerApp) {
      return;
    }
    List<Long> toDelete = timestamps.subList(maxRunsPerApp, timestamps.size());
    Path appDir = resolveAppDir(appName);
    for (long ts : toDelete) {
      try (DirectoryStream<Path> stream = Files.newDirectoryStream(appDir, ts + "-*.log")) {
        for (Path entry : stream) {
          Files.deleteIfExists(entry);
        }
      } catch (IOException e) {
        // best-effort cleanup
      }
    }
  }

  static List<Long> listRunTimestamps(String appName) {
    Set<Long> timestamps = new TreeSet<>(Comparator.reverseOrder());
    Path appDir = resolveAppDir(appName);
    if (!Files.isDirectory(appDir)) {
      return new ArrayList<>();
    }
    try (DirectoryStream<Path> stream = Files.newDirectoryStream(appDir, "*.log")) {
      for (Path entry : stream) {
        String fileName = entry.getFileName().toString();
        int dashIdx = fileName.indexOf('-');
        if (dashIdx > 0) {
          try {
            timestamps.add(Long.parseLong(fileName.substring(0, dashIdx)));
          } catch (NumberFormatException ignored) {
            // skip malformed
          }
        }
      }
    } catch (IOException e) {
      // directory may not exist yet
    }
    return new ArrayList<>(timestamps);
  }

  private static Path resolveLogFile(String appName, long runTimestamp, String serverId) {
    Path base = Paths.get(logDirectory).toAbsolutePath().normalize();
    Path resolved =
        base.resolve(appName).resolve(runTimestamp + "-" + serverId + ".log").normalize();
    if (!resolved.startsWith(base)) {
      throw new IllegalArgumentException("Invalid path components");
    }
    return resolved;
  }

  private static Path resolveAppDir(String appName) {
    Path base = Paths.get(logDirectory).toAbsolutePath().normalize();
    Path resolved = base.resolve(appName).normalize();
    if (!resolved.startsWith(base)) {
      throw new IllegalArgumentException("Invalid path components");
    }
    return resolved;
  }

  static ConcurrentHashMap<String, RunLogBuffer> getActiveBuffers() {
    return activeBuffers;
  }

  static void setLogDirectoryForTest(String dir) {
    logDirectory = dir;
  }

  static void setMaxRunsPerAppForTest(int max) {
    maxRunsPerApp = max;
  }

  static void resetForTest() {
    registered = false;
    threadPrefixBindings.clear();
  }

  private static class ThreadPrefixBinding {
    final String prefix;
    final RunLogBuffer buffer;

    ThreadPrefixBinding(String prefix, RunLogBuffer buffer) {
      this.prefix = prefix;
      this.buffer = buffer;
    }
  }
}
