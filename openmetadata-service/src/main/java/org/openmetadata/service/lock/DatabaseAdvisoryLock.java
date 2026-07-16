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

package org.openmetadata.service.lock;

import static org.openmetadata.service.jdbi3.locator.ConnectionType.MYSQL;
import static org.openmetadata.service.jdbi3.locator.ConnectionType.POSTGRES;

import java.time.Duration;
import java.util.Objects;
import java.util.concurrent.locks.LockSupport;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.Jdbi;
import org.jdbi.v3.sqlobject.customizer.Bind;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlQuery;

@Slf4j
public final class DatabaseAdvisoryLock {
  private static final int MYSQL_LOCK_NAME_LIMIT = 64;
  private static final long RETRY_INTERVAL_NANOS = Duration.ofMillis(25).toNanos();

  private DatabaseAdvisoryLock() {}

  public static <T> T withLock(Jdbi jdbi, String lockKey, Duration timeout, Supplier<T> operation) {
    Objects.requireNonNull(jdbi, "jdbi");
    Objects.requireNonNull(lockKey, "lockKey");
    Objects.requireNonNull(timeout, "timeout");
    Objects.requireNonNull(operation, "operation");
    if (lockKey.length() > MYSQL_LOCK_NAME_LIMIT) {
      throw new IllegalArgumentException("Database advisory lock key exceeds 64 characters");
    }
    if (timeout.isNegative()) {
      throw new IllegalArgumentException("Database advisory lock timeout cannot be negative");
    }

    try (Handle handle = jdbi.open()) {
      AdvisoryLockDAO lockDAO = handle.attach(AdvisoryLockDAO.class);
      acquire(lockDAO, lockKey, timeout);
      try {
        return operation.get();
      } finally {
        release(lockDAO, lockKey);
      }
    }
  }

  private static void acquire(AdvisoryLockDAO lockDAO, String lockKey, Duration timeout) {
    long deadline = System.nanoTime() + timeout.toNanos();
    do {
      if (lockDAO.tryAcquire(lockKey)) {
        return;
      }
      if (Thread.currentThread().isInterrupted()) {
        throw new LockUnavailableException(
            "Interrupted while acquiring database advisory lock " + lockKey);
      }
      long remainingNanos = deadline - System.nanoTime();
      if (remainingNanos > 0) {
        LockSupport.parkNanos(Math.min(RETRY_INTERVAL_NANOS, remainingNanos));
      }
    } while (System.nanoTime() < deadline);

    throw new LockUnavailableException("Timed out acquiring database advisory lock " + lockKey);
  }

  private static void release(AdvisoryLockDAO lockDAO, String lockKey) {
    try {
      if (!lockDAO.release(lockKey)) {
        LOG.warn("Database advisory lock {} was no longer owned during release", lockKey);
      }
    } catch (RuntimeException exception) {
      LOG.warn("Failed to release database advisory lock {}", lockKey, exception);
    }
  }

  interface AdvisoryLockDAO {
    @ConnectionAwareSqlQuery(value = "SELECT GET_LOCK(:lockKey, 0)", connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value = "SELECT pg_try_advisory_lock(hashtextextended(:lockKey, 0))",
        connectionType = POSTGRES)
    boolean tryAcquire(@Bind("lockKey") String lockKey);

    @ConnectionAwareSqlQuery(value = "SELECT RELEASE_LOCK(:lockKey)", connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value = "SELECT pg_advisory_unlock(hashtextextended(:lockKey, 0))",
        connectionType = POSTGRES)
    boolean release(@Bind("lockKey") String lockKey);
  }

  public static final class LockUnavailableException extends RuntimeException {
    public LockUnavailableException(String message) {
      super(message);
    }
  }
}
