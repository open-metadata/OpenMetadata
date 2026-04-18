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
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;

/**
 * Retry wrapper for JDBI {@code @Transaction}-annotated methods that can lose a deadlock race on
 * hot rows.
 *
 * <p>The retry scope is the full transaction: when JDBI rolls the transaction back on a deadlock,
 * we re-invoke the enclosing method so the entire unit of work replays in a fresh transaction. Do
 * not push this down into {@code CollectionDAO} — retrying one DAO statement outside its original
 * transaction context would leave earlier writes in that txn lost.
 *
 * <p>Backoff: resilience4j schedules the delay on its own executor, so the request thread yields
 * instead of blocking on {@link Thread#sleep}. Exponential base 50 ms × 2^(attempt-1) with 50%
 * jitter — attempt 1 ≈ 25-75 ms, attempt 2 ≈ 50-150 ms, attempt 3 ≈ 100-300 ms.
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

  /** Execute {@code operation} with deadlock retry. {@code operation} must open its own JDBI
   * transaction (typically via {@code @Transaction} on the method it delegates to) so each retry
   * runs in a fresh, atomic unit of work. */
  public static <T> T execute(Supplier<T> operation) {
    return RETRY.executeSupplier(operation);
  }

  /** {@code true} if {@code throwable} (or any cause in its chain) is a MySQL/Postgres deadlock or
   * lock-wait timeout that is safe to retry as a fresh transaction. */
  public static boolean isDeadlock(Throwable throwable) {
    Throwable root = throwable;
    while (root.getCause() != null) {
      root = root.getCause();
    }
    if (root instanceof SQLException sqlException) {
      String sqlState = sqlException.getSQLState();
      int errorCode = sqlException.getErrorCode();
      // MySQL: 1213 deadlock, 1205 lock-wait timeout. Postgres: 40P01 deadlock. Generic: 40001.
      return "40001".equals(sqlState)
          || "40P01".equals(sqlState)
          || errorCode == 1213
          || errorCode == 1205;
    }
    String message = root.getMessage();
    return message != null && message.contains("Deadlock found when trying to get lock");
  }
}
