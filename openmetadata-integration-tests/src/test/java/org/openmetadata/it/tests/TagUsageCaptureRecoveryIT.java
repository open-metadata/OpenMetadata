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
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.EnumMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.IntStream;
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
import org.openmetadata.service.jdbi3.ClassificationTagDAOs.TagUsageDAO;
import org.openmetadata.service.projection.TagUsageSnapshot;
import org.openmetadata.service.util.FullyQualifiedName;

@Execution(ExecutionMode.SAME_THREAD)
class TagUsageCaptureRecoveryIT {
  private static final Map<RdfTestDatabase.Backend, TagUsageCaptureFixture> DATABASES =
      new EnumMap<>(RdfTestDatabase.Backend.class);

  @BeforeAll
  static void startDatabases() {
    for (final RdfTestDatabase.Backend backend : RdfTestDatabase.backends().toList()) {
      DATABASES.put(backend, new TagUsageCaptureFixture(backend));
    }
  }

  @AfterAll
  static void stopDatabases() {
    DATABASES.values().forEach(TagUsageCaptureFixture::close);
    DATABASES.clear();
  }

  @BeforeEach
  void clearRows() {
    DATABASES.values().forEach(TagUsageCaptureFixture::clear);
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void pointApplicationCaptureFailureFailsTheWholeCommit(final RdfTestDatabase.Backend backend) {
    final TagUsageCaptureFixture fixture = DATABASES.get(backend);
    fixture.seed(1, "Glossary.Customer", "service.table");
    fixture
        .jdbi()
        .useHandle(
            handle ->
                handle.execute(
                    "ALTER TABLE metadata_projection_tag_usage RENAME TO unavailable_snapshot"));
    try {
      assertThrows(
          UnableToExecuteStatementException.class,
          () ->
              fixture
                  .jdbi()
                  .useTransaction(
                      handle -> {
                        handle
                            .attach(TagUsageDAO.class)
                            .applyTag(
                                1,
                                "Glossary.Customer",
                                "Glossary.Customer",
                                "service.other",
                                0,
                                1,
                                null,
                                "admin");
                        handle.execute("UPDATE tag_usage SET reason = 'must not commit'");
                      }));
      assertEquals(1, fixture.count("tag_usage"));
      assertNull(
          fixture
              .jdbi()
              .withHandle(
                  handle ->
                      handle
                          .createQuery("SELECT reason FROM tag_usage")
                          .mapTo(String.class)
                          .one()));
      assertEquals(0, fixture.count("metadata_projection_mutation"));
    } finally {
      fixture
          .jdbi()
          .useHandle(
              handle ->
                  handle.execute(
                      "ALTER TABLE unavailable_snapshot RENAME TO metadata_projection_tag_usage"));
    }
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void caughtDeletionCaptureFailureRollsBackOnlyTheDeletion(final RdfTestDatabase.Backend backend) {
    final TagUsageCaptureFixture fixture = DATABASES.get(backend);
    fixture.seed(1, "Glossary.Customer", "service.table");
    fixture
        .jdbi()
        .useHandle(
            handle ->
                handle.execute(
                    "ALTER TABLE metadata_projection_tag_usage RENAME TO unavailable_snapshot"));
    try {
      fixture
          .jdbi()
          .useTransaction(
              handle -> {
                final TagUsageDAO dao = handle.attach(TagUsageDAO.class);
                assertThrows(
                    UnableToExecuteStatementException.class,
                    () -> dao.deleteTagLabels(1, "Glossary.Customer"));
                handle.execute("UPDATE tag_usage SET reason = 'transaction survived'");
              });
      assertEquals(1, fixture.count("tag_usage"));
      assertEquals(
          "transaction survived",
          fixture
              .jdbi()
              .withHandle(
                  handle ->
                      handle
                          .createQuery("SELECT reason FROM tag_usage")
                          .mapTo(String.class)
                          .one()));
      assertEquals(0, fixture.count("metadata_projection_mutation"));
      assertEquals(0, fixture.count("unavailable_snapshot"));
    } finally {
      fixture
          .jdbi()
          .useHandle(
              handle ->
                  handle.execute(
                      "ALTER TABLE unavailable_snapshot RENAME TO metadata_projection_tag_usage"));
    }
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void failureAfterDeleteRestoresEveryAssociation(final RdfTestDatabase.Backend backend) {
    final TagUsageCaptureFixture fixture = DATABASES.get(backend);
    seedFanout(fixture, 205);
    final AtomicInteger writes = new AtomicInteger();
    fixture
        .jdbi()
        .setSqlLogger(
            new SqlLogger() {
              @Override
              public void logAfterExecution(final StatementContext context) {
                if ((CaptureStatements.deletes(context, "tag_usage"))
                    && writes.incrementAndGet() == 1) {
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
                    () -> handle.attach(TagUsageDAO.class).deleteTagLabels(1, "Glossary.Customer"));
                assertEquals(
                    205,
                    handle
                        .createQuery("SELECT COUNT(*) FROM tag_usage")
                        .mapTo(Integer.class)
                        .one());
              });
    } finally {
      fixture.jdbi().setSqlLogger(SqlLogger.NOP_SQL_LOGGER);
    }
    assertEquals(1, writes.get());
    assertEquals(205, fixture.count("tag_usage"));
    assertEquals(0, fixture.count("metadata_projection_mutation"));
    assertEquals(0, fixture.count("metadata_projection_tag_usage"));
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void aConcurrentAssociationCannotDisappearWithoutCapture(final RdfTestDatabase.Backend backend)
      throws Exception {
    final TagUsageCaptureFixture fixture = DATABASES.get(backend);
    fixture.seed(1, "Glossary.Customer", "service.before");
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
                if (CaptureStatements.deletes(context, "tag_usage")) {
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
                                .attach(TagUsageDAO.class)
                                .deleteTagLabels(1, "Glossary.Customer")),
            DedicatedThreads.EXECUTOR);
    try {
      selected.orTimeout(30, TimeUnit.SECONDS).join();
      fixture.seed(1, "Glossary.Customer", "service.concurrent");
    } finally {
      release.complete(null);
      deletion
          .whenComplete((result, failure) -> fixture.jdbi().setSqlLogger(SqlLogger.NOP_SQL_LOGGER))
          .get(30, TimeUnit.SECONDS);
    }
    assertEquals(
        List.of(FullyQualifiedName.buildHash("service.concurrent")),
        fixture
            .jdbi()
            .withHandle(
                handle ->
                    handle
                        .createQuery("SELECT targetFQNHash FROM tag_usage")
                        .mapTo(String.class)
                        .list()));
    assertEquals(
        List.of(FullyQualifiedName.buildHash("service.before")),
        fixture.retained().stream().map(TagUsageSnapshot::targetFqnHash).toList());
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void largeDeletionRetainsAllColumnsWithBoundedSqlAndReadPages(
      final RdfTestDatabase.Backend backend) {
    final TagUsageCaptureFixture fixture = DATABASES.get(backend);
    seedFanout(fixture, 6005);
    final List<Integer> statementSizes = new ArrayList<>();
    fixture
        .jdbi()
        .setSqlLogger(
            new SqlLogger() {
              @Override
              public void logBeforeExecution(final StatementContext context) {
                if ((CaptureStatements.deletes(context, "tag_usage"))) {
                  statementSizes.add(context.getParsedSql().getParameters().getParameterCount());
                }
              }
            });
    try {
      fixture.dao().deleteTagLabels(1, "Glossary.Customer");
    } finally {
      fixture.jdbi().setSqlLogger(SqlLogger.NOP_SQL_LOGGER);
    }
    assertEquals(1, statementSizes.size());
    assertTrue(statementSizes.stream().allMatch(count -> count <= 300));
    assertEquals(0, fixture.count("tag_usage"));
    final long mutationId = fixture.claims().getFirst().id();
    final Set<String> targets = new HashSet<>();
    long after = 0;
    List<TagUsageSnapshot> page;
    do {
      page = fixture.snapshots().page(mutationId, after, 1000);
      assertTrue(page.size() <= 1000);
      targets.addAll(page.stream().map(TagUsageSnapshot::targetFqnHash).toList());
      if (!page.isEmpty()) {
        after = page.getLast().id();
      }
    } while (!page.isEmpty());
    final Set<String> expected = new HashSet<>();
    IntStream.range(0, 6005)
        .forEach(i -> expected.add(FullyQualifiedName.buildHash("service.table.column" + i)));
    assertEquals(expected, targets);
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void aCaughtBatchFailureCannotCommitTheRowsItApplied(final RdfTestDatabase.Backend backend) {
    final TagUsageCaptureFixture fixture = DATABASES.get(backend);
    fixture.seed(1, "Glossary.Customer", "service.before");
    final String target = FullyQualifiedName.buildHash("service.table");
    fixture
        .jdbi()
        .useTransaction(
            handle -> {
              final TagUsageDAO dao = handle.attach(TagUsageDAO.class);
              // MySQL runs the first row before the second violates NOT NULL.
              assertThrows(
                  UnableToExecuteStatementException.class,
                  () ->
                      dao.applyTagsBatchInternal(
                          List.of(1, 1),
                          List.of("Glossary.Customer", "Glossary.Supplier"),
                          List.of(
                              FullyQualifiedName.buildHash("Glossary.Customer"),
                              FullyQualifiedName.buildHash("Glossary.Supplier")),
                          List.of(target, target),
                          Arrays.asList(0, null),
                          List.of(1, 1),
                          Arrays.asList(null, null),
                          List.of("admin", "admin"),
                          Arrays.asList(null, null)));
              handle.execute("UPDATE tag_usage SET reason = 'transaction survived'");
            });
    assertEquals(1, fixture.count("tag_usage"));
    assertEquals(
        "transaction survived",
        fixture
            .jdbi()
            .withHandle(
                handle ->
                    handle.createQuery("SELECT reason FROM tag_usage").mapTo(String.class).one()));
    assertEquals(0, fixture.count("metadata_projection_mutation"));
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void insertBatchCaptureFailureCannotCommitAPartialBatch(final RdfTestDatabase.Backend backend) {
    final TagUsageCaptureFixture fixture = DATABASES.get(backend);
    fixture
        .jdbi()
        .setSqlLogger(
            new SqlLogger() {
              @Override
              public void logBeforeExecution(final StatementContext context) {
                if (context
                    .getRenderedSql()
                    .startsWith("INSERT INTO metadata_projection_tag_usage")) {
                  throw new IllegalStateException("capture unavailable");
                }
              }
            });
    try {
      assertThrows(
          IllegalStateException.class,
          () ->
              fixture
                  .dao()
                  .applyTagsBatch(
                      List.of(
                          TagUsageCaptureFixture.label(1, "Glossary.Customer"),
                          TagUsageCaptureFixture.label(0, "PII.Sensitive")),
                      "service.table"));
    } finally {
      fixture.jdbi().setSqlLogger(SqlLogger.NOP_SQL_LOGGER);
    }
    assertEquals(0, fixture.count("tag_usage"));
    assertEquals(0, fixture.count("metadata_projection_mutation"));
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void deletionDoesNotRevisitEveryRetainedKeyWhenReturningIsAvailable(
      final RdfTestDatabase.Backend backend) {
    final var fixture = DATABASES.get(backend);
    seedFanout(fixture, 205);
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
      fixture.dao().deleteTagLabels(1, "Glossary.Customer");
    } finally {
      fixture.jdbi().setSqlLogger(SqlLogger.NOP_SQL_LOGGER);
    }
    assertEquals(backend == RdfTestDatabase.Backend.POSTGRES ? 3 : 4, statements.get());
    assertEquals(0, fixture.count("tag_usage"));
    assertEquals(205, fixture.count("metadata_projection_tag_usage"));
    assertEquals(2, fixture.count("metadata_projection_consumer"));
  }

  private static void seedFanout(final TagUsageCaptureFixture fixture, final int count) {
    fixture
        .jdbi()
        .useTransaction(
            handle -> {
              final var batch =
                  handle.prepareBatch(
                      "INSERT INTO tag_usage (labelType, state, source, tagFQN, tagFQNHash, targetFQNHash) VALUES (0, 1, 1, 'Glossary.Customer', ?, ?)");
              for (int i = 0; i < count; i++) {
                batch.add(
                    FullyQualifiedName.buildHash("Glossary.Customer"),
                    FullyQualifiedName.buildHash("service.table.column" + i));
              }
              batch.execute();
            });
  }
}
