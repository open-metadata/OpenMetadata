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

import io.github.resilience4j.core.IntervalFunction;
import io.github.resilience4j.retry.Retry;
import io.github.resilience4j.retry.RetryConfig;
import java.sql.SQLException;
import java.util.function.Predicate;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;

/**
 * Retry wrapper for a self-contained unit of work that can lose a deadlock race on hot rows.
 *
 * <p>The retry scope is the whole enclosing unit of work — a JDBI {@code @Transaction}-annotated
 * method, or a single self-contained Flowable command (e.g. {@code taskService.complete(...)},
 * {@code runtimeService.startProcessInstanceById(...)}). When the database rolls the transaction
 * back on a deadlock it has already released every lock it held, so re-invoking the enclosing
 * operation replays it atomically in a fresh transaction. Do not push this down into
 * {@code CollectionDAO} — retrying one DAO statement outside its original transaction context
 * would leave earlier writes in that txn lost.
 *
 * <p>Backoff: retries are synchronous when invoked via {@link Retry#executeSupplier(Supplier)} —
 * the calling thread waits between attempts according to the configured interval. This matches
 * the existing retry pattern in {@code SearchRetryUtil} so operators see consistent behaviour
 * across subsystems. Exponential base 50 ms × 2^(attempt-1) with 50% jitter — attempt 1 ≈ 25-75
 * ms, attempt 2 ≈ 50-150 ms, attempt 3 ≈ 100-300 ms. The wait is bounded and happens after the
 * transaction has been rolled back, so no database lock is held while the thread backs off.
 */
@Slf4j
public final class DeadlockRetry {
  private static final RetryConfig CONFIG =
      RetryConfig.custom()
          .maxAttempts(4)
          .intervalFunction(IntervalFunction.ofExponentialRandomBackoff(50, 2.0, 0.5))
          .retryOnException(DeadlockRetry::isDeadlock)
          .build();

  private static final Retry RETRY = Retry.of("db-deadlock", CONFIG);
  private static final int MYSQL_LOCK_WAIT_TIMEOUT = 1205;
  private static final int MYSQL_DEADLOCK = 1213;
  private static final String SERIALIZATION_FAILURE = "40001";
  private static final String POSTGRES_DEADLOCK = "40P01";
  private static final String DEADLOCK_MESSAGE = "Deadlock found when trying to get lock";

  static {
    RETRY
        .getEventPublisher()
        .onRetry(
            event ->
                LOG.warn(
                    "Retrying transactional operation after deadlock (attempt {}, waiting {})",
                    event.getNumberOfRetryAttempts(),
                    event.getWaitInterval()));
  }

  private DeadlockRetry() {}

  /** Execute {@code operation} with deadlock retry. {@code operation} must open its own
   * transaction (a JDBI {@code @Transaction} method, or a self-contained Flowable command that
   * commits on its own) so each retry runs in a fresh, atomic unit of work. */
  public static <T> T execute(Supplier<T> operation) {
    return RETRY.executeSupplier(operation);
  }

  /** Run a void {@code operation} with deadlock retry — the {@link Runnable} equivalent of
   * {@link #execute(Supplier)} for a self-contained command with no return value. */
  public static void run(Runnable operation) {
    RETRY.executeSupplier(
        () -> {
          operation.run();
          return null;
        });
  }

  /** {@code true} if {@code throwable} (or any cause in its chain) is a MySQL/Postgres deadlock or
   * lock-wait timeout that is safe to retry as a fresh transaction. */
  public static boolean isDeadlock(Throwable throwable) {
    return anyInChain(throwable, DeadlockRetry::isDeadlockSqlException);
  }

  /**
   * {@code true} if {@code throwable} (or any cause in its chain) means the database rolled back the
   * whole transaction: a MySQL deadlock, or a Postgres deadlock or serialization failure. A MySQL
   * lock wait timeout rolls back only its statement, so it does not count, even though Connector/J
   * reports it with the same SQLState {@code 40001}.
   */
  public static boolean isTransactionRolledBack(Throwable throwable) {
    return anyInChain(throwable, DeadlockRetry::rolledBackTransaction);
  }

  private static boolean anyInChain(Throwable throwable, Predicate<SQLException> matches) {
    // Walk every link — JDBI wraps SQLException in UnableToExecuteStatementException, and some
    // drivers wrap the deadlock further with a connection-release or cleanup exception that
    // ends up as the terminal cause. Checking only the leaf would miss those cases and silently
    // skip the retry.
    Throwable current = throwable;
    int guard = 0;
    while (current != null && guard++ < 32) {
      if (current instanceof SQLException sqlException && matches.test(sqlException)) {
        return true;
      }
      String message = current.getMessage();
      if (message != null && message.contains(DEADLOCK_MESSAGE)) {
        return true;
      }
      if (current.getCause() == current) {
        break;
      }
      current = current.getCause();
    }
    return false;
  }

  private static boolean isDeadlockSqlException(SQLException sqlException) {
    String sqlState = sqlException.getSQLState();
    int errorCode = sqlException.getErrorCode();
    // MySQL: 1213 deadlock, 1205 lock-wait timeout. Postgres: 40P01 deadlock. Generic: 40001.
    return SERIALIZATION_FAILURE.equals(sqlState)
        || POSTGRES_DEADLOCK.equals(sqlState)
        || errorCode == MYSQL_DEADLOCK
        || errorCode == MYSQL_LOCK_WAIT_TIMEOUT;
  }

  private static boolean rolledBackTransaction(SQLException sqlException) {
    String sqlState = sqlException.getSQLState();
    int errorCode = sqlException.getErrorCode();
    boolean rollbackState =
        SERIALIZATION_FAILURE.equals(sqlState) || POSTGRES_DEADLOCK.equals(sqlState);
    return errorCode == MYSQL_DEADLOCK || (rollbackState && errorCode != MYSQL_LOCK_WAIT_TIMEOUT);
  }
}
