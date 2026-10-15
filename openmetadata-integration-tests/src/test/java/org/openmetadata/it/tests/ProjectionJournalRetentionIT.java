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

import java.time.Duration;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.statement.SqlLogger;
import org.jdbi.v3.core.statement.StatementContext;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.projection.EntityMutation;
import org.openmetadata.service.projection.EntityPrefixMutation;
import org.openmetadata.service.projection.FieldRelationshipMutation;
import org.openmetadata.service.projection.ProjectionJournalRetention;
import org.openmetadata.service.projection.ProjectionOwnerLookup;
import org.openmetadata.service.projection.ProjectionTarget;
import org.openmetadata.service.projection.RelationshipMutation;
import org.openmetadata.service.projection.TagUsageMutation;
import org.openmetadata.service.util.FullyQualifiedName;

@Execution(ExecutionMode.SAME_THREAD)
class ProjectionJournalRetentionIT {
  private static final Duration MINIMUM_AGE = Duration.ofDays(1);
  private static final Map<RdfTestDatabase.Backend, RdfTestDatabase> DATABASES =
      new EnumMap<>(RdfTestDatabase.Backend.class);
  private static final List<String> TABLES =
      List.of(
          "metadata_projection_relationship",
          "metadata_projection_tag_usage",
          "metadata_projection_field_relationship",
          "metadata_projection_consumer",
          "metadata_projection_mutation",
          "metadata_projection_work");

  @BeforeAll
  static void startDatabases() {
    for (final RdfTestDatabase.Backend backend : RdfTestDatabase.backends().toList()) {
      final var database = new RdfTestDatabase(backend);
      database.applyProjectionMigrations();
      database.applyProjectionMigrations();
      database
          .jdbi()
          .useHandle(
              handle ->
                  handle.execute(
                      "CREATE TABLE projection_retention_owner (id VARCHAR(36) PRIMARY KEY, fqnHash VARCHAR(768))"));
      DATABASES.put(backend, database);
    }
  }

  @AfterAll
  static void stopDatabases() {
    DATABASES.values().forEach(RdfTestDatabase::close);
    DATABASES.clear();
  }

