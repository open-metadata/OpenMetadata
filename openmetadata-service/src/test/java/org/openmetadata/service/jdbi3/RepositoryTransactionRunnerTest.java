/*
 *  Copyright 2024 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 */

package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import javax.sql.DataSource;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.core.statement.StatementContext;
import org.jdbi.v3.sqlobject.SqlObjectPlugin;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.util.PostCommitActionQueue;
import org.openmetadata.service.util.jdbi.OMSqlLogger;

/** Exercises whole-transaction retry using real JDBI and a mocked JDBC connection. */
class RepositoryTransactionRunnerTest {

  /** Matches {@code DeadlockRetry}'s configured {@code maxAttempts}. */
  private static final int MAX_ATTEMPTS = 4;

  private Jdbi jdbi;
  private CollectionDAO transactionRoot;
  private Connection connection;
  private RepositoryTransactionRunner runner;

  /** Production exception shape: a runtime exception wrapping the MySQL deadlock (errno 1213). */
  private static RuntimeException deadlock() {
    SQLException sql =
        new SQLException(
            "Deadlock found when trying to get lock; try restarting transaction", "40001", 1213);
    return new RuntimeException("### Error updating database", sql);
  }

  @BeforeEach
  void setUp() throws SQLException {
    connection = mock(Connection.class);
    // JDBI reads transaction state from the connection's auto-commit flag. Every thread shares this
    // mock, but a real pool gives each thread its own connection, so the flag is kept per thread.
    final ThreadLocal<Boolean> autoCommit = ThreadLocal.withInitial(() -> true);
    when(connection.getAutoCommit()).thenAnswer(call -> autoCommit.get());
    doAnswer(
            call -> {
              autoCommit.set(call.getArgument(0));
              return null;
            })
        .when(connection)
        .setAutoCommit(anyBoolean());
    final DataSource dataSource = mock(DataSource.class);
    when(dataSource.getConnection()).thenReturn(connection);
    jdbi = Jdbi.create(dataSource).installPlugin(new SqlObjectPlugin());
    transactionRoot = jdbi.onDemand(CollectionDAO.class);
    runner = new RepositoryTransactionRunner(transactionRoot);
  }

  private int countFlushAttempts(final Runnable body) {
    final AtomicInteger attempts = new AtomicInteger();
    assertThrows(
        RuntimeException.class,
        () ->
            runner.run(
                () -> {
                  attempts.incrementAndGet();
                  body.run();
                }));
    return attempts.get();
  }

  @Test
  void aFlushThatDeadlocksIsRetried() {
    assertEquals(
        MAX_ATTEMPTS,
        countFlushAttempts(
            () -> {
              throw deadlock();
            }),
        "the boundary replays a deadlocked flush");
  }

  @Test
  void aFlushThatFailsForAnotherReasonIsNotRetried() {
    assertEquals(
        1,
        countFlushAttempts(
            () -> {
              throw new IllegalStateException("not a deadlock");
            }),
        "only a deadlock is retryable");
  }

  @Test
  void aNestedFlushDoesNotStartItsOwnRetry() {
    AtomicInteger innerRuns = new AtomicInteger();

    assertThrows(
        RuntimeException.class,
        () ->
            runner.run(
                () ->
                    runner.run(
                        () -> {
                          innerRuns.incrementAndGet();
                          throw deadlock();
                        })));

    // The outer boundary owns the retry, so the inner body runs once per outer attempt. A nested
    // retry would square that (MAX_ATTEMPTS * MAX_ATTEMPTS) and replay the inner body against a
    // transaction the database had already rolled back.
    assertEquals(
        MAX_ATTEMPTS,
        innerRuns.get(),
        "a boundary opened inside another must not retry on its own");
  }

  @Test
  void aFlushInsideACallerOwnedTransactionLeavesTheRetryToItsOwner() {
    final AtomicInteger runs = new AtomicInteger();
    assertThrows(
        RuntimeException.class,
        () ->
            jdbi.useTransaction(
                handle ->
                    runner.run(
                        () -> {
                          runs.incrementAndGet();
                          throw deadlock();
                        })));
    // The deadlock rolled back the caller's earlier writes too. Replaying only this unit would
    // commit it alone, so the caller, which owns the transaction, decides whether to retry.
    assertEquals(1, runs.get());
  }

  @Test
  void aFlushInsideACallerOwnedTransactionCommitsOnlyWithIt() throws SQLException {
    jdbi.useTransaction(handle -> runner.run(() -> {}));
    verify(connection).commit();
  }

