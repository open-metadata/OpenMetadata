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

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.Objects;
import java.util.function.LongSupplier;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.services.ingestionPipelines.LogStreamEndReason;
import org.openmetadata.schema.entity.services.ingestionPipelines.LogStreamEvent;
import org.openmetadata.schema.entity.services.ingestionPipelines.LogStreamEventType;
import org.openmetadata.service.logstorage.stream.LogTailSource.LogChunk;

/**
 * Reads one pipeline run's log forward and fans each new chunk out to every viewer of that run.
 *
 * <p>One tailer serves all viewers of a {@code (pipeline, run)} pair, so the load it puts on log
 * storage or on the pipeline service is a function of the run, never of how many browser tabs are
 * open. It reads only what it has not read yet, holds at most one page in heap, and stops on its
 * own once the run is finished, the stream goes silent, or a configured ceiling is reached — so no
 * stream can poll a backend forever.
 *
 * <p>The tailer does not schedule itself. {@link IngestionLogStreamManager} calls {@link #poll()}
 * on a shared scheduler, which keeps every timing decision testable without sleeping.
 */
@Slf4j
public final class IngestionLogTailer {

  private final LogStreamRun run;
  private final LogStreamSettings settings;
  private final LongSupplier nanoTime;
  private final Runnable onTerminate;

  private final List<LogStreamSubscriber> subscribers = new ArrayList<>();
  private final Deque<LogChunk> replay = new ArrayDeque<>();

  private final long startedAt;
  private long lastContentAt;
  private long lastProbeAt;
  private boolean probed;
  private RunState lastKnownState = RunState.RUNNING;
  private long replayBytes;
  private boolean replayTruncated;
  private long streamedBytes;
  private String cursor;
  private boolean terminated;
  private LogSourceUnavailableException sourceError;

  public IngestionLogTailer(
      LogStreamRun run, LogStreamSettings settings, LongSupplier nanoTime, Runnable onTerminate) {
    this.run = run;
    this.settings = settings;
    this.nanoTime = nanoTime;
    this.onTerminate = onTerminate;
    this.cursor = run.startCursor();
    this.startedAt = nanoTime.getAsLong();
    this.lastContentAt = startedAt;
    this.lastProbeAt = startedAt;
  }

  /**
   * Attaches a viewer resuming from {@code fromCursor}, replaying the backlog this tailer still
   * holds so a joiner is not missing the lines that were streamed before it connected. Returns
   * {@code false} when the stream has already ended, in which case the caller should start a fresh
   * one.
   */
  public synchronized boolean attach(LogStreamSubscriber subscriber, String fromCursor) {
    boolean attached = false;
    if (!terminated) {
      replayTo(subscriber, fromCursor);
      subscribers.add(subscriber);
      attached = true;
    }
    return attached;
  }

  /**
   * Replays what a joining viewer has not seen. A viewer whose cursor this tailer still holds is
   * given exactly the chunks after it. One whose cursor the tailer cannot place — older than the
   * replay buffer, or issued by a different stream of the same run — is given the whole buffer
   * flagged as truncated, which tells the client to reset its viewer to what it is about to receive
   * and backfill the earlier history from the paginated endpoint.
   */
  private void replayTo(LogStreamSubscriber subscriber, String fromCursor) {
    final List<LogChunk> missed = chunksAfter(fromCursor);
    if (missed == null) {
      subscriber.send(truncationNotice());
      replay.forEach(chunk -> subscriber.send(replayEvent(chunk)));
    } else {
      missed.forEach(chunk -> subscriber.send(replayEvent(chunk)));
    }
  }

  /**
   * The buffered chunks written after {@code fromCursor}, or {@code null} when this tailer cannot
   * place the cursor and therefore cannot tell what sits between it and the buffer.
   */
  private List<LogChunk> chunksAfter(String fromCursor) {
    final List<LogChunk> buffered = List.copyOf(replay);
    List<LogChunk> missed = null;
    if (!replayTruncated && Objects.equals(fromCursor, run.startCursor())) {
      missed = buffered;
    } else if (Objects.equals(fromCursor, cursor)) {
      missed = List.of();
    } else {
      final int delivered = indexOfCursor(buffered, fromCursor);
      missed = delivered < 0 ? null : buffered.subList(delivered + 1, buffered.size());
    }
    return missed;
  }

  private static int indexOfCursor(List<LogChunk> chunks, String cursor) {
    int found = -1;
    for (int position = 0; position < chunks.size() && found < 0; position++) {
      if (Objects.equals(chunks.get(position).cursor(), cursor)) {
        found = position;
      }
    }
    return found;
  }

  /** Detaches a viewer. The last one leaving ends the stream, so an unwatched run is never read. */
  public synchronized void detach(LogStreamSubscriber subscriber) {
    subscribers.remove(subscriber);
    if (subscribers.isEmpty()) {
      stop();
    }
  }

