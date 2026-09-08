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

import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.ByteArrayInputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.awaitility.Awaitility;
import org.jdbi.v3.core.Jdbi;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.rdf.RdfDatasetNames;
import org.openmetadata.service.rdf.RdfLiveWriteStore;
import org.openmetadata.service.rdf.RdfWriteMode;
import org.openmetadata.service.rdf.rebuild.RdfDatasetManager;
import org.openmetadata.service.rdf.rebuild.RdfDatasetManager.BuildTarget;
import org.openmetadata.service.rdf.rebuild.RdfMutation;
import org.openmetadata.service.rdf.rebuild.RdfRebuildStore;
import org.openmetadata.service.rdf.rebuild.RdfRebuildStore.JournalLimits;
import org.openmetadata.service.rdf.storage.ForwardingRdfStorage;
import org.openmetadata.service.rdf.storage.InferenceInvalidatingRdfStorage;
import org.openmetadata.service.rdf.storage.JenaFusekiStorage;
import org.openmetadata.service.rdf.storage.RdfStorageInterface;
import org.openmetadata.service.rdf.storage.RdfStorageInterface.EntityWriteRequest;
import org.openmetadata.service.rdf.storage.RdfStorageInterface.RelationshipData;
import org.openmetadata.service.rdf.storage.RdfWriteOutcomeUnknownException;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.images.builder.ImageFromDockerfile;

/** Real SQL transactions and HTTP/TDB2, including two independent server routing instances. */
@Execution(ExecutionMode.SAME_THREAD)
public class RdfBlueGreenRebuildIT {
  private static final String BASE = "https://open-metadata.org/";
  private static final String GRAPH = BASE + "graph/knowledge";
  private static final String NAME = BASE + "ontology/name";
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final Path ROOT = RdfTestDatabase.repositoryRoot();
  private static GenericContainer<?> fuseki;
  private static String endpoint;

  enum Database {
    POSTGRES,
    MYSQL;
    RdfTestDatabase database;
    Jdbi jdbi;

    void start() {
      database = new RdfTestDatabase(RdfTestDatabase.Backend.valueOf(name()));
      jdbi = database.jdbi();
    }

    void applyReleaseMigration() {
      database.applyReleaseMigration();
    }
  }

  @BeforeAll
  static void startServices() throws Exception {
    endpoint = System.getProperty("rdfRebuildFusekiEndpoint");
    if (endpoint == null) {
      fuseki =
          new GenericContainer<>(
                  new ImageFromDockerfile().withFileFromPath(".", ROOT.resolve("docker/rdf-store")))
              .withExposedPorts(3030)
              .withEnv("JVM_ARGS", "-Xms512m -Xmx1g")
              .waitingFor(Wait.forHttp("/$/ping"));
      fuseki.start();
      endpoint = "http://" + fuseki.getHost() + ":" + fuseki.getMappedPort(3030);
    }
    for (Database database : Database.values()) {
      database.start();
    }
  }

  @AfterAll
  static void stopServices() {
    for (Database database : Database.values()) {
      if (database.database != null) {
        database.database.close();
      }
    }
    if (fuseki != null) {
      fuseki.close();
    }
  }

  @ParameterizedTest
  @EnumSource(Database.class)
  void durableLiveReplayFollowsTheServingDatasetAcrossPromotion(final Database database) {
    try (Fixture fixture = new Fixture(database, RdfRebuildStore.DEFAULT_LIMITS)) {
      final UUID id = UUID.randomUUID();
      final BuildTarget target = fixture.primary.begin();
      write(fixture.primary.buildStorage(target), id, "snapshot");
      final RdfLiveWriteStore queue = new RdfLiveWriteStore(database.jdbi, fixture.clock);
      queue.enqueue(livePayload(id, "before-promotion"));
      assertTrue(
          queue.processNext(
              payload ->
                  JsonUtils.readValue(payload, RdfMutation.class)
                      .apply(fixture.other.routedStorage())));
      fixture.primary.promote(target, "test");
      assertName(fixture.other.routedStorage(), id, "before-promotion");

      queue.enqueue(livePayload(id, "after-promotion"));
      assertTrue(
          queue.processNext(
              payload ->
                  JsonUtils.readValue(payload, RdfMutation.class)
                      .apply(fixture.other.routedStorage())));
      assertName(fixture.other.routedStorage(), id, "after-promotion");
      try (RdfStorageInterface previous = raw("openmetadata")) {
        assertName(previous, id, "before-promotion");
      }
    }
  }

