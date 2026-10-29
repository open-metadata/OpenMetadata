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

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.EnumMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicLong;
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
import org.openmetadata.service.jdbi3.RdfInfraDAOs.RdfReindexLockDAO;
import org.openmetadata.service.rdf.RdfDatasetNames;
import org.openmetadata.service.rdf.RdfLiveWriteStore;
import org.openmetadata.service.rdf.rebuild.RdfDatasetManager;
import org.openmetadata.service.rdf.rebuild.RdfLiveWritePause;
import org.openmetadata.service.rdf.rebuild.RdfMutation;
import org.openmetadata.service.rdf.rebuild.RdfRebuildStore;
import org.openmetadata.service.rdf.rebuild.RdfWriteDelivery;
import org.openmetadata.service.rdf.storage.CompactionResult;
import org.openmetadata.service.rdf.storage.JenaFusekiStorage;
import org.openmetadata.service.rdf.storage.RdfStorageInterface;
import org.openmetadata.service.rdf.storage.RdfStorageMaintenanceException;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.images.builder.ImageFromDockerfile;

/**
 * Storage maintenance against real MySQL/PostgreSQL and Fuseki: a compaction or clear pauses
 * writes to the serving dataset, queued writes wait without using a delivery attempt or reading as
 * degraded, and they are all applied once the pause ends. Run against the production image with
 * {@code -DrdfContainerImage=openmetadata/fuseki:6.2.0}.
 */
@Tag("rdf")
@EnabledIfSystemProperty(named = "enableRdf", matches = "true")
@Execution(ExecutionMode.SAME_THREAD)
public class RdfStorageMaintenanceIT {
  private static final String BASE = "https://open-metadata.org/";
  private static final String GRAPH = BASE + "graph/knowledge";
  private static final String NAME = BASE + "ontology/name";
  private static final String DATASET = "openmetadata";
  // Stands in for the RDF request timeout, the longest a writer waits for a pause.
  private static final Duration WRITER_WAIT = Duration.ofSeconds(10);
  private static final Map<RdfTestDatabase.Backend, RdfTestDatabase> DATABASES =
      new EnumMap<>(RdfTestDatabase.Backend.class);
  private static GenericContainer<?> fuseki;
  private static String endpoint;

  @BeforeAll
  static void startServices() {
    fuseki = fusekiContainer().withExposedPorts(3030).waitingFor(Wait.forHttp("/$/ping"));
    fuseki.start();
    endpoint = "http://" + fuseki.getHost() + ":" + fuseki.getMappedPort(3030);
    for (RdfTestDatabase.Backend backend : RdfTestDatabase.Backend.values()) {
      DATABASES.put(backend, new RdfTestDatabase(backend));
    }
  }

  private static GenericContainer<?> fusekiContainer() {
    final String image = System.getProperty("rdfContainerImage");
    return image == null
        ? new GenericContainer<>(
                new ImageFromDockerfile()
                    .withFileFromPath(
                        ".", RdfTestDatabase.repositoryRoot().resolve("docker/rdf-store")))
            .withEnv("JVM_ARGS", "-Xms512m -Xmx1g")
        : new GenericContainer<>(image)
            .withEnv("ADMIN_PASSWORD", "admin")
            .withEnv("FUSEKI_HEAP", "1g")
            .withEnv("FUSEKI_DATASETS", DATASET + "," + DATASET + "_a," + DATASET + "_b")
            .withEnv("FUSEKI_UNION_DEFAULT_GRAPH", "true")
            .withEnv("OPENMETADATA_EXTENSION_ENABLED", "true");
  }

  @AfterAll
  static void stopServices() {
    DATABASES.values().forEach(RdfTestDatabase::close);
    DATABASES.clear();
    if (fuseki != null) {
      fuseki.close();
    }
  }

  @ParameterizedTest
  @EnumSource(RdfTestDatabase.Backend.class)
  void writesQueuedDuringAPauseWaitWithoutUsingAttemptsAndApplyAfterwards(
      final RdfTestDatabase.Backend backend) throws Exception {
    try (Fixture fixture = new Fixture(backend)) {
      fixture.queue.enqueue(insert(1));
      final HeldPause held = fixture.holdPause();

      assertFalse(fixture.queue.processNext(fixture::applyQueued), "the write must wait");
      assertEquals(0, fixture.headAttempts(), "waiting for maintenance is not a failed attempt");
      fixture.clock.advance(TimeUnit.MINUTES.toMillis(1));
      assertFalse(fixture.queue.isDegraded(), "a write held by maintenance is late, not failing");

      held.release();
      fixture.clock.advance(RdfLiveWritePause.RETRY_AFTER.toMillis());
      assertTrue(fixture.queue.processNext(fixture::applyQueued));
      assertEquals(1, fixture.raw.getTripleCount(GRAPH));
      assertEquals(0, fixture.deadLetters());
      assertFalse(fixture.queue.isDegraded());
    }
  }

