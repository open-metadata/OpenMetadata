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
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import java.util.stream.Stream;
import org.jdbi.v3.core.statement.SqlLogger;
import org.jdbi.v3.core.statement.StatementContext;
import org.jdbi.v3.core.transaction.TransactionIsolationLevel;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityExtensionDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.ExtensionWithIdAndSchemaObject;
import org.openmetadata.service.projection.ExtensionMutation;
import org.openmetadata.service.projection.ProjectionJournalRetention;
import org.openmetadata.service.projection.ProjectionTarget;

class ExtensionMutationCaptureIT {
  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void retainedOwnersArePagedAndPurgedOnlyAfterBothConsumersExpand(
      final RdfTestDatabase.Backend backend) {
    try (final var fixture = new ExtensionCaptureFixture(backend)) {
      final var expected = IntStream.range(0, 205).mapToObj(index -> UUID.randomUUID()).toList();
      for (final UUID owner : expected) {
        fixture.seed(owner, "table.cost");
      }
      fixture.dao().deleteExtension("table.cost");
      final var search = fixture.claims(ProjectionTarget.SEARCH).getFirst();
      final var rdf = fixture.claims(ProjectionTarget.RDF).getFirst();
      final var first = fixture.snapshots().page(search.id(), 0, 100);
      final var second = fixture.snapshots().page(search.id(), first.getLast().id(), 100);
      final var last = fixture.snapshots().page(search.id(), second.getLast().id(), 100);
      assertEquals(List.of(100, 100, 5), List.of(first.size(), second.size(), last.size()));
      assertEquals(
          Set.copyOf(expected),
          Stream.of(first, second, last)
              .flatMap(List::stream)
              .map(row -> row.entityId())
              .collect(Collectors.toSet()));
      final var future = Clock.fixed(Instant.now().plus(Duration.ofDays(2)), ZoneOffset.UTC);
      final var retention = new ProjectionJournalRetention(fixture.jdbi(), future);
      assertTrue(fixture.journal().advance(search, null, true, handle -> {}));
      assertEquals(0, retention.purgePage(Duration.ofDays(1), 0, 1000).snapshotsDeleted());
      assertTrue(fixture.journal().advance(rdf, null, true, handle -> {}));
      final var purged = retention.purgePage(Duration.ofDays(1), 0, 1000);
      assertEquals(205, purged.snapshotsDeleted());
      assertEquals(1, purged.mutationsDeleted());
      assertEquals(2, purged.consumersDeleted());
    }
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void failureAfterCrossEntityDeletionRestoresOwnersWithinCaughtSavepoint(
      final RdfTestDatabase.Backend backend) {
    try (final var fixture = new ExtensionCaptureFixture(backend)) {
      final UUID owner = UUID.randomUUID();
      fixture.seed(owner, "table.cost");
      fixture
          .jdbi()
          .setSqlLogger(
              new SqlLogger() {
                @Override
                public void logAfterExecution(final StatementContext context) {
                  if (CaptureStatements.deletes(context, "entity_extension")) {
                    throw new IllegalStateException("failure after delete");
                  }
                }
              });
      try {
        fixture
            .jdbi()
            .useTransaction(
                handle -> {
                  assertThrows(
                      IllegalStateException.class,
                      () -> handle.attach(EntityExtensionDAO.class).deleteExtension("table.cost"));
                  handle.execute("UPDATE entity_extension SET jsonSchema = 'survived'");
                });
      } finally {
        fixture.jdbi().setSqlLogger(SqlLogger.NOP_SQL_LOGGER);
      }
      assertEquals(1, fixture.count("entity_extension"));
      assertEquals(0, fixture.count("metadata_projection_mutation"));
      assertEquals(0, fixture.count("metadata_projection_extension"));
    }
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void extensionOnlyChangesCreateIndependentDurableObligations(
      final RdfTestDatabase.Backend backend) {
    try (final var fixture = new ExtensionCaptureFixture(backend)) {
      final UUID owner = UUID.randomUUID();
      fixture.dao().insert(owner, "table.cost", "customFieldSchema", "123");
      fixture.dao().delete(owner, "table.cost");
      assertEquals(0, fixture.count("entity_extension"));
      for (final var target : ProjectionTarget.values()) {
        final var claims = fixture.claims(target);
        assertEquals(2, claims.size());
        assertTrue(
            claims.stream().allMatch(claim -> claim.mutation().kind().name().equals("EXTENSIONS")));
      }
    }
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void outerRollbackDiscardsBothExtensionsAndCapture(final RdfTestDatabase.Backend backend) {
    try (final var fixture = new ExtensionCaptureFixture(backend)) {
      assertThrows(
          IllegalStateException.class,
          () ->
              fixture
                  .jdbi()
                  .useTransaction(
                      handle -> {
                        handle
                            .attach(EntityExtensionDAO.class)
                            .insert(UUID.randomUUID(), "table.cost", "customFieldSchema", "123");
                        throw new IllegalStateException("rollback");
                      }));
      assertEquals(0, fixture.count("entity_extension"));
      assertEquals(0, fixture.count("metadata_projection_mutation"));
    }
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void schemaDeletionPreservesOtherExtensions(final RdfTestDatabase.Backend backend) {
    try (final var fixture = new ExtensionCaptureFixture(backend)) {
      final UUID first = UUID.randomUUID();
      final UUID second = UUID.randomUUID();
      fixture.seed(first, "table.cost");
      fixture.seed(second, "table.cost");
      fixture.seed(first, "table.other");
      fixture.dao().deleteExtension("table.cost");
      assertEquals(1, fixture.count("entity_extension"));
      final var claims = fixture.claims(ProjectionTarget.SEARCH);
      assertEquals(1, claims.size());
      assertEquals(
          Set.of(first, second),
          fixture.snapshots().page(claims.getFirst().id(), 0, 1000).stream()
              .map(row -> row.entityId())
              .collect(Collectors.toSet()));
    }
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void knownOwnersNeedNoPreimageReadsAndShareCommitInserts(final RdfTestDatabase.Backend backend) {
    try (final var fixture = new ExtensionCaptureFixture(backend)) {
      final AtomicInteger statements = new AtomicInteger();
      fixture
          .jdbi()
          .setSqlLogger(
              new SqlLogger() {
                @Override
                public void logAfterExecution(final StatementContext context) {
                  statements.incrementAndGet();
                }
              });
      try {
        fixture
            .jdbi()
            .useTransaction(
                handle -> {
                  final var dao = handle.attach(EntityExtensionDAO.class);
                  for (int i = 0; i < 20; i++) {
                    dao.insert(UUID.randomUUID(), "table.cost", "customFieldSchema", "123");
                  }
                });
      } finally {
        fixture.jdbi().setSqlLogger(SqlLogger.NOP_SQL_LOGGER);
      }
      assertEquals(22, statements.get());
      assertEquals(20, fixture.count("entity_extension"));
      assertEquals(20, fixture.claims(ProjectionTarget.SEARCH).size());
    }
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void batchesAndRevisionsRetainOwnersAcrossDifferentWriteShapes(
      final RdfTestDatabase.Backend backend) {
    try (final var fixture = new ExtensionCaptureFixture(backend)) {
      final UUID first = UUID.randomUUID();
      final UUID second = UUID.randomUUID();
      fixture
          .dao()
          .insertMany(
              List.of(first, second),
              List.of("table.cost", "table.cost"),
              "customFieldSchema",
              List.of("1", "2"));
      fixture
          .dao()
          .bulkUpsertExtensions(
              List.of(
                  ExtensionWithIdAndSchemaObject.builder()
                      .id(first.toString())
                      .extension("table.columnExtension")
                      .jsonschema("columnExtension")
                      .json("{}")
                      .build()));
      fixture
          .dao()
          .incrementRevisions(
              List.of(first, second), "table.relationshipRevision", "relationshipRevision");
      fixture
          .dao()
          .incrementRevisions(List.of(first), "table.relationshipRevision", "relationshipRevision");
      assertTrue(fixture.dao().getExtension(first, "table.relationshipRevision").contains("2"));
      fixture
          .dao()
          .deleteByJsonSchemaBatch(
              List.of(first.toString(), second.toString()), "customFieldSchema");
      assertEquals(3, fixture.count("entity_extension"));
      fixture.dao().deleteAll(first);
      fixture.dao().deleteAllBatch(List.of(second.toString()));
      assertEquals(0, fixture.count("entity_extension"));
      final var owners =
          fixture.claims(ProjectionTarget.SEARCH).stream()
              .map(claim -> ((ExtensionMutation) claim.mutation()).entityId())
              .toList();
      assertEquals(10, owners.size());
      assertEquals(Set.of(first, second), Set.copyOf(owners));
    }
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void failedCaptureCannotCommitAnExtensionWrite(final RdfTestDatabase.Backend backend) {
    try (final var fixture = new ExtensionCaptureFixture(backend)) {
      fixture
          .jdbi()
          .setSqlLogger(
              new SqlLogger() {
                @Override
                public void logBeforeExecution(final StatementContext context) {
                  if (context
                      .getRenderedSql()
                      .contains("INSERT INTO metadata_projection_mutation")) {
                    throw new IllegalStateException("journal unavailable");
                  }
                }
              });
      try {
        assertThrows(
            IllegalStateException.class,
            () ->
                fixture.dao().insert(UUID.randomUUID(), "table.cost", "customFieldSchema", "123"));
      } finally {
        fixture.jdbi().setSqlLogger(SqlLogger.NOP_SQL_LOGGER);
      }
      assertEquals(0, fixture.count("entity_extension"));
      assertEquals(0, fixture.count("metadata_projection_mutation"));
    }
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void crossEntityDeleteCannotRemoveAnUncapturedConcurrentOwner(
      final RdfTestDatabase.Backend backend) throws Exception {
    try (final var fixture = new ExtensionCaptureFixture(backend)) {
      final UUID existing = UUID.randomUUID();
      final UUID concurrent = UUID.randomUUID();
      fixture.seed(existing, "table.cost");
      final var retained = new CompletableFuture<Void>();
      final var release = new CompletableFuture<Void>();
      fixture
          .jdbi()
          .setSqlLogger(
              new SqlLogger() {
                @Override
                public void logBeforeExecution(final StatementContext context) {
                  if (backend == RdfTestDatabase.Backend.MYSQL) {
                    awaitInsert(context);
                  }
                }

                @Override
                public void logAfterExecution(final StatementContext context) {
                  if (backend == RdfTestDatabase.Backend.POSTGRES) {
                    awaitInsert(context);
                  }
                }

                private void awaitInsert(final StatementContext context) {
                  if (CaptureStatements.deletes(context, "entity_extension")) {
                    retained.complete(null);
                    release.orTimeout(30, TimeUnit.SECONDS).join();
                  }
                }
              });
      final var deletion =
          CompletableFuture.runAsync(
              () ->
                  fixture
                      .jdbi()
                      .useTransaction(
                          TransactionIsolationLevel.READ_COMMITTED,
                          handle ->
                              handle
                                  .attach(EntityExtensionDAO.class)
                                  .deleteExtension("table.cost")),
              DedicatedThreads.EXECUTOR);
      try {
        retained.orTimeout(30, TimeUnit.SECONDS).join();
        fixture.seed(concurrent, "table.cost");
      } finally {
        release.complete(null);
        deletion
            .whenComplete(
                (result, failure) -> fixture.jdbi().setSqlLogger(SqlLogger.NOP_SQL_LOGGER))
            .get(30, TimeUnit.SECONDS);
      }
      assertEquals("{}", fixture.dao().getExtension(concurrent, "table.cost").replace(" ", ""));
      final var mutation = fixture.claims(ProjectionTarget.SEARCH).getFirst();
      assertEquals(
          List.of(existing),
          fixture.snapshots().page(mutation.id(), 0, 100).stream()
              .map(row -> row.entityId())
              .toList());
    }
  }
}
