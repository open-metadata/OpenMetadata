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

import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.jdbi3.CollectionDAO;

/**
 * Database polling based job notifier as fallback when Redis is not available.
 *
 * <p>Uses adaptive polling intervals:
 *
 * <ul>
 *   <li>30 seconds when idle (no active jobs)
 *   <li>1 second when actively participating in a job
 * </ul>
 *
 * <p>This minimizes database overhead while still providing reasonable job discovery latency.
 */
@Slf4j
public class PollingJobNotifier implements DistributedJobNotifier {

  /** Poll interval when no job is running (30 seconds) */
  private static final long IDLE_POLL_INTERVAL_MS = 30_000;

  /** Poll interval when actively participating (1 second) */
  private static final long ACTIVE_POLL_INTERVAL_MS = 1_000;

  private final CollectionDAO collectionDAO;
  private final String serverId;
  private final AtomicBoolean running = new AtomicBoolean(false);
  private final AtomicBoolean participating = new AtomicBoolean(false);
  private final Set<UUID> knownJobs = ConcurrentHashMap.newKeySet();

  private ScheduledExecutorService scheduler;
  private Consumer<UUID> jobStartedCallback;
  private volatile long lastPollTime = 0;

  public PollingJobNotifier(CollectionDAO collectionDAO, String serverId) {
    this.collectionDAO = collectionDAO;
    this.serverId = serverId;
  }

  @Override
  public void start() {
    if (!running.compareAndSet(false, true)) {
      LOG.warn("PollingJobNotifier already running");
      return;
    }

    scheduler =
        Executors.newSingleThreadScheduledExecutor(
            Thread.ofPlatform().name("job-notifier-poll").factory());

    // Schedule with fixed delay of 1 second, but actual polling is controlled by interval logic
    scheduler.scheduleWithFixedDelay(
        this::pollForJobs, 0, ACTIVE_POLL_INTERVAL_MS, TimeUnit.MILLISECONDS);

    LOG.info(
        "PollingJobNotifier started on server {} (idle: {}s, active: {}s)",
        serverId,
        IDLE_POLL_INTERVAL_MS / 1000,
        ACTIVE_POLL_INTERVAL_MS / 1000);
  }

  @Override
  public void stop() {
    if (!running.compareAndSet(true, false)) {
      return;
    }

    if (scheduler != null) {
      scheduler.shutdown();
      try {
        if (!scheduler.awaitTermination(5, TimeUnit.SECONDS)) {
          scheduler.shutdownNow();
        }
      } catch (InterruptedException e) {
        scheduler.shutdownNow();
        Thread.currentThread().interrupt();
      }
    }

    knownJobs.clear();
    LOG.info("PollingJobNotifier stopped on server {}", serverId);
  }

  @Override
  public void notifyJobStarted(UUID jobId, String jobType) {
    // In polling mode, we don't actively notify - other servers will discover via polling
    // But we track it locally to avoid re-notifying ourselves
    knownJobs.add(jobId);
    LOG.debug(
        "Job {} (type: {}) started - other servers will discover via polling", jobId, jobType);
  }

  @Override
  public void notifyJobCompleted(UUID jobId) {
    knownJobs.remove(jobId);
    LOG.debug("Job {} completed - removed from known jobs", jobId);
  }

  @Override
  public void onJobStarted(Consumer<UUID> callback) {
    this.jobStartedCallback = callback;
  }

  @Override
  public boolean isRunning() {
    return running.get();
  }

  @Override
  public String getType() {
    return "database-polling";
  }

  /**
   * Mark that this server is actively participating in a job. This speeds up polling to detect job
   * completion faster.
   */
  public void setParticipating(boolean isParticipating) {
    this.participating.set(isParticipating);
  }

  private void pollForJobs() {
    if (!running.get()) {
      return;
    }

    long now = System.currentTimeMillis();
    long interval = participating.get() ? ACTIVE_POLL_INTERVAL_MS : IDLE_POLL_INTERVAL_MS;

    // Skip poll if not enough time has elapsed
    if (now - lastPollTime < interval) {
      return;
    }
    lastPollTime = now;

    try {
      // Fast, lightweight query for running jobs
      List<String> runningJobIds = collectionDAO.searchIndexJobDAO().getRunningJobIds();

      if (runningJobIds.isEmpty()) {
        // No jobs running - clear known jobs and stay in idle mode
        if (!knownJobs.isEmpty()) {
          LOG.debug("No running jobs found, clearing {} known jobs", knownJobs.size());
          knownJobs.clear();
        }
        return;
      }

      // Check for new jobs we haven't seen
      for (String jobIdStr : runningJobIds) {
        UUID jobId = UUID.fromString(jobIdStr);
        if (!knownJobs.contains(jobId)) {
          // New job discovered!
          LOG.info("Discovered new running job via polling: {}", jobId);
          knownJobs.add(jobId);

          if (jobStartedCallback != null) {
            jobStartedCallback.accept(jobId);
          }
        }
      }

      // Clean up jobs that are no longer running
      knownJobs.removeIf(
          jobId -> runningJobIds.stream().noneMatch(id -> id.equals(jobId.toString())));

    } catch (Exception e) {
      LOG.error("Error polling for jobs", e);
    }
  }
}
