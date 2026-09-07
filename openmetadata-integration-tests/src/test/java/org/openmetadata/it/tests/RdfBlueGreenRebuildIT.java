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

import java.io.ByteArrayInputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
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
import java.util.regex.Pattern;
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
import org.openmetadata.service.rdf.RdfDatasetNames;
import org.openmetadata.service.rdf.RdfWriteMode;
import org.openmetadata.service.rdf.rebuild.RdfDatasetManager;
import org.openmetadata.service.rdf.rebuild.RdfDatasetManager.BuildTarget;
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
  private static final Path ROOT = repositoryRoot();
  private static GenericContainer<?> fuseki;
  private static String endpoint;

  enum Database {
    POSTGRES("postgres:15", 5432, "postgres"),
    MYSQL("mysql:8.0", 3306, "mysql");
    final String image;
    final int port;
    final String migration;
    GenericContainer<?> container;
    Jdbi jdbi;

    Database(String image, int port, String migration) {
      this.image = image;
      this.port = port;
      this.migration = migration;
    }

    void start() throws Exception {
      container =
          new GenericContainer<>(image)
              .withExposedPorts(port)
              .withEnv("POSTGRES_PASSWORD", "rdf-test")
              .withEnv("POSTGRES_DB", "rdf")
              .withEnv("MYSQL_ROOT_PASSWORD", "rdf-test")
              .withEnv("MYSQL_DATABASE", "rdf")
              .withStartupTimeout(Duration.ofMinutes(3));
      container.start();
      final String driver = this == POSTGRES ? "postgresql" : "mysql";
      final String suffix = this == MYSQL ? "?allowPublicKeyRetrieval=true&useSSL=false" : "";
      final String url =
          "jdbc:"
              + driver
              + "://"
              + container.getHost()
              + ":"
              + container.getMappedPort(port)
              + "/rdf"
              + suffix;
      jdbi = Jdbi.create(url, this == POSTGRES ? "postgres" : "root", "rdf-test");
      org.awaitility.Awaitility.await()
          .atMost(Duration.ofMinutes(2))
          .ignoreExceptions()
          .until(
              () ->
                  jdbi.withHandle(
                          handle -> handle.createQuery("SELECT 1").mapTo(Integer.class).one())
                      == 1);
      final String previous =
          Files.readString(
              ROOT.resolve(
                  "bootstrap/sql/migrations/native/2.0.2/" + migration + "/schemaChanges.sql"));
      final var active =
          Pattern.compile("CREATE TABLE IF NOT EXISTS rdf_active_dataset.*?;", Pattern.DOTALL)
              .matcher(previous);
      assertTrue(active.find());
      jdbi.useHandle(handle -> handle.execute(active.group()));
      final String inferenceMigration =
          Files.readString(
              ROOT.resolve(
                  "bootstrap/sql/migrations/native/2.1.0/" + migration + "/schemaChanges.sql"));
      final var inferenceTable =
          Pattern.compile("CREATE TABLE IF NOT EXISTS rdf_inference_rule.*?;", Pattern.DOTALL)
              .matcher(inferenceMigration);
      assertTrue(inferenceTable.find());
      jdbi.useHandle(handle -> handle.execute(inferenceTable.group()));
      final String upgrade =
          Files.readString(
              ROOT.resolve(
                  "bootstrap/sql/migrations/native/2.0.3/" + migration + "/schemaChanges.sql"));
      for (int pass = 0; pass < 2; pass++) {
        jdbi.useHandle(
            handle -> {
              for (String statement : upgrade.split(";")) {
                if (!statement.isBlank()) {
                  handle.execute(statement);
                }
              }
            });
      }
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
      if (database.container != null) {
        database.container.close();
      }
    }
    if (fuseki != null) {
      fuseki.close();
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

  private static Path repositoryRoot() {
    Path path = Path.of("").toAbsolutePath();
    while (path != null && !Files.isDirectory(path.resolve("bootstrap/sql/migrations"))) {
      path = path.getParent();
    }
    if (path == null) {
      throw new IllegalStateException("Cannot locate repository migrations");
    }
    return path;
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
