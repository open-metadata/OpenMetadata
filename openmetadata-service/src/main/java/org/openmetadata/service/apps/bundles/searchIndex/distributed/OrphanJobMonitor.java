/*
 *  Copyright 2024 Collate
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

package org.openmetadata.service.apps.bundles.searchIndex.distributed;

import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.jdbi3.CollectionDAO;

/**
 * Periodically checks for orphaned distributed reindex jobs left behind by crashed coordinators.
 *
 * <p>When a coordinator server crashes mid-job, the distributed lock expires but no surviving server
 * cleans up the orphaned job. This monitor runs on every server and periodically delegates to {@link
 * JobRecoveryManager#performStartupRecovery()} to detect and handle orphaned jobs.
 */
@Slf4j
public class OrphanJobMonitor {

  private static final long MONITOR_INTERVAL_MINUTES = 2;

  private final CollectionDAO collectionDAO;
  private volatile ScheduledExecutorService scheduler;

  public OrphanJobMonitor(CollectionDAO collectionDAO) {
    this.collectionDAO = collectionDAO;
  }

  public synchronized void start() {
    if (scheduler != null && !scheduler.isShutdown()) {
      LOG.debug("OrphanJobMonitor already running, skipping start");
      return;
    }

    scheduler =
        Executors.newSingleThreadScheduledExecutor(
            r -> {
              Thread t = new Thread(r, "reindex-orphan-job-monitor");
              t.setDaemon(true);
              return t;
            });

    scheduler.scheduleAtFixedRate(
        this::checkForOrphanedJobs,
        MONITOR_INTERVAL_MINUTES,
        MONITOR_INTERVAL_MINUTES,
        TimeUnit.MINUTES);

    LOG.info(
        "OrphanJobMonitor started (interval={}min, initialDelay={}min)",
        MONITOR_INTERVAL_MINUTES,
        MONITOR_INTERVAL_MINUTES);
  }

  public synchronized void shutdown() {
    if (scheduler != null && !scheduler.isShutdown()) {
      scheduler.shutdown();
      try {
        if (!scheduler.awaitTermination(5, TimeUnit.SECONDS)) {
          scheduler.shutdownNow();
        }
      } catch (InterruptedException e) {
        scheduler.shutdownNow();
        Thread.currentThread().interrupt();
      }
      LOG.info("OrphanJobMonitor stopped");
    }
  }

  private void checkForOrphanedJobs() {
    try {
      JobRecoveryManager recoveryManager = new JobRecoveryManager(collectionDAO);
      JobRecoveryManager.RecoveryResult result = recoveryManager.performStartupRecovery();

      if (result.orphanedJobsFound() > 0) {
        LOG.info(
            "OrphanJobMonitor recovery: {} orphaned jobs found ({} recovered, {} failed)",
            result.orphanedJobsFound(),
            result.jobsRecovered(),
            result.jobsMarkedFailed());
      }
    } catch (Exception e) {
      LOG.error("OrphanJobMonitor failed during recovery check", e);
    }
  }
}
