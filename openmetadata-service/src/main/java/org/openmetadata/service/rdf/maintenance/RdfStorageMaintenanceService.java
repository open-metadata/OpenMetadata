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
package org.openmetadata.service.rdf.maintenance;

import java.time.Clock;
import java.time.Duration;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.configuration.rdf.RdfStorageMaintenanceConfig;
import org.openmetadata.service.apps.bundles.rdf.RdfReindexRunLock;
import org.openmetadata.service.jdbi3.RdfInfraDAOs.RdfReindexLockDAO;
import org.openmetadata.service.rdf.RdfBackgroundScheduler;
import org.openmetadata.service.rdf.RdfRepository;
import org.openmetadata.service.rdf.inference.InferenceRunLock;
import org.openmetadata.service.rdf.storage.CompactionResult;

/**
 * Compacts the RDF serving dataset on a schedule, so a store that only receives live writes does
 * not grow until its disk is full.
 *
 * <p>Apache Jena TDB2 copies every index page a write transaction touches and frees the old ones
 * only when the dataset is compacted; every entity write leaves hundreds of kilobytes behind. Before
 * this service, only the RDF reindex app compacted, so a deployment that indexed once and then only
 * received live writes never got its disk back.
 *
 * <p>Every server checks every {@link #CHECK_INTERVAL}; the first to find a compaction due takes a
 * lease that marks the next one due one interval later, so the cluster compacts once per interval.
 * The compaction holds the RDF reindex and inference locks, so it never overlaps a reindex or an
 * inference run, and pauses writes to the serving dataset, because Fuseki blocks them for the whole
 * copy. A compaction that does not succeed releases its lease, so the next check tries again,
 * unless Fuseki restarted during it: that one waits for the next interval. See
 * ADR:2026-10-28-rdf-storage-maintenance-pauses-serving-writes-and-compacts-on-a-schedule.
 */
@Slf4j
public final class RdfStorageMaintenanceService implements AutoCloseable {
  static final String NEXT_COMPACTION_KEY = "RDF_STORAGE_NEXT_COMPACTION";
  static final Duration CHECK_INTERVAL = Duration.ofMinutes(15);
  // Servers older than this change do not hold their writes back for maintenance, so the first
  // compaction waits for a rolling upgrade to finish.
  private static final Duration FIRST_CHECK_DELAY = Duration.ofHours(1);
  private static final long LOCK_HEARTBEAT_SECONDS = 60;

  private final RdfStorageMaintenanceConfig config;
  private final RdfReindexLockDAO locks;
  private final Supplier<RdfRepository> repository;
  private final Clock clock;
  private final String serverId;
  private final ExecutorService worker =
      Executors.newSingleThreadExecutor(
          Thread.ofPlatform().daemon().name("rdf-storage-maintenance").factory());
  private final AtomicBoolean running = new AtomicBoolean();
  private ScheduledFuture<?> checks;

  public RdfStorageMaintenanceService(
      final RdfStorageMaintenanceConfig config,
      final RdfReindexLockDAO locks,
      final Supplier<RdfRepository> repository,
      final Clock clock,
      final String serverId) {
    this.config = config;
    this.locks = locks;
    this.repository = repository;
    this.clock = clock;
    this.serverId = serverId;
  }

  public void start() {
    checks =
        RdfBackgroundScheduler.getInstance()
            .scheduleWithFixedDelay(
                this::check,
                FIRST_CHECK_DELAY.toSeconds(),
                CHECK_INTERVAL.toSeconds(),
                TimeUnit.SECONDS);
    LOG.info(
        "RDF storage maintenance compacts the serving dataset every {} h",
        compactionInterval().toHours());
  }

  /** Hands the check to the maintenance thread; the scheduler's threads never wait on Fuseki. */
  void check() {
    if (running.compareAndSet(false, true)) {
      try {
        worker.execute(this::runGuarded);
      } catch (RuntimeException exception) {
        running.set(false);
        LOG.warn("Could not start RDF storage maintenance; retrying on the next check", exception);
      }
    }
  }

