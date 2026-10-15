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
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.List;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Collectors;
import org.jdbi.v3.core.statement.SqlLogger;
import org.jdbi.v3.core.statement.StatementContext;
import org.jdbi.v3.core.statement.UnableToExecuteStatementException;
import org.jdbi.v3.core.transaction.TransactionIsolationLevel;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.FieldRelationshipDAO;
import org.openmetadata.service.projection.ProjectionTarget;

class FieldRelationshipCaptureRecoveryIT extends FieldRelationshipCaptureTestBase {
  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void anIgnoredInsertCannotCommitAnUncapturedCoercedKey(final RdfTestDatabase.Backend backend) {
    final var fixture = fixture(backend);
    assertThrows(
        RuntimeException.class,
        () ->
            fixture
                .dao()
                .insert(
                    null,
                    "table",
                    "thread",
                    "table",
                    "THREAD",
                    "table",
                    Relationship.IS_ABOUT.ordinal(),
                    null));
    assertEquals(0, fixture.count("field_relationship"));
    assertEquals(0, fixture.count("metadata_projection_mutation"));
    assertEquals(0, fixture.count("metadata_projection_field_relationship"));
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void batchCaptureRejectsAChangedKeyAndRollsBackValidRowsToo(
      final RdfTestDatabase.Backend backend) {
    final var fixture = fixture(backend);
    final var invalid =
        FieldRelationshipCaptureFixture.relationship(
            "invalid", "table", Relationship.IS_ABOUT.ordinal());
    invalid.setFromFQNHash(null);
    assertThrows(
        RuntimeException.class,
        () ->
            fixture
                .dao()
                .insertMany(
                    List.of(
                        FieldRelationshipCaptureFixture.relationship(
                            "valid", "table", Relationship.IS_ABOUT.ordinal()),
                        invalid)));
    assertEquals(0, fixture.count("field_relationship"));
    assertEquals(0, fixture.count("metadata_projection_mutation"));
    assertEquals(0, fixture.count("metadata_projection_field_relationship"));
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void pointWriteCaptureFailureFailsTheWholeCommit(final RdfTestDatabase.Backend backend) {
    final var fixture = fixture(backend);
    fixture.seed("owner", "pipeline.task", "team", "task", Relationship.OWNS.ordinal());
    failRetainedRowInserts(fixture);
    try {
      assertThrows(
          IllegalStateException.class,
          () ->
              fixture
                  .jdbi()
                  .useTransaction(
                      handle -> {
                        final var dao = handle.attach(FieldRelationshipDAO.class);
                        dao.insert(
                            "other",
                            "pipeline.task",
                            "other",
                            "pipeline.task",
                            "user",
                            "task",
                            Relationship.OWNS.ordinal(),
                            null);
                        dao.upsert(
                            "owner",
                            "pipeline.task",
                            "owner",
                            "pipeline.task",
                            "team",
                            "task",
                            Relationship.OWNS.ordinal(),
                            "metadata",
                            "{\"changed\":true}");
                        handle.execute(
                            "UPDATE field_relationship SET jsonSchema = 'must not commit'");
                      }));
    } finally {
      fixture.jdbi().setSqlLogger(SqlLogger.NOP_SQL_LOGGER);
    }
    assertEquals(List.of("pipeline.task"), fixture.destinations());
    assertNull(jsonSchema(fixture));
    assertEquals(0, fixture.count("metadata_projection_mutation"));
    assertEquals(0, fixture.count("metadata_projection_consumer"));
    assertEquals(0, fixture.count("metadata_projection_field_relationship"));
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void caughtSelectedCaptureFailureRestoresTheStatementAndKeepsTheTransactionUsable(
      final RdfTestDatabase.Backend backend) {
    final var fixture = fixture(backend);
    fixture.seed("owner", "pipeline.task", "team", "task", Relationship.OWNS.ordinal());
    failRetainedRowInserts(fixture);
    try {
      fixture
          .jdbi()
          .useTransaction(
              handle -> {
                final var dao = handle.attach(FieldRelationshipDAO.class);
                assertThrows(
                    IllegalStateException.class,
                    () ->
                        dao.delete(
                            "owner", "pipeline.task", "team", "task", Relationship.OWNS.ordinal()));
                assertThrows(
                    IllegalStateException.class,
                    () ->
                        dao.insertMany(
                            List.of(
                                FieldRelationshipCaptureFixture.relationship(
                                    "thread", "table", Relationship.IS_ABOUT.ordinal()),
                                FieldRelationshipCaptureFixture.relationship(
                                    "thread", "other", Relationship.IS_ABOUT.ordinal()))));
                handle.execute("UPDATE field_relationship SET jsonSchema = 'transaction survived'");
              });
    } finally {
      fixture.jdbi().setSqlLogger(SqlLogger.NOP_SQL_LOGGER);
    }
    assertEquals(List.of("pipeline.task"), fixture.destinations());
    assertEquals("transaction survived", jsonSchema(fixture));
    assertEquals(0, fixture.count("metadata_projection_mutation"));
    assertEquals(0, fixture.count("metadata_projection_consumer"));
    assertEquals(0, fixture.count("metadata_projection_field_relationship"));
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void failureAfterDeleteRestoresEveryRelationship(final RdfTestDatabase.Backend backend) {
    final var fixture = fixture(backend);
    fixture.seedFanout(205);
    final AtomicInteger pages = new AtomicInteger();
    fixture
        .jdbi()
        .setSqlLogger(
            new SqlLogger() {
              @Override
              public void logAfterExecution(final StatementContext context) {
                if ((CaptureStatements.deletes(context, "field_relationship"))
                    && pages.incrementAndGet() == 1) {
                  throw new IllegalStateException("failure after source delete");
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
                    () ->
                        handle
                            .attach(FieldRelationshipDAO.class)
                            .deleteAllByPrefix("service.table"));
                assertEquals(
                    205,
                    handle
                        .createQuery("SELECT COUNT(*) FROM field_relationship")
                        .mapTo(Integer.class)
                        .one());
              });
    } finally {
      fixture.jdbi().setSqlLogger(SqlLogger.NOP_SQL_LOGGER);
    }
    assertEquals(1, pages.get());
    assertEquals(205, fixture.count("field_relationship"));
    assertEquals(0, fixture.count("metadata_projection_mutation"));
    assertEquals(0, fixture.count("metadata_projection_field_relationship"));
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void aConcurrentMatchingInsertCannotBeDeletedWithoutCapture(final RdfTestDatabase.Backend backend)
      throws Exception {
    final var fixture = fixture(backend);
    fixture.seed(
        "thread", "service.table.before", "THREAD", "table", Relationship.IS_ABOUT.ordinal());
    final CompletableFuture<Void> selected = new CompletableFuture<>();
    final CompletableFuture<Void> release = new CompletableFuture<>();
    fixture
        .jdbi()
        .setSqlLogger(
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
                if (CaptureStatements.deletes(context, "field_relationship")) {
                  selected.complete(null);
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
                                .attach(FieldRelationshipDAO.class)
                                .deleteAllByPrefix("service.table")),
            DedicatedThreads.EXECUTOR);
    try {
      selected.orTimeout(30, TimeUnit.SECONDS).join();
      fixture.seed(
          "thread", "service.table.concurrent", "THREAD", "table", Relationship.IS_ABOUT.ordinal());
    } finally {
      release.complete(null);
      deletion
          .whenComplete((result, failure) -> fixture.jdbi().setSqlLogger(SqlLogger.NOP_SQL_LOGGER))
          .get(30, TimeUnit.SECONDS);
    }
    assertEquals(List.of("service.table.concurrent"), fixture.destinations());
    assertEquals(
        List.of("service.table.before"),
        fixture.retained().stream().map(row -> row.to().fqn()).toList());
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void concurrentUpsertsOfAnInitiallyAbsentKeyRetainTheCommittedPreimage(
      final RdfTestDatabase.Backend backend) throws Exception {
    final var fixture = fixture(backend);
    final CompletableFuture<Void> firstLocked = new CompletableFuture<>();
    final CompletableFuture<Void> secondAttempted = new CompletableFuture<>();
    final CompletableFuture<Void> release = new CompletableFuture<>();
    final AtomicBoolean retained = new AtomicBoolean();
    final AtomicInteger guards = new AtomicInteger();
    fixture
        .jdbi()
        .setSqlLogger(
            new SqlLogger() {
              @Override
              public void logBeforeExecution(final StatementContext context) {
                final String sql = context.getRenderedSql();
                if (sql.startsWith("INSERT INTO field_relationship")
                    && sql.endsWith("fromFQNHash = field_relationship.fromFQNHash")
                    && guards.incrementAndGet() == 2) {
                  secondAttempted.complete(null);
                }
                if (sql.startsWith("INSERT INTO metadata_projection_field_relationship")
                    && retained.compareAndSet(false, true)) {
                  firstLocked.complete(null);
                  release.orTimeout(30, TimeUnit.SECONDS).join();
                }
              }
            });
    final var first =
        CompletableFuture.runAsync(() -> upsert(fixture, 1), DedicatedThreads.EXECUTOR);
    CompletableFuture<Void> second = CompletableFuture.completedFuture(null);
    try {
      firstLocked.orTimeout(30, TimeUnit.SECONDS).join();
      second = CompletableFuture.runAsync(() -> upsert(fixture, 2), DedicatedThreads.EXECUTOR);
      secondAttempted.orTimeout(30, TimeUnit.SECONDS).join();
    } finally {
      release.complete(null);
      CompletableFuture.allOf(first, second)
          .whenComplete((result, failure) -> fixture.jdbi().setSqlLogger(SqlLogger.NOP_SQL_LOGGER))
          .get(30, TimeUnit.SECONDS);
    }
    final var claims = fixture.claims(ProjectionTarget.SEARCH);
    assertEquals(2, claims.size());
    final var secondRows = fixture.snapshots().page(claims.get(1).id(), 0, 10);
    assertEquals(
        Set.of(1, 2),
        secondRows.stream()
            .map(row -> JsonUtils.readTree(row.metadata().json()).get("count").asInt())
            .collect(Collectors.toSet()));
    assertEquals(
        2,
        JsonUtils.readTree(
                fixture
                    .dao()
                    .find(
                        "table.column",
                        "other.column",
                        "column",
                        "column",
                        Relationship.JOINED_WITH.ordinal()))
            .get("count")
            .asInt());
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void prefixCollisionRollsBackRootRenameAndRetainedRows(final RdfTestDatabase.Backend backend) {
    final var fixture = fixture(backend);
    fixture.seed("thread", "before", "THREAD", "table", Relationship.IS_ABOUT.ordinal());
    fixture.seed("thread", "before.child", "THREAD", "table", Relationship.IS_ABOUT.ordinal());
    fixture.seed("thread", "after.child", "THREAD", "table", Relationship.IS_ABOUT.ordinal());
    assertThrows(
        UnableToExecuteStatementException.class,
        () -> fixture.dao().renameByToFQN("before", "after"));
    assertEquals(List.of("after.child", "before", "before.child"), fixture.destinations());
    assertEquals(0, fixture.count("metadata_projection_mutation"));
    assertEquals(0, fixture.count("metadata_projection_field_relationship"));
  }

  private static void failRetainedRowInserts(final FieldRelationshipCaptureFixture fixture) {
    fixture
        .jdbi()
        .setSqlLogger(
            new SqlLogger() {
              @Override
              public void logBeforeExecution(final StatementContext context) {
                if (context
                    .getRenderedSql()
                    .contains("INSERT INTO metadata_projection_field_relationship")) {
                  throw new IllegalStateException("retention unavailable");
                }
              }
            });
  }

  private static String jsonSchema(final FieldRelationshipCaptureFixture fixture) {
    return fixture
        .jdbi()
        .withHandle(
            handle ->
                handle
                    .createQuery("SELECT jsonSchema FROM field_relationship")
                    .mapTo(String.class)
                    .one());
  }

  private static void upsert(final FieldRelationshipCaptureFixture fixture, final int count) {
    fixture
        .dao()
        .upsert(
            "table.column",
            "other.column",
            "table.column",
            "other.column",
            "column",
            "column",
            Relationship.JOINED_WITH.ordinal(),
            "dailyCount",
            "{\"count\":" + count + "}");
  }
}
