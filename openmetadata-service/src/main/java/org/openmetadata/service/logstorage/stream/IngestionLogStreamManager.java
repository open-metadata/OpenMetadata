/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.service.logstorage.stream;

import jakarta.ws.rs.sse.Sse;
import jakarta.ws.rs.sse.SseEventSink;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.ScheduledThreadPoolExecutor;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.services.ingestionPipelines.LogStreamEvent;
import org.openmetadata.schema.entity.services.ingestionPipelines.LogStreamEventType;
import org.openmetadata.service.logstorage.stream.IngestionLogTailer.LogStreamRun;
import org.openmetadata.service.sse.SseConnectionRegistry;

/**
 * Entry point for live log streaming: turns an HTTP Server-Sent Events request into a viewer on the
 * one {@link IngestionLogTailer} that follows the requested run.
 *
 * <p>Tailers are shared and reference counted. The first viewer of a run starts one, later viewers
 * of the same run join it, and the last one to leave stops it. That is what keeps a hundred open
 * browser tabs from turning into a hundred parallel readers against S3 or Airflow.
 *
 * <p>Both the number of concurrently tailed runs and the number of concurrently open connections
 * are capped; a request past either cap is answered with an {@code error} event rather than being
 * silently queued.
 */
@Slf4j
public final class IngestionLogStreamManager {

  private static final String TOO_MANY_RUNS =
      "The server is already streaming the maximum number of pipeline runs. Retry shortly or use the paginated log endpoint.";
  private static final String TOO_MANY_VIEWERS =
      "The server is already serving the maximum number of log stream connections. Retry shortly or use the paginated log endpoint.";
  private static final int ATTACH_ATTEMPTS = 2;
  private static final int HEARTBEAT_SECONDS = 25;
  private static final int RUNS_PER_POLL_THREAD = 25;
  private static final int MIN_POLL_THREADS = 2;
  private static final int MAX_POLL_THREADS = 16;

  private static final IngestionLogStreamManager INSTANCE =
      new IngestionLogStreamManager(LogStreamSettings.defaults());

  private final LogStreamSettings settings;
  private final Map<String, TailedRun> runs = new ConcurrentHashMap<>();
  private final ScheduledExecutorService scheduler;
  private final SseConnectionRegistry connections;

  IngestionLogStreamManager(LogStreamSettings settings) {
    this.settings = settings;
    this.scheduler = pollScheduler(settings);
    this.connections =
        new SseConnectionRegistry(
            "ingestion-logs", settings.maxActiveConnections(), HEARTBEAT_SECONDS);
  }

  /**
   * A poll reads a log backend over the network, so the pool is sized to how many runs the server
   * will tail rather than fixed. With too few threads a slow backend turns the configured poll delay
   * into a queueing delay for every other run being watched.
   */
  private static ScheduledExecutorService pollScheduler(LogStreamSettings settings) {
    final int threads =
        Math.clamp(
            Math.ceilDiv(settings.maxActiveRuns(), RUNS_PER_POLL_THREAD),
            MIN_POLL_THREADS,
            MAX_POLL_THREADS);
    final ScheduledThreadPoolExecutor executor =
        new ScheduledThreadPoolExecutor(threads, daemonThreadFactory());
    // A finished run cancels its poll; without this the cancelled task sits in the delay queue
    // until its next due time, so a server churning through runs accumulates dead tasks.
    executor.setRemoveOnCancelPolicy(true);
    return executor;
  }

  public static IngestionLogStreamManager getInstance() {
    return INSTANCE;
  }

  /**
   * Streams a run's logs to one client until the run ends or the client disconnects. Returns as
   * soon as the viewer is attached: delivery happens on the shared scheduler, never on the request
   * thread.
   */
  public void stream(LogStreamRequest request, SseEventSink sink, Sse sse) {
    final LogStreamSubscriber subscriber =
        new LogStreamSubscriber(sink, sse, settings.maxPendingBytesPerClient());
    final TailedRun tailed = acquire(request, subscriber);
    if (tailed == null) {
      reject(subscriber, request.run().runId(), TOO_MANY_RUNS);
    } else if (!connections.register(sink, sse, () -> tailed.tailer().detach(subscriber))) {
      tailed.tailer().detach(subscriber);
      reject(subscriber, request.run().runId(), TOO_MANY_VIEWERS);
    }
  }

