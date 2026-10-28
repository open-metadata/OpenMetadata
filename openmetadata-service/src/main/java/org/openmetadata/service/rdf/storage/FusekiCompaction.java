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
    final Instant requestedAt = clock.instant();
    try {
      return new Run(serverBaseUrl, authenticate).awaitStarted(dataset, maxWait, requestedAt);
    } catch (IOException exception) {
      return CompactionResult.of(
          CompactionResult.Outcome.UNKNOWN, null, describe(exception), requestedAt, clock);
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

  private static CompactionResult.Outcome startFailure(final int status) {
    return status == 404 || status == 405
        ? CompactionResult.Outcome.UNSUPPORTED
        : CompactionResult.Outcome.FAILED;
  }

  /** One compaction against one server, with the credentials of the endpoint that asked. */
  private final class Run {
    private final String serverBaseUrl;
    private final UnaryOperator<HttpRequest.Builder> authenticate;

    Run(final String serverBaseUrl, final UnaryOperator<HttpRequest.Builder> authenticate) {
      this.serverBaseUrl = serverBaseUrl;
      this.authenticate = authenticate;
    }

    CompactionResult awaitStarted(
        final String dataset, final Duration maxWait, final Instant requestedAt)
        throws IOException, InterruptedException {
      final HttpResponse<String> started = start(dataset);
      final String taskId = started.statusCode() == 200 ? field(started.body(), "taskId") : null;
      if (taskId == null) {
        return CompactionResult.of(
            startFailure(started.statusCode()),
            null,
            "Fuseki did not start a compaction: HTTP "
                + started.statusCode()
                + " "
                + started.body(),
            requestedAt,
            clock);
      }
      LOG.info("Started compaction of Fuseki dataset '{}' (task {})", dataset, taskId);
      return poll(taskId, requestedAt, requestedAt.plus(maxWait));
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
        throws IOException, InterruptedException {
      TaskState state = taskState(taskId);
      while (state.outcome() == null && clock.instant().isBefore(deadline)) {
        sleeper.sleep(POLL_INTERVAL);
        state = taskState(taskId);
      }
      final CompactionResult.Outcome outcome =
          state.outcome() == null ? CompactionResult.Outcome.TIMED_OUT : state.outcome();
      return CompactionResult.of(outcome, taskId, state.detail(), requestedAt, clock);
    }

    private TaskState taskState(final String taskId) throws IOException, InterruptedException {
      final HttpResponse<String> response =
          send(
              serverBaseUrl + "/$/tasks/" + URLEncoder.encode(taskId, StandardCharsets.UTF_8),
              HttpRequest.Builder::GET);
      return response.statusCode() == 200
          ? TaskState.parse(response.body())
          : new TaskState(
              CompactionResult.Outcome.UNKNOWN,
              "Fuseki no longer reports task " + taskId + ": HTTP " + response.statusCode());
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
    final JsonNode value =
        body == null || body.isBlank() ? null : JsonUtils.readTree(body).get(name);
    return value == null || value.isNull() || value.asText().isBlank() ? null : value.asText();
  }

  private static String describe(final IOException exception) {
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
      final boolean ours = COMPACT_TASK.equals(field(body, "task"));
      final String success = field(body, "finished") == null ? null : field(body, "success");
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
