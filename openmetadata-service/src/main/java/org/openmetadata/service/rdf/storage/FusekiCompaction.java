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
package org.openmetadata.service.rdf.storage;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.function.UnaryOperator;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.exception.JsonParsingException;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Runs a TDB2 compaction through Fuseki's admin API and reports what really happened.
 *
 * <p>Compaction is the only way TDB2 returns disk: every write transaction copies the index pages
 * it touches and leaves the old ones behind. Fuseki runs it as an asynchronous task that blocks
 * writers to the dataset for the whole copy, so the caller must know whether it succeeded, failed,
 * is still running, or can no longer be traced. Fuseki keeps finished tasks only in memory, numbers
 * them from 1 after every restart, and forgets the oldest, so a task that disappears or changes
 * name is reported as {@link CompactionResult.Outcome#UNKNOWN}, never as a success.
 */
@Slf4j
public final class FusekiCompaction {
  static final String COMPACT_TASK = "Compact";
  private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(30);
  private static final Duration POLL_INTERVAL = Duration.ofSeconds(2);

  private final HttpClient httpClient;
  private final Clock clock;
  private final Sleeper sleeper;

  FusekiCompaction(final HttpClient httpClient, final Clock clock, final Sleeper sleeper) {
    this.httpClient = httpClient;
    this.clock = clock;
    this.sleeper = sleeper;
  }

  /** Compacts {@code dataset}, deleting the old generation once the new one is in service. */
  public CompactionResult compact(
      final String serverBaseUrl,
      final String dataset,
      final Duration maxWait,
      final UnaryOperator<HttpRequest.Builder> authenticate) {
    return compact(serverBaseUrl, dataset, maxWait, authenticate, false);
  }

  /** Keeps observing the same task after the budget, so its caller can keep serving writes paused. */
  public CompactionResult compactAndAwait(
      final String serverBaseUrl,
      final String dataset,
      final Duration warningAfter,
      final UnaryOperator<HttpRequest.Builder> authenticate) {
    return compact(serverBaseUrl, dataset, warningAfter, authenticate, true);
  }

  private CompactionResult compact(
      final String serverBaseUrl,
      final String dataset,
      final Duration maxWait,
      final UnaryOperator<HttpRequest.Builder> authenticate,
      final boolean awaitCompletion) {
    final Instant requestedAt = clock.instant();
    try {
      return new Run(serverBaseUrl, authenticate, awaitCompletion)
          .awaitStarted(dataset, maxWait, requestedAt);
    } catch (InterruptedException exception) {
      Thread.currentThread().interrupt();
      return CompactionResult.of(
          CompactionResult.Outcome.UNKNOWN,
          null,
          "Interrupted while compacting; the task may still be running",
          requestedAt,
          clock);
    }
  }

  /**
   * Whether Fuseki is still compacting a dataset, whoever started it. Fuseki blocks writers for the
   * whole copy, so a write that timed out meanwhile was held up by maintenance, not refused.
   */
  public boolean isCompacting(
      final String serverBaseUrl, final UnaryOperator<HttpRequest.Builder> authenticate) {
    boolean compacting = false;
    try {
      compacting = new Run(serverBaseUrl, authenticate, false).isCompacting();
    } catch (InterruptedException exception) {
      Thread.currentThread().interrupt();
    }
    return compacting;
  }

  static boolean anyRunningCompaction(final String body) {
    final JsonNode tasks = parse(body);
    boolean running = false;
    if (tasks != null && tasks.isArray()) {
      for (final JsonNode task : tasks) {
        running |= COMPACT_TASK.equals(task.path("task").asText()) && !task.hasNonNull("finished");
      }
    }
    return running;
  }

  private static CompactionResult.Outcome startFailure(final int status) {
    return switch (status) {
      case 404, 405 -> CompactionResult.Outcome.UNSUPPORTED;
      default -> status == 200 || status == 408 || status >= 500
          ? CompactionResult.Outcome.UNKNOWN
          : CompactionResult.Outcome.FAILED;
    };
  }

  /** One compaction against one server, with the credentials of the endpoint that asked. */
  private final class Run {
    private final String serverBaseUrl;
    private final UnaryOperator<HttpRequest.Builder> authenticate;
    private final boolean awaitCompletion;

    Run(
        final String serverBaseUrl,
        final UnaryOperator<HttpRequest.Builder> authenticate,
        final boolean awaitCompletion) {
      this.serverBaseUrl = serverBaseUrl;
      this.authenticate = authenticate;
      this.awaitCompletion = awaitCompletion;
    }

    CompactionResult awaitStarted(
        final String dataset, final Duration maxWait, final Instant requestedAt)
        throws InterruptedException {
      try {
        return track(start(dataset), maxWait, requestedAt);
      } catch (IOException exception) {
        return untracked(CompactionResult.Outcome.UNKNOWN, describe(exception), requestedAt);
      }
    }

    private CompactionResult track(
        final HttpResponse<String> started, final Duration maxWait, final Instant requestedAt)
        throws InterruptedException {
      final String taskId = started.statusCode() == 200 ? field(started.body(), "taskId") : null;
      if (taskId == null) {
        return untracked(
            startFailure(started.statusCode()),
            "Fuseki did not return a compaction task: HTTP "
                + started.statusCode()
                + " "
                + started.body(),
            requestedAt);
      }
      LOG.info("Started Fuseki compaction task {}", taskId);
      return poll(taskId, requestedAt, requestedAt.plus(maxWait));
    }

    private CompactionResult untracked(
        final CompactionResult.Outcome outcome, final String detail, final Instant requestedAt)
        throws InterruptedException {
      if (awaitCompletion && outcome == CompactionResult.Outcome.UNKNOWN) {
        LOG.warn(
            "{}; keeping serving writes paused until Fuseki reports no running compaction", detail);
        while (!Boolean.FALSE.equals(runningCompaction())) {
          sleeper.sleep(POLL_INTERVAL);
        }
      }
      return CompactionResult.of(outcome, null, detail, requestedAt, clock);
    }

    private HttpResponse<String> start(final String dataset)
        throws IOException, InterruptedException {
      final String url =
          serverBaseUrl
              + "/$/compact/"
              + URLEncoder.encode(dataset, StandardCharsets.UTF_8)
              + "?deleteOld=true";
      return send(url, builder -> builder.POST(HttpRequest.BodyPublishers.noBody()));
    }

    private CompactionResult poll(
        final String taskId, final Instant requestedAt, final Instant deadline)
        throws InterruptedException {
      TaskState state = taskState(taskId);
      boolean warned = false;
      while (state.outcome() == null && (awaitCompletion || clock.instant().isBefore(deadline))) {
        if (awaitCompletion && !warned && !clock.instant().isBefore(deadline)) {
          LOG.error(
              "Fuseki compaction task {} exceeded its budget; keeping serving writes paused until it ends",
              taskId);
          warned = true;
        }
        sleeper.sleep(POLL_INTERVAL);
        state = taskState(taskId);
      }
      final CompactionResult.Outcome outcome =
          state.outcome() == null ? CompactionResult.Outcome.TIMED_OUT : state.outcome();
      return CompactionResult.of(outcome, taskId, state.detail(), requestedAt, clock);
    }

    /**
     * Fuseki keeps compacting while it cannot answer, so only its own answer ends the wait: a poll
     * that fails counts as still running. A task Fuseki no longer knows did not survive a restart.
     */
    private TaskState taskState(final String taskId) throws InterruptedException {
      try {
        final HttpResponse<String> response =
            send(
                serverBaseUrl + "/$/tasks/" + URLEncoder.encode(taskId, StandardCharsets.UTF_8),
                HttpRequest.Builder::GET);
        return switch (response.statusCode()) {
          case 200 -> TaskState.parse(response.body());
          case 404 -> new TaskState(
              CompactionResult.Outcome.UNKNOWN, "Fuseki no longer reports task " + taskId);
          default -> new TaskState(
              null, "Fuseki answered HTTP " + response.statusCode() + " for task " + taskId);
        };
      } catch (IOException exception) {
        return new TaskState(null, describe(exception));
      }
    }

    /** Whether Fuseki reports a compaction that has not finished; false when it cannot tell. */
    boolean isCompacting() throws InterruptedException {
      return Boolean.TRUE.equals(runningCompaction());
    }

    private Boolean runningCompaction() throws InterruptedException {
      try {
        final HttpResponse<String> response =
            send(serverBaseUrl + "/$/tasks", HttpRequest.Builder::GET);
        final JsonNode tasks = response.statusCode() == 200 ? parse(response.body()) : null;
        return tasks != null && tasks.isArray() ? anyRunningCompaction(response.body()) : null;
      } catch (IOException exception) {
        return null;
      }
    }

    private HttpResponse<String> send(
        final String url, final UnaryOperator<HttpRequest.Builder> method)
        throws IOException, InterruptedException {
      final HttpRequest.Builder builder =
          method.apply(
              HttpRequest.newBuilder()
                  .uri(URI.create(url))
                  .timeout(REQUEST_TIMEOUT)
                  .header("Accept", "application/json"));
      return httpClient.send(
          authenticate.apply(builder).build(), HttpResponse.BodyHandlers.ofString());
    }
  }

  static String field(final String body, final String name) {
    return field(parse(body), name);
  }

  private static String field(final JsonNode body, final String name) {
    final JsonNode value = body == null ? null : body.get(name);
    return value == null || value.isNull() || value.asText().isBlank() ? null : value.asText();
  }

  private static JsonNode parse(final String body) {
    try {
      return body == null || body.isBlank() ? null : JsonUtils.readTree(body);
    } catch (JsonParsingException exception) {
      return null;
    }
  }

  private static String describe(final Exception exception) {
    return "Lost contact with Fuseki while compacting; the task may still be running: "
        + exception.getMessage();
  }

  /**
   * One poll of a Fuseki task. A task under our id that is not a compaction belongs to a Fuseki that
   * restarted and renumbered its tasks. {@code success} is read only once {@code finished} is set,
   * because Fuseki publishes the two separately; a null outcome means still running.
   */
  record TaskState(CompactionResult.Outcome outcome, String detail) {
    static TaskState parse(final String body) {
      final JsonNode task = FusekiCompaction.parse(body);
      if (task == null || !task.isObject() || field(task, "task") == null) {
        return new TaskState(null, "Unreadable Fuseki task response: " + body);
      }
      final boolean ours = COMPACT_TASK.equals(field(task, "task"));
      final String success = field(task, "finished") == null ? null : field(task, "success");
      return new TaskState(ours ? outcome(success) : CompactionResult.Outcome.UNKNOWN, body);
    }

    private static CompactionResult.Outcome outcome(final String success) {
      return success == null
          ? null
          : Boolean.parseBoolean(success)
              ? CompactionResult.Outcome.SUCCEEDED
              : CompactionResult.Outcome.FAILED;
    }
  }

  @FunctionalInterface
  interface Sleeper {
    void sleep(Duration duration) throws InterruptedException;
  }
}
