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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Pins how a Fuseki compaction is reported against a stub admin API: only a compaction task that
 * says it succeeded counts as success, because a compaction that silently fails leaves the store
 * growing until its disk is full.
 */
@DisplayName("Fuseki compaction")
class FusekiCompactionTest {
  private static final String STARTED = "{\"taskId\":\"7\",\"requestId\":12}";
  private static final String RUNNING =
      "{\"task\":\"Compact\",\"taskId\":\"7\",\"started\":\"2026-10-28T10:00:00.000+00:00\"}";

  private HttpServer server;
  private final List<String> requests = new CopyOnWriteArrayList<>();
  private final AtomicReference<Reply> compactReply = new AtomicReference<>();
  private final List<Reply> taskReplies = new CopyOnWriteArrayList<>();
  private final MutableClock clock = new MutableClock();

  @BeforeEach
  void startStub() throws IOException {
    server = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
    server.createContext("/", this::handle);
    server.start();
    compactReply.set(new Reply(200, STARTED));
  }

  @AfterEach
  void stopStub() {
    server.stop(0);
  }

  @Test
  void reportsSuccessOnlyWhenTheTaskSaysSo() {
    taskReplies.add(new Reply(200, RUNNING));
    taskReplies.add(new Reply(200, finished(true)));

    final CompactionResult result = compact(Duration.ofMinutes(10));

    assertEquals(CompactionResult.Outcome.SUCCEEDED, result.outcome());
    assertEquals("7", result.taskId());
    assertEquals(
        List.of("POST /$/compact/collate?deleteOld=true", "GET /$/tasks/7", "GET /$/tasks/7"),
        requests);
  }

  @Test
  void reportsAFailedCompactionAsFailed() {
    taskReplies.add(new Reply(200, finished(false)));

    assertEquals(CompactionResult.Outcome.FAILED, compact(Duration.ofMinutes(10)).outcome());
  }

  @Test
  void keepsPollingWhileFinishedIsPublishedBeforeSuccess() {
    taskReplies.add(
        new Reply(
            200, "{\"task\":\"Compact\",\"taskId\":\"7\",\"finished\":\"2026-10-28T10:01:00Z\"}"));
    taskReplies.add(new Reply(200, finished(true)));

    assertEquals(CompactionResult.Outcome.SUCCEEDED, compact(Duration.ofMinutes(10)).outcome());
  }

  @Test
  void aTaskFusekiNoLongerKnowsIsUnknownNotSuccess() {
    taskReplies.add(new Reply(404, ""));

    final CompactionResult result = compact(Duration.ofMinutes(10));

    assertEquals(CompactionResult.Outcome.UNKNOWN, result.outcome());
    assertTrue(result.detail().contains("no longer reports task 7"));
  }

  @Test
  void aFailedPollKeepsWaitingBecauseFusekiKeepsCompacting() {
    taskReplies.add(new Reply(503, "Service Unavailable"));
    taskReplies.add(new Reply(200, finished(true)));

    assertEquals(CompactionResult.Outcome.SUCCEEDED, compact(Duration.ofMinutes(10)).outcome());
  }

  @Test
  void reportsWhetherACompactionIsStillRunning() {
    taskReplies.add(new Reply(200, "[" + RUNNING + "," + finished(true) + "]"));
    assertTrue(isCompacting());

    taskReplies.clear();
    taskReplies.add(new Reply(200, "[" + finished(true) + "]"));
    assertFalse(isCompacting());

    server.stop(0);
    assertFalse(isCompacting(), "an unreachable Fuseki cannot be said to compact");
  }

  @Test
  void aDifferentTaskUnderOurIdIsUnknown() {
    taskReplies.add(
        new Reply(
            200, "{\"task\":\"Backup\",\"taskId\":\"7\",\"finished\":\"x\",\"success\":true}"));

    assertEquals(CompactionResult.Outcome.UNKNOWN, compact(Duration.ofMinutes(10)).outcome());
  }

  @Test
  void stopsWaitingAtTheDeadlineAndSaysTheTaskMayStillRun() {
    taskReplies.add(new Reply(200, RUNNING));

    final CompactionResult result = compact(Duration.ofSeconds(5));

    assertEquals(CompactionResult.Outcome.TIMED_OUT, result.outcome());
    assertEquals(Duration.ofSeconds(6), result.elapsed());
  }

  @Test
  void aServerWithoutTheCompactEndpointIsUnsupported() {
    compactReply.set(new Reply(404, "Not Found"));

    assertEquals(CompactionResult.Outcome.UNSUPPORTED, compact(Duration.ofMinutes(1)).outcome());
  }

  @Test
  void aRefusedCompactionIsFailed() {
    compactReply.set(new Reply(400, "Async task request rejected - exceeds the limit of 4 tasks"));

    final CompactionResult result = compact(Duration.ofMinutes(1));

    assertEquals(CompactionResult.Outcome.FAILED, result.outcome());
    assertTrue(result.detail().contains("HTTP 400"));
  }

  @Test
  void anUnreachableServerIsUnknown() {
    server.stop(0);

    assertEquals(CompactionResult.Outcome.UNKNOWN, compact(Duration.ofMinutes(1)).outcome());
  }

  private boolean isCompacting() {
    return compaction()
        .isCompacting(
            "http://localhost:" + server.getAddress().getPort(),
            builder -> builder.header("Authorization", "Basic test"));
  }

  private FusekiCompaction compaction() {
    return new FusekiCompaction(
        HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(2)).build(),
        clock,
        clock::advance);
  }

  private CompactionResult compact(final Duration maxWait) {
    final FusekiCompaction compaction = compaction();
    return compaction.compact(
        "http://localhost:" + server.getAddress().getPort(),
        "collate",
        maxWait,
        builder -> builder.header("Authorization", "Basic test"));
  }

  private static String finished(final boolean success) {
    return "{\"task\":\"Compact\",\"taskId\":\"7\",\"started\":\"2026-10-28T10:00:00Z\","
        + "\"finished\":\"2026-10-28T10:01:00Z\",\"success\":"
        + success
        + "}";
  }

  private void handle(final HttpExchange exchange) throws IOException {
    final String query = exchange.getRequestURI().getRawQuery();
    requests.add(
        exchange.getRequestMethod()
            + " "
            + exchange.getRequestURI().getPath()
            + (query == null ? "" : "?" + query));
    final Reply reply =
        exchange.getRequestURI().getPath().startsWith("/$/compact/")
            ? compactReply.get()
            : nextTaskReply();
    final byte[] body = reply.body().getBytes(StandardCharsets.UTF_8);
    exchange.sendResponseHeaders(reply.status(), body.length == 0 ? -1 : body.length);
    if (body.length > 0) {
      exchange.getResponseBody().write(body);
    }
    exchange.close();
  }

  /** The last configured reply repeats, like a task that keeps reporting the same state. */
  private Reply nextTaskReply() {
    return taskReplies.size() > 1 ? taskReplies.removeFirst() : taskReplies.getFirst();
  }

  private record Reply(int status, String body) {}

  private static final class MutableClock extends Clock {
    private Instant now = Instant.parse("2026-10-28T10:00:00Z");

    void advance(final Duration duration) {
      now = now.plus(duration);
    }

    @Override
    public Instant instant() {
      return now;
    }

    @Override
    public ZoneOffset getZone() {
      return ZoneOffset.UTC;
    }

    @Override
    public Clock withZone(final java.time.ZoneId zone) {
      return this;
    }
  }
}