  @ParameterizedTest
  @EnumSource(Database.class)
  void releaseMigrationCanBeReappliedWithoutLosingRebuildState(final Database database) {
    try (Fixture fixture = new Fixture(database, RdfRebuildStore.DEFAULT_LIMITS)) {
      final UUID id = UUID.randomUUID();
      final BuildTarget target = fixture.primary.begin();
      write(fixture.primary.buildStorage(target), id, "snapshot");
      write(fixture.other.routedStorage(), id, "live");

      database.applyReleaseMigration();

      assertEquals(target.id(), fixture.store.state().rebuildId());
      assertEquals(1, fixture.store.page(target.id(), 0, 10).size());
      fixture.primary.promote(target, "test");
      database.applyReleaseMigration();
      assertEquals(target.dataset(), fixture.other.activeDataset());
      assertName(fixture.other.routedStorage(), id, "live");
    }
  }

  @ParameterizedTest
  @EnumSource(Database.class)
  void snapshotCannotOverwriteLiveUpdatesDeletesOrRelationships(final Database database) {
    try (Fixture fixture = new Fixture(database, RdfRebuildStore.DEFAULT_LIMITS)) {
      final AtomicInteger invalidations = new AtomicInteger();
      final RdfStorageInterface live =
          new InferenceInvalidatingRdfStorage(
              fixture.other.routedStorage(), invalidations::incrementAndGet);
      final UUID updated = UUID.randomUUID();
      final UUID deleted = UUID.randomUUID();
      final UUID created = UUID.randomUUID();
      final BuildTarget target = fixture.primary.begin();
      final RdfStorageInterface build = fixture.primary.buildStorage(target);
      write(build, updated, "snapshot");
      write(build, deleted, "snapshot");
      write(live, updated, "live");
      live.deleteEntity("table", deleted);
      write(live, created, "created-after-scan");
      live.bulkStoreRelationships(
          List.of(new RelationshipData("table", updated, "table", created, "contains")),
          Set.of(BASE + "entity/table/" + updated));

      fixture.primary.promote(target, "test");

      assertName(live, updated, "live");
      assertName(live, created, "created-after-scan");
      assertFalse(hasEntity(live, deleted));
      assertTrue(
          live.executeSparqlQuery(
                  "ASK { GRAPH <"
                      + GRAPH
                      + "> { <"
                      + BASE
                      + "entity/table/"
                      + updated
                      + "> <"
                      + BASE
                      + "ontology/contains> <"
                      + BASE
                      + "entity/table/"
                      + created
                      + "> } }",
                  "json")
              .contains("true"));
      write(live, updated, "after-cutover");
      assertName(build, updated, "after-cutover");
      assertEquals(target.dataset(), fixture.other.activeDataset());
      assertEquals(5, invalidations.get());
    }
  }

  @ParameterizedTest
  @EnumSource(Database.class)
  void aLiveMutationDuringReplayIsIncludedBeforePromotion(final Database database) {
    try (Fixture fixture = new Fixture(database, RdfRebuildStore.DEFAULT_LIMITS)) {
      final UUID id = UUID.randomUUID();
      final BuildTarget target = fixture.primary.begin();
      write(fixture.primary.buildStorage(target), id, "snapshot");
      write(fixture.other.routedStorage(), id, "first-live");
      fixture.duringBuildWrite =
          () -> write(fixture.other.routedStorage(), id, "live-during-replay");

      fixture.primary.promote(target, "test");

      assertName(fixture.other.routedStorage(), id, "live-during-replay");
    }
  }

