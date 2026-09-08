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

import java.net.URI;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.EnumMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.rdf.RdfLiveWriteStore;
import org.openmetadata.service.rdf.rebuild.RdfMutation;
import org.openmetadata.service.rdf.storage.JenaFusekiStorage;
import org.openmetadata.service.rdf.storage.RdfStorageInterface;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.images.builder.ImageFromDockerfile;

/** Durable delivery through real MySQL/PostgreSQL transactions and HTTP/TDB2 writes. */
@Execution(ExecutionMode.SAME_THREAD)
public class RdfLiveWriteRecoveryIT {
  private static final String BASE = "https://open-metadata.org/";
  private static final String GRAPH = BASE + "graph/knowledge";
  private static final String NAME = BASE + "ontology/name";
  private static final Map<RdfTestDatabase.Backend, RdfTestDatabase> DATABASES =
      new EnumMap<>(RdfTestDatabase.Backend.class);
  private static GenericContainer<?> fuseki;
  private static String endpoint;

  @BeforeAll
  static void startServices() {
    endpoint = System.getProperty("rdfRebuildFusekiEndpoint");
    if (endpoint == null) {
      fuseki =
          new GenericContainer<>(
                  new ImageFromDockerfile()
                      .withFileFromPath(
                          ".", RdfTestDatabase.repositoryRoot().resolve("docker/rdf-store")))
              .withExposedPorts(3030)
              .withEnv("JVM_ARGS", "-Xms512m -Xmx1g")
              .waitingFor(Wait.forHttp("/$/ping"));
      fuseki.start();
      endpoint = "http://" + fuseki.getHost() + ":" + fuseki.getMappedPort(3030);
    }
    for (RdfTestDatabase.Backend backend : RdfTestDatabase.Backend.values()) {
      DATABASES.put(backend, new RdfTestDatabase(backend));
    }
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
  void backlogBeyondTheOldMemoryLimitSurvivesRestart(final RdfTestDatabase.Backend backend) {
    try (Fixture fixture = new Fixture(backend)) {
      final int writes = 1005;
      for (int index = 0; index < writes; index++) {
        fixture.primary.enqueue(insert(index));
      }
      assertEquals(writes, fixture.other.pendingWrites());
      fixture.clock.advance(30_000);
      assertTrue(fixture.other.isDegraded());

      final RdfLiveWriteStore restarted = fixture.newStore();
      int delivered = 0;
      while (restarted.processNext(fixture::apply)) {
        delivered++;
      }

      assertEquals(writes, delivered);
      assertEquals(0, fixture.primary.pendingWrites());
      assertFalse(fixture.primary.isDegraded());
      final String count =
          fixture.storage.executeSparqlQuery(
              "SELECT (COUNT(*) AS ?count) WHERE { GRAPH <" + GRAPH + "> { ?s ?p ?o } }", "json");
      assertEquals(
          writes,
          JsonUtils.readTree(count)
              .path("results")
              .path("bindings")
              .get(0)
              .path("count")
              .path("value")
              .asInt());
    }
  }

  @ParameterizedTest
  @EnumSource(RdfTestDatabase.Backend.class)
  void failureIsSharedAndRecoversIncrementallyInOrder(final RdfTestDatabase.Backend backend) {
    try (Fixture fixture = new Fixture(backend)) {
      final UUID entityId = UUID.randomUUID();
      fixture.primary.enqueue(entity(entityId, "old"));
      fixture.other.enqueue(entity(entityId, "latest"));
      assertFalse(
          fixture.primary.processNext(
              payload -> {
                throw new IllegalStateException("Fuseki temporarily unavailable");
              }));
      assertTrue(fixture.other.isDegraded());
      assertEquals(2, fixture.other.pendingWrites());
      assertFalse(fixture.other.processNext(fixture::apply));
      assertTrue(fixture.lastError().contains("Fuseki temporarily unavailable"));

      final RdfLiveWriteStore restarted = fixture.newStore();
      fixture.clock.advance(1000);
      assertTrue(restarted.processNext(fixture::apply));
      assertTrue(restarted.processNext(fixture::apply));
      assertFalse(restarted.processNext(fixture::apply));

      fixture.assertName(entityId, "latest");
      assertFalse(fixture.primary.isDegraded());
      assertFalse(fixture.other.isDegraded());
    }
  }

  @ParameterizedTest
  @EnumSource(RdfTestDatabase.Backend.class)
  void onlyOneServerDrainsButProducersDoNotWaitForFuseki(final RdfTestDatabase.Backend backend)
      throws Exception {
    try (Fixture fixture = new Fixture(backend);
        var executor = Executors.newFixedThreadPool(2)) {
      final CountDownLatch started = new CountDownLatch(1);
      final CountDownLatch release = new CountDownLatch(1);
      fixture.primary.enqueue(insert(1));
      final var running =
          executor.submit(
              () ->
                  fixture.primary.processNext(
                      payload -> {
                        started.countDown();
                        await(release);
                        fixture.apply(payload);
                      }));
      try {
        assertTrue(started.await(5, TimeUnit.SECONDS));
        assertFalse(
            executor
                .submit(() -> fixture.other.processNext(fixture::apply))
                .get(2, TimeUnit.SECONDS));
        executor.submit(() -> fixture.other.enqueue(insert(2))).get(2, TimeUnit.SECONDS);
      } finally {
        release.countDown();
      }
      assertTrue(running.get(5, TimeUnit.SECONDS));
      assertTrue(fixture.other.processNext(fixture::apply));
      assertEquals(0, fixture.primary.pendingWrites());
    }
  }

  @ParameterizedTest
  @EnumSource(RdfTestDatabase.Backend.class)
  void crashAfterFusekiCommitReplaysWithoutResurrectingDeletedEntity(
      final RdfTestDatabase.Backend backend) {
    try (Fixture fixture = new Fixture(backend)) {
      final UUID id = UUID.randomUUID();
      fixture.primary.enqueue(entity(id, "before-delete"));
      fixture.primary.enqueue(JsonUtils.pojoToJson(new RdfMutation.EntityDelete("table", id)));
      assertThrows(
          SimulatedProcessCrash.class,
          () ->
              fixture.primary.processNext(
                  payload -> {
                    fixture.apply(payload);
                    throw new SimulatedProcessCrash();
                  }));
      assertEquals(2, fixture.other.pendingWrites());

      final RdfLiveWriteStore restarted = fixture.newStore();
      assertTrue(restarted.processNext(fixture::apply));
      assertTrue(restarted.processNext(fixture::apply));
      assertEquals(0, fixture.other.pendingWrites());
      final Model remaining = fixture.storage.getEntity("table", id);
      try {
        assertTrue(remaining == null || remaining.isEmpty());
      } finally {
        if (remaining != null) {
          remaining.close();
        }
      }
    }
  }

  @ParameterizedTest
  @EnumSource(RdfTestDatabase.Backend.class)
  void rebuildCannotEraseConcurrentFailuresOrPendingRetries(final RdfTestDatabase.Backend backend) {
    try (Fixture fixture = new Fixture(backend)) {
      fixture.primary.markDegraded("first failure");
      final long startedAtVersion = fixture.primary.failureVersion();
      fixture.other.markDegraded("failure after rebuild started");
      fixture.primary.markRebuilt(startedAtVersion);
      assertTrue(fixture.newStore().isDegraded());
      fixture.primary.markRebuilt(fixture.primary.failureVersion());
      assertFalse(fixture.other.isDegraded());

      fixture.primary.enqueue(insert(1));
      fixture.primary.processNext(
          payload -> {
            throw new IllegalStateException("offline");
          });
      fixture.primary.markRebuilt(fixture.primary.failureVersion());
      assertTrue(fixture.other.isDegraded());
      fixture.clock.advance(1000);
      assertTrue(fixture.other.processNext(fixture::apply));
      assertFalse(fixture.primary.isDegraded());
    }
  }

  @ParameterizedTest
  @EnumSource(RdfTestDatabase.Backend.class)
  void retryingOneWriteDoesNotClearAnUnrecoverableFailure(final RdfTestDatabase.Backend backend) {
    try (Fixture fixture = new Fixture(backend)) {
      fixture.primary.markDegraded("failure outside the queue");
      fixture.primary.enqueue(insert(1));
      assertTrue(fixture.other.processNext(fixture::apply));
      assertTrue(fixture.newStore().isDegraded());
    }
  }

  @ParameterizedTest
  @EnumSource(RdfTestDatabase.Backend.class)
  void migrationReapplicationPreservesFailuresAndPendingWrites(
      final RdfTestDatabase.Backend backend) {
    try (Fixture fixture = new Fixture(backend)) {
      fixture.primary.markDegraded("persisted failure");
      fixture.primary.enqueue(insert(1));
      fixture.database.applyReleaseMigration();
      assertTrue(fixture.newStore().isDegraded());
      assertEquals(1, fixture.other.pendingWrites());
      assertTrue(fixture.other.processNext(fixture::apply));
    }
  }

  @ParameterizedTest
  @EnumSource(RdfTestDatabase.Backend.class)
  void malformedCommandIsRetainedWithAnInspectableFailure(final RdfTestDatabase.Backend backend) {
    try (Fixture fixture = new Fixture(backend)) {
      fixture.primary.enqueue("malformed");
      fixture.primary.enqueue(insert(1));
      assertFalse(fixture.primary.processNext(fixture::apply));
      assertEquals(2, fixture.other.pendingWrites());
      assertTrue(fixture.lastError().contains("JsonParsingException"));
      assertTrue(fixture.other.isDegraded());
    }
  }

  private static void await(final CountDownLatch latch) {
    try {
      assertTrue(latch.await(5, TimeUnit.SECONDS));
    } catch (InterruptedException exception) {
      Thread.currentThread().interrupt();
      throw new IllegalStateException(exception);
    }
  }

  private static String insert(final int index) {
    return JsonUtils.pojoToJson(
        new RdfMutation.Sparql(
            "INSERT DATA { GRAPH <"
                + GRAPH
                + "> { <urn:queued:"
                + index
                + "> <"
                + NAME
                + "> \"value\" } }"));
  }

  private static String entity(final UUID id, final String name) {
    final Model model = ModelFactory.createDefaultModel();
    try {
      model
          .createResource(BASE + "entity/table/" + id)
          .addProperty(model.createProperty(NAME), name);
      return JsonUtils.pojoToJson(RdfMutation.EntityWrite.capture("table", id, model));
    } finally {
      model.close();
    }
  }

  private static final class Fixture implements AutoCloseable {
    final RdfTestDatabase database;
    final MutableClock clock = new MutableClock();
    final RdfLiveWriteStore primary;
    final RdfLiveWriteStore other;
    final RdfStorageInterface storage;

    Fixture(final RdfTestDatabase.Backend backend) {
      database = DATABASES.get(backend);
      database
          .jdbi()
          .useHandle(
              handle -> {
                handle.execute("DELETE FROM rdf_live_write_queue");
                handle.execute(
                    "UPDATE rdf_projection_health SET failureVersion = 0, repairedVersion = 0, lastError = NULL");
              });
      primary = newStore();
      other = newStore();
      storage =
          new JenaFusekiStorage(
              new RdfConfiguration()
                  .withEnabled(true)
                  .withStorageType(RdfConfiguration.StorageType.FUSEKI)
                  .withBaseUri(URI.create(BASE))
                  .withRemoteEndpoint(URI.create(endpoint + "/openmetadata"))
                  .withUsername("admin")
                  .withPassword("admin")
                  .withWriteMaxRetries(0));
      storage.clearGraph(GRAPH);
    }

    RdfLiveWriteStore newStore() {
      return new RdfLiveWriteStore(database.jdbi(), clock);
    }

    void apply(final String payload) {
      JsonUtils.readValue(payload, RdfMutation.class).apply(storage);
    }

    String lastError() {
      return database
          .jdbi()
          .withHandle(
              handle ->
                  handle
                      .createQuery("SELECT lastError FROM rdf_live_write_queue ORDER BY id LIMIT 1")
                      .mapTo(String.class)
                      .one());
    }

    void assertName(final UUID id, final String expected) {
      final Model model = storage.getEntity("table", id);
      try {
        assertEquals(
            expected,
            model.listObjectsOfProperty(model.createProperty(NAME)).next().asLiteral().getString());
      } finally {
        model.close();
      }
    }

    @Override
    public void close() {
      storage.close();
    }
  }

  private static final class SimulatedProcessCrash extends Error {}

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