  @ParameterizedTest
  @EnumSource(RdfTestDatabase.Backend.class)
  void theHolderWritesDuringItsOwnPause(final RdfTestDatabase.Backend backend) {
    try (Fixture fixture = new Fixture(backend)) {
      fixture.pause.during(
          UUID.randomUUID().toString(),
          holder -> {
            fixture.manager.routedStorage(holder).executeSparqlUpdate(sparql(1));
            return null;
          });

      assertEquals(1, fixture.raw.getTripleCount(GRAPH));
    }
  }

  @ParameterizedTest
  @EnumSource(RdfTestDatabase.Backend.class)
  void aWriterTheQueueDoesNotRetryWaitsForThePauseInsteadOfLosingItsWrite(
      final RdfTestDatabase.Backend backend) throws Exception {
    try (Fixture fixture = new Fixture(backend)) {
      final RdfStorageInterface serving = fixture.manager.routedStorage(RdfWriteDelivery.DIRECT);
      final HeldPause held = fixture.holdPause();
      final CompletableFuture<Void> write =
          CompletableFuture.runAsync(() -> serving.executeSparqlUpdate(sparql(2)));

      assertThrows(TimeoutException.class, () -> write.get(2, TimeUnit.SECONDS));
      assertEquals(0, fixture.raw.getTripleCount(GRAPH), "nothing reaches Fuseki during a pause");

      held.release();
      assertDoesNotThrow(() -> write.get(30, TimeUnit.SECONDS));
      assertEquals(1, fixture.raw.getTripleCount(GRAPH));
    }
  }

  @ParameterizedTest
  @EnumSource(RdfTestDatabase.Backend.class)
  void aWriterStillWaitingWhenItsTimeoutEndsIsRefusedWithNothingApplied(
      final RdfTestDatabase.Backend backend) throws InterruptedException {
    try (Fixture fixture = new Fixture(backend)) {
      final RdfStorageInterface serving = fixture.manager.routedStorage(RdfWriteDelivery.DIRECT);
      final HeldPause held = fixture.holdPause();

      assertThrows(
          RdfStorageMaintenanceException.class,
          () -> serving.executeSparqlUpdate(sparql(3)),
          "the REST API answers this with 503 and Retry-After");
      assertEquals(0, fixture.raw.getTripleCount(GRAPH), "nothing reaches Fuseki during a pause");
      held.release();
    }
  }

  @ParameterizedTest
  @EnumSource(RdfTestDatabase.Backend.class)
  void anExpiredPauseOfAStoppedServerNoLongerHoldsWrites(final RdfTestDatabase.Backend backend) {
    try (Fixture fixture = new Fixture(backend)) {
      final long longAgo = System.currentTimeMillis() - TimeUnit.MINUTES.toMillis(10);
      fixture.locks.tryAcquireLock(
          RdfLiveWritePause.LOCK_KEY,
          UUID.randomUUID().toString(),
          "stopped-server",
          longAgo,
          longAgo + TimeUnit.MINUTES.toMillis(5));

      assertDoesNotThrow(
          () ->
              fixture
                  .manager
                  .routedStorage(RdfWriteDelivery.DIRECT)
                  .executeSparqlUpdate(sparql(1)));
    }
  }

  @ParameterizedTest
  @EnumSource(RdfTestDatabase.Backend.class)
  void aMaintenanceClearAndCompactionEmptyAndShrinkTheDataset(
      final RdfTestDatabase.Backend backend) {
    try (Fixture fixture = new Fixture(backend)) {
      for (int index = 0; index < 50; index++) {
        fixture.raw.executeSparqlUpdate(sparql(index));
      }

      fixture.raw.executeMaintenanceUpdate("CLEAR ALL", Duration.ofMinutes(1));
      final CompactionResult compacted = fixture.raw.compact(Duration.ofMinutes(5));

      assertEquals(CompactionResult.Outcome.SUCCEEDED, compacted.outcome(), compacted.detail());
      assertEquals(0, fixture.raw.getTripleCount(GRAPH));
    }
  }

  private static String sparql(final int index) {
    return "INSERT DATA { GRAPH <"
        + GRAPH
        + "> { <urn:maintenance:"
        + index
        + "> <"
        + NAME
        + "> \"value\" } }";
  }

