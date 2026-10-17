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
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Clock;
import java.time.Duration;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.statement.SqlLogger;
import org.jdbi.v3.core.statement.StatementContext;
import org.jdbi.v3.core.statement.UnableToExecuteStatementException;
import org.jdbi.v3.core.transaction.TransactionIsolationLevel;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipDAO;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.projection.ProjectionJournal;
import org.openmetadata.service.projection.ProjectionTarget;
import org.openmetadata.service.projection.RelationshipMutation;
import org.openmetadata.service.projection.RelationshipSnapshot;
import org.openmetadata.service.projection.RelationshipSnapshotStore;

@Execution(ExecutionMode.SAME_THREAD)
class RelationshipMutationCaptureIT {
  private static final Map<RdfTestDatabase.Backend, RelationshipCaptureFixture> DATABASES =
      new EnumMap<>(RdfTestDatabase.Backend.class);

  @BeforeAll
  static void startDatabases() {
    for (final RdfTestDatabase.Backend backend : RdfTestDatabase.backends().toList()) {
      DATABASES.put(backend, new RelationshipCaptureFixture(backend));
    }
  }

  @AfterAll
  static void stopDatabases() {
    DATABASES.values().forEach(RelationshipCaptureFixture::close);
    DATABASES.clear();
  }

