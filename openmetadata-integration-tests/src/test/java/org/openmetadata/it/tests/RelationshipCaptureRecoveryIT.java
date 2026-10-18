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

import java.time.Duration;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.statement.SqlLogger;
import org.jdbi.v3.core.statement.StatementContext;
import org.jdbi.v3.core.statement.UnableToExecuteStatementException;
import org.jdbi.v3.core.transaction.TransactionIsolationLevel;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.condition.EnabledIf;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipDAO;
import org.openmetadata.service.jdbi3.DeadlockRetry;
import org.openmetadata.service.jdbi3.FeedDAOs;
import org.openmetadata.service.projection.ProjectionTarget;

@Execution(ExecutionMode.SAME_THREAD)
class RelationshipCaptureRecoveryIT {
  private static final Map<RdfTestDatabase.Backend, RelationshipCaptureFixture> DATABASES =
      new EnumMap<>(RdfTestDatabase.Backend.class);

  @BeforeAll
  static void startDatabases() {
    for (final var backend : RdfTestDatabase.backends().toList()) {
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
  void pointWriteCaptureFailureFailsTheWholeCommit(final RdfTestDatabase.Backend backend) {
    final Jdbi jdbi = DATABASES.get(backend).jdbi();
    jdbi.useHandle(
        handle ->
            handle.execute(
                "ALTER TABLE metadata_projection_relationship RENAME TO unavailable_snapshot"));
    try {
      assertThrows(
          UnableToExecuteStatementException.class,
          () ->
              jdbi.useTransaction(
                  handle -> {
                    handle
                        .attach(EntityRelationshipDAO.class)
                        .insert(
                            UUID.randomUUID(),
                            UUID.randomUUID(),
                            Entity.DOMAIN,
                            Entity.TABLE,
                            Relationship.HAS.ordinal());
                    handle.execute(
                        "INSERT INTO entity_relationship (fromId, toId, fromEntity, toEntity, relation) VALUES (?, ?, ?, ?, ?)",
                        UUID.randomUUID().toString(),
                        UUID.randomUUID().toString(),
                        Entity.DOMAIN,
                        Entity.TABLE,
                        Relationship.HAS.ordinal());
                  }));
      assertEquals(0, count(jdbi, "entity_relationship"));
      assertEquals(0, count(jdbi, "metadata_projection_mutation"));
    } finally {
      jdbi.useHandle(
          handle ->
              handle.execute(
                  "ALTER TABLE unavailable_snapshot RENAME TO metadata_projection_relationship"));
    }
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void caughtSpillFailurePoisonsTheTransaction(final RdfTestDatabase.Backend backend) {
    final Jdbi jdbi = DATABASES.get(backend).jdbi();
    final AtomicBoolean failOnce = new AtomicBoolean(true);
    jdbi.setSqlLogger(
        new SqlLogger() {
          @Override
          public void logBeforeExecution(final StatementContext context) {
            if (context.getRenderedSql().startsWith("INSERT INTO metadata_projection_relationship")
                && failOnce.compareAndSet(true, false)) {
              throw new IllegalStateException("snapshot spill unavailable");
            }
          }
        });
    try {
      assertThrows(
          IllegalStateException.class,
          () ->
              jdbi.useTransaction(
                  handle ->
                      assertTrue(
                          spillFailsWhileCaught(handle.attach(EntityRelationshipDAO.class)))));
    } finally {
      jdbi.setSqlLogger(SqlLogger.NOP_SQL_LOGGER);
    }
    assertEquals(0, count(jdbi, "entity_relationship"));
    assertEquals(0, count(jdbi, "metadata_projection_mutation"));
  }

  /** The 1,001st buffered row spills; the caller catches that failure and carries on. */
  private static boolean spillFailsWhileCaught(final EntityRelationshipDAO dao) {
    final UUID domain = UUID.randomUUID();
    for (int index = 0; index <= 1000; index++) {
      try {
        dao.insert(
            domain, UUID.randomUUID(), Entity.DOMAIN, Entity.TABLE, Relationship.HAS.ordinal());
      } catch (IllegalStateException expected) {
        return true;
      }
    }
    return false;
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void caughtFailureAfterDeleteRestoresEveryRelationship(final RdfTestDatabase.Backend backend) {
    final Jdbi jdbi = DATABASES.get(backend).jdbi();
    final UUID domain = UUID.randomUUID();
    jdbi.useTransaction(
        handle -> {
          final var insert =
              handle.prepareBatch(
                  "INSERT INTO entity_relationship (fromId, toId, fromEntity, toEntity, relation) VALUES (?, ?, ?, ?, ?)");
          for (int i = 0; i < 205; i++) {
            insert.add(
                domain.toString(),
                UUID.randomUUID().toString(),
                Entity.DOMAIN,
                Entity.TABLE,
                Relationship.HAS.ordinal());
          }
          insert.execute();
        });
    final AtomicInteger pages = new AtomicInteger();
    jdbi.setSqlLogger(
        new SqlLogger() {
          @Override
          public void logAfterExecution(final StatementContext context) {
            if ((CaptureStatements.deletes(context, "entity_relationship"))
                && pages.incrementAndGet() == 1) {
              throw new IllegalStateException("failure after source delete");
            }
          }
        });
    try {
      jdbi.useTransaction(
          handle -> {
            assertThrows(
                IllegalStateException.class,
                () ->
                    handle
                        .attach(EntityRelationshipDAO.class)
                        .deleteAllFrom(domain, Entity.DOMAIN));
            assertEquals(
                205,
                handle
                    .createQuery("SELECT COUNT(*) FROM entity_relationship")
                    .mapTo(Integer.class)
                    .one());
          });
    } finally {
      jdbi.setSqlLogger(SqlLogger.NOP_SQL_LOGGER);
    }
    assertEquals(1, pages.get());
    assertEquals(205, count(jdbi, "entity_relationship"));
    assertEquals(0, count(jdbi, "metadata_projection_mutation"));
    assertEquals(0, count(jdbi, "metadata_projection_relationship"));
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void deadlockReplaysTheEntireTransactionWithoutLeakingFacts(final RdfTestDatabase.Backend backend)
      throws Exception {
    final var fixture = DATABASES.get(backend);
    final UUID first = UUID.randomUUID();
    final UUID second = UUID.randomUUID();
    final UUID table = UUID.randomUUID();
    fixture
        .jdbi()
        .useHandle(
            handle -> {
              for (final UUID domain : List.of(first, second)) {
                handle.execute(
                    "INSERT INTO entity_relationship (fromId, toId, fromEntity, toEntity, relation) VALUES (?, ?, ?, ?, ?)",
                    domain.toString(),
                    table.toString(),
                    Entity.DOMAIN,
                    Entity.TABLE,
                    Relationship.HAS.ordinal());
              }
            });
    final AtomicInteger firstAttempts = new AtomicInteger();
    final AtomicInteger secondAttempts = new AtomicInteger();
    final CompletableFuture<Void> firstLocked = new CompletableFuture<>();
    final CompletableFuture<Void> secondLocked = new CompletableFuture<>();
    final var left =
        CompletableFuture.runAsync(
            () ->
                deadlockingUpdate(
                    fixture.jdbi(),
                    List.of(first, second, table),
                    firstAttempts,
                    firstLocked,
                    secondLocked),
            DedicatedThreads.EXECUTOR);
    final var right =
        CompletableFuture.runAsync(
            () ->
                deadlockingUpdate(
                    fixture.jdbi(),
                    List.of(second, first, table),
                    secondAttempts,
                    secondLocked,
                    firstLocked),
            DedicatedThreads.EXECUTOR);
    CompletableFuture.allOf(left, right).get(45, TimeUnit.SECONDS);
    assertTrue(firstAttempts.get() + secondAttempts.get() >= 3);
    // Each committed transaction buffers both point upserts under one header at commit.
    assertEquals(2, count(fixture.jdbi(), "entity_relationship"));
    assertEquals(2, count(fixture.jdbi(), "metadata_projection_mutation"));
    assertEquals(4, count(fixture.jdbi(), "metadata_projection_relationship"));
    assertEquals(
        2, fixture.journal().claim(ProjectionTarget.SEARCH, 10, Duration.ofSeconds(30)).size());
    assertEquals(
        2, fixture.journal().claim(ProjectionTarget.RDF, 10, Duration.ofSeconds(30)).size());
  }

  private static void deadlockingUpdate(
      final Jdbi jdbi,
      final List<UUID> ids,
      final AtomicInteger attempts,
      final CompletableFuture<Void> ownLock,
      final CompletableFuture<Void> otherLock) {
    DeadlockRetry.run(
        () -> {
          final int attempt = attempts.incrementAndGet();
          jdbi.useTransaction(
              TransactionIsolationLevel.READ_COMMITTED,
              handle -> {
                final var dao = handle.attach(EntityRelationshipDAO.class);
                dao.insert(
                    ids.get(0),
                    ids.get(2),
                    Entity.DOMAIN,
                    Entity.TABLE,
                    Relationship.HAS.ordinal(),
                    "{} ");
                if (attempt == 1) {
                  ownLock.complete(null);
                  otherLock.orTimeout(30, TimeUnit.SECONDS).join();
                }
                dao.insert(
                    ids.get(1),
                    ids.get(2),
                    Entity.DOMAIN,
                    Entity.TABLE,
                    Relationship.HAS.ordinal(),
                    "{}");
              });
        });
  }

  @ParameterizedTest
  @EnumSource(value = RdfTestDatabase.Backend.class, names = "MYSQL")
  @EnabledIf("org.openmetadata.it.tests.RdfTestDatabase#mysqlEnabled")
  void secondaryUniqueConflictRetainsTheActualExistingEdge(final RdfTestDatabase.Backend backend) {
    final var fixture = DATABASES.get(backend);
    final UUID oldGroup = UUID.randomUUID();
    final UUID newGroup = UUID.randomUUID();
    final UUID metric = UUID.randomUUID();
    final UUID oldPipeline = UUID.randomUUID();
    final UUID newPipeline = UUID.randomUUID();
    for (int i = 0; i < 50; i++) {
      fixture
          .jdbi()
          .useHandle(
              handle ->
                  handle.execute(
                      "INSERT INTO entity_relationship (fromId, toId, fromEntity, toEntity, relation) VALUES (?, ?, 'team', 'metric', 10)",
                      newGroup.toString(),
                      UUID.randomUUID().toString()));
    }
    fixture
        .dao()
        .insert(
            oldGroup,
            metric,
            Entity.METRIC_GROUP,
            Entity.METRIC,
            Relationship.HAS.ordinal(),
            "{\"pipeline\":{\"id\":\"" + oldPipeline + "\"}}");
    fixture
        .dao()
        .insert(
            newGroup,
            metric,
            Entity.METRIC_GROUP,
            Entity.METRIC,
            Relationship.HAS.ordinal(),
            "{\"pipeline\":{\"id\":\"" + newPipeline + "\"}}");
    final var facts = fixture.journal().claim(ProjectionTarget.SEARCH, 10, Duration.ofSeconds(30));
    assertEquals(2, facts.size());
    final var retained = fixture.snapshots().page(facts.getLast().id(), 0, 10);
    assertEquals(
        Set.of(oldGroup),
        retained.stream().map(row -> row.from().id()).collect(Collectors.toSet()));
    assertEquals(
        Set.of(oldPipeline, newPipeline),
        retained.stream().map(row -> row.relatedIds().pipelineId()).collect(Collectors.toSet()));
    assertEquals(51, count(fixture.jdbi(), "entity_relationship"));
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void feedCleanupUsesRelationshipCapture(final RdfTestDatabase.Backend backend) {
    final var fixture = DATABASES.get(backend);
    final UUID domain = UUID.randomUUID();
    final UUID task = UUID.randomUUID();
    final UUID otherTask = UUID.randomUUID();
    fixture.dao().insert(domain, task, Entity.DOMAIN, Entity.TASK, Relationship.HAS.ordinal());
    fixture.dao().insert(domain, otherTask, Entity.DOMAIN, Entity.TASK, Relationship.HAS.ordinal());
    fixture.journal().claim(ProjectionTarget.SEARCH, 10, Duration.ofSeconds(30));
    final var feed = fixture.jdbi().onDemand(FeedDAOs.TaskDAO.class);
    feed.bulkRemoveDomainRelationships(List.of(task.toString()));
    final var first = fixture.journal().claim(ProjectionTarget.SEARCH, 10, Duration.ofSeconds(30));
    assertEquals(
        List.of(task),
        fixture.snapshots().page(first.getFirst().id(), 0, 10).stream()
            .map(row -> row.to().id())
            .toList());
    assertEquals(1, count(fixture.jdbi(), "entity_relationship"));
    feed.deleteTaskRelationships();
    final var second = fixture.journal().claim(ProjectionTarget.SEARCH, 10, Duration.ofSeconds(30));
    assertEquals(
        List.of(otherTask),
        fixture.snapshots().page(second.getFirst().id(), 0, 10).stream()
            .map(row -> row.to().id())
            .toList());
    assertEquals(0, count(fixture.jdbi(), "entity_relationship"));
  }

  private static long count(final Jdbi jdbi, final String table) {
    return jdbi.withHandle(
        handle -> handle.createQuery("SELECT COUNT(*) FROM " + table).mapTo(Long.class).one());
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void ontologyIdentifierConflictPreservesTheOriginalUpsertBehavior(
      final RdfTestDatabase.Backend backend) {
    final var fixture = DATABASES.get(backend);
    final UUID originalFrom = UUID.randomUUID();
    final UUID originalTo = UUID.randomUUID();
    final UUID relationshipId = UUID.randomUUID();
    final UUID oldType = UUID.randomUUID();
    final UUID newType = UUID.randomUUID();
    final int relation = Relationship.RELATED_TO.ordinal();
    fixture
        .jdbi()
        .useHandle(
            handle ->
                handle.execute(
                    """
        INSERT INTO entity_relationship (fromId, toId, fromEntity, toEntity, relation, relationType, relationshipId, relationshipTypeId)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """,
                    originalFrom.toString(),
                    originalTo.toString(),
                    Entity.GLOSSARY_TERM,
                    Entity.GLOSSARY_TERM,
                    relation,
                    "synonym",
                    relationshipId.toString(),
                    oldType.toString()));
    final Runnable upsert =
        () ->
            fixture
                .dao()
                .insertOntologyRelationship(
                    UUID.randomUUID(),
                    UUID.randomUUID(),
                    Entity.GLOSSARY_TERM,
                    Entity.GLOSSARY_TERM,
                    relation,
                    "synonym",
                    relationshipId,
                    newType,
                    "{}");
    if (backend == RdfTestDatabase.Backend.POSTGRES) {
      assertThrows(UnableToExecuteStatementException.class, upsert::run);
      assertEquals(0, count(fixture.jdbi(), "metadata_projection_mutation"));
    } else {
      upsert.run();
      final var claims =
          fixture.journal().claim(ProjectionTarget.SEARCH, 10, Duration.ofSeconds(30));
      assertEquals(1, claims.size());
      final var snapshots = fixture.snapshots().page(claims.getFirst().id(), 0, 10);
      assertEquals(
          Set.of(originalFrom),
          snapshots.stream().map(row -> row.from().id()).collect(Collectors.toSet()));
      assertEquals(
          Set.of(originalTo),
          snapshots.stream().map(row -> row.to().id()).collect(Collectors.toSet()));
      assertEquals(
          Set.of(oldType, newType),
          snapshots.stream()
              .map(row -> row.relatedIds().relationshipTypeId())
              .collect(Collectors.toSet()));
    }
    assertEquals(1, count(fixture.jdbi(), "entity_relationship"));
  }
}