  @ParameterizedTest
  @EnumSource(Database.class)
  void committedJournalSurvivesTheRoutingTransactionRollingBack(final Database database) {
    try (Fixture fixture = new Fixture(database, RdfRebuildStore.DEFAULT_LIMITS)) {
      final UUID id = UUID.randomUUID();
      final BuildTarget target = fixture.primary.begin();
      write(fixture.primary.buildStorage(target), id, "snapshot");
      fixture.failAfterLiveWrite.set(true);
      assertThrows(
          IllegalStateException.class,
          () -> write(fixture.primary.routedStorage(), id, "remote-committed"));
      assertEquals(1, fixture.store.page(target.id(), 0, 10).size());

      fixture.primary.promote(target, "test");

      assertName(fixture.other.routedStorage(), id, "remote-committed");
    }
  }

  @ParameterizedTest
  @EnumSource(Database.class)
  void boundedJournalAbortsRebuildWhileKeepingLiveWritesAvailable(final Database database) {
    try (Fixture fixture = new Fixture(database, new JournalLimits(16, 1))) {
      final UUID id = UUID.randomUUID();
      final BuildTarget target = fixture.primary.begin();
      write(fixture.primary.routedStorage(), id, "live-write-must-survive");
      assertThrows(IllegalStateException.class, () -> fixture.primary.promote(target, "test"));
      assertName(fixture.other.routedStorage(), id, "live-write-must-survive");
      assertEquals("openmetadata", fixture.primary.activeDataset());
      assertTrue(fixture.store.page(target.id(), 0, 10).isEmpty());
    }
  }

  @ParameterizedTest
  @EnumSource(Database.class)
  void staleWorkerCannotWriteAfterLeaseExpiryAndTargetReuse(final Database database) {
    try (Fixture fixture = new Fixture(database, RdfRebuildStore.DEFAULT_LIMITS)) {
      final BuildTarget expired = fixture.primary.begin();
      final RdfStorageInterface staleWorker = fixture.primary.buildStorage(expired);
      assertThrows(IllegalStateException.class, fixture.other::begin);
      fixture.clock.advance(RdfRebuildStore.LEASE_MILLIS - 1);
      fixture.primary.heartbeat(expired);
      fixture.clock.advance(2);
      write(staleWorker, UUID.randomUUID(), "lease-was-renewed");
      fixture.clock.advance(RdfRebuildStore.LEASE_MILLIS);
      final BuildTarget replacement = fixture.other.begin();
      assertEquals(expired.dataset(), replacement.dataset());
      final UUID id = UUID.randomUUID();
      assertThrows(IllegalStateException.class, () -> write(staleWorker, id, "stale"));
      assertFalse(hasEntity(fixture.other.buildStorage(replacement), id));
      assertThrows(IllegalStateException.class, () -> fixture.primary.promote(expired, "test"));
    }
  }

  @ParameterizedTest
  @EnumSource(Database.class)
  void threePromotionsAndRestartReuseOnlyTwoAlternates(final Database database) {
    try (Fixture fixture = new Fixture(database, RdfRebuildStore.DEFAULT_LIMITS)) {
      final UUID id = UUID.randomUUID();
      for (String expected : List.of("openmetadata_a", "openmetadata_b", "openmetadata_a")) {
        final BuildTarget target = fixture.primary.begin();
        assertEquals(expected, target.dataset());
        final RdfStorageInterface build = fixture.primary.buildStorage(target);
        build.clearGraph(GRAPH);
        write(build, id, expected);
        fixture.primary.promote(target, "test");
        try (RdfDatasetManager restarted = fixture.manager(false)) {
          assertEquals(expected, restarted.activeDataset());
          assertName(restarted.routedStorage(), id, expected);
        }
      }
    }
  }