  private static String insert(final int index) {
    return JsonUtils.pojoToJson(new RdfMutation.Sparql(sparql(index)));
  }

  /** A pause held open on another thread until {@link #release()}. */
  private record HeldPause(CountDownLatch done, CompletableFuture<Void> maintenance) {
    void release() {
      done.countDown();
      maintenance.join();
    }
  }

  private static final class Fixture implements AutoCloseable {
    final RdfTestDatabase database;
    final MutableClock clock = new MutableClock();
    final RdfLiveWriteStore queue;
    final RdfReindexLockDAO locks;
    final RdfStorageInterface raw;
    final RdfDatasetManager manager;
    final RdfLiveWritePause pause;

    Fixture(final RdfTestDatabase.Backend backend) {
      database = DATABASES.get(backend);
      database
          .jdbi()
          .useHandle(
              handle -> {
                handle.execute("DELETE FROM rdf_live_write_queue");
                handle.execute("DELETE FROM rdf_live_write_dead_letter");
                handle.execute("DELETE FROM rdf_reindex_lock");
                handle.execute("DELETE FROM rdf_active_dataset");
                handle.execute(
                    "UPDATE rdf_projection_health SET failureVersion = 0, repairedVersion = 0, lastError = NULL");
              });
      queue = new RdfLiveWriteStore(database.jdbi(), clock);
      locks = database.lockDao();
      raw = storage();
      raw.clearGraph(GRAPH);
      manager =
          new RdfDatasetManager(
              new RdfDatasetNames(DATASET),
              new RdfRebuildStore(database.jdbi(), clock, RdfRebuildStore.DEFAULT_LIMITS),
              clock,
              dataset -> raw,
              WRITER_WAIT);
      pause = new RdfLiveWritePause(locks, manager, "server-a");
    }

    private static RdfStorageInterface storage() {
      return new JenaFusekiStorage(
          new RdfConfiguration()
              .withEnabled(true)
              .withStorageType(RdfConfiguration.StorageType.FUSEKI)
              .withBaseUri(URI.create(BASE))
              .withRemoteEndpoint(URI.create(endpoint + "/" + DATASET))
              .withUsername("admin")
              .withPassword("admin")
              .withWriteMaxRetries(0));
    }

    HeldPause holdPause() throws InterruptedException {
      final CountDownLatch paused = new CountDownLatch(1);
      final CountDownLatch done = new CountDownLatch(1);
      final CompletableFuture<Void> maintenance =
          CompletableFuture.runAsync(
              () ->
                  pause.during(
                      UUID.randomUUID().toString(),
                      holder -> {
                        paused.countDown();
                        awaitQuietly(done);
                        return null;
                      }));
      assertTrue(paused.await(30, TimeUnit.SECONDS), "the pause did not start");
      return new HeldPause(done, maintenance);
    }

    private static void awaitQuietly(final CountDownLatch latch) {
      try {
        latch.await(2, TimeUnit.MINUTES);
      } catch (InterruptedException exception) {
        Thread.currentThread().interrupt();
      }
    }

    void applyServing(final String payload) {
      JsonUtils.readValue(payload, RdfMutation.class)
          .apply(manager.routedStorage(RdfWriteDelivery.DIRECT));
    }

    /** As the live writer applies a queue row: held back at once while paused, never waiting. */
    void applyQueued(final String payload) {
      JsonUtils.readValue(payload, RdfMutation.class)
          .apply(manager.routedStorage(RdfWriteDelivery.QUEUED));
    }

    int headAttempts() {
      return database
          .jdbi()
          .withHandle(
              handle ->
                  handle
                      .createQuery("SELECT attempts FROM rdf_live_write_queue ORDER BY id LIMIT 1")
                      .mapTo(Integer.class)
                      .one());
    }

    long deadLetters() {
      return database
          .jdbi()
          .withHandle(
              handle ->
                  handle
                      .createQuery("SELECT COUNT(*) FROM rdf_live_write_dead_letter")
                      .mapTo(Long.class)
                      .one());
    }

    @Override
    public void close() {
      manager.close();
    }
  }

  private static final class MutableClock extends Clock {
    private final AtomicLong now = new AtomicLong(System.currentTimeMillis());

    void advance(final long millis) {
      now.addAndGet(millis);
    }

    @Override
    public ZoneId getZone() {
      return ZoneOffset.UTC;
    }

    @Override
    public Clock withZone(final ZoneId zone) {
      return this;
    }

    @Override
    public Instant instant() {
      return Instant.ofEpochMilli(millis());
    }

    @Override
    public long millis() {
      return now.get();
    }
  }
}