  @Test
  void effectsOfAFlushInsideACallerOwnedTransactionWaitForItsCommit() throws SQLException {
    final List<String> published = new ArrayList<>();
    doAnswer(
            invocation -> {
              published.add("commit");
              return null;
            })
        .when(connection)
        .commit();
    jdbi.useTransaction(
        handle -> {
          runner.run(() -> deferSearch(() -> published.add("search")));
          published.add("caller's next write");
        });
    assertEquals(List.of("caller's next write", "commit", "search"), published);
    assertFalse(SearchRepository.isSearchWriteDeferralActive());
  }

  @Test
  void effectsOfAFlushInsideACallerOwnedTransactionAreDroppedWhenItRollsBack() {
    final List<String> published = new ArrayList<>();
    assertThrows(
        IllegalStateException.class,
        () ->
            jdbi.useTransaction(
                handle -> {
                  runner.run(() -> deferSearch(() -> published.add("search")));
                  throw new IllegalStateException("the caller fails after the flush");
                }));
    PostCommitActionQueue.runOrDefer(() -> published.add("next request"));
    assertEquals(List.of("next request"), published);
    assertFalse(SearchRepository.isSearchWriteDeferralActive());
  }

  @Test
  void aCallerTransactionThatCannotRollBackStillReleasesTheRequestThread() throws SQLException {
    final List<String> published = new ArrayList<>();
    doThrow(new SQLException("connection lost", "08S01")).when(connection).commit();
    doThrow(new SQLException("connection lost", "08S01")).when(connection).rollback();
    assertThrows(
        RuntimeException.class,
        () ->
            jdbi.useTransaction(
                handle -> runner.run(() -> deferSearch(() -> published.add("search")))));
    PostCommitActionQueue.runOrDefer(() -> published.add("next request"));
    assertEquals(List.of("next request"), published);
    assertFalse(SearchRepository.isSearchWriteDeferralActive());
  }

  @Test
  void aNestedFlushJoinsTheOpenTransaction() throws SQLException {
    runner.run(() -> runner.run(() -> {}));

    // One commit for the whole unit of work: the nested boundary joined the transaction already
    // open instead of committing independently of it.
    verify(connection).commit();
  }

  @ParameterizedTest
  @ValueSource(booleans = {true, false})
  void bothBoundariesExposeTheRetainedDaoHandle(boolean flush) {

    final Runnable assertion =
        () ->
            transactionRoot.useHandle(
                handle ->
                    assertSame(
                        handle,
                        RepositoryTransactionContext.requireCurrentDAO().getHandle(),
                        "Capture and repository writes must share the physical transaction"));
    if (flush) {
      runner.run(assertion);
    } else {
      runner.execute(
          () -> {
            assertion.run();
            return null;
          });
    }
  }

  @Test
  void publishesSearchAndRdfSubmissionOnlyAfterCommit() throws SQLException {
    final List<String> published = new ArrayList<>();
    doAnswer(
            invocation -> {
              published.add("commit");
              return null;
            })
        .when(connection)
        .commit();
    runner.run(
        () -> {
          deferSearch(() -> published.add("search"));
          PostCommitActionQueue.runOrDefer(
              () -> {
                assertNull(RepositoryTransactionContext.currentDAO());
                published.add("rdf submission");
              });
          assertEquals(List.of(), published);
        });
    assertEquals(List.of("commit", "search", "rdf submission"), published);
    assertFalse(SearchRepository.isSearchWriteDeferralActive());
  }

  @Test
  void retryDiscardsEffectsFromTheFailedAttempt() {
    final AtomicInteger attempts = new AtomicInteger();
    final List<Integer> published = new ArrayList<>();
    runner.run(
        () -> {
          final int attempt = attempts.incrementAndGet();
          deferSearch(() -> published.add(attempt));
          PostCommitActionQueue.runOrDefer(() -> published.add(attempt));
          if (attempt == 1) {
            throw deadlock();
          }
        });
    assertEquals(List.of(2, 2), published);
    assertNull(RepositoryTransactionContext.currentDAO());
  }

  @Test
  void failedCommitDiscardsEffectsAndRestoresTheRequestThread() throws SQLException {
    final List<String> published = new ArrayList<>();
    doThrow(new SQLException("commit failed", "HY000")).when(connection).commit();
    assertThrows(
        RuntimeException.class,
        () ->
            runner.run(
                () -> {
                  deferSearch(() -> published.add("search"));
                  PostCommitActionQueue.runOrDefer(() -> published.add("rdf submission"));
                }));
    PostCommitActionQueue.runOrDefer(() -> published.add("next request"));
    assertEquals(List.of("next request"), published);
    assertFalse(SearchRepository.isSearchWriteDeferralActive());
    assertNull(RepositoryTransactionContext.currentDAO());
  }

