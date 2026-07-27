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

import java.util.HashSet;
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
 * Database polling based job notifier for distributed job discovery.
 *
 * <p>Uses adaptive polling intervals:
 *
 * <ul>
 *   <li>1 second while actively participating in a job
 *   <li>2 seconds plus jitter while recently started or after job activity
 *   <li>30 seconds plus jitter after an extended idle period
 * </ul>
 */
@Slf4j
public class PollingJobNotifier implements DistributedJobNotifier {

  private static final long FAST_IDLE_POLL_INTERVAL_MS = 2_000;
  private static final long BACKOFF_IDLE_POLL_INTERVAL_MS = 30_000;

  private static final long ACTIVE_POLL_INTERVAL_MS = 1_000;
  private static final long FAST_IDLE_WINDOW_MS = 60_000;
  private static final long FAST_IDLE_JITTER_MS = 1_000;
  private static final long BACKOFF_IDLE_JITTER_MS = 5_000;

  private final CollectionDAO collectionDAO;
  private final String serverId;
  private final long fastIdleJitterMs;
  private final long backoffIdleJitterMs;
  private final AtomicBoolean running = new AtomicBoolean(false);
  private final AtomicBoolean participating = new AtomicBoolean(false);
  private final Set<UUID> knownJobs = ConcurrentHashMap.newKeySet();

  private ScheduledExecutorService scheduler;
  private Consumer<UUID> jobStartedCallback;
  private volatile long lastPollTime = 0;
  private volatile long fastIdleUntil = 0;

  public PollingJobNotifier(CollectionDAO collectionDAO, String serverId) {
    this.collectionDAO = collectionDAO;
    this.serverId = serverId;
    this.fastIdleJitterMs = computeJitter(FAST_IDLE_JITTER_MS, 17);
    this.backoffIdleJitterMs = computeJitter(BACKOFF_IDLE_JITTER_MS, 31);
  }

  @Override
  public void start() {
    if (!running.compareAndSet(false, true)) {
      LOG.warn("PollingJobNotifier already running");
      return;
    }

    long now = System.currentTimeMillis();
    lastPollTime = 0;
    extendFastIdleWindow(now);

    scheduler =
        Executors.newSingleThreadScheduledExecutor(
            Thread.ofPlatform()
                .name(
                    "reindex-job-notifier-" + serverId.substring(0, Math.min(8, serverId.length())))
                .factory());

    scheduler.scheduleWithFixedDelay(
        this::pollForJobs, 0, ACTIVE_POLL_INTERVAL_MS, TimeUnit.MILLISECONDS);

    LOG.info(
        "PollingJobNotifier started on server {} (fast idle: {}s, backoff idle: {}s, active: {}s)",
        serverId,
        FAST_IDLE_POLL_INTERVAL_MS / 1000,
        BACKOFF_IDLE_POLL_INTERVAL_MS / 1000,
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
    knownJobs.add(jobId);
    extendFastIdleWindow(System.currentTimeMillis());
    LOG.debug(
        "Job {} (type: {}) started - other servers will discover via polling", jobId, jobType);
  }

  @Override
  public void notifyJobCompleted(UUID jobId) {
    knownJobs.remove(jobId);
    extendFastIdleWindow(System.currentTimeMillis());
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
    if (!isParticipating) {
      extendFastIdleWindow(System.currentTimeMillis());
    }
  }

  private void pollForJobs() {
    if (!running.get()) {
      return;
    }

    long now = System.currentTimeMillis();
    if (now - lastPollTime < currentPollIntervalMs(now)) {
      return;
    }
    lastPollTime = now;

    try {
      List<String> runningJobIds = collectionDAO.searchIndexJobDAO().getRunningJobIds();

      if (runningJobIds.isEmpty()) {
        handleNoRunningJobs(now);
        return;
      }

      extendFastIdleWindow(now);
      for (String jobIdStr : runningJobIds) {
        UUID jobId = UUID.fromString(jobIdStr);
        if (!knownJobs.contains(jobId)) {
          LOG.info("Discovered new running job via polling: {}", jobId);
          knownJobs.add(jobId);

          if (jobStartedCallback != null) {
            jobStartedCallback.accept(jobId);
          }
        }
      }

      Set<String> runningJobIdSet = new HashSet<>(runningJobIds);
      knownJobs.removeIf(jobId -> !runningJobIdSet.contains(jobId.toString()));

    } catch (Exception e) {
      LOG.error("Error polling for jobs", e);
    }
  }

  private void handleNoRunningJobs(long now) {
    if (knownJobs.isEmpty()) {
      return;
    }
    LOG.debug("No running jobs found, clearing {} known jobs", knownJobs.size());
    knownJobs.clear();
    extendFastIdleWindow(now);
  }

  private long currentPollIntervalMs(long now) {
    if (participating.get()) {
      return ACTIVE_POLL_INTERVAL_MS;
    }
    if (now <= fastIdleUntil) {
      return FAST_IDLE_POLL_INTERVAL_MS + fastIdleJitterMs;
    }
    return BACKOFF_IDLE_POLL_INTERVAL_MS + backoffIdleJitterMs;
  }

  private void extendFastIdleWindow(long now) {
    fastIdleUntil = now + FAST_IDLE_WINDOW_MS;
  }

  private long computeJitter(long maxJitterMs, int salt) {
    return Math.floorMod((serverId.hashCode() * 31) + salt, (int) maxJitterMs + 1);
  }
}