  @ParameterizedTest
  @EnumSource(Database.class)
  void textSearchSurvivesPromotionLiveWritesAndTargetReuse(final Database database)
      throws Exception {
    try (Fixture fixture = new Fixture(database, RdfRebuildStore.DEFAULT_LIMITS)) {
      final UUID id = UUID.randomUUID();
      final RdfStorageInterface live = fixture.other.routedStorage();
      write(live, id, "baseline");
      assertTextMatch(live, id, "baseline", true);

      for (String expected : List.of("openmetadata_a", "openmetadata_b", "openmetadata_a")) {
        final BuildTarget target = fixture.primary.begin();
        assertEquals(expected, target.dataset());
        final RdfStorageInterface build = fixture.primary.buildStorage(target);
        build.clearGraph(GRAPH);
        assertTextMatch(build, id, "snapshot", false);
        assertTextMatch(build, id, "retained", false);
        append(build, id, "snapshot");
        assertTextMatch(build, id, "snapshot", true);
        assertTextMatch(live, id, "snapshot", false);

        fixture.primary.promote(target, "test");
        assertTextMatch(live, id, "snapshot", true);
        write(live, id, "updated");
        assertTextMatch(live, id, "snapshot", false);
        assertTextMatch(live, id, "updated", true);
        live.deleteEntity("table", id);
        assertTextMatch(live, id, "updated", false);
        append(live, id, "retained");
      }
    }
  }

  @ParameterizedTest
  @EnumSource(Database.class)
  void promotionMarksMaterializedInferenceDirty(final Database database) {
    try (Fixture fixture = new Fixture(database, RdfRebuildStore.DEFAULT_LIMITS)) {
      database.jdbi.useHandle(
          handle ->
              handle.execute(
                  "INSERT INTO rdf_inference_rule (name, json, updatedAt, dirty) VALUES ('clean-rule', '{}', 1, FALSE)"));
      final BuildTarget target = fixture.primary.begin();
      write(fixture.primary.buildStorage(target), UUID.randomUUID(), "rebuilt source");
      fixture.primary.promote(target, "test");
      assertEquals(target.dataset(), fixture.other.activeDataset());
      final boolean dirty =
          database.jdbi.withHandle(
              handle ->
                  handle
                      .createQuery("SELECT dirty FROM rdf_inference_rule WHERE name = 'clean-rule'")
                      .mapTo(Boolean.class)
                      .one());
      assertTrue(dirty);
    }
  }

  @ParameterizedTest
  @EnumSource(Database.class)
  void journalReplaysBatchTurtleSparqlAndGraphClearMutations(final Database database) {
    try (Fixture fixture = new Fixture(database, RdfRebuildStore.DEFAULT_LIMITS)) {
      final BuildTarget target = fixture.primary.begin();
      final AtomicInteger invalidations = new AtomicInteger();
      final RdfStorageInterface live =
          new InferenceInvalidatingRdfStorage(
              fixture.other.routedStorage(), invalidations::incrementAndGet);
      final UUID id = UUID.randomUUID();
      final Model model = ModelFactory.createDefaultModel();
      try {
        model
            .createResource(BASE + "entity/table/" + id)
            .addProperty(model.createProperty(NAME), "batch");
        live.bulkStoreEntities(List.of(new EntityWriteRequest("table", id, model)));
        live.bulkStoreEntities(
            List.of(new EntityWriteRequest("table", id, model)),
            RdfWriteMode.RECONCILE,
            1024 * 1024);
        live.bulkStoreEntities(
            List.of(new EntityWriteRequest("table", id, model)), RdfWriteMode.RECONCILE);
      } finally {
        model.close();
      }
      live.loadTurtleFile(
          new ByteArrayInputStream("<urn:s> <urn:p> <urn:o> .".getBytes(StandardCharsets.UTF_8)),
          "urn:journal:turtle");
      live.executeSparqlUpdate(
          "INSERT DATA { GRAPH <urn:journal:clear> { <urn:s> <urn:p> <urn:o> } }");
      live.clearGraph("urn:journal:clear");
      live.storeRelationship("table", id, "table", UUID.randomUUID(), "contains");

      fixture.primary.promote(target, "test");

      assertName(fixture.other.routedStorage(), id, "batch");
      assertEquals(1, fixture.other.routedStorage().getTripleCount("urn:journal:turtle"));
      assertEquals(0, fixture.other.routedStorage().getTripleCount("urn:journal:clear"));
      assertEquals(7, invalidations.get());
    }
  }

