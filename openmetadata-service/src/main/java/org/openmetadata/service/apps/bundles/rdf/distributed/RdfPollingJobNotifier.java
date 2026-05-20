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
package org.openmetadata.service.apps.bundles.rdf.distributed;

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
 * Database-polling job notifier for the RDF distributed indexing job. Lets other
 * server pods discover an in-flight RDF reindex and join it as participants. Mirrors
 * the SearchIndex {@code PollingJobNotifier} but queries the {@code rdf_index_job}
 * table.
 *
 * <p>Adaptive polling: 30s while idle, 1s while actively participating in a job to
 * detect completion quickly. Single-server deployments don't gain anything from this
 * — it's a no-op when only one pod exists. Multi-pod deployments use it to
 * coordinate work without needing Redis pub/sub.
 */
@Slf4j
public class RdfPollingJobNotifier {

  private static final long IDLE_POLL_INTERVAL_MS = 30_000;
  private static final long ACTIVE_POLL_INTERVAL_MS = 1_000;

  private final CollectionDAO collectionDAO;
  private final String serverId;
  private final AtomicBoolean running = new AtomicBoolean(false);
  private final AtomicBoolean participating = new AtomicBoolean(false);
  private final Set<UUID> knownJobs = ConcurrentHashMap.newKeySet();

  private ScheduledExecutorService scheduler;
  private Consumer<UUID> jobStartedCallback;
  private volatile java.util.concurrent.ScheduledFuture<?> pollTask;

  public RdfPollingJobNotifier(CollectionDAO collectionDAO, String serverId) {
    this.collectionDAO = collectionDAO;
    this.serverId = serverId;
  }

  public void start() {
    if (!running.compareAndSet(false, true)) {
      LOG.warn("RdfPollingJobNotifier already running");
      return;
    }
    scheduler =
        Executors.newSingleThreadScheduledExecutor(
            Thread.ofPlatform()
                .name("rdf-job-notifier-" + serverId.substring(0, Math.min(8, serverId.length())))
                .factory());
    schedulePoll(IDLE_POLL_INTERVAL_MS);
    LOG.info(
        "RdfPollingJobNotifier started on server {} (idle: {}s, active: {}s)",
        serverId,
        IDLE_POLL_INTERVAL_MS / 1000,
        ACTIVE_POLL_INTERVAL_MS / 1000);
  }

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
  }

  public void notifyJobStarted(UUID jobId) {
    knownJobs.add(jobId);
  }

  public void notifyJobCompleted(UUID jobId) {
    knownJobs.remove(jobId);
  }

  public void onJobStarted(Consumer<UUID> callback) {
    this.jobStartedCallback = callback;
  }

  public boolean isRunning() {
    return running.get();
  }

  /**
   * Toggle the active poll cadence. Reschedules the poll task at the new interval
   * instead of relying on a soft throttle inside {@link #pollForJobs}, so the thread
   * doesn't wake every second while idle.
   */
  public void setParticipating(boolean isParticipating) {
    boolean changed = participating.compareAndSet(!isParticipating, isParticipating);
    if (changed && running.get()) {
      schedulePoll(isParticipating ? ACTIVE_POLL_INTERVAL_MS : IDLE_POLL_INTERVAL_MS);
    }
  }

  private synchronized void schedulePoll(long intervalMs) {
    if (scheduler == null || scheduler.isShutdown()) {
      return;
    }
    if (pollTask != null) {
      pollTask.cancel(false);
    }
    pollTask =
        scheduler.scheduleWithFixedDelay(this::pollForJobs, 0, intervalMs, TimeUnit.MILLISECONDS);
  }

  private void pollForJobs() {
    if (!running.get()) {
      return;
    }
    try {
      List<String> runningJobIds = collectionDAO.rdfIndexJobDAO().getRunningJobIds();
      if (runningJobIds.isEmpty()) {
        if (!knownJobs.isEmpty()) {
          knownJobs.clear();
        }
        return;
      }
      for (String jobIdStr : runningJobIds) {
        UUID jobId = UUID.fromString(jobIdStr);
        if (knownJobs.add(jobId)) {
          LOG.info("Discovered new running RDF job via polling: {}", jobId);
          if (jobStartedCallback != null) {
            jobStartedCallback.accept(jobId);
          }
        }
      }
      knownJobs.removeIf(
          jobId -> runningJobIds.stream().noneMatch(id -> id.equals(jobId.toString())));
    } catch (Exception e) {
      LOG.error("Error polling for RDF jobs", e);
    }
  }
}
