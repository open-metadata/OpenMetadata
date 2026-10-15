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
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Supplier;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.statement.Cleanable;

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
    final AtomicBoolean callerOwnsTransaction = new AtomicBoolean();
    boolean committed = false;
    try {
      // Every attempt reuses this thread-bound handle, which is released before effects drain.
      final R result =
          daoCollection.withHandle(
              handle -> executeOnHandle(handle, effects, callerOwnsTransaction, work));
      committed = true;
      return result;
    } finally {
      if (!callerOwnsTransaction.get()) {
        effects.finish(committed);
      }
    }
  }

  /**
   * A transaction already open on the thread's handle belongs to a caller that opened it through
   * the same Jdbi, such as a raw {@code inTransaction} or a {@code @Transaction} SQL object method.
   * Replaying only this unit after a deadlock would commit a fragment after the database rolled
   * back the caller's earlier writes, so that deadlock propagates to the transaction's owner. The
   * unit's effects wait for that transaction too: its commit publishes them, a rollback drops them.
   */
  private <R> R executeOnHandle(
      final Handle handle,
      final RepositorySideEffectScope effects,
      final AtomicBoolean callerOwnsTransaction,
      final Supplier<R> work) {
    if (!handle.isInTransaction()) {
      return DeadlockRetry.execute(() -> executeAttempt(effects, work));
    }
    callerOwnsTransaction.set(true);
    CallerTransactionEffects.register(handle, effects);
    return executeAttempt(effects, work);
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

  /** Finishes a unit's effects when the transaction its caller opened ends. */
  private static final class CallerTransactionEffects implements Cleanable {
    private final Handle handle;
    private final RepositorySideEffectScope effects;
    private boolean finished;

    private CallerTransactionEffects(final Handle handle, final RepositorySideEffectScope effects) {
      this.handle = handle;
      this.effects = effects;
    }

    static void register(final Handle handle, final RepositorySideEffectScope effects) {
      final CallerTransactionEffects callerEffects = new CallerTransactionEffects(handle, effects);
      handle.afterCommit(() -> callerEffects.transactionEnded(true));
      handle.afterRollback(() -> callerEffects.transactionEnded(false));
      // A rollback that fails as well runs neither callback; the effects must not outlive the
      // handle.
      handle.addCleanable(callerEffects);
    }

    private void transactionEnded(final boolean committed) {
      handle.removeCleanable(this);
      finish(committed);
    }

    @Override
    public void close() {
      finish(false);
    }

    private void finish(final boolean committed) {
      if (!finished) {
        finished = true;
        effects.finish(committed);
      }
    }
  }
}