  @BeforeEach
  void clearRows() {
    DATABASES.values().forEach(RelationshipCaptureFixture::clear);
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void domainDetachLeavesDurableDependencyWork(final RdfTestDatabase.Backend backend) {
    final Jdbi jdbi = DATABASES.get(backend).jdbi();
    final UUID domainId = UUID.randomUUID();
    final UUID tableId = UUID.randomUUID();
    jdbi.useHandle(
        handle ->
            handle.execute(
                "INSERT INTO entity_relationship (fromId, toId, fromEntity, toEntity, relation) VALUES (?, ?, ?, ?, ?)",
                domainId.toString(),
                tableId.toString(),
                Entity.DOMAIN,
                Entity.TABLE,
                Relationship.HAS.ordinal()));
    jdbi.onDemand(EntityRelationshipDAO.class)
        .deleteFrom(domainId, Entity.DOMAIN, Relationship.HAS.ordinal(), Entity.TABLE);
    assertEquals(
        0,
        jdbi.withHandle(
                handle ->
                    handle
                        .createQuery("SELECT COUNT(*) FROM entity_relationship")
                        .mapTo(Integer.class)
                        .one())
            .intValue());
    final ProjectionJournal journal =
        new ProjectionJournal(jdbi, Clock.systemUTC(), EnumSet.allOf(ProjectionTarget.class));
    final var search = journal.claim(ProjectionTarget.SEARCH, 10, Duration.ofSeconds(30));
    final var rdf = journal.claim(ProjectionTarget.RDF, 10, Duration.ofSeconds(30));
    assertEquals(1, search.size());
    assertEquals(1, rdf.size());
    assertEquals(search.getFirst().id(), rdf.getFirst().id());
    assertInstanceOf(RelationshipMutation.class, search.getFirst().mutation());
    final var retained = snapshots(backend).page(search.getFirst().id(), 0, 10);
    assertEquals(1, retained.size());
    assertEquals(
        new RelationshipSnapshot.Endpoint(domainId, Entity.DOMAIN), retained.getFirst().from());
    assertEquals(
        new RelationshipSnapshot.Endpoint(tableId, Entity.TABLE), retained.getFirst().to());
    assertEquals(Relationship.HAS.ordinal(), retained.getFirst().relation().code());
    assertTrue(journal.advance(search.getFirst(), null, true, handle -> {}));
    assertEquals(retained, snapshots(backend).page(rdf.getFirst().id(), 0, 10));
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void rolledBackDetachRestoresRelationshipsAndDiscardsMembership(
      final RdfTestDatabase.Backend backend) {
    final Jdbi jdbi = DATABASES.get(backend).jdbi();
    final UUID domain = UUID.randomUUID();
    seed(jdbi, domain, List.of(UUID.randomUUID(), UUID.randomUUID()));
    assertThrows(
        IllegalStateException.class,
        () ->
            jdbi.useTransaction(
                handle -> {
                  handle.attach(EntityRelationshipDAO.class).deleteAllFrom(domain, Entity.DOMAIN);
                  throw new IllegalStateException("rollback");
                }));
    assertEquals(2, count(jdbi, "entity_relationship"));
    assertEquals(0, count(jdbi, "metadata_projection_mutation"));
    assertEquals(0, count(jdbi, "metadata_projection_relationship"));
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void captureFailurePreventsDetach(final RdfTestDatabase.Backend backend) {
    final Jdbi jdbi = DATABASES.get(backend).jdbi();
    final UUID domain = UUID.randomUUID();
    seed(jdbi, domain, List.of(UUID.randomUUID()));
    jdbi.useHandle(
        handle ->
            handle.execute(
                "ALTER TABLE metadata_projection_consumer RENAME TO unavailable_consumer"));
    try {
      assertThrows(
          UnableToExecuteStatementException.class,
          () -> jdbi.onDemand(EntityRelationshipDAO.class).deleteAllFrom(domain, Entity.DOMAIN));
      assertEquals(1, count(jdbi, "entity_relationship"));
      assertEquals(0, count(jdbi, "metadata_projection_mutation"));
    } finally {
      jdbi.useHandle(
          handle ->
              handle.execute(
                  "ALTER TABLE unavailable_consumer RENAME TO metadata_projection_consumer"));
    }
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void largeFanoutRetainsEveryMemberInBoundedPages(final RdfTestDatabase.Backend backend) {
    final Jdbi jdbi = DATABASES.get(backend).jdbi();
    final UUID domain = UUID.randomUUID();
    final List<UUID> ids = IntStream.range(0, 6005).mapToObj(i -> UUID.randomUUID()).toList();
    seed(jdbi, domain, ids);
    jdbi.onDemand(EntityRelationshipDAO.class).deleteAllFrom(domain, Entity.DOMAIN);
    final long mutationId =
        journal(jdbi).claim(ProjectionTarget.SEARCH, 10, Duration.ofSeconds(30)).getFirst().id();
    final Set<UUID> retained = new HashSet<>();
    long after = 0;
    List<RelationshipSnapshot> page;
    do {
      page = snapshots(backend).page(mutationId, after, 1000);
      assertTrue(page.size() <= 1000);
      retained.addAll(page.stream().map(row -> row.to().id()).collect(Collectors.toSet()));
      if (!page.isEmpty()) {
        after = page.getLast().id();
      }
    } while (!page.isEmpty());
    assertEquals(Set.copyOf(ids), retained);
    assertEquals(0, count(jdbi, "entity_relationship"));
    assertEquals(6005, count(jdbi, "metadata_projection_relationship"));
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void concurrentInsertCannotBeDeletedOutsideTheRetainedSet(final RdfTestDatabase.Backend backend)
      throws Exception {
    final Jdbi jdbi = DATABASES.get(backend).jdbi();
    final UUID domain = UUID.randomUUID();
    final UUID existing = UUID.randomUUID();
    final UUID inserted = UUID.randomUUID();
    seed(jdbi, domain, List.of(existing));
    final CompletableFuture<Void> beforeDelete = new CompletableFuture<>();
    final CompletableFuture<Void> releaseDelete = new CompletableFuture<>();
    jdbi.setSqlLogger(
        new SqlLogger() {
          @Override
          public void logBeforeExecution(final StatementContext context) {
            if (backend == RdfTestDatabase.Backend.MYSQL) {
              awaitConcurrentInsert(context);
            }
          }

          @Override
          public void logAfterExecution(final StatementContext context) {
            if (backend == RdfTestDatabase.Backend.POSTGRES) {
              awaitConcurrentInsert(context);
            }
          }

          private void awaitConcurrentInsert(final StatementContext context) {
            if (CaptureStatements.deletes(context, "entity_relationship")) {
              beforeDelete.complete(null);
              releaseDelete.orTimeout(30, TimeUnit.SECONDS).join();
            }
          }
        });
    final var deletion =
        CompletableFuture.runAsync(
            () ->
                jdbi.useTransaction(
                    TransactionIsolationLevel.READ_COMMITTED,
                    handle ->
                        handle
                            .attach(EntityRelationshipDAO.class)
                            .deleteAllFrom(domain, Entity.DOMAIN)),
            DedicatedThreads.EXECUTOR);
    try {
      beforeDelete.orTimeout(30, TimeUnit.SECONDS).join();
      seed(jdbi, domain, List.of(inserted));
    } finally {
      releaseDelete.complete(null);
      deletion
          .whenComplete((result, failure) -> jdbi.setSqlLogger(SqlLogger.NOP_SQL_LOGGER))
          .get(30, TimeUnit.SECONDS);
    }
    assertEquals(
        List.of(inserted.toString()),
        jdbi.withHandle(
            handle ->
                handle
                    .createQuery("SELECT toId FROM entity_relationship")
                    .mapTo(String.class)
                    .list()));
    final long mutationId =
        journal(jdbi).claim(ProjectionTarget.SEARCH, 10, Duration.ofSeconds(30)).getFirst().id();
    assertEquals(
        List.of(existing),
        snapshots(backend).page(mutationId, 0, 10).stream().map(row -> row.to().id()).toList());
  }

  private static ProjectionJournal journal(final Jdbi jdbi) {
    return new ProjectionJournal(jdbi, Clock.systemUTC(), EnumSet.allOf(ProjectionTarget.class));
  }

  private static RelationshipSnapshotStore snapshots(final RdfTestDatabase.Backend backend) {
    final Jdbi jdbi = DATABASES.get(backend).jdbi();
    return new RelationshipSnapshotStore(
        jdbi,
        journal(jdbi),
        backend == RdfTestDatabase.Backend.MYSQL ? ConnectionType.MYSQL : ConnectionType.POSTGRES);
  }

  private static void seed(final Jdbi jdbi, final UUID from, final List<UUID> ids) {
    jdbi.useTransaction(
        handle -> {
          final var batch =
              handle.prepareBatch(
                  "INSERT INTO entity_relationship (fromId, toId, fromEntity, toEntity, relation) VALUES (?, ?, ?, ?, ?)");
          for (final UUID id : ids) {
            batch.add(
                from.toString(),
                id.toString(),
                Entity.DOMAIN,
                Entity.TABLE,
                Relationship.HAS.ordinal());
          }
          batch.execute();
        });
  }

  private static long count(final Jdbi jdbi, final String table) {
    return jdbi.withHandle(
        handle -> handle.createQuery("SELECT COUNT(*) FROM " + table).mapTo(Long.class).one());
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void retainedKeysWorkWithTheCatalogsExistingCollation(final RdfTestDatabase.Backend backend) {
    final Jdbi jdbi = DATABASES.get(backend).jdbi();
    final UUID domain = UUID.randomUUID();
    seed(jdbi, domain, List.of(UUID.randomUUID()));
    if (backend == RdfTestDatabase.Backend.MYSQL) {
      jdbi.useHandle(
          handle ->
              handle.execute(
                  "ALTER TABLE entity_relationship CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"));
    }
    try {
      jdbi.onDemand(EntityRelationshipDAO.class).deleteAllFrom(domain, Entity.DOMAIN);
      assertEquals(0, count(jdbi, "entity_relationship"));
      assertEquals(1, count(jdbi, "metadata_projection_relationship"));
    } finally {
      if (backend == RdfTestDatabase.Backend.MYSQL) {
        jdbi.useHandle(
            handle ->
                handle.execute(
                    "ALTER TABLE entity_relationship CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci"));
      }
    }
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void lineageUpdateRetainsOldAndNewPipelineIdentifiers(final RdfTestDatabase.Backend backend) {
    final Jdbi jdbi = DATABASES.get(backend).jdbi();
    final EntityRelationshipDAO dao = jdbi.onDemand(EntityRelationshipDAO.class);
    final UUID from = UUID.randomUUID();
    final UUID to = UUID.randomUUID();
    final UUID previousPipeline = UUID.randomUUID();
    final UUID nextPipeline = UUID.randomUUID();
    dao.insert(
        from,
        to,
        Entity.TABLE,
        Entity.TABLE,
        Relationship.UPSTREAM.ordinal(),
        "",
        "{\"pipeline\":{\"id\":\"" + previousPipeline + "\"}}");
    dao.insert(
        from,
        to,
        Entity.TABLE,
        Entity.TABLE,
        Relationship.UPSTREAM.ordinal(),
        "",
        "{\"pipeline\":{\"id\":\"" + nextPipeline + "\"}}");
    final var facts = journal(jdbi).claim(ProjectionTarget.SEARCH, 10, Duration.ofSeconds(30));
    assertEquals(2, facts.size());
    final var updated = snapshots(backend).page(facts.getLast().id(), 0, 10);
    assertEquals(
        Set.of(previousPipeline, nextPipeline),
        updated.stream().map(row -> row.relatedIds().pipelineId()).collect(Collectors.toSet()));
    assertEquals(
        Set.of(from), updated.stream().map(row -> row.from().id()).collect(Collectors.toSet()));
    assertEquals(
        Set.of(to), updated.stream().map(row -> row.to().id()).collect(Collectors.toSet()));
    assertEquals(1, count(jdbi, "entity_relationship"));
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void concurrentInsertCannotBeMovedOutsideTheRetainedSet(final RdfTestDatabase.Backend backend)
      throws Exception {
    final var fixture = DATABASES.get(backend);
    final Jdbi jdbi = fixture.jdbi();
    final UUID oldDomain = UUID.randomUUID();
    final UUID newDomain = UUID.randomUUID();
    final UUID existing = UUID.randomUUID();
    final UUID inserted = UUID.randomUUID();
    seed(jdbi, oldDomain, List.of(existing));
    final CompletableFuture<Void> beforeUpdate = new CompletableFuture<>();
    final CompletableFuture<Void> releaseUpdate = new CompletableFuture<>();
    jdbi.setSqlLogger(
        new SqlLogger() {
          @Override
          public void logBeforeExecution(final StatementContext context) {
            if (context.getRenderedSql().startsWith("UPDATE entity_relationship ")) {
              beforeUpdate.complete(null);
              releaseUpdate.orTimeout(30, TimeUnit.SECONDS).join();
            }
          }
        });
    final var move =
        CompletableFuture.runAsync(
            () ->
                jdbi.useTransaction(
                    TransactionIsolationLevel.READ_COMMITTED,
                    handle ->
                        handle
                            .attach(EntityRelationshipDAO.class)
                            .bulkUpdateFromId(
                                oldDomain,
                                newDomain,
                                List.of(existing.toString(), inserted.toString()),
                                Entity.DOMAIN,
                                Entity.TABLE,
                                Relationship.HAS.ordinal())),
            DedicatedThreads.EXECUTOR);
    move.whenComplete(
        (ignored, failure) -> {
          if (failure != null) {
            beforeUpdate.completeExceptionally(failure);
          }
        });
    try {
      beforeUpdate.orTimeout(30, TimeUnit.SECONDS).join();
      seed(jdbi, oldDomain, List.of(inserted));
    } finally {
      releaseUpdate.complete(null);
      move.whenComplete((ignored, failure) -> jdbi.setSqlLogger(SqlLogger.NOP_SQL_LOGGER))
          .get(30, TimeUnit.SECONDS);
    }
    assertEquals(
        List.of(inserted.toString()),
        jdbi.withHandle(
            handle ->
                handle
                    .createQuery("SELECT toId FROM entity_relationship WHERE fromId = ?")
                    .bind(0, oldDomain.toString())
                    .mapTo(String.class)
                    .list()));
    assertEquals(
        List.of(existing.toString()),
        jdbi.withHandle(
            handle ->
                handle
                    .createQuery("SELECT toId FROM entity_relationship WHERE fromId = ?")
                    .bind(0, newDomain.toString())
                    .mapTo(String.class)
                    .list()));
    final long mutationId =
        fixture
            .journal()
            .claim(ProjectionTarget.SEARCH, 10, Duration.ofSeconds(30))
            .getFirst()
            .id();
    final var retained = fixture.snapshots().page(mutationId, 0, 10);
    assertEquals(
        Set.of(oldDomain, newDomain),
        retained.stream().map(row -> row.from().id()).collect(Collectors.toSet()));
    assertEquals(
        Set.of(existing), retained.stream().map(row -> row.to().id()).collect(Collectors.toSet()));
  }
}
