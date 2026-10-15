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

import java.util.Objects;
import java.util.function.Supplier;
import org.jdbi.v3.core.Handle;

/** Owns the SQL transaction, whole-unit retry and post-commit effects for repository mutations. */
final class RepositoryTransactionRunner {
  private final CollectionDAO daoCollection;

  RepositoryTransactionRunner(final CollectionDAO daoCollection) {
    this.daoCollection = Objects.requireNonNull(daoCollection);
  }

  void run(final Runnable work) {
    execute(
        () -> {
          work.run();
          return null;
        });
  }

  <R> R execute(final Supplier<R> work) {
    // A database deadlock discards the entire transaction. Only its owner may replay the work.
    if (RepositoryTransactionContext.currentDAO() != null) {
      return work.get();
    }
    final RepositorySideEffectScope effects = new RepositorySideEffectScope();
    boolean committed = false;
    try {
      // Every attempt reuses this thread-bound handle, which is released before effects drain.
      final R result = daoCollection.withHandle(handle -> executeOnHandle(handle, effects, work));
      committed = true;
      return result;
    } finally {
      effects.finish(committed);
    }
  }

  /**
   * A transaction already open on the thread's handle belongs to a caller that opened it through
   * the same Jdbi, such as a raw {@code inTransaction} or a {@code @Transaction} SQL object method.
   * Replaying only this unit after a deadlock would commit a fragment after the database rolled
   * back the caller's earlier writes, so that deadlock propagates to the transaction's owner.
   */
  private <R> R executeOnHandle(
      final Handle handle, final RepositorySideEffectScope effects, final Supplier<R> work) {
    return handle.isInTransaction()
        ? executeAttempt(effects, work)
        : DeadlockRetry.execute(() -> executeAttempt(effects, work));
  }

  private <R> R executeAttempt(final RepositorySideEffectScope effects, final Supplier<R> work) {
    return daoCollection.inTransaction(
        transaction ->
            RepositoryTransactionContext.callWith(
                transaction,
                () ->
                    TransactionRollbackTracker.runAttempt(
                        () -> {
                          effects.reopenForAttempt();
                          return work.get();
                        })));
  }
}
