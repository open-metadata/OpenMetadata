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
package org.openmetadata.service.rdf.rebuild;

import java.time.Duration;
import java.util.Optional;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.service.apps.bundles.rdf.RdfReindexRunLock;
import org.openmetadata.service.jdbi3.RdfInfraDAOs.RdfReindexLockDAO;
import org.openmetadata.service.rdf.RdfBackgroundScheduler;
import org.openmetadata.service.rdf.storage.RdfStorageMaintenanceException;

/**
 * Holds writes to the serving dataset while maintenance blocks Fuseki's writer, cluster-wide.
 *
 * <p>TDB2 compaction blocks every writer to the dataset for the whole copy, and a reset rewrites
 * the dataset underneath them. A write that reached Fuseki then would wait, time out and use up one
 * of its delivery attempts, and enough of those dead-letter it. Instead, the pause is a lease every
 * server reads before writing the serving dataset: queued writes stay in the durable queue and are
 * applied once it ends, and other writers wait for it up to the RDF request timeout, as long as
 * they would have waited for Fuseki, before getting {@link RdfStorageMaintenanceException}.
 *
 * <p>The lease lives in the shared lock table and expires unless renewed, so a server that stops
 * mid-maintenance pauses writes for at most {@link RdfReindexRunLock#EXPIRY_MS}. The thread that
 * holds the pause may still write, for example to reload ontologies into an emptied dataset. See
 * ADR:2026-10-28-rdf-storage-maintenance-pauses-serving-writes-and-compacts-on-a-schedule.
 */
@Slf4j
public final class RdfLiveWritePause {
  public static final String LOCK_KEY = "RDF_LIVE_WRITES_PAUSED";
  public static final Duration RETRY_AFTER = Duration.ofSeconds(5);
  private static final long HEARTBEAT_SECONDS = 30;
  private static final String HOLDER =
      "SELECT jobId FROM rdf_reindex_lock WHERE lockKey = ? AND expiresAt > ?";
  private static final ThreadLocal<String> OWNER = new ThreadLocal<>();

  private final RdfReindexLockDAO locks;
  private final RdfDatasetManager datasets;
  private final String serverId;

  public RdfLiveWritePause(
      final RdfReindexLockDAO locks, final RdfDatasetManager datasets, final String serverId) {
    this.locks = locks;
    this.datasets = datasets;
    this.serverId = serverId;
  }

  /**
   * Runs {@code work} with every other writer of the serving dataset held back. Returns once the
   * pause is released, even when {@code work} throws. Writes already on their way to Fuseki finish
   * before {@code work} starts.
   */
  public <T> T during(final String jobId, final Supplier<T> work) {
    final RdfReindexRunLock lease = new RdfReindexRunLock(locks, LOCK_KEY, jobId, serverId);
    lease.acquire();
    final ScheduledFuture<?> heartbeat = keepAlive(lease);
    try {
      datasets.awaitServingWrites();
      LOG.info("Paused writes to the RDF serving dataset for maintenance {}", jobId);
      return asOwner(jobId, work);
    } finally {
      heartbeat.cancel(false);
      lease.release();
      LOG.info("Resumed writes to the RDF serving dataset after maintenance {}", jobId);
    }
  }

  private static ScheduledFuture<?> keepAlive(final RdfReindexRunLock lease) {
    return RdfBackgroundScheduler.getInstance()
        .scheduleWithFixedDelay(
            () -> renewQuietly(lease), HEARTBEAT_SECONDS, HEARTBEAT_SECONDS, TimeUnit.SECONDS);
  }

  private static void renewQuietly(final RdfReindexRunLock lease) {
    try {
      if (!lease.renew()) {
        LOG.error("The RDF write pause lease expired before maintenance finished");
      }
    } catch (RuntimeException exception) {
      LOG.warn("Could not renew the RDF write pause; retrying on the next beat", exception);
    }
  }

  private static <T> T asOwner(final String jobId, final Supplier<T> work) {
    final String previous = OWNER.get();
    OWNER.set(jobId);
    try {
      return work.get();
    } finally {
      if (previous == null) {
        OWNER.remove();
      } else {
        OWNER.set(previous);
      }
    }
  }

  /**
   * Refuses a serving write while another job holds the pause. Called inside the transaction that
   * holds the serving-dataset row lock, so a write either finishes before the pause's flush or
   * sees the pause.
   */
  static void requireWritable(final Handle handle, final long now) {
    final Optional<String> holder = holder(handle, now);
    if (holder.isPresent() && !holder.get().equals(OWNER.get())) {
      throw new RdfStorageMaintenanceException(holder.get(), RETRY_AFTER);
    }
  }

  static boolean isHeldByCurrentThread() {
    return OWNER.get() != null;
  }

  /** Whether storage maintenance currently holds writes to the serving dataset. */
  public static boolean isPaused(final Handle handle, final long now) {
    return holder(handle, now).isPresent();
  }

  private static Optional<String> holder(final Handle handle, final long now) {
    return handle.createQuery(HOLDER).bind(0, LOCK_KEY).bind(1, now).mapTo(String.class).findOne();
  }
}