  @ParameterizedTest
  @EnumSource(Database.class)
  void uncertainBuildWriteCannotBePromotedOrImmediatelyReused(final Database database) {
    try (Fixture fixture = new Fixture(database, RdfRebuildStore.DEFAULT_LIMITS)) {
      final BuildTarget target = fixture.primary.begin();
      fixture.duringBuildWrite =
          () -> {
            throw new RdfWriteOutcomeUnknownException("test", new TimeoutException());
          };
      assertThrows(
          RdfWriteOutcomeUnknownException.class,
          () -> write(fixture.primary.buildStorage(target), UUID.randomUUID(), "unknown"));
      fixture.primary.abort(target, "app teardown");
      assertThrows(IllegalStateException.class, () -> fixture.primary.promote(target, "test"));
      assertThrows(IllegalStateException.class, fixture.other::begin);
      assertEquals("openmetadata", fixture.other.activeDataset());
      assertEquals(RdfRebuildStore.UNCERTAIN_WRITE, fixture.store.state().failure());
    }
  }

  @ParameterizedTest
  @EnumSource(Database.class)
  void uncertainOutcomeAfterCancellationStillQuarantinesTheDataset(final Database database)
      throws Exception {
    try (Fixture fixture = new Fixture(database, RdfRebuildStore.DEFAULT_LIMITS);
        var executor = Executors.newVirtualThreadPerTaskExecutor()) {
      final BuildTarget target = fixture.primary.begin();
      final CountDownLatch activeLockHeld = new CountDownLatch(1);
      final AtomicReference<Future<?>> cancellation = new AtomicReference<>();
      fixture.duringBuildWrite =
          () -> {
            cancellation.set(
                executor.submit(
                    () ->
                        fixture.store.withActiveLock(
                            session -> {
                              activeLockHeld.countDown();
                              session.abort(target.id(), "cancelled while writing");
                              return null;
                            })));
            Awaitility.await()
                .atMost(Duration.ofSeconds(10))
                .until(() -> activeLockHeld.getCount() == 0);
            throw new RdfWriteOutcomeUnknownException("test", new TimeoutException());
          };
      assertThrows(
          RdfWriteOutcomeUnknownException.class,
          () -> write(fixture.primary.buildStorage(target), UUID.randomUUID(), "unknown"));
      cancellation.get().get(10, TimeUnit.SECONDS);
      assertThrows(IllegalStateException.class, fixture.other::begin);
      assertEquals(RdfRebuildStore.UNCERTAIN_WRITE, fixture.store.state().failure());
    }
  }

  private static final class Fixture implements AutoCloseable {
    final Database database;
    final MutableClock clock = new MutableClock();
    final RdfRebuildStore store;
    final RdfDatasetManager primary;
    final RdfDatasetManager other;
    final AtomicBoolean failAfterLiveWrite = new AtomicBoolean();
    Runnable duringBuildWrite;

    Fixture(final Database database, final JournalLimits limits) {
      this.database = database;
      database.jdbi.useHandle(
          handle -> {
            handle.execute("DELETE FROM rdf_rebuild_journal");
            handle.execute("DELETE FROM rdf_rebuild_state");
            handle.execute("DELETE FROM rdf_active_dataset");
            handle.execute("DELETE FROM rdf_inference_rule");
            handle.execute("DELETE FROM rdf_live_write_queue");
          });
      store = new RdfRebuildStore(database.jdbi, clock, limits);
      primary = manager(true);
      other = manager(false);
      for (String dataset : List.of("openmetadata", "openmetadata_a", "openmetadata_b")) {
        try (RdfStorageInterface storage = raw(dataset)) {
          storage.ensureStorageReady();
          storage.clearGraph(GRAPH);
        }
      }
    }

