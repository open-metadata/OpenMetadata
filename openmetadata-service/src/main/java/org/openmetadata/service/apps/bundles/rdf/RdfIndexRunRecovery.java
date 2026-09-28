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
package org.openmetadata.service.apps.bundles.rdf;

import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.function.LongSupplier;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.AppRunInterruption;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.RdfInfraDAOs.RdfReindexLockDAO;
import org.openmetadata.service.jdbi3.RdfInfraDAOs.RdfReindexLockDAO.RdfReindexLockRecord;
import org.openmetadata.service.rdf.RdfBackgroundScheduler;

/**
 * Ends RDF index runs left running by a server that stopped, without ending a run that is still
 * executing on another server. A run renews the reindex lock for as long as it executes, so the
 * lock, not the run record, tells a starting server whether a run it finds running is dead. While a
 * run holds the lock this looks again once that lock would expire, until the lock is released,
 * expires, or passes to another run.
 */
@Slf4j
public final class RdfIndexRunRecovery {
  public static final String APP_NAME = "RdfIndexApp";

  /** Past the lock's expiry, so a renewal that is merely late is not taken for a stopped run. */
  static final long RECHECK_MARGIN_MS = TimeUnit.SECONDS.toMillis(30);

  /** Runs a task once, after a delay. */
  @FunctionalInterface
  public interface DelayedTasks {
    void runAfter(long delayMs, Runnable task);
  }

  private final CollectionDAO.AppExtensionTimeSeries runs;
  private final RdfReindexLockDAO locks;
  private final String appName;
  private final String lockKey;
  private final LongSupplier clock;
  private final DelayedTasks delayedTasks;

  public RdfIndexRunRecovery(
      final CollectionDAO.AppExtensionTimeSeries runs,
      final RdfReindexLockDAO locks,
      final String appName,
      final String lockKey,
      final LongSupplier clock,
      final DelayedTasks delayedTasks) {
    this.runs = runs;
    this.locks = locks;
    this.appName = appName;
    this.lockKey = lockKey;
    this.clock = clock;
    this.delayedTasks = delayedTasks;
  }

  public static RdfIndexRunRecovery forServer() {
    final CollectionDAO collectionDAO = Entity.getCollectionDAO();
    return new RdfIndexRunRecovery(
        collectionDAO.appExtensionTimeSeriesDao(),
        collectionDAO.rdfReindexLockDAO(),
        APP_NAME,
        RdfReindexRunLock.LOCK_KEY,
        System::currentTimeMillis,
        (delayMs, task) ->
            RdfBackgroundScheduler.getInstance().schedule(task, delayMs, TimeUnit.MILLISECONDS));
  }

  /** Ends the runs that started before {@code startedBefore} once no live run holds the lock. */
  public void recover(final long startedBefore) {
    final RdfReindexLockRecord lock = locks.findByKey(lockKey);
    if (isLive(lock)) {
      LOG.info(
          "RDF index run {} on server '{}' holds the reindex lock, so it is left running",
          lock.jobId(),
          lock.serverId());
      checkAgainOnceExpired(lock, startedBefore);
    } else {
      end(startedBefore, AppRunInterruption.stillRunningAtStartup());
    }
  }

  private void recheck(final RdfReindexLockRecord observed, final long startedBefore) {
    try {
      final RdfReindexLockRecord lock = locks.findByKey(lockKey);
      if (isLive(lock) && lock.jobId().equals(observed.jobId())) {
        checkAgainOnceExpired(lock, startedBefore);
      } else {
        end(startedBefore, AppRunInterruption.lockNoLongerRenewed(observed.serverId()));
      }
    } catch (RuntimeException exception) {
      LOG.warn(
          "Could not check whether RDF index run {} is still live; checking again later",
          observed.jobId(),
          exception);
      delayedTasks.runAfter(RdfReindexRunLock.EXPIRY_MS, () -> recheck(observed, startedBefore));
    }
  }

  private void checkAgainOnceExpired(final RdfReindexLockRecord lock, final long startedBefore) {
    final long untilExpiry = Math.max(0, lock.expiresAt() - clock.getAsLong());
    delayedTasks.runAfter(untilExpiry + RECHECK_MARGIN_MS, () -> recheck(lock, startedBefore));
  }

  private void end(final long startedBefore, final String failure) {
    final int ended =
        runs.markRunningEntriesInterrupted(
            List.of(appName), failure, clock.getAsLong(), startedBefore);
    if (ended > 0) {
      LOG.info("Marked {} {} run(s) failed because their server stopped", ended, appName);
    }
  }

  private boolean isLive(final RdfReindexLockRecord lock) {
    return lock != null && lock.expiresAt() >= clock.getAsLong();
  }
}
