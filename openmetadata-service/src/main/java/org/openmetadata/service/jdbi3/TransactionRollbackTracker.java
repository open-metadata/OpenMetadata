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

package org.openmetadata.service.jdbi3;

import java.sql.SQLException;
import java.util.function.Supplier;
import org.jdbi.v3.core.transaction.TransactionException;

/**
 * Tells a unit of work that the database rolled back its transaction, even when the code in between
 * caught the error.
 *
 * <p>A deadlock makes MySQL roll back the whole transaction. Code that catches that error and
 * carries on runs its remaining statements in a fresh transaction, so committing would persist only
 * part of the unit. The SQL logger records such a rollback for the attempt running on its thread,
 * and the attempt then fails with an error {@link DeadlockRetry} replays instead of committing.
 */
public final class TransactionRollbackTracker {
  private static final ThreadLocal<Attempt> CURRENT = new ThreadLocal<>();

  private TransactionRollbackTracker() {}

  /** Called by the SQL logger when a statement's error rolled back the whole transaction. */
  public static void recordRollback(final SQLException rollback) {
    final Attempt attempt = CURRENT.get();
    if (attempt != null) {
      attempt.rollback = rollback;
    }
  }

  /**
   * Runs one attempt of a unit of work inside its open transaction. An attempt started inside
   * another joins it, because nested boundaries share one database transaction: a rollback anywhere
   * fails the outermost attempt too. A body that throws is rolled back anyway, so its error reaches
   * {@link DeadlockRetry} unchanged.
   */
  static <R> R runAttempt(final Supplier<R> body) {
    final Attempt enclosing = CURRENT.get();
    final Attempt attempt = enclosing == null ? new Attempt() : enclosing;
    CURRENT.set(attempt);
    try {
      final R result = body.get();
      attempt.failIfRolledBack();
      return result;
    } finally {
      if (enclosing == null) {
        CURRENT.remove();
      }
    }
  }

  private static final class Attempt {
    private SQLException rollback;

    private void failIfRolledBack() {
      if (rollback != null) {
        throw new TransactionException(
            "The database rolled back this unit of work's transaction, so it was not committed: "
                + rollback.getMessage(),
            rollback);
      }
    }
  }
}