  /**
   * Reads whatever the run has produced since the previous call and applies the stop rules.
   *
   * <p>Never throws. This is the body of a repeating scheduled task, and an escaping exception
   * would cancel that task silently: the run would stay registered, holding one of the server's
   * tail slots, while its viewers waited on a stream nothing was writing to any more.
   */
  public synchronized void poll() {
    try {
      pollOnce();
    } catch (RuntimeException e) {
      LOG.error("Log stream for run {} failed and is being closed", run.runId(), e);
      abort();
    }
  }

  private void pollOnce() {
    if (!terminated) {
      final long bytes = drain();
      if (sourceError != null) {
        fail(sourceError.getMessage());
      } else {
        final LogStreamEndReason reason = terminated ? null : terminalReason(bytes);
        if (reason != null) {
          complete(reason);
        }
      }
    }
  }

  /**
   * Ends a stream whose source reported a failure that will not resolve on a later poll. Reported
   * as an {@code error} event rather than the silent close {@link #abort()} uses, so a persistent
   * backend failure (e.g. a Kubernetes client that cannot deserialize the cluster's response) is
   * visible to the viewer instead of looking like an idle stream.
   */
  private void fail(String message) {
    final LogStreamEvent event =
        new LogStreamEvent()
            .withEventType(LogStreamEventType.ERROR)
            .withRunId(run.runId())
            .withMessage(message);
    subscribers.forEach(
        subscriber -> {
          subscriber.send(event);
          subscriber.close();
        });
    subscribers.clear();
    stop();
  }

  /**
   * Ends a stream that cannot continue. Viewers are closed without a {@code complete} event, which
   * is their signal to reconnect from the last cursor they saw.
   */
  private void abort() {
    subscribers.forEach(LogStreamSubscriber::close);
    subscribers.clear();
    stop();
  }

  public synchronized boolean isTerminated() {
    return terminated;
  }

  public synchronized int viewerCount() {
    return subscribers.size();
  }

  public synchronized String cursor() {
    return cursor;
  }

  private long drain() {
    long bytes = 0;
    for (int read = 0; read < settings.maxReadsPerTick() && !terminated; read++) {
      final LogChunk chunk = readQuietly();
      if (chunk == null || (chunk.isEmpty() && Objects.equals(cursor, chunk.cursor()))) {
        break;
      }
      cursor = chunk.cursor();
      bytes += publish(chunk);
      if (bytes >= settings.maxBytesPerTick()) {
        break;
      }
    }
    if (bytes > 0) {
      streamedBytes += bytes;
      lastContentAt = nanoTime.getAsLong();
    }
    return bytes;
  }

  private long publish(LogChunk chunk) {
    long bytes = 0;
    if (!chunk.isEmpty()) {
      bytes = chunk.size();
      remember(chunk);
      broadcast(logsEvent(chunk.content(), false));
    }
    return bytes;
  }

  private LogChunk readQuietly() {
    LogChunk chunk = null;
    try {
      chunk = run.source().readNext();
    } catch (LogSourceUnavailableException e) {
      // Distinct from the transient/no-content case below: this failure will not resolve on a
      // later poll, so it is surfaced to the viewer instead of being retried into an idle timeout.
      sourceError = e;
    } catch (Exception e) {
      // A backend that has no log file yet answers with an error rather than an empty page, and a
      // transient outage looks identical. Neither is fatal: the run either produces content on a
      // later poll or the idle backstop ends the stream.
      LOG.debug("No log content for run {} on this poll: {}", run.runId(), e.getMessage());
    }
    return chunk;
  }

  private void remember(LogChunk chunk) {
    replay.addLast(chunk);
    replayBytes += chunk.size();
    while (replayBytes > settings.maxReplayBytes() && replay.size() > 1) {
      replayBytes -= replay.removeFirst().size();
      replayTruncated = true;
    }
  }

  private void broadcast(LogStreamEvent event) {
    subscribers.removeIf(subscriber -> !deliver(subscriber, event));
    if (subscribers.isEmpty()) {
      stop();
    }
  }

  /**
   * A viewer that cannot take the event is dropped and its connection closed right away, rather
   * than left open for the heartbeat sweep to notice. The client sees the stream end without a
   * {@code complete} event, which is its signal to reconnect from the last cursor it saw.
   */
  private boolean deliver(LogStreamSubscriber subscriber, LogStreamEvent event) {
    final boolean delivered = subscriber.send(event);
    if (!delivered) {
      subscriber.close();
    }
    return delivered;
  }

