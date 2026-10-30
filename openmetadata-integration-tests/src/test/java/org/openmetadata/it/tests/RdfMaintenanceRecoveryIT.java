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
package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.util.ArrayList;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import org.jdbi.v3.core.Handle;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.rdf.RdfDatasetNames;
import org.openmetadata.service.rdf.RdfLiveWrite;
import org.openmetadata.service.rdf.RdfLiveWriteStore;
import org.openmetadata.service.rdf.rebuild.RdfDatasetManager;
import org.openmetadata.service.rdf.rebuild.RdfLiveWritePause;
import org.openmetadata.service.rdf.rebuild.RdfRebuildStore;
import org.openmetadata.service.rdf.rebuild.RdfWriteDelivery;
import org.openmetadata.service.rdf.storage.CompactionResult;
import org.openmetadata.service.rdf.storage.JenaFusekiStorage;

/** SQL delivery fences against a Fuseki admin API that loses contact after accepting compaction. */
@Tag("rdf")
@EnabledIfSystemProperty(named = "enableRdf", matches = "true")
@Execution(ExecutionMode.SAME_THREAD)
public class RdfMaintenanceRecoveryIT {
  private static final String LEGACY_WRITER_LOCK =
      "SELECT id FROM rdf_live_write_guard WHERE id = 'drain' FOR UPDATE SKIP LOCKED";
  private static final String UPDATE = "INSERT DATA { <urn:s> <urn:p> <urn:o> }";
  private static final Map<RdfTestDatabase.Backend, RdfTestDatabase> DATABASES =
      new EnumMap<>(RdfTestDatabase.Backend.class);

  @BeforeAll
  static void startDatabases() {
    for (final RdfTestDatabase.Backend backend : RdfTestDatabase.Backend.values()) {
      DATABASES.put(backend, new RdfTestDatabase(backend));
    }
  }

  @AfterAll
  static void stopDatabases() {
    DATABASES.values().forEach(RdfTestDatabase::close);
    DATABASES.clear();
  }

  @ParameterizedTest
  @EnumSource(RdfTestDatabase.Backend.class)
  void aKnownTaskKeepsThePausePastTheBudgetEvenWhenPollingFails(
      final RdfTestDatabase.Backend backend) throws Exception {
    assertPauseUntilFusekiAnswers(backend, false);
  }

  @ParameterizedTest
  @EnumSource(RdfTestDatabase.Backend.class)
  void anUnreadableStartKeepsThePauseUntilTheTaskListConfirmsNothingIsRunning(
      final RdfTestDatabase.Backend backend) throws Exception {
    assertPauseUntilFusekiAnswers(backend, true);
  }

