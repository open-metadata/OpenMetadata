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

import java.time.Clock;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.IntStream;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.statement.SqlLogger;
import org.jdbi.v3.core.statement.StatementContext;
import org.jdbi.v3.core.statement.UnableToExecuteStatementException;
import org.jdbi.v3.core.transaction.TransactionIsolationLevel;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.it.tests.EntityCaptureFixture.CaptureDAO;
import org.openmetadata.it.tests.EntityCaptureFixture.CaptureRoot;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.projection.EntityMutation;
import org.openmetadata.service.projection.EntityPrefixMembers;
import org.openmetadata.service.projection.EntityPrefixMutation;
import org.openmetadata.service.projection.ProjectionJournal;
import org.openmetadata.service.projection.ProjectionOwnerLookup;
import org.openmetadata.service.projection.ProjectionTarget;
import org.openmetadata.service.util.FullyQualifiedName;

/** Real inherited EntityDAO writes, both on-demand and attached to an enclosing transaction. */
@Execution(ExecutionMode.SAME_THREAD)
class EntityMutationCaptureIT {
  private static final Map<RdfTestDatabase.Backend, EntityCaptureFixture> DATABASES =
      new EnumMap<>(RdfTestDatabase.Backend.class);

  @BeforeAll
  static void startDatabases() {
    for (final RdfTestDatabase.Backend backend : RdfTestDatabase.backends().toList()) {
      DATABASES.put(backend, new EntityCaptureFixture(backend));
    }
  }

  @AfterAll
  static void stopDatabases() {
    DATABASES.values().forEach(EntityCaptureFixture::close);
    DATABASES.clear();
  }

