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

import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Supplier;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.transaction.TransactionIsolationLevel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.LineageUtil;
import org.openmetadata.service.util.PostCommitActionQueue;

/**
 * One lineage write as one database transaction, so the locks its domain lineage rollups need hold
 * until it commits. It runs at READ COMMITTED: a write that waited on a guard row must read what
 * the writer it waited for committed, which MySQL's default REPEATABLE READ snapshot, taken at its
 * first read, would hide. Search writes and other post-commit actions it captures run once, after
 * the commit, and a rolled-back attempt drops its own. A deadlock replays the whole write. Inside a
 * repository transaction that is already open the work joins it, and that transaction owns the
 * retry and the post-commit actions.
 * ADR:2026-11-26-domain-lineage-rollup-writers-lock-guard-rows-in-one-order
 */
final class LineageWriteTransaction {

  private LineageWriteTransaction() {}

  static <R> R run(final Supplier<R> work) {
    final boolean ownsRetry = Entity.getJdbi() != null && EntityRepository.enterRetryableBoundary();
    try {
      return ownsRetry ? DeadlockRetry.execute(() -> attempt(work)) : work.get();
    } finally {
      EntityRepository.exitRetryableBoundary(ownsRetry);
    }
  }

  private static <R> R attempt(final Supplier<R> work) {
    final int searchCheckpoint = LineageUtil.checkpoint();
    final int actionCheckpoint = PostCommitActionQueue.checkpoint();
    final boolean ownsSearchWrites = LineageUtil.beginLineageDeferral();
    final boolean ownsActions = PostCommitActionQueue.begin();
    boolean committed = false;
    try {
      final R result =
          Entity.getJdbi()
              .inTransaction(
                  TransactionIsolationLevel.READ_COMMITTED,
                  handle -> TransactionRollbackTracker.runAttempt(() -> bound(handle, work)));
      committed = true;
      return result;
    } finally {
      if (committed) {
        drain(ownsSearchWrites, ownsActions);
      } else {
        discard(ownsSearchWrites, searchCheckpoint, ownsActions, actionCheckpoint);
      }
    }
  }

  private static <R> R bound(final Handle handle, final Supplier<R> work) {
    final AtomicReference<R> result = new AtomicReference<>();
    RepositoryTransactionContext.runWith(
        handle.attach(CollectionDAO.class), () -> result.set(work.get()));
    return result.get();
  }

  private static void drain(final boolean ownsSearchWrites, final boolean ownsActions) {
    final List<LineageUtil.DeferredLineageEsWrite> searchWrites =
        ownsSearchWrites ? LineageUtil.drainLineageDeferred() : List.of();
    final List<Runnable> actions = ownsActions ? PostCommitActionQueue.drain() : List.of();
    LineageUtil.runDeferred(searchWrites);
    PostCommitActionQueue.run(actions);
  }

  private static void discard(
      final boolean ownsSearchWrites,
      final int searchCheckpoint,
      final boolean ownsActions,
      final int actionCheckpoint) {
    if (ownsSearchWrites) {
      LineageUtil.clearLineageDeferred();
    } else {
      LineageUtil.rollbackToCheckpoint(searchCheckpoint);
    }
    if (ownsActions) {
      PostCommitActionQueue.clear();
    } else {
      PostCommitActionQueue.rollbackToCheckpoint(actionCheckpoint);
    }
  }
}