  private static void assertPauseUntilFusekiAnswers(
      final RdfTestDatabase.Backend backend, final boolean unreadableStart) throws Exception {
    final RdfTestDatabase database = database(backend);
    final Clock clock = Clock.systemUTC();
    final RdfLiveWriteStore queue = new RdfLiveWriteStore(database.jdbi(), clock);
    try (CompactionApi api = new CompactionApi(unreadableStart);
        var worker = Executors.newSingleThreadExecutor()) {
      final JenaFusekiStorage raw = new JenaFusekiStorage(api.configuration());
      final RdfDatasetManager manager =
          new RdfDatasetManager(
              new RdfDatasetNames("openmetadata"),
              new RdfRebuildStore(database.jdbi(), clock, RdfRebuildStore.DEFAULT_LIMITS),
              clock,
              dataset -> raw,
              Duration.ofSeconds(1));
      final RdfLiveWritePause pause = new RdfLiveWritePause(database.lockDao(), manager, "new");
      queue.enqueue(UPDATE);
      final CompletableFuture<CompactionResult> maintenance =
          CompletableFuture.supplyAsync(
              () ->
                  pause.during(
                      UUID.randomUUID().toString(),
                      holder -> manager.routedStorage(holder).compact(Duration.ZERO)),
              worker);
      try {
        assertTrue(api.polled.await(20, TimeUnit.SECONDS));
        assertThrows(TimeoutException.class, () -> maintenance.get(1, TimeUnit.SECONDS));
        final boolean paused =
            database
                .jdbi()
                .withHandle(handle -> RdfLiveWritePause.isPaused(handle, clock.millis()));
        assertTrue(paused);
        assertFalse(
            queue.processNext(
                sparql ->
                    manager.routedStorage(RdfWriteDelivery.QUEUED).executeSparqlUpdate(sparql)));
        assertEquals(0, scalar(database, "SELECT attempts FROM rdf_live_write_queue"));
        assertEquals(0, api.writes.get());
      } finally {
        api.finished.set(true);
      }
      final CompactionResult result = maintenance.get(20, TimeUnit.SECONDS);
      assertEquals(
          unreadableStart ? CompactionResult.Outcome.UNKNOWN : CompactionResult.Outcome.SUCCEEDED,
          result.outcome());
      assertEquals(1, api.starts.get(), "waiting must not POST a second compaction");
      final RdfLiveWriteStore afterPause =
          new RdfLiveWriteStore(
              database.jdbi(), Clock.offset(clock, RdfLiveWritePause.RETRY_AFTER));
      assertTrue(
          afterPause.processNext(
              sparql ->
                  manager.routedStorage(RdfWriteDelivery.QUEUED).executeSparqlUpdate(sparql)));
      assertEquals(1, api.writes.get());
      assertEquals(0, queue.pendingWrites());
      assertEquals(0, scalar(database, "SELECT COUNT(*) FROM rdf_live_write_dead_letter"));
    }
  }

  @ParameterizedTest
  @EnumSource(RdfTestDatabase.Backend.class)
  void oldServersCannotConsumeNewPayloadsButCanStillProduceLegacyPayloads(
      final RdfTestDatabase.Backend backend) {
    final RdfTestDatabase database = database(backend);
    final RdfLiveWriteStore queue = new RdfLiveWriteStore(database.jdbi(), Clock.systemUTC());
    final RdfLiveWrite.PipelineExecution execution =
        new RdfLiveWrite.PipelineExecution(UUID.randomUUID(), 1234);
    final RdfLiveWrite.EntityUpdate legacyUpdate =
        new RdfLiveWrite.EntityUpdate("pipeline", execution.pipelineId());
    queue.enqueue(JsonUtils.pojoToJson(execution));
    queue.enqueue(JsonUtils.pojoToJson(legacyUpdate));

    for (int attempt = 0; attempt < 12; attempt++) {
      final boolean legacyOwnsWriter =
          database
              .jdbi()
              .inTransaction(
                  handle ->
                      handle
                          .createQuery(LEGACY_WRITER_LOCK)
                          .mapTo(String.class)
                          .findOne()
                          .isPresent());
      assertFalse(
          legacyOwnsWriter, "an old server must stop before reading an unsupported payload");
    }
    assertEquals(0, scalar(database, "SELECT SUM(attempts) FROM rdf_live_write_queue"));
    final List<RdfLiveWrite> delivered = new ArrayList<>();
    assertTrue(
        queue.processNext(
            payload -> delivered.add(JsonUtils.readValue(payload, RdfLiveWrite.class))));
    assertTrue(
        queue.processNext(
            payload -> delivered.add(JsonUtils.readValue(payload, RdfLiveWrite.class))));
    assertFalse(
        queue.processNext(
            payload -> delivered.add(JsonUtils.readValue(payload, RdfLiveWrite.class))));
    assertEquals(List.of(execution, legacyUpdate), delivered);
    assertEquals(0, scalar(database, "SELECT COUNT(*) FROM rdf_live_write_dead_letter"));
  }