  @BeforeEach
  void clearRows() {
    DATABASES
        .values()
        .forEach(
            database ->
                database
                    .jdbi()
                    .useHandle(
                        handle -> {
                          handle.execute("DELETE FROM metadata_projection_consumer");
                          handle.execute("DELETE FROM metadata_projection_mutation");
                          handle.execute("DELETE FROM projection_test_entity");
                        }));
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void transactionBuffersFactsUntilCommit(final RdfTestDatabase.Backend backend) {
    final Jdbi jdbi = DATABASES.get(backend).jdbi();
    jdbi.onDemand(CaptureRoot.class)
        .useTransaction(
            root -> {
              for (int index = 0; index < 3; index++) {
                final Chart chart = chart("buffered_" + index);
                root.charts().insert(chart, chart.getFullyQualifiedName());
              }
              assertEquals(3, count(jdbi, "projection_test_entity"));
              assertEquals(0, count(jdbi, "metadata_projection_mutation"));
              assertEquals(0, count(jdbi, "metadata_projection_consumer"));
            });
    assertEquals(3, count(jdbi, "projection_test_entity"));
    assertEquals(3, count(jdbi, "metadata_projection_mutation"));
    assertEquals(6, count(jdbi, "metadata_projection_consumer"));
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void onDemandWritesCaptureBeforeAndAfterLocators(final RdfTestDatabase.Backend backend) {
    final Jdbi jdbi = DATABASES.get(backend).jdbi();
    final CaptureDAO dao = jdbi.onDemand(CaptureDAO.class);
    final Chart chart = chart("original");
    dao.insert(chart, chart.getFullyQualifiedName());
    chart.setFullyQualifiedName("service.renamed");
    dao.update(chart);
    dao.delete(chart.getId());
    final List<EntityMutation> facts = facts(jdbi);
    assertEquals(3, facts.size());
    assertNull(facts.getFirst().beforeFqn());
    assertEquals("service.original", facts.get(1).beforeFqn());
    assertEquals("service.renamed", facts.get(1).afterFqn());
    assertEquals(EntityMutation.Operation.DELETE, facts.getLast().operation());
    assertEquals("service.renamed", facts.getLast().beforeFqn());
    assertNull(facts.getLast().afterFqn());
    assertEquals(0, count(jdbi, "projection_test_entity"));
    assertEquals(6, count(jdbi, "metadata_projection_consumer"));
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void attachedAndRootDaoMutationsRollBackWithCapture(final RdfTestDatabase.Backend backend) {
    final Jdbi jdbi = DATABASES.get(backend).jdbi();
    assertThrows(
        IllegalStateException.class,
        () ->
            jdbi.useTransaction(
                handle -> {
                  final Chart first = chart("attached");
                  handle.attach(CaptureDAO.class).insert(first, first.getFullyQualifiedName());
                  throw new IllegalStateException("rollback attached");
                }));
    assertThrows(
        IllegalStateException.class,
        () ->
            jdbi.onDemand(CaptureRoot.class)
                .useTransaction(
                    root -> {
                      final Chart second = chart("root");
                      root.charts().insert(second, second.getFullyQualifiedName());
                      throw new IllegalStateException("rollback root");
                    }));
    assertEquals(0, count(jdbi, "projection_test_entity"));
    assertEquals(0, count(jdbi, "metadata_projection_mutation"));
    assertEquals(0, count(jdbi, "metadata_projection_consumer"));
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void failedMutationDoesNotPublishAFact(final RdfTestDatabase.Backend backend) {
    final Jdbi jdbi = DATABASES.get(backend).jdbi();
    final CaptureDAO dao = jdbi.onDemand(CaptureDAO.class);
    final Chart chart = chart("duplicate");
    dao.insert(chart, chart.getFullyQualifiedName());
    assertThrows(
        UnableToExecuteStatementException.class,
        () -> dao.insert(chart, chart.getFullyQualifiedName()));
    assertEquals(1, count(jdbi, "projection_test_entity"));
    assertEquals(1, count(jdbi, "metadata_projection_mutation"));
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void captureFailurePreventsCatalogWrite(final RdfTestDatabase.Backend backend) {
    final Jdbi jdbi = DATABASES.get(backend).jdbi();
    jdbi.useHandle(
        handle ->
            handle.execute(
                "ALTER TABLE metadata_projection_consumer RENAME TO unavailable_consumer"));
    try {
      final Chart chart = chart("capture_failure");
      assertThrows(
          UnableToExecuteStatementException.class,
          () -> jdbi.onDemand(CaptureDAO.class).insert(chart, chart.getFullyQualifiedName()));
      assertEquals(0, count(jdbi, "projection_test_entity"));
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
  void batchesCaptureEveryRowAcrossChunks(final RdfTestDatabase.Backend backend) {
    final Jdbi jdbi = DATABASES.get(backend).jdbi();
    final CaptureDAO dao = jdbi.onDemand(CaptureDAO.class);
    final List<EntityInterface<?>> charts =
        IntStream.range(0, 205).<EntityInterface<?>>mapToObj(i -> chart("batch_" + i)).toList();
    dao.insertMany(charts);
    charts.forEach(
        chart -> chart.setFullyQualifiedName(chart.getFullyQualifiedName() + "_renamed"));
    dao.updateMany(charts);
    dao.deleteByIds(charts.stream().map(EntityInterface::getId).toList());
    assertEquals(0, count(jdbi, "projection_test_entity"));
    assertEquals(615, count(jdbi, "metadata_projection_mutation"));
    assertEquals(1230, count(jdbi, "metadata_projection_consumer"));
    final List<EntityMutation> facts = facts(jdbi);
    assertEquals(
        205,
        facts.stream().filter(fact -> fact.operation() == EntityMutation.Operation.DELETE).count());
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void optimisticUpdateFailureDoesNotRecordAnInvalidation(final RdfTestDatabase.Backend backend) {
    final Jdbi jdbi = DATABASES.get(backend).jdbi();
    final CaptureDAO dao = jdbi.onDemand(CaptureDAO.class);
    final Chart chart = chart("cas");
    dao.insert(chart, chart.getFullyQualifiedName());
    assertEquals(
        0,
        dao.updateWithVersion(
            dao.getTableName(),
            dao.getNameHashColumn(),
            "service.cas",
            chart.getId().toString(),
            JsonUtils.pojoToJson(chart),
            "99.0"));
    assertEquals(
        "service.cas",
        JsonUtils.readTree(dao.findById(dao.getTableName(), chart.getId(), ""))
            .get("fullyQualifiedName")
            .asText());
    assertEquals(1, facts(jdbi).size());
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void batchCaptureSqlCostIsBoundedByChunks(final RdfTestDatabase.Backend backend) {
    final Jdbi jdbi = DATABASES.get(backend).jdbi();
    final CaptureDAO dao = jdbi.onDemand(CaptureDAO.class);
    final List<EntityInterface<?>> charts =
        IntStream.range(0, 205).<EntityInterface<?>>mapToObj(i -> chart("cost_" + i)).toList();
    final AtomicLong statements = new AtomicLong();
    jdbi.setSqlLogger(
        new SqlLogger() {
          @Override
          public void logAfterExecution(final StatementContext context) {
            statements.incrementAndGet();
          }
        });
    try {
      dao.insertMany(charts);
      assertTrue(
          statements.get() <= 9,
          "205 rows should use at most three capture batches plus three catalog batches, got "
              + statements.get());
    } finally {
      jdbi.setSqlLogger(SqlLogger.NOP_SQL_LOGGER);
    }
    assertEquals(205, count(jdbi, "metadata_projection_mutation"));
  }

  @EnabledIfSystemProperty(named = "projection.capture.benchmark", matches = "true")
  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void reportLocalTransactionCaptureOverhead(final RdfTestDatabase.Backend backend) {
    final Jdbi jdbi = DATABASES.get(backend).jdbi();
    final long[] baseline = new long[100];
    final long[] captured = new long[100];
    jdbi.useHandle(
        handle -> {
          final CaptureDAO dao = handle.attach(CaptureDAO.class);
          for (int i = -30; i < 100; i++) {
            final long plain = measureInsert(handle, dao, backend, false);
            final long tracked = measureInsert(handle, dao, backend, true);
            if (i >= 0) {
              baseline[i] = plain;
              captured[i] = tracked;
            }
          }
        });
    Arrays.sort(baseline);
    Arrays.sort(captured);
    System.out.printf(
        "Projection capture %s, 100 local durable transactions: baseline p50=%.3fms p95=%.3fms; captured p50=%.3fms p95=%.3fms%n",
        backend,
        baseline[49] / 1_000_000.0,
        baseline[94] / 1_000_000.0,
        captured[49] / 1_000_000.0,
        captured[94] / 1_000_000.0);
    assertEquals(260, count(jdbi, "projection_test_entity"));
    assertEquals(130, count(jdbi, "metadata_projection_mutation"));
  }

  private static long measureInsert(
      final Handle handle,
      final CaptureDAO dao,
      final RdfTestDatabase.Backend backend,
      final boolean capture) {
    final Chart entity = chart(UUID.randomUUID().toString());
    final String json = JsonUtils.pojoToJson(entity);
    final long started = System.nanoTime();
    handle.useTransaction(
        transaction -> {
          if (capture) {
            dao.insert(
                dao.getTableName(), dao.getNameHashColumn(), entity.getFullyQualifiedName(), json);
          } else {
            transaction.execute(
                "INSERT INTO projection_test_entity (fqnHash, json) VALUES (?, "
                    + (backend == RdfTestDatabase.Backend.MYSQL ? "?" : "CAST(? AS JSONB)")
                    + ")",
                entity.getFullyQualifiedName(),
                json);
          }
        });
    return System.nanoTime() - started;
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void failureAfterABulkChunkRollsBackAllRowsAndFacts(final RdfTestDatabase.Backend backend) {
    final Jdbi jdbi = DATABASES.get(backend).jdbi();
    final CaptureDAO dao = jdbi.onDemand(CaptureDAO.class);
    final List<EntityInterface<?>> charts =
        new ArrayList<>(
            IntStream.range(0, 205)
                .<EntityInterface<?>>mapToObj(i -> chart("rollback_" + i))
                .toList());
    charts.add(charts.getFirst());
    assertThrows(UnableToExecuteStatementException.class, () -> dao.insertMany(charts));
    assertEquals(0, count(jdbi, "projection_test_entity"));
    assertEquals(0, count(jdbi, "metadata_projection_mutation"));
    assertEquals(0, count(jdbi, "metadata_projection_consumer"));
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void missingDeleteRetainsTheRequestedIdentity(final RdfTestDatabase.Backend backend) {
    final Jdbi jdbi = DATABASES.get(backend).jdbi();
    final CaptureDAO dao = jdbi.onDemand(CaptureDAO.class);
    final UUID id = UUID.randomUUID();
    assertEquals(0, dao.delete(dao.getTableName(), id));
    final List<EntityMutation> facts = facts(jdbi);
    assertEquals(1, facts.size());
    assertEquals(id, facts.getFirst().entityId());
    assertEquals(EntityMutation.Operation.DELETE, facts.getFirst().operation());
    assertNull(facts.getFirst().beforeFqn());
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void deletionRetainsWorkWhenInsertCommitsAfterThePreimageRead(
      final RdfTestDatabase.Backend backend) throws Exception {
    final Jdbi jdbi = DATABASES.get(backend).jdbi();
    final Chart chart = chart("concurrent_insert");
    final CompletableFuture<Void> beforeDelete = new CompletableFuture<>();
    final CompletableFuture<Void> releaseDelete = new CompletableFuture<>();
    jdbi.setSqlLogger(
        new SqlLogger() {
          @Override
          public void logBeforeExecution(final StatementContext context) {
            if (context.getRenderedSql().startsWith("DELETE FROM projection_test_entity")) {
              beforeDelete.complete(null);
              releaseDelete.orTimeout(30, TimeUnit.SECONDS).join();
            }
          }
        });
    final CompletableFuture<Integer> deletion =
        CompletableFuture.supplyAsync(
            () ->
                jdbi.inTransaction(
                    TransactionIsolationLevel.READ_COMMITTED,
                    handle ->
                        handle
                            .attach(CaptureDAO.class)
                            .delete("projection_test_entity", chart.getId())),
            DedicatedThreads.EXECUTOR);
    try {
      beforeDelete.orTimeout(30, TimeUnit.SECONDS).join();
      jdbi.onDemand(CaptureDAO.class).insert(chart, chart.getFullyQualifiedName());
      final ProjectionJournal journal = journal(jdbi);
      for (final ProjectionTarget target : ProjectionTarget.values()) {
        final List<ProjectionJournal.Claim> inserted =
            journal.claim(target, 10, Duration.ofSeconds(30));
        assertEquals(1, inserted.size());
        assertEquals(
            EntityMutation.Operation.UPSERT,
            ((EntityMutation) inserted.getFirst().mutation()).operation());
        assertTrue(journal.advance(inserted.getFirst(), null, true, handle -> {}));
      }
    } finally {
      releaseDelete.complete(null);
      deletion
          .whenComplete((result, failure) -> jdbi.setSqlLogger(SqlLogger.NOP_SQL_LOGGER))
          .get(30, TimeUnit.SECONDS);
    }
    assertEquals(1, deletion.get(30, TimeUnit.SECONDS));
    assertEquals(0, count(jdbi, "projection_test_entity"));
    final List<EntityMutation> remaining = facts(jdbi);
    assertEquals(
        1,
        remaining.size(),
        "The committed delete must remain recoverable after insert work completes");
    assertEquals(chart.getId(), remaining.getFirst().entityId());
    assertEquals(EntityMutation.Operation.DELETE, remaining.getFirst().operation());
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void identifierChangeInvalidatesBothOldAndNewKeys(final RdfTestDatabase.Backend backend) {
    final Jdbi jdbi = DATABASES.get(backend).jdbi();
    final CaptureDAO dao = jdbi.onDemand(CaptureDAO.class);
    final Chart chart = chart("identifier");
    final UUID previousId = chart.getId();
    dao.insert(chart, chart.getFullyQualifiedName());
    chart.setId(UUID.randomUUID());
    dao.update(previousId, chart.getFullyQualifiedName(), JsonUtils.pojoToJson(chart));
    final List<EntityMutation> facts = facts(jdbi);
    assertEquals(3, facts.size());
    assertEquals(previousId, facts.get(1).entityId());
    assertEquals(chart.getId(), facts.getLast().entityId());
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void nullFqnUsesTheStoredNameForDeletion(final RdfTestDatabase.Backend backend) {
    final Jdbi jdbi = DATABASES.get(backend).jdbi();
    final CaptureDAO dao = jdbi.onDemand(CaptureDAO.class);
    final UUID id = UUID.randomUUID();
    final String json = "{\"id\":\"" + id + "\",\"name\":\"no_fqn\",\"fullyQualifiedName\":null}";
    dao.insert(dao.getTableName(), dao.getNameHashColumn(), "no_fqn", json);
    dao.delete(dao.getTableName(), id);
    final List<EntityMutation> facts = facts(jdbi);
    assertEquals("no_fqn", facts.getFirst().afterFqn());
    assertEquals("no_fqn", facts.getLast().beforeFqn());
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void entityLocatorsRemainHashAddressableAfterRenameAndDeletion(
      final RdfTestDatabase.Backend backend) {
    final Jdbi jdbi = DATABASES.get(backend).jdbi();
    final CaptureDAO dao = jdbi.onDemand(CaptureDAO.class);
    final Chart chart = chart("original");
    dao.insert(chart, chart.getFullyQualifiedName());
    chart.setFullyQualifiedName("service.renamed");
    dao.update(chart);
    dao.delete(chart.getId());
    assertEquals(
        List.of(chart.getId().toString()),
        jdbi.withHandle(
            handle ->
                handle
                    .createQuery(
                        "SELECT DISTINCT entityId FROM metadata_projection_mutation "
                            + "WHERE beforeFqnHash = :hash OR afterFqnHash = :hash")
                    .bind("hash", FullyQualifiedName.buildHash("service.original"))
                    .mapTo(String.class)
                    .list()));
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void prefixRewriteRecordsOneFactWhoseMembersCarryBothLocators(
      final RdfTestDatabase.Backend backend) {
    final Jdbi jdbi = DATABASES.get(backend).jdbi();
    final CaptureDAO dao = jdbi.onDemand(CaptureDAO.class);
    final Chart child = chart("before.child");
    final Chart other = chart("unrelated");
    dao.insert(child, child.getFullyQualifiedName());
    dao.insert(other, other.getFullyQualifiedName());
    facts(jdbi);
    dao.updateFqn("service.before", "service.after");
    final var rewrite = new EntityPrefixMutation(1, "chart", "service.before", "service.after");
    assertEquals(
        List.of(rewrite),
        journal(jdbi).claim(ProjectionTarget.SEARCH, 1000, Duration.ofSeconds(30)).stream()
            .map(ProjectionJournal.Claim::mutation)
            .toList());
    final var members =
        new EntityPrefixMembers(jdbi, ConnectionType.valueOf(backend.name()))
            .page(
                new ProjectionOwnerLookup.Source("chart", dao.getTableName(), "fqnHash", false),
                rewrite,
                null,
                10);
    assertEquals(1, members.size());
    assertEquals(child.getId(), members.getFirst().id());
    assertEquals("service.before.child", members.getFirst().beforeFqn());
    assertEquals("service.after.child", members.getFirst().afterFqn());
    assertEquals(
        "service.after.child",
        JsonUtils.readTree(dao.findById(dao.getTableName(), child.getId(), ""))
            .get("fullyQualifiedName")
            .asText());
    assertEquals(
        other.getFullyQualifiedName(),
        JsonUtils.readTree(dao.findById(dao.getTableName(), other.getId(), ""))
            .get("fullyQualifiedName")
            .asText());
  }

  private static List<EntityMutation> facts(final Jdbi jdbi) {
    return journal(jdbi).claim(ProjectionTarget.SEARCH, 1000, Duration.ofSeconds(30)).stream()
        .map(ProjectionJournal.Claim::mutation)
        .map(EntityMutation.class::cast)
        .toList();
  }

  private static ProjectionJournal journal(final Jdbi jdbi) {
    return new ProjectionJournal(jdbi, Clock.systemUTC(), EnumSet.allOf(ProjectionTarget.class));
  }

  private static Chart chart(final String name) {
    return new Chart()
        .withId(UUID.randomUUID())
        .withName(name)
        .withFullyQualifiedName("service." + name)
        .withVersion(0.1);
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void rejectedCompareAndSwapDoesNotCaptureFacts(final RdfTestDatabase.Backend backend) {
    final Jdbi jdbi = DATABASES.get(backend).jdbi();
    final CaptureDAO dao = jdbi.onDemand(CaptureDAO.class);
    final Chart original = chart("cas.original");
    dao.insert(original, original.getFullyQualifiedName());
    final long before = count(jdbi, "metadata_projection_mutation");
    final Chart replacement = chart("cas.replacement").withId(original.getId());
    assertEquals(
        0,
        dao.updateWithVersion(
            dao.getTableName(),
            "fqnHash",
            replacement.getFullyQualifiedName(),
            original.getId().toString(),
            JsonUtils.pojoToJson(replacement),
            "99.0"));
    assertEquals(before, count(jdbi, "metadata_projection_mutation"));
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void caughtStatementFailureBehavesAsWithoutCaptureAndLeavesNoPhantomFacts(
      final RdfTestDatabase.Backend backend) {
    try (var uncaptured = new EntityCaptureFixture(backend, false)) {
      final long committed = insertDuplicateThenContinue(uncaptured.jdbi(), backend);
      final Jdbi jdbi = DATABASES.get(backend).jdbi();
      assertEquals(committed, insertDuplicateThenContinue(jdbi, backend));
      // Every committed row has its fact; the rejected duplicate has none.
      assertEquals(committed, count(jdbi, "metadata_projection_mutation"));
    }
  }

  /** Inserts a row, a duplicate the database rejects, then another row; returns committed rows. */
  private static long insertDuplicateThenContinue(
      final Jdbi jdbi, final RdfTestDatabase.Backend backend) {
    final Runnable transaction =
        () ->
            jdbi.useTransaction(
                handle -> {
                  final CaptureDAO dao = handle.attach(CaptureDAO.class);
                  final Chart original = chart("duplicate");
                  dao.insert(original, original.getFullyQualifiedName());
                  assertThrows(
                      UnableToExecuteStatementException.class,
                      () -> dao.insert(original, original.getFullyQualifiedName()));
                  final Chart next = chart("after_failure");
                  dao.insert(next, next.getFullyQualifiedName());
                });
    if (backend == RdfTestDatabase.Backend.POSTGRES) {
      // PostgreSQL aborts the whole transaction after a failed statement, with or without capture.
      assertThrows(UnableToExecuteStatementException.class, transaction::run);
    } else {
      transaction.run();
    }
    return count(jdbi, "projection_test_entity");
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void unchangedNameUpdateIsOneStatementAndRenameStillRecordsTheFormerName(
      final RdfTestDatabase.Backend backend) {
    final Jdbi jdbi = DATABASES.get(backend).jdbi();
    final CaptureDAO dao = jdbi.onDemand(CaptureDAO.class);
    final Chart chart = chart("stable");
    dao.insert(chart, chart.getFullyQualifiedName());
    facts(jdbi);
    final var statements = new AtomicInteger();
    jdbi.setSqlLogger(
        new SqlLogger() {
          @Override
          public void logAfterExecution(final StatementContext context) {
            if (!context.getRenderedSql().startsWith("INSERT INTO metadata_projection_")) {
              statements.incrementAndGet();
            }
          }
        });
    try {
      chart.setDescription("same name");
      dao.update(chart);
      assertEquals(1, statements.get(), "An unchanged name needs no before-image read");
      chart.setFullyQualifiedName("service.renamed_stable");
      dao.update(chart);
    } finally {
      jdbi.setSqlLogger(SqlLogger.NOP_SQL_LOGGER);
    }
    final List<EntityMutation> facts = facts(jdbi);
    assertEquals(2, facts.size());
    assertEquals("service.stable", facts.getFirst().beforeFqn());
    assertEquals("service.stable", facts.getFirst().afterFqn());
    assertEquals("service.stable", facts.getLast().beforeFqn());
    assertEquals("service.renamed_stable", facts.getLast().afterFqn());
  }

  private static long count(final Jdbi jdbi, final String table) {
    return jdbi.withHandle(
        handle -> handle.createQuery("SELECT COUNT(*) FROM " + table).mapTo(Long.class).one());
  }
}