    RdfDatasetManager manager(final boolean injectFaults) {
      return new RdfDatasetManager(
          new RdfDatasetNames("openmetadata"),
          store,
          clock,
          dataset -> {
            final RdfStorageInterface storage = raw(dataset);
            if (!injectFaults) {
              return storage;
            }
            return new ForwardingRdfStorage() {
              @Override
              protected RdfStorageInterface delegate() {
                return storage;
              }

              @Override
              public void storeEntity(String type, UUID id, Model model) {
                storage.storeEntity(type, id, model);
                if (dataset.equals("openmetadata")
                    && failAfterLiveWrite.compareAndSet(true, false)) {
                  throw new IllegalStateException(
                      "Simulated process failure after Fuseki committed");
                }
                if (!dataset.equals("openmetadata") && duringBuildWrite != null) {
                  final Runnable mutation = duringBuildWrite;
                  duringBuildWrite = null;
                  mutation.run();
                }
              }
            };
          });
    }

    @Override
    public void close() {
      primary.close();
      other.close();
    }
  }

  private static RdfStorageInterface raw(final String dataset) {
    return new JenaFusekiStorage(
        new RdfConfiguration()
            .withEnabled(true)
            .withStorageType(RdfConfiguration.StorageType.FUSEKI)
            .withBaseUri(URI.create(BASE))
            .withRemoteEndpoint(URI.create(endpoint + "/" + dataset))
            .withUsername("admin")
            .withPassword("admin")
            .withWriteMaxRetries(0));
  }

  private static String livePayload(final UUID id, final String name) {
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

  private static void write(final RdfStorageInterface storage, final UUID id, final String name) {
    final Model model = ModelFactory.createDefaultModel();
    try {
      model
          .createResource(BASE + "entity/table/" + id)
          .addProperty(model.createProperty(NAME), name);
      storage.storeEntity("table", id, model);
    } finally {
      model.close();
    }
  }

  private static boolean hasEntity(final RdfStorageInterface storage, final UUID id) {
    final Model model = storage.getEntity("table", id);
    if (model == null) {
      return false;
    }
    try {
      return !model.isEmpty();
    } finally {
      model.close();
    }
  }

  private static void append(final RdfStorageInterface storage, final UUID id, final String name) {
    final Model model = ModelFactory.createDefaultModel();
    try {
      model
          .createResource(BASE + "entity/table/" + id)
          .addProperty(model.createProperty(NAME), name);
      storage.bulkStoreEntities(
          List.of(new EntityWriteRequest("table", id, model)), RdfWriteMode.INSERT_ONLY);
    } finally {
      model.close();
    }
  }

  private static void assertTextMatch(
      final RdfStorageInterface storage, final UUID id, final String term, final boolean expected)
      throws Exception {
    final String pattern =
        "?entity <http://jena.apache.org/text#query> (<%s> \"%s\") FILTER (?entity = <%sentity/table/%s>)"
            .formatted(NAME, term, BASE, id);
    for (String body : List.of(pattern, "GRAPH <%s> { %s }".formatted(GRAPH, pattern))) {
      final String result = storage.executeSparqlQuery("ASK { " + body + " }", "json");
      assertEquals(expected, MAPPER.readTree(result).path("boolean").asBoolean(), result);
    }
  }

  private static void assertName(
      final RdfStorageInterface storage, final UUID id, final String expected) {
    final Model model = storage.getEntity("table", id);
    try {
      assertEquals(
          List.of(expected),
          model.listObjectsOfProperty(model.createProperty(NAME)).toList().stream()
              .map(node -> node.asLiteral().getString())
              .toList());
    } finally {
      model.close();
    }
  }

  private static final class MutableClock extends Clock {
    private long millis = System.currentTimeMillis();

    void advance(final long delta) {
      millis += delta;
    }

    @Override
    public ZoneId getZone() {
      return ZoneOffset.UTC;
    }

    @Override
    public Clock withZone(ZoneId zone) {
      return this;
    }

    @Override
    public Instant instant() {
      return Instant.ofEpochMilli(millis);
    }

    @Override
    public long millis() {
      return millis;
    }
  }
}