  private LogStreamEndReason terminalReason(long bytesThisTick) {
    LogStreamEndReason reason = null;
    if (streamedBytes >= settings.maxStreamBytes()) {
      reason = LogStreamEndReason.MAX_BYTES;
    } else if (secondsSince(startedAt) >= settings.maxStreamSeconds()) {
      reason = LogStreamEndReason.MAX_DURATION;
    } else if (secondsSince(lastContentAt) >= settings.maxIdleSeconds()) {
      reason = LogStreamEndReason.IDLE_TIMEOUT;
    } else if (bytesThisTick == 0 && quietLongEnoughToClose(runState())) {
      reason = LogStreamEndReason.RUN_FINISHED;
    }
    return reason;
  }

  /**
   * How long the log must stay quiet before the stream closes. A run the status rows confirm is
   * over only needs the short grace — one last flush. A run they say nothing about gets a longer
   * one: "no status row" also describes a run triggered seconds ago that has not written its first
   * line yet, and closing that one on the short grace would tell a user the run is over before it
   * has begun. A run that is still going is never closed here at all.
   */
  private boolean quietLongEnoughToClose(RunState state) {
    return switch (state) {
      case RUNNING -> false;
      case FINISHED -> secondsSince(lastContentAt) >= settings.finishGraceSeconds();
      case UNKNOWN -> secondsSince(lastContentAt) >= settings.unknownRunGraceSeconds();
    };
  }

  /**
   * The run's state. Looked up at most once per {@code runProbeSeconds} and never again once
   * terminal, so a long stream cannot turn into a stream of status queries.
   */
  private RunState runState() {
    if (lastKnownState != RunState.FINISHED
        && (!probed || secondsSince(lastProbeAt) >= settings.runProbeSeconds())) {
      lastProbeAt = nanoTime.getAsLong();
      probed = true;
      lastKnownState = probeRunState();
    }
    return lastKnownState;
  }

  /**
   * A state lookup that fails leaves the run "still running": the idle backstop ends the stream
   * anyway, whereas treating a database hiccup as "finished" would cut a live run's log short.
   */
  private RunState probeRunState() {
    RunState state = RunState.RUNNING;
    try {
      state = run.runState().get();
    } catch (RuntimeException e) {
      LOG.debug("Could not read the state of run {}: {}", run.runId(), e.getMessage());
    }
    return state;
  }

  private void complete(LogStreamEndReason reason) {
    final LogStreamEvent event =
        new LogStreamEvent()
            .withEventType(LogStreamEventType.COMPLETE)
            .withRunId(run.runId())
            .withAfter(cursor)
            .withReason(reason)
            .withMessage(message(reason));
    subscribers.forEach(
        subscriber -> {
          subscriber.send(event);
          subscriber.close();
        });
    subscribers.clear();
    stop();
  }

  private void stop() {
    if (!terminated) {
      terminated = true;
      replay.clear();
      replayBytes = 0;
      onTerminate.run();
    }
  }

  private LogStreamEvent logsEvent(String content, boolean replayed) {
    return new LogStreamEvent()
        .withEventType(LogStreamEventType.LOGS)
        .withRunId(run.runId())
        .withLogs(content)
        .withAfter(cursor)
        .withReplay(replayed);
  }

  private LogStreamEvent replayEvent(LogChunk chunk) {
    return logsEvent(chunk.content(), true).withAfter(chunk.cursor());
  }

  /**
   * Warns a joining viewer that the backlog it is about to receive is not the whole story. It
   * carries no cursor on purpose: the content it refers to sits <em>before</em> everything this
   * tailer can still replay, so resuming from here would skip what the viewer is being told to go
   * and fetch.
   */
  private LogStreamEvent truncationNotice() {
    return new LogStreamEvent()
        .withEventType(LogStreamEventType.LOGS)
        .withRunId(run.runId())
        .withLogs("")
        .withReplay(true)
        .withTruncated(true);
  }

  private long secondsSince(long timestamp) {
    return (nanoTime.getAsLong() - timestamp) / 1_000_000_000L;
  }

  private static String message(LogStreamEndReason reason) {
    return switch (reason) {
      case RUN_FINISHED -> null;
      case MAX_BYTES -> "Stream size limit reached. Download the full log to see the rest of this run.";
      case MAX_DURATION -> "Stream lifetime limit reached. Reconnect with the last cursor to resume.";
      case IDLE_TIMEOUT -> "No new logs for this run. Reconnect with the last cursor to resume.";
    };
  }

  /** Everything a tailer needs to follow one run. */
  public record LogStreamRun(
      String runId, LogTailSource source, Supplier<RunState> runState, String startCursor) {}

  /**
   * What the server knows about a streamed run. {@link #UNKNOWN} is its own case rather than a
   * synonym for finished: only a few recent runs keep a status row, so "no row" covers both a run
   * that aged out and one that was triggered a moment ago.
   */
  public enum RunState {
    RUNNING,
    FINISHED,
    UNKNOWN
  }
}
