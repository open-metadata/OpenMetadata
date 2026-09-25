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
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.jdbi3.EntityRepository.exitRetryableBoundary;

import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import javax.sql.DataSource;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.sqlobject.SqlObjectPlugin;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

/**
 * Which transaction boundary owns the {@link DeadlockRetry}, exercised through the production entry
 * point {@link EntityRepository#flushInOneTransaction(Runnable)}. Every assertion here is on
 * observable behaviour — how many times a flush body runs, and how many transactions get committed —
 * so removing the production guard or its {@code finally} fails the suite.
 *
 * <p>JDBI joins a nested {@code inTransaction} to the handle already bound to the thread rather than
 * opening a savepoint, so nested boundaries share one database transaction. A deadlock rolls that
 * whole transaction back, so only the outermost boundary may retry — an inner retry would replay its
 * own body against a transaction the database has already discarded and commit a fragment of the
 * unit of work. Nesting is reachable in production: a hard delete runs {@code entitySpecificCleanup}
 * inside its boundary, and those hooks cascade into full entity deletes of their own.
 *
 * <p>The only mock is the JDBC boundary — a {@link DataSource} handing out a {@link Connection} that
 * records commits. Everything above it is the real repository code path.
 */
class RetryableBoundaryTest {

  /** Matches {@code DeadlockRetry}'s configured {@code maxAttempts}. */
  private static final int MAX_ATTEMPTS = 4;

  private Jdbi previousJdbi;
  private Connection connection;
  private BoundaryRepo repo;

  /** Production exception shape: a runtime exception wrapping the MySQL deadlock (errno 1213). */
  private static RuntimeException deadlock() {
    SQLException sql =
        new SQLException(
            "Deadlock found when trying to get lock; try restarting transaction", "40001", 1213);
    return new RuntimeException("### Error updating database", sql);
  }

  /** A repository with no persistence of its own — only the transaction boundary is under test. */
  private static class BoundaryRepo extends EntityRepository<Pipeline> {
    BoundaryRepo(CollectionDAO.PipelineDAO dao) {
      super("pipelines", Entity.PIPELINE, Pipeline.class, dao, "", "");
    }

    /** Test-side entry into the inherited production boundary. */
    void runFlush(Runnable body) {
      flushInOneTransaction(body);
    }

    /** Runs {@code body} in a boundary and counts how many times the body was replayed. */
    int countFlushAttempts(Runnable body) {
      AtomicInteger attempts = new AtomicInteger();
      assertThrows(
          RuntimeException.class,
          () ->
              runFlush(
                  () -> {
                    attempts.incrementAndGet();
                    body.run();
                  }));
      return attempts.get();
    }

    @Override
    protected void setFields(Pipeline entity, Fields fields, RelationIncludes includes) {}

    @Override
    protected void clearFields(Pipeline entity, Fields fields) {}

    @Override
    protected void prepare(Pipeline entity, boolean update) {}

    @Override
    protected void storeEntity(Pipeline entity, boolean update) {}

    @Override
    protected void storeRelationships(Pipeline entity) {}
  }

  @BeforeEach
  void setUp() throws SQLException {
    CollectionDAO daoCollection = mock(CollectionDAO.class);
    when(daoCollection.relationshipDAO())
        .thenReturn(mock(CollectionDAO.EntityRelationshipDAO.class));
    Entity.setCollectionDAO(daoCollection);

    connection = mock(Connection.class);
    when(connection.getAutoCommit()).thenReturn(true);
    DataSource dataSource = mock(DataSource.class);
    when(dataSource.getConnection()).thenReturn(connection);

    previousJdbi = Entity.getJdbi();
    // SqlObjectPlugin mirrors the production Jdbi built in JdbiUtils: the boundary attaches
    // CollectionDAO to the transaction's handle, and attach() needs the SQL-object extension.
    Entity.setJdbi(Jdbi.create(dataSource).installPlugin(new SqlObjectPlugin()));
    repo = new BoundaryRepo(mock(CollectionDAO.PipelineDAO.class));
  }

  @AfterEach
  void tearDown() {
    Entity.setJdbi(previousJdbi);
    Entity.setCollectionDAO(null);
    // Hygiene only, never an assertion: a boundary stranded by a failing test would otherwise
    // cascade into confusing failures on the next test to run on this thread.
    exitRetryableBoundary(true);
  }

  @Test
  void aFlushThatDeadlocksIsRetried() {
    assertEquals(
        MAX_ATTEMPTS,
        repo.countFlushAttempts(
            () -> {
              throw deadlock();
            }),
        "the boundary replays a deadlocked flush");
  }

  @Test
  void aFlushThatFailsForAnotherReasonIsNotRetried() {
    assertEquals(
        1,
        repo.countFlushAttempts(
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
            repo.runFlush(
                () ->
                    repo.runFlush(
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
  void aNestedFlushJoinsTheOpenTransaction() throws SQLException {
    repo.runFlush(() -> repo.runFlush(() -> {}));

    // One commit for the whole unit of work: the nested boundary joined the transaction already
    // open instead of committing independently of it.
    verify(connection).commit();
  }

  @Test
  void aFailedFlushLeavesTheNextFlushRetryable() {
    repo.countFlushAttempts(
        () -> {
          throw new IllegalStateException("flush blew up");
        });

    // If the failed flush had stranded its boundary, this one would look nested and silently lose
    // its retry — every later write on this pooled request thread would go unprotected.
    assertEquals(
        MAX_ATTEMPTS,
        repo.countFlushAttempts(
            () -> {
              throw deadlock();
            }),
        "a failed flush must not disable retry for the next request on this thread");
  }

  @Test
  void aBoundaryOnOneThreadDoesNotSuppressRetryOnAnother() {
    AtomicInteger attemptsOnWorker = new AtomicInteger();
    List<Throwable> failures = new ArrayList<>();

    repo.runFlush(
        () -> {
          // A worker thread checks out its own connection, so it owns its own transaction and must
          // keep its own retry even though the request thread is inside a boundary.
          Thread worker =
              new Thread(
                  () -> {
                    try {
                      attemptsOnWorker.set(
                          repo.countFlushAttempts(
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

  private static void joinQuietly(Thread thread) {
    try {
      thread.join();
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    }
  }
}