  private void runGuarded() {
    try {
      compactIfDue();
    } catch (RuntimeException exception) {
      LOG.error("RDF storage maintenance failed; retrying on the next check", exception);
    } finally {
      running.set(false);
    }
  }

  /** Compacts the serving dataset when its interval has passed. Returns the outcome, if it ran. */
  CompactionResult compactIfDue() {
    // Lock rows hold a 36-character job id: a bare UUID.
    final String jobId = UUID.randomUUID().toString();
    final boolean due = reserve(NEXT_COMPACTION_KEY, jobId, compactionInterval());
    return due ? compactHoldingSlot(NEXT_COMPACTION_KEY, jobId) : null;
  }

  private boolean reserve(final String slot, final String jobId, final Duration spacing) {
    final long now = clock.millis();
    return locks.tryAcquireLock(slot, jobId, serverId, now, now + spacing.toMillis());
  }

  private CompactionResult compactHoldingSlot(final String slot, final String jobId) {
    CompactionResult result = null;
    try {
      result = compactExclusively(jobId);
    } catch (RdfReindexRunLock.HeldByAnotherRun reindexRunning) {
      LOG.info("Skipping RDF compaction while a reindex runs; it compacts itself");
    } finally {
      if (retryAtNextCheck(result)) {
        locks.releaseLock(slot, jobId);
      }
    }
    return result;
  }

  /**
   * A compaction that did not run or did not succeed is retried at the next check, except one that
   * Fuseki started and then lost: Fuseki restarted during the copy, as it does when the volume
   * cannot hold the copy, and retrying would only restart it again.
   */
  private static boolean retryAtNextCheck(final CompactionResult result) {
    final boolean lost = result != null && result.lostByTheStore();
    if (lost) {
      LOG.error(
          "Fuseki restarted while compacting the RDF store, as it does when the volume has less"
              + " free space than the live data. The next compaction waits for its schedule; expand"
              + " the volume if this repeats.");
    }
    return result == null || !result.succeeded() && !lost;
  }

  private CompactionResult compactExclusively(final String jobId) {
    final RdfReindexRunLock reindexLock = RdfReindexRunLock.forMaintenance(locks, jobId, serverId);
    reindexLock.acquire();
    final ScheduledFuture<?> heartbeat =
        RdfBackgroundScheduler.getInstance()
            .scheduleWithFixedDelay(
                () -> renewQuietly(reindexLock),
                LOCK_HEARTBEAT_SECONDS,
                LOCK_HEARTBEAT_SECONDS,
                TimeUnit.SECONDS);
    try {
      return compactWithoutInference(jobId);
    } finally {
      heartbeat.cancel(false);
      reindexLock.release();
    }
  }

  /**
   * An inference run rewrites its rule graphs in several writes, so a pause starting in between
   * would leave them half derived. Returns null when a run holds the lock; the next check retries.
   */
  private CompactionResult compactWithoutInference(final String jobId) {
    final InferenceRunLock inference =
        InferenceRunLock.forCluster(locks, InferenceRunLock.MATERIALIZATION_LOCK_KEY, serverId);
    CompactionResult result = null;
    if (inference.tryAcquire(jobId)) {
      final Runnable stopRenewing = inference.keepAlive(jobId);
      try {
        final RdfRepository rdf = repository.get();
        result = rdf.withServingWritesPaused(jobId, holder -> holder.compact(maxDuration()));
      } finally {
        stopRenewing.run();
        inference.release(jobId);
      }
    } else {
      LOG.info("Skipping RDF compaction while inference runs; retrying on the next check");
    }
    return result;
  }

  /** A failed renewal is retried on the next beat; a scheduled task that throws never runs again. */
  private static void renewQuietly(final RdfReindexRunLock lock) {
    try {
      lock.renew();
    } catch (RuntimeException exception) {
      LOG.warn("Could not renew the RDF reindex lock during maintenance", exception);
    }
  }

  private Duration compactionInterval() {
    return Duration.ofHours(config.getCompactionIntervalHours());
  }

  private Duration maxDuration() {
    return Duration.ofMinutes(config.getMaxDurationMinutes());
  }

  @Override
  public void close() {
    if (checks != null) {
      checks.cancel(false);
    }
    worker.shutdownNow();
  }
}