  /**
   * Opens a stream only to explain on it why there is nothing to tail, then closes it. Reporting
   * the refusal as an event rather than an HTTP status keeps a client's stream handling on one path:
   * whatever goes wrong, it arrives as an event on the stream it already opened.
   */
  public void refuse(SseEventSink sink, Sse sse, String runId, String message) {
    reject(new LogStreamSubscriber(sink, sse, settings.maxPendingBytesPerClient()), runId, message);
  }

  public int activeRuns() {
    return runs.size();
  }

  /** Releases the scheduler, the connection registry and every tailer they drive. */
  void shutdown() {
    runs.values().forEach(TailedRun::cancel);
    runs.clear();
    scheduler.shutdownNow();
    connections.shutdown();
  }

  /**
   * Joins the run's tailer, starting one if this is the first viewer. A tailer that terminates
   * between lookup and attach is discarded and the attempt is retried against a fresh one.
   */
  private TailedRun acquire(LogStreamRequest request, LogStreamSubscriber subscriber) {
    TailedRun acquired = null;
    for (int attempt = 0; attempt < ATTACH_ATTEMPTS && acquired == null; attempt++) {
      final TailedRun candidate = runs.computeIfAbsent(request.key(), key -> build(key, request));
      if (candidate == null) {
        break;
      }
      if (candidate.tailer().attach(subscriber, request.run().startCursor())) {
        candidate.start(scheduler, settings.pollSeconds());
        acquired = candidate;
      } else {
        runs.remove(request.key(), candidate);
      }
    }
    return acquired;
  }

  private TailedRun build(String key, LogStreamRequest request) {
    TailedRun built = null;
    if (runs.size() < settings.maxActiveRuns()) {
      final TailedRun tailed = new TailedRun();
      tailed.bind(
          new IngestionLogTailer(
              request.run(), settings, System::nanoTime, () -> release(key, tailed)));
      built = tailed;
      LOG.debug("Started log tailer for {}", key);
    } else {
      LOG.warn("Refusing to tail {}: already tailing {} runs", key, runs.size());
    }
    return built;
  }

  private void release(String key, TailedRun tailed) {
    runs.remove(key, tailed);
    tailed.cancel();
    LOG.debug("Stopped log tailer for {}", key);
  }

  private void reject(LogStreamSubscriber subscriber, String runId, String message) {
    subscriber.send(
        new LogStreamEvent()
            .withEventType(LogStreamEventType.ERROR)
            .withRunId(runId)
            .withMessage(message));
    subscriber.close();
  }

  private static ThreadFactory daemonThreadFactory() {
    return runnable -> {
      final Thread thread = new Thread(runnable, "ingestion-log-tailer");
      thread.setDaemon(true);
      return thread;
    };
  }

  /** What a client asked to stream. */
  public record LogStreamRequest(String key, LogStreamRun run) {}

  /** A tailer plus the scheduled poll that drives it. */
  private static final class TailedRun {
    private IngestionLogTailer tailer;
    private ScheduledFuture<?> task;
    private boolean cancelled;

    synchronized void bind(IngestionLogTailer tailer) {
      this.tailer = tailer;
    }

    synchronized IngestionLogTailer tailer() {
      return tailer;
    }

    /** Schedules polling once, after the first viewer is attached, and never again. */
    synchronized void start(ScheduledExecutorService scheduler, int pollSeconds) {
      if (task == null && !cancelled) {
        task = scheduler.scheduleWithFixedDelay(tailer::poll, 0, pollSeconds, TimeUnit.SECONDS);
      }
    }

    synchronized void cancel() {
      cancelled = true;
      if (task != null) {
        task.cancel(false);
        task = null;
      }
    }
  }
}
