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

import java.time.Clock;
import java.time.Duration;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Stream;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.statement.SqlLogger;
import org.jdbi.v3.core.statement.StatementContext;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.it.util.MutableClock;
import org.openmetadata.service.projection.EntityMutation;
import org.openmetadata.service.projection.ProjectionJournal;
import org.openmetadata.service.projection.ProjectionTarget;
import org.openmetadata.service.projection.RelationshipMutation;

@Execution(ExecutionMode.SAME_THREAD)
class ProjectionJournalIT {
  private static final Map<RdfTestDatabase.Backend, RdfTestDatabase> DATABASES =
      new EnumMap<>(RdfTestDatabase.Backend.class);

  @BeforeAll
  static void startDatabases() {
    for (final RdfTestDatabase.Backend backend : RdfTestDatabase.backends().toList()) {
      final RdfTestDatabase database = new RdfTestDatabase(backend);
      database.applyProjectionMigrations();
      database.applyProjectionMigrations();
      DATABASES.put(backend, database);
    }
  }

  @AfterAll
  static void stopDatabases() {
    DATABASES.values().forEach(RdfTestDatabase::close);
    DATABASES.clear();
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void migrationCanBeAppliedTwice(final RdfTestDatabase.Backend backend) {
    final RdfTestDatabase database = DATABASES.get(backend);
    database.applyProjectionMigrations();
    database.applyProjectionMigrations();
    final long mutations =
        database
            .jdbi()
            .withHandle(
                handle ->
                    handle
                        .createQuery("SELECT COUNT(*) FROM metadata_projection_mutation")
                        .mapTo(Long.class)
                        .one());
    assertEquals(0, mutations);
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void reapplyingSchemaPreservesPreviouslyCapturedFacts(final RdfTestDatabase.Backend backend) {
    try (final var database = new RdfTestDatabase(backend)) {
      database.applyProjectionMigrations();
      final EntityMutation entity = mutation();
      database.jdbi().useTransaction(handle -> journal(database.jdbi()).capture(handle, entity));
      database.applyProjectionMigrations();
      final var journal = journal(database.jdbi());
      assertEquals(entity, claim(journal, ProjectionTarget.SEARCH).mutation());
      final var relationship = new RelationshipMutation(1);
      database
          .jdbi()
          .useTransaction(handle -> journal.captureAll(handle, List.of(entity, relationship)));
      assertEquals(
          List.of(entity, relationship),
          journal.claim(ProjectionTarget.SEARCH, 10, Duration.ofSeconds(30)).stream()
              .map(ProjectionJournal.Claim::mutation)
              .toList());
    }
  }

  @BeforeEach
  void clearJournal() {
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
                        }));
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void mutationAndObligationsRollBackTogether(final RdfTestDatabase.Backend backend) {
    final Jdbi jdbi = DATABASES.get(backend).jdbi();
    final ProjectionJournal journal = journal(jdbi);
    assertThrows(
        IllegalStateException.class,
        () ->
            jdbi.useTransaction(
                handle -> {
                  journal.capture(handle, mutation());
                  throw new IllegalStateException("rollback");
                }));
    assertEquals(0, count(jdbi, "metadata_projection_mutation"));
    assertEquals(0, count(jdbi, "metadata_projection_consumer"));
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void captureRejectsAutocommit(final RdfTestDatabase.Backend backend) {
    final Jdbi jdbi = DATABASES.get(backend).jdbi();
    jdbi.useHandle(
        handle ->
            assertThrows(
                IllegalStateException.class, () -> journal(jdbi).capture(handle, mutation())));
    assertEquals(0, count(jdbi, "metadata_projection_mutation"));
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void searchCompletionDoesNotAcknowledgeRdf(final RdfTestDatabase.Backend backend) {
    final Jdbi jdbi = DATABASES.get(backend).jdbi();
    final ProjectionJournal journal = journal(jdbi);
    final EntityMutation mutation = mutation();
    final long id = jdbi.inTransaction(handle -> journal.capture(handle, mutation));
    final ProjectionJournal.Claim search = claim(journal, ProjectionTarget.SEARCH);
    assertEquals(id, search.id());
    assertEquals(mutation, search.mutation());
    assertTrue(journal.advance(search, null, true, handle -> {}));
    assertTrue(journal.claim(ProjectionTarget.SEARCH, 1, Duration.ofSeconds(30)).isEmpty());
    assertEquals(id, claim(journal, ProjectionTarget.RDF).id());
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void lateCommitIsNotSkipped(final RdfTestDatabase.Backend backend) throws Exception {
    final Jdbi jdbi = DATABASES.get(backend).jdbi();
    final ProjectionJournal journal = journal(jdbi);
    final CountDownLatch captured = new CountDownLatch(1);
    final CountDownLatch commit = new CountDownLatch(1);
    try (final var executor = Executors.newSingleThreadExecutor()) {
      final var producer =
          executor.submit(
              () ->
                  jdbi.inTransaction(
                      handle -> {
                        final long id = journal.capture(handle, mutation());
                        captured.countDown();
                        assertTrue(commit.await(30, TimeUnit.SECONDS));
                        return id;
                      }));
      try {
        assertTrue(captured.await(30, TimeUnit.SECONDS));
        final long second = jdbi.inTransaction(handle -> journal.capture(handle, mutation()));
        final ProjectionJournal.Claim visible = claim(journal, ProjectionTarget.SEARCH);
        assertEquals(second, visible.id());
        assertTrue(journal.advance(visible, null, true, handle -> {}));
      } finally {
        commit.countDown();
      }
      final long first = producer.get(30, TimeUnit.SECONDS);
      assertEquals(first, claim(journal, ProjectionTarget.SEARCH).id());
    }
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void workerRestartReclaimsExpiredLeaseAndRejectsOldAcknowledgment(
      final RdfTestDatabase.Backend backend) {
    final Jdbi jdbi = DATABASES.get(backend).jdbi();
    final MutableClock clock = new MutableClock();
    final ProjectionJournal first =
        new ProjectionJournal(jdbi, clock, EnumSet.allOf(ProjectionTarget.class));
    jdbi.useTransaction(handle -> first.capture(handle, mutation()));
    final ProjectionJournal.Claim old = claim(first, ProjectionTarget.SEARCH);
    assertTrue(first.claim(ProjectionTarget.SEARCH, 1, Duration.ofSeconds(30)).isEmpty());
    clock.advance(Duration.ofMinutes(1));
    final ProjectionJournal restarted =
        new ProjectionJournal(jdbi, clock, EnumSet.allOf(ProjectionTarget.class));
    final ProjectionJournal.Claim current = claim(restarted, ProjectionTarget.SEARCH);
    assertEquals(old.id(), current.id());
    assertFalse(
        first.advance(
            old,
            null,
            true,
            handle -> {
              throw new AssertionError("stale expansion");
            }));
    assertTrue(restarted.advance(current, null, true, handle -> {}));
    assertFalse(restarted.advance(current, null, true, handle -> {}));
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void expansionAndContinuationCommitAtomically(final RdfTestDatabase.Backend backend) {
    final Jdbi jdbi = DATABASES.get(backend).jdbi();
    final ProjectionJournal journal = journal(jdbi);
    final long id = jdbi.inTransaction(handle -> journal.capture(handle, mutation()));
    final ProjectionJournal.Claim claim = claim(journal, ProjectionTarget.SEARCH);
    assertThrows(
        IllegalStateException.class,
        () ->
            journal.advance(
                claim,
                "page-2",
                false,
                handle -> {
                  journal.capture(handle, mutation());
                  throw new IllegalStateException("expansion failed");
                }));
    assertEquals(1, count(jdbi, "metadata_projection_mutation"));
    assertTrue(journal.advance(claim, "page-2", false, handle -> {}));
    final ProjectionJournal.Claim next = claim(journal, ProjectionTarget.SEARCH);
    assertEquals(id, next.id());
    assertEquals("page-2", next.cursor());
    assertEquals(0, next.attempts());
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void retryPreservesWorkAcrossMoreThanThreeFailures(final RdfTestDatabase.Backend backend) {
    final Jdbi jdbi = DATABASES.get(backend).jdbi();
    final MutableClock clock = new MutableClock();
    final ProjectionJournal journal =
        new ProjectionJournal(jdbi, clock, EnumSet.of(ProjectionTarget.SEARCH));
    jdbi.useTransaction(handle -> journal.capture(handle, mutation()));
    for (int attempt = 0; attempt < 12; attempt++) {
      final ProjectionJournal.Claim claim = claim(journal, ProjectionTarget.SEARCH);
      assertEquals(attempt, claim.attempts());
      assertTrue(journal.retry(claim, "database unavailable", Duration.ofSeconds(1)));
      assertTrue(journal.claim(ProjectionTarget.SEARCH, 1, Duration.ofSeconds(30)).isEmpty());
      clock.advance(Duration.ofSeconds(1));
    }
    assertEquals(12, claim(journal, ProjectionTarget.SEARCH).attempts());
    assertEquals(1, count(jdbi, "metadata_projection_consumer"));
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void claimsAreBoundedAndWorkersDoNotShareRows(final RdfTestDatabase.Backend backend) {
    final Jdbi jdbi = DATABASES.get(backend).jdbi();
    final ProjectionJournal first = journal(jdbi);
    final ProjectionJournal second = journal(jdbi);
    jdbi.useTransaction(
        handle -> {
          for (int i = 0; i < 5; i++) first.capture(handle, mutation());
        });
    final List<ProjectionJournal.Claim> page =
        first.claim(ProjectionTarget.SEARCH, 3, Duration.ofSeconds(30));
    final List<ProjectionJournal.Claim> other =
        second.claim(ProjectionTarget.SEARCH, 3, Duration.ofSeconds(30));
    assertEquals(3, page.size());
    assertEquals(2, other.size());
    assertEquals(
        5,
        Stream.concat(page.stream(), other.stream())
            .map(ProjectionJournal.Claim::id)
            .distinct()
            .count());
    assertThrows(
        IllegalArgumentException.class,
        () -> first.claim(ProjectionTarget.SEARCH, 1001, Duration.ofSeconds(30)));
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void claimSqlCostDoesNotGrowWithPageSize(final RdfTestDatabase.Backend backend) {
    final Jdbi jdbi = DATABASES.get(backend).jdbi();
    final ProjectionJournal journal = journal(jdbi);
    jdbi.useTransaction(
        handle -> {
          for (int i = 0; i < 20; i++) journal.capture(handle, mutation());
        });
    final AtomicLong statements = new AtomicLong();
    jdbi.setSqlLogger(
        new SqlLogger() {
          @Override
          public void logAfterExecution(final StatementContext context) {
            statements.incrementAndGet();
          }
        });
    try {
      assertEquals(20, journal.claim(ProjectionTarget.SEARCH, 20, Duration.ofSeconds(30)).size());
      assertEquals(2, statements.get(), "A claim page should need one read and one lease update");
    } finally {
      jdbi.setSqlLogger(SqlLogger.NOP_SQL_LOGGER);
    }
  }

  private static ProjectionJournal journal(final Jdbi jdbi) {
    return new ProjectionJournal(jdbi, Clock.systemUTC(), EnumSet.allOf(ProjectionTarget.class));
  }

  @ParameterizedTest
  @MethodSource("org.openmetadata.it.tests.RdfTestDatabase#backends")
  void oneTargetClaimDoesNotLockOutTheOther(final RdfTestDatabase.Backend backend)
      throws Exception {
    final Jdbi jdbi = DATABASES.get(backend).jdbi();
    final ProjectionJournal journal = journal(jdbi);
    jdbi.useTransaction(handle -> journal.capture(handle, mutation()));
    final CountDownLatch selected = new CountDownLatch(1);
    final CountDownLatch release = new CountDownLatch(1);
    final AtomicBoolean first = new AtomicBoolean(true);
    jdbi.setSqlLogger(
        new SqlLogger() {
          @Override
          public void logAfterExecution(final StatementContext context) {
            if (context.getRenderedSql().contains("SELECT m.*")
                && first.compareAndSet(true, false)) {
              selected.countDown();
              try {
                assertTrue(release.await(30, TimeUnit.SECONDS));
              } catch (InterruptedException interrupted) {
                Thread.currentThread().interrupt();
                throw new IllegalStateException(interrupted);
              }
            }
          }
        });
    try (final var executor = Executors.newSingleThreadExecutor()) {
      final var search =
          executor.submit(() -> journal.claim(ProjectionTarget.SEARCH, 1, Duration.ofSeconds(30)));
      try {
        assertTrue(selected.await(30, TimeUnit.SECONDS));
        assertEquals(1, journal.claim(ProjectionTarget.RDF, 1, Duration.ofSeconds(30)).size());
      } finally {
        release.countDown();
        assertEquals(1, search.get(30, TimeUnit.SECONDS).size());
        jdbi.setSqlLogger(SqlLogger.NOP_SQL_LOGGER);
      }
    }
  }

  private static ProjectionJournal.Claim claim(
      final ProjectionJournal journal, final ProjectionTarget target) {
    return journal.claim(target, 1, Duration.ofSeconds(30)).getFirst();
  }

  private static EntityMutation mutation() {
    return new EntityMutation(
        1,
        "table",
        UUID.randomUUID(),
        EntityMutation.Operation.UPSERT,
        "service.database.old_name",
        "service.database.new_name");
  }

  private static long count(final Jdbi jdbi, final String table) {
    return jdbi.withHandle(
        handle -> handle.createQuery("SELECT COUNT(*) FROM " + table).mapTo(Long.class).one());
  }
}