  @BeforeEach
  void clearFacts() {
    DATABASES
        .values()
        .forEach(
            database ->
                database
                    .jdbi()
                    .useTransaction(
                        handle -> TABLES.forEach(table -> handle.execute("DELETE FROM " + table))));
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void waitsForBothTargetsAndPreservesPendingDelivery(final RdfTestDatabase.Backend backend) {
    final ProjectionRetentionFixture store = store(backend);
    final long id = store.relationship(5);
    store.clock().advance(MINIMUM_AGE.plusSeconds(1));
    store.complete(ProjectionTarget.SEARCH);
    assertEquals(0, store.retention().purgePage(MINIMUM_AGE, 0, 100).mutationsDeleted());
    assertEquals(5, store.count(TABLES.getFirst()));

    store.complete(ProjectionTarget.RDF);
    final var result = store.retention().purgePage(MINIMUM_AGE, 0, 100);
    assertEquals(1, result.mutationsDeleted());
    assertEquals(5, result.snapshotsDeleted());
    assertEquals(2, result.consumersDeleted());
    assertEquals(0, store.count("metadata_projection_mutation"));
    assertEquals(2, store.count("metadata_projection_work"));
    assertEquals(
        1, store.work().claim(ProjectionTarget.SEARCH, "active", 10, Duration.ofMinutes(1)).size());
    assertTrue(id > 0);
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void boundsChildDeletionAndResumesWithoutDeletingParentEarly(
      final RdfTestDatabase.Backend backend) {
    final ProjectionRetentionFixture store = store(backend);
    store.relationship(9);
    store.completeAll();
    store.clock().advance(MINIMUM_AGE.plusSeconds(1));
    final var first = store.retention().purgePage(MINIMUM_AGE, 0, 7);
    assertEquals(4, first.snapshotsDeleted());
    assertEquals(0, first.mutationsDeleted());
    assertFalse(first.endOfPass());
    assertEquals(1, store.count("metadata_projection_mutation"));
    assertEquals(2, store.count("metadata_projection_consumer"));

    final var restarted = new ProjectionJournalRetention(store.jdbi(), store.clock());
    final var second = restarted.purgePage(MINIMUM_AGE, first.nextCursor(), 7);
    assertEquals(4, second.snapshotsDeleted());
    final var last = restarted.purgePage(MINIMUM_AGE, second.nextCursor(), 7);
    assertEquals(1, last.snapshotsDeleted());
    assertEquals(1, last.mutationsDeleted());
    assertEquals(0, store.count(TABLES.getFirst()));
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void retainsRecentFactsUntilTheyAge(final RdfTestDatabase.Backend backend) {
    final ProjectionRetentionFixture store = store(backend);
    store.relationship(0);
    store.completeAll();
    assertEquals(0, store.retention().purgePage(MINIMUM_AGE, 0, 100).mutationsDeleted());
    store.clock().advance(MINIMUM_AGE.plusSeconds(1));
    assertEquals(1, store.retention().purgePage(MINIMUM_AGE, 0, 100).mutationsDeleted());
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void keepsCompletedPrefixRewritesForHistoricalLookup(final RdfTestDatabase.Backend backend) {
    final ProjectionRetentionFixture store = store(backend);
    store
        .jdbi()
        .useTransaction(
            handle ->
                store
                    .journal()
                    .capture(
                        handle,
                        new EntityPrefixMutation(1, "table", "service.db", "service.warehouse")));
    store.completeAll();
    store.clock().advance(MINIMUM_AGE.plusSeconds(1));
    assertEquals(0, store.retention().purgePage(MINIMUM_AGE, 0, 100).mutationsDeleted());
    assertEquals(1, store.count("metadata_projection_mutation"));
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void discardsEntityFactsThatRetireNoLocator(final RdfTestDatabase.Backend backend) {
    final ProjectionRetentionFixture store = store(backend);
    store.entity(UUID.randomUUID(), null, "created", EntityMutation.Operation.UPSERT);
    store.entity(UUID.randomUUID(), "same", "same", EntityMutation.Operation.UPSERT);
    store.entity(UUID.randomUUID(), null, null, EntityMutation.Operation.DELETE);
    final UUID renamed = UUID.randomUUID();
    store.entity(renamed, "before", "after", EntityMutation.Operation.UPSERT);
    final UUID deleted = UUID.randomUUID();
    store.entity(deleted, "gone", null, EntityMutation.Operation.DELETE);
    store.completeAll();
    store.clock().advance(MINIMUM_AGE.plusSeconds(1));
    assertEquals(3, store.retention().purgePage(MINIMUM_AGE, 0, 100).mutationsDeleted());
    assertEquals(
        List.of(renamed.toString(), deleted.toString()),
        store
            .jdbi()
            .withHandle(
                handle ->
                    handle
                        .createQuery(
                            "SELECT entityId FROM metadata_projection_mutation ORDER BY id")
                        .mapTo(String.class)
                        .list()));
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void compactsRepeatedEntityFactsButKeepsHistoricalLocators(
      final RdfTestDatabase.Backend backend) {
    final ProjectionRetentionFixture store = store(backend);
    final UUID id = UUID.randomUUID();
    store.entity(id, null, "old", EntityMutation.Operation.UPSERT);
    store.entity(id, "old", "old", EntityMutation.Operation.UPSERT);
    store.entity(id, "old", "new", EntityMutation.Operation.UPSERT);
    store.entity(id, "new", "new", EntityMutation.Operation.UPSERT);
    store.entity(id, "new", null, EntityMutation.Operation.DELETE);
    store.completeAll();
    store.clock().advance(MINIMUM_AGE.plusSeconds(1));
    assertEquals(3, store.retention().purgePage(MINIMUM_AGE, 0, 100).mutationsDeleted());
    assertEquals(2, store.count("metadata_projection_mutation"));
    final List<String> operations =
        store
            .jdbi()
            .withHandle(
                handle ->
                    handle
                        .createQuery(
                            "SELECT operation FROM metadata_projection_mutation ORDER BY id")
                        .mapTo(String.class)
                        .list());
    assertEquals(List.of("UPSERT", "DELETE"), operations);
    final var lookup = new ProjectionOwnerLookup(store.jdbi());
    final var source =
        new ProjectionOwnerLookup.Source("table", "projection_retention_owner", "fqnHash", true);
    for (final String locator : List.of("old", "new", "old.column", "new.column")) {
      assertEquals(
          List.of(new ProjectionOwnerLookup.Owner(id, "table")),
          lookup.page(source, FullyQualifiedName.buildHash(locator), null, 100));
    }
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void cleansTagAndFieldSnapshotsAndKeepsCompletedRevisionState(
      final RdfTestDatabase.Backend backend) {
    final ProjectionRetentionFixture store = store(backend);
    store
        .jdbi()
        .useTransaction(
            handle -> {
              final long tag = store.journal().capture(handle, new TagUsageMutation(1));
              handle.execute(
                  "INSERT INTO metadata_projection_tag_usage (mutationId, source, tagFQN) VALUES (?, 1, 'Glossary.Term')",
                  tag);
              final long field = store.journal().capture(handle, new FieldRelationshipMutation(1));
              handle.execute(
                  """
          INSERT INTO metadata_projection_field_relationship
            (mutationId, fromFQNHash, toFQNHash, fromFQN, toFQN, fromType, toType, relation)
          VALUES (?, 'hash-a', 'hash-b', 'a', 'b', 'table', 'table', 1)
          """,
                  field);
            });
    store.completeAll();
    final var claims =
        store.work().claim(ProjectionTarget.SEARCH, "active", 10, Duration.ofMinutes(1));
    claims.forEach(claim -> assertTrue(store.work().complete(claim)));
    store.clock().advance(MINIMUM_AGE.plusSeconds(1));
    final var result = store.retention().purgePage(MINIMUM_AGE, 0, 100);
    assertEquals(2, result.mutationsDeleted());
    assertEquals(2, result.snapshotsDeleted());
    assertEquals(4, result.consumersDeleted());
    assertEquals(4, store.count("metadata_projection_work"));
    assertTrue(
        store.work().claim(ProjectionTarget.SEARCH, "active", 10, Duration.ofMinutes(1)).isEmpty());
    final List<Long> revisions =
        store
            .jdbi()
            .withHandle(
                handle ->
                    handle
                        .createQuery(
                            "SELECT writeRevision FROM metadata_projection_work WHERE target = 'SEARCH'")
                        .mapTo(Long.class)
                        .list());
    assertEquals(List.of(1L, 1L), revisions);
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void neverTreatsLeasedOrMissingConsumersAsCompletion(final RdfTestDatabase.Backend backend) {
    final ProjectionRetentionFixture store = store(backend);
    final long missing = store.relationship(1);
    store
        .jdbi()
        .useHandle(
            handle ->
                handle.execute(
                    "DELETE FROM metadata_projection_consumer WHERE mutationId = ?", missing));
    store.relationship(1);
    store.complete(ProjectionTarget.SEARCH);
    store.clock().advance(MINIMUM_AGE.plusSeconds(1));
    assertEquals(1, store.journal().claim(ProjectionTarget.RDF, 100, Duration.ofMinutes(1)).size());
    assertEquals(0, store.retention().purgePage(MINIMUM_AGE, 0, 100).mutationsDeleted());
    assertEquals(2, store.count("metadata_projection_mutation"));
    assertEquals(2, store.count("metadata_projection_relationship"));
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void retainsUnsupportedFormatsAndUnknownMutationKinds(final RdfTestDatabase.Backend backend) {
    final ProjectionRetentionFixture store = store(backend);
    final long futureVersion = store.relationship(0);
    final long futureKind = store.relationship(0);
    store.completeAll();
    store
        .jdbi()
        .useHandle(
            handle -> {
              handle.execute(
                  "UPDATE metadata_projection_mutation SET formatVersion = 2 WHERE id = ?",
                  futureVersion);
              handle.execute(
                  "UPDATE metadata_projection_mutation SET mutationType = 'FUTURE' WHERE id = ?",
                  futureKind);
            });
    store.clock().advance(MINIMUM_AGE.plusSeconds(1));
    assertEquals(0, store.retention().purgePage(MINIMUM_AGE, 0, 100).mutationsDeleted());
    assertEquals(2, store.count("metadata_projection_mutation"));
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void failedPageRollsBackSnapshotsConsumersAndParents(final RdfTestDatabase.Backend backend) {
    final ProjectionRetentionFixture store = store(backend);
    store.relationship(9);
    store.completeAll();
    store.clock().advance(MINIMUM_AGE.plusSeconds(1));
    store
        .jdbi()
        .setSqlLogger(
            new SqlLogger() {
              @Override
              public void logAfterExecution(final StatementContext context) {
                if (context
                    .getRenderedSql()
                    .startsWith("DELETE FROM metadata_projection_mutation")) {
                  throw new IllegalStateException(
                      "Injected retention failure after the parent delete");
                }
              }
            });
    try {
      assertThrows(
          IllegalStateException.class, () -> store.retention().purgePage(MINIMUM_AGE, 0, 100));
    } finally {
      store.jdbi().setSqlLogger(SqlLogger.NOP_SQL_LOGGER);
    }
    assertEquals(9, store.count("metadata_projection_relationship"));
    assertEquals(2, store.count("metadata_projection_consumer"));
    assertEquals(1, store.count("metadata_projection_mutation"));
    assertEquals(1, store.retention().purgePage(MINIMUM_AGE, 0, 100).mutationsDeleted());
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void aNewPassFindsLateCommitsBelowThePreviousCursor(final RdfTestDatabase.Backend backend) {
    final ProjectionRetentionFixture store = store(backend);
    try (final Handle delayed = store.jdbi().open()) {
      delayed.begin();
      final long lower = store.journal().capture(delayed, new RelationshipMutation(1));
      final long higher = store.relationship(0);
      assertTrue(lower < higher);
      store.completeAll();
      store.clock().advance(MINIMUM_AGE.plusSeconds(1));
      final var firstPass = store.retention().purgePage(MINIMUM_AGE, 0, 100);
      assertEquals(1, firstPass.mutationsDeleted());
      assertTrue(firstPass.endOfPass());
      assertEquals(0, firstPass.nextCursor());
      delayed.commit();
      store.completeAll();
      assertEquals(
          1,
          store.retention().purgePage(MINIMUM_AGE, firstPass.nextCursor(), 100).mutationsDeleted());
      assertEquals(0, store.count("metadata_projection_mutation"));
    }
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void overlappingSweepersKeepTheFinalLocator(final RdfTestDatabase.Backend backend)
      throws Exception {
    final ProjectionRetentionFixture store = store(backend);
    final UUID id = UUID.randomUUID();
    store
        .jdbi()
        .useTransaction(
            handle -> {
              for (int i = 0; i < 201; i++) {
                store
                    .journal()
                    .capture(
                        handle,
                        new EntityMutation(
                            1, "table", id, EntityMutation.Operation.UPSERT, "old", "name"));
              }
            });
    store.completeAll();
    store.clock().advance(MINIMUM_AGE.plusSeconds(1));
    final var locked = new CountDownLatch(1);
    final var release = new CountDownLatch(1);
    final var blockOnce = new AtomicBoolean(true);
    store
        .jdbi()
        .setSqlLogger(
            new SqlLogger() {
              @Override
              public void logAfterExecution(final StatementContext context) {
                if (context.getRenderedSql().contains("FOR UPDATE OF m SKIP LOCKED")
                    && blockOnce.compareAndSet(true, false)) {
                  locked.countDown();
                  await(release);
                }
              }
            });
    try (final var executor = Executors.newVirtualThreadPerTaskExecutor()) {
      final var first = executor.submit(() -> store.retention().purgePage(MINIMUM_AGE, 0, 1000));
      try {
        assertTrue(locked.await(30, TimeUnit.SECONDS));
        // The first page is the other sweeper's: this one moves past it instead of ending the pass.
        final var skipped = store.retention().purgePage(MINIMUM_AGE, 0, 1000);
        assertEquals(0, skipped.mutationsDeleted());
        assertFalse(skipped.endOfPass());
        assertEquals(
            100,
            store
                .retention()
                .purgePage(MINIMUM_AGE, skipped.nextCursor(), 1000)
                .mutationsDeleted());
      } finally {
        release.countDown();
      }
      assertEquals(100, first.get(30, TimeUnit.SECONDS).mutationsDeleted());
    } finally {
      release.countDown();
      store.jdbi().setSqlLogger(SqlLogger.NOP_SQL_LOGGER);
    }
    assertEquals(0, store.retention().purgePage(MINIMUM_AGE, 0, 1000).mutationsDeleted());
    assertEquals(1, store.count("metadata_projection_mutation"));
    // The final anchor is archived: its completed consumers are gone, so no later pass scans it.
    assertEquals(0, store.count("metadata_projection_consumer"));
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void aNewerRenameRetiresAnAnchorArchivedBeforeIt(final RdfTestDatabase.Backend backend) {
    final ProjectionRetentionFixture store = store(backend);
    final UUID id = UUID.randomUUID();
    store.entity(id, "first", "second", EntityMutation.Operation.UPSERT);
    store.completeAll();
    store.clock().advance(MINIMUM_AGE.plusSeconds(1));
    assertEquals(0, store.retention().purgePage(MINIMUM_AGE, 0, 100).mutationsDeleted());
    assertEquals(0, store.count("metadata_projection_consumer"));
    store.entity(id, "second", "first", EntityMutation.Operation.UPSERT);
    store.completeAll();
    store.clock().advance(MINIMUM_AGE.plusSeconds(1));
    final var result = store.retention().purgePage(MINIMUM_AGE, 0, 100);
    assertEquals(1, result.mutationsDeleted());
    assertEquals(
        List.of("second"),
        store
            .jdbi()
            .withHandle(
                handle ->
                    handle
                        .createQuery("SELECT beforeFqn FROM metadata_projection_mutation")
                        .mapTo(String.class)
                        .list()));
    final var lookup = new ProjectionOwnerLookup(store.jdbi());
    final var source =
        new ProjectionOwnerLookup.Source("table", "projection_retention_owner", "fqnHash", true);
    for (final String locator : List.of("first", "second")) {
      assertEquals(
          List.of(new ProjectionOwnerLookup.Owner(id, "table")),
          lookup.page(source, FullyQualifiedName.buildHash(locator), null, 100));
    }
  }

  private static void await(final CountDownLatch latch) {
    try {
      assertTrue(latch.await(30, TimeUnit.SECONDS));
    } catch (InterruptedException interrupted) {
      Thread.currentThread().interrupt();
      throw new IllegalStateException("Interrupted retention test", interrupted);
    }
  }

  private static ProjectionRetentionFixture store(final RdfTestDatabase.Backend backend) {
    return new ProjectionRetentionFixture(
        DATABASES.get(backend).jdbi(), ConnectionType.valueOf(backend.name()));
  }
}
