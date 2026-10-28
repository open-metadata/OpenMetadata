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
import java.util.Optional;
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
import org.openmetadata.service.rdf.storage.CompactionResult;
import org.openmetadata.service.rdf.storage.StorageFacts;

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
 * The compaction holds the RDF reindex lock, so it never overlaps a reindex, and pauses writes to
 * the serving dataset, because Fuseki blocks them for the whole copy. A compaction that does not
 * succeed releases its lease, so the next check tries again. See
 * ADR:2026-10-28-rdf-storage-maintenance-pauses-serving-writes-and-compacts-on-a-schedule.
 *
 * <p>A store that reports its volume, as OpenMetadata's Fuseki images do, is also compacted without
 * waiting for the interval once its free space falls below {@code urgentFreeSpacePercent} or its
 * write guard is refusing writes: a burst of writes can fill the volume well within one interval.
 * An urgent compaction that brings the store back above the threshold frees the urgent slot at
 * once, so the next burst is compacted as soon as it needs to be. One that does not shows that data
 * compaction cannot remove fills the volume, such as the live graph or other datasets on it;
 * compacting again cannot help, so urgent compactions wait for the next scheduled one and the
 * service logs that the volume needs expanding. See
 * ADR:2026-10-28-the-fuseki-image-refuses-writes-below-a-free-space-reserve-and-reports-its-volume.
 */
@Slf4j
public final class RdfStorageMaintenanceService implements AutoCloseable {
  static final String NEXT_COMPACTION_KEY = "RDF_STORAGE_NEXT_COMPACTION";
  static final String URGENT_COMPACTION_KEY = "RDF_STORAGE_URGENT_COMPACTION";
  static final Duration CHECK_INTERVAL = Duration.ofMinutes(15);
  private static final Duration FIRST_CHECK_DELAY = Duration.ofMinutes(5);
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

  /**
   * Compacts the serving dataset when its interval has passed or its store is running out of
   * space. Returns the outcome, if it ran.
   */
  CompactionResult compactIfDue() {
    // Lock rows hold a 36-character job id: a bare UUID.
    final String jobId = UUID.randomUUID().toString();
    final String slot =
        reserve(NEXT_COMPACTION_KEY, jobId, compactionInterval())
            ? NEXT_COMPACTION_KEY
            : urgentSlot(jobId);
    return slot == null ? null : compactHoldingSlot(slot, jobId);
  }

  private String urgentSlot(final String jobId) {
    final Optional<StorageFacts> urgent = repository.get().storageFacts().filter(this::needsSpace);
    final boolean reserved =
        urgent.isPresent() && reserve(URGENT_COMPACTION_KEY, jobId, compactionInterval());
    urgent.filter(facts -> reserved).ifPresent(this::logUrgency);
    return reserved ? URGENT_COMPACTION_KEY : null;
  }

  private boolean needsSpace(final StorageFacts facts) {
    return facts.lowOnSpace() || facts.freePercent() < config.getUrgentFreeSpacePercent();
  }

  private void logUrgency(final StorageFacts facts) {
    LOG.warn(
        "RDF store volume has {}% free ({} of {} bytes, write guard {}); compacting before the"
            + " interval",
        facts.freePercent(),
        facts.usableBytes(),
        facts.totalBytes(),
        facts.lowOnSpace() ? "refusing writes" : "open");
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
      if (result == null || !result.succeeded() || freedEnough(slot)) {
        locks.releaseLock(slot, jobId);
      }
    }
    return result;
  }

  /** Whether an urgent compaction left the store with room, so the next one may follow at once. */
  private boolean freedEnough(final String slot) {
    final boolean urgent = URGENT_COMPACTION_KEY.equals(slot);
    final boolean freed =
        urgent && repository.get().storageFacts().map(facts -> !needsSpace(facts)).orElse(true);
    if (urgent && !freed) {
      LOG.error(
          "Compacting the RDF store did not free enough space: data compaction cannot remove, such"
              + " as the live graph or other datasets on the volume, fills it. Expand the volume or"
              + " remove unused datasets. Urgent compactions wait for the next scheduled one.");
    }
    return freed;
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
      final RdfRepository rdf = repository.get();
      return rdf.withServingWritesPaused(jobId, () -> rdf.compact(maxDuration()));
    } finally {
      heartbeat.cancel(false);
      reindexLock.release();
    }
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