  @Test
  void publicationCanOpenAnIndependentTransaction() throws SQLException {
    final List<String> published = new ArrayList<>();
    final String result =
        runner.execute(
            () -> {
              PostCommitActionQueue.runOrDefer(
                  () ->
                      runner.run(
                          () ->
                              PostCommitActionQueue.runOrDefer(
                                  () -> published.add("nested publication"))));
              return "committed";
            });
    assertEquals("committed", result);
    assertEquals(List.of("nested publication"), published);
    verify(connection, times(2)).commit();
  }

  private static void deferSearch(final Runnable effect) {
    SearchRepository.deferOrRunSearchWrite(effect, "test", null, null, null);
  }

  @Test
  void aFailedFlushLeavesTheNextFlushRetryable() {
    countFlushAttempts(
        () -> {
          throw new IllegalStateException("flush blew up");
        });

    // If the failed flush had stranded its boundary, this one would look nested and silently lose
    // its retry — every later write on this pooled request thread would go unprotected.
    assertEquals(
        MAX_ATTEMPTS,
        countFlushAttempts(
            () -> {
              throw deadlock();
            }),
        "a failed flush must not disable retry for the next request on this thread");
  }

  @Test
  void aBoundaryOnOneThreadDoesNotSuppressRetryOnAnother() {
    AtomicInteger attemptsOnWorker = new AtomicInteger();
    List<Throwable> failures = new ArrayList<>();

    runner.run(
        () -> {
          // A worker thread checks out its own connection, so it owns its own transaction and must
          // keep its own retry even though the request thread is inside a boundary.
          Thread worker =
              new Thread(
                  () -> {
                    try {
                      attemptsOnWorker.set(
                          countFlushAttempts(
                              () -> {
                                throw deadlock();
                              }));
                    } catch (Throwable unexpected) {
                      failures.add(unexpected);
                    }
                  });
          worker.start();
          joinQuietly(worker);
        });

    assertEquals(List.of(), failures, "the worker thread failed for an unexpected reason");
    assertEquals(MAX_ATTEMPTS, attemptsOnWorker.get(), "another thread keeps its own retry");
  }

  @Test
  void aFlushThatSwallowsADeadlockIsReplayedWholeInsteadOfCommittedInPart() throws SQLException {
    AtomicInteger attempts = new AtomicInteger();

    runner.run(
        () -> {
          if (attempts.incrementAndGet() == 1) {
            loseDeadlockAndCarryOn();
          }
        });

    assertEquals(2, attempts.get(), "the unit is replayed after its transaction was rolled back");
    verify(connection, times(1)).commit();
  }

  @Test
  void aNestedFlushThatSwallowsADeadlockReplaysTheOwningUnit() {
    AtomicInteger outerAttempts = new AtomicInteger();

    runner.run(
        () -> {
          boolean firstAttempt = outerAttempts.incrementAndGet() == 1;
          runner.run(
              () -> {
                if (firstAttempt) {
                  loseDeadlockAndCarryOn();
                }
              });
        });

    assertEquals(2, outerAttempts.get(), "the whole unit is replayed, not only the nested flush");
  }

  @Test
  void aFlushThatSwallowsALockWaitTimeoutCommitsWithoutReplay() throws SQLException {
    AtomicInteger attempts = new AtomicInteger();

    runner.run(
        () -> {
          attempts.incrementAndGet();
          failStatementAndCarryOn(
              new SQLException(
                  "Lock wait timeout exceeded; try restarting transaction", "40001", 1205));
        });

    assertEquals(1, attempts.get(), "a lock wait timeout rolls back only its statement");
    verify(connection, times(1)).commit();
  }

  /** What the SQL logger sees when a statement loses a deadlock that its caller then catches. */
  private static void loseDeadlockAndCarryOn() {
    failStatementAndCarryOn((SQLException) deadlock().getCause());
  }

  private static void failStatementAndCarryOn(SQLException failure) {
    StatementContext statement = mock(StatementContext.class);
    when(statement.getRenderedSql()).thenReturn("/* EntityRelationshipDAO.insert */ INSERT");
    new OMSqlLogger().logException(statement, failure);
  }

  private static void joinQuietly(Thread thread) {
    try {
      thread.join();
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    }
  }
}
