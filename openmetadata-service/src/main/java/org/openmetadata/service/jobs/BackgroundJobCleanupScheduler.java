/*
 *  Copyright 2026 Collate.
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

package org.openmetadata.service.jobs;

import io.dropwizard.lifecycle.Managed;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.csv.CsvAsyncJobManager;

/**
 * Keeps {@code background_jobs} bounded and reaps jobs whose worker stopped responding.
 *
 * <p>The table is shared: CSV, audit, and ontology jobs live there alongside custom-property enum
 * cleanup. Pruning terminal rows therefore applies to every job type, while export-payload
 * retention is delegated to {@link CsvAsyncJobManager} because only export jobs carry a payload.
 *
 * <p>Reaping used to happen once at startup and failed every RUNNING job unconditionally, so in a
 * multi-server deployment a pod coming up during a rolling deploy killed the jobs its peers were
 * actively running. It is now scoped to jobs nobody has heartbeated, which makes it safe for every
 * server to run repeatedly — including shortly after boot, where it recovers whatever the previous
 * process left behind.
 */
@Slf4j
public class BackgroundJobCleanupScheduler implements Managed {
  private static final long INTERVAL_MINUTES = 5L;

  /**
   * Short rather than a full interval so a restart recovers jobs orphaned by the previous run
   * promptly, instead of leaving them RUNNING for another five minutes. Not zero, to keep a few
   * database statements out of the first seconds of startup. Reaping at boot is safe now that the
   * reaper is scoped to a staleness window — it cannot touch a job a live peer is heartbeating.
   */
  private static final long INITIAL_DELAY_SECONDS = 30L;

  private static final Duration JOB_ROW_RETENTION = Duration.ofDays(7);
  private static final int PRUNE_BATCH_SIZE = 500;
  private static final int PRUNE_MAX_ITERATIONS = 100;

  private final JobDAO jobDao;
  private final CsvAsyncJobManager csvJobManager;
  private ScheduledExecutorService scheduler;

  public BackgroundJobCleanupScheduler(JobDAO jobDao, CsvAsyncJobManager csvJobManager) {
    this.jobDao = jobDao;
    this.csvJobManager = csvJobManager;
  }

  @Override
  public void start() {
    scheduler =
        Executors.newSingleThreadScheduledExecutor(
            runnable -> {
              Thread thread = new Thread(runnable, "om-background-job-cleanup");
              thread.setDaemon(true);
              return thread;
            });
    scheduler.scheduleWithFixedDelay(
        this::runCleanupSafely,
        INITIAL_DELAY_SECONDS,
        TimeUnit.MINUTES.toSeconds(INTERVAL_MINUTES),
        TimeUnit.SECONDS);
  }

  @Override
  public void stop() {
    if (scheduler != null) {
      scheduler.shutdownNow();
    }
  }

  void runCleanupSafely() {
    try {
      runCleanupOnce(System.currentTimeMillis());
    } catch (RuntimeException exception) {
      LOG.warn("Failed to run background job cleanup", exception);
    }
  }

  void runCleanupOnce(final long now) {
    final long staleBefore = now - GenericBackgroundWorker.RUNNING_JOB_STALE_AFTER.toMillis();
    final int failedJobs = jobDao.markStaleRunningJobsFailed(now, staleBefore);
    if (failedJobs > 0) {
      LOG.info("Marked {} unresponsive background jobs as failed", failedJobs);
    }
    csvJobManager.runCleanupOnce();
    pruneTerminalJobRows(now - JOB_ROW_RETENTION.toMillis());
  }

  /**
   * Deletes finished rows of every job type; {@code background_job_logs} cascades. PENDING and
   * RUNNING are never pruned — a PENDING job with a future runAt has not had its turn yet.
   */
  private void pruneTerminalJobRows(long cutoff) {
    for (int iteration = 0; iteration < PRUNE_MAX_ITERATIONS; iteration++) {
      List<Long> ids = jobDao.findJobsToPrune(cutoff, PRUNE_BATCH_SIZE);
      if (ids.isEmpty()) {
        return;
      }
      LOG.debug("Pruned {} background job rows in batch", jobDao.deleteJobsByIds(ids));
      if (ids.size() < PRUNE_BATCH_SIZE) {
        return;
      }
    }
    LOG.warn("pruneTerminalJobRows reached maximum iterations ({})", PRUNE_MAX_ITERATIONS);
  }
}