  @ParameterizedTest
  @EnumSource(RdfTestDatabase.Backend.class)
  void protocolMigrationWaitsForAnOldDeliveryBeforeEnablingNewConsumers(
      final RdfTestDatabase.Backend backend) throws Exception {
    final RdfTestDatabase database = database(backend);
    final RdfLiveWriteStore queue = new RdfLiveWriteStore(database.jdbi(), Clock.systemUTC());
    database
        .jdbi()
        .useHandle(
            handle ->
                handle.execute(
                    "UPDATE rdf_live_write_guard SET id = 'drain' WHERE id = 'drain-v2'"));
    assertThrows(IllegalStateException.class, queue::requireCurrentWriter);
    queue.enqueue("legacy write");
    try (Handle legacy = database.jdbi().open();
        var worker = Executors.newSingleThreadExecutor()) {
      legacy.begin();
      legacy.createQuery(LEGACY_WRITER_LOCK).mapTo(String.class).one();
      final CountDownLatch started = new CountDownLatch(1);
      final CompletableFuture<Void> migration =
          CompletableFuture.runAsync(
              () -> {
                started.countDown();
                database.applyConsumerProtocolMigration();
              },
              worker);
      try {
        assertTrue(started.await(10, TimeUnit.SECONDS));
        assertThrows(TimeoutException.class, () -> migration.get(1, TimeUnit.SECONDS));
        assertFalse(
            queue.processNext(
                payload -> {
                  throw new AssertionError("old delivery still active");
                }));
      } finally {
        legacy.commit();
      }
      migration.get(10, TimeUnit.SECONDS);
    }
    queue.requireCurrentWriter();
    database.applyConsumerProtocolMigration();
    assertTrue(queue.processNext(payload -> assertEquals("legacy write", payload)));
    assertEquals(
        0, scalar(database, "SELECT COUNT(*) FROM rdf_live_write_guard WHERE id = 'drain'"));
  }

  private static RdfTestDatabase database(final RdfTestDatabase.Backend backend) {
    final RdfTestDatabase database = DATABASES.get(backend);
    database
        .jdbi()
        .useHandle(
            handle -> {
              handle.execute("DELETE FROM rdf_live_write_queue");
              handle.execute("DELETE FROM rdf_live_write_dead_letter");
              handle.execute("DELETE FROM rdf_reindex_lock");
              handle.execute("DELETE FROM rdf_active_dataset");
            });
    return database;
  }

  private static int scalar(final RdfTestDatabase database, final String sql) {
    return database.jdbi().withHandle(handle -> handle.createQuery(sql).mapTo(Integer.class).one());
  }

  private static final class CompactionApi implements AutoCloseable {
    final AtomicBoolean finished = new AtomicBoolean();
    final AtomicInteger starts = new AtomicInteger();
    final AtomicInteger writes = new AtomicInteger();
    final CountDownLatch polled = new CountDownLatch(1);
    private final boolean unreadableStart;
    private final HttpServer server;

    CompactionApi(final boolean unreadableStart) throws IOException {
      this.unreadableStart = unreadableStart;
      server = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
      server.createContext("/", this::handle);
      server.start();
    }

    RdfConfiguration configuration() {
      return new RdfConfiguration()
          .withEnabled(true)
          .withBaseUri(URI.create("https://open-metadata.org/"))
          .withRemoteEndpoint(
              URI.create("http://localhost:" + server.getAddress().getPort() + "/openmetadata"))
          .withWriteMaxRetries(0);
    }

    private void handle(final HttpExchange exchange) throws IOException {
      final String path = exchange.getRequestURI().getPath();
      String body = "";
      int status = 200;
      if (path.startsWith("/$/compact/")) {
        starts.incrementAndGet();
        body = unreadableStart ? "<html>Bad Gateway</html>" : "{\"taskId\":\"7\"}";
      } else if (path.startsWith("/$/tasks")) {
        polled.countDown();
        status = finished.get() ? 200 : 503;
        body =
            !finished.get()
                ? "<html>Bad Gateway</html>"
                : unreadableStart
                    ? "[]"
                    : "{\"task\":\"Compact\",\"finished\":\"now\",\"success\":true}";
      } else {
        writes.incrementAndGet();
      }
      final byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
      exchange.sendResponseHeaders(status, bytes.length == 0 ? -1 : bytes.length);
      exchange.getResponseBody().write(bytes);
      exchange.close();
    }

    @Override
    public void close() {
      server.stop(0);
    }
  }
}
