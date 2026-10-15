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
package org.openmetadata.service.jobs;

import io.dropwizard.lifecycle.Managed;
import java.io.IOException;
import java.time.Duration;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.function.LongSupplier;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.jdbi3.SearchReindexDAOs.ProjectionRepairStateDAO;
import org.openmetadata.service.jdbi3.SearchReindexDAOs.ProjectionRepairStateDAO.RepairState;

/**
 * Keeps a projection of the database, search or RDF, in step with it without routine full
 * rebuilds. Every server ticks; a lock row lets one of them run each pass, and the pass's progress
 * lives in {@code projection_repair_state} under the repair's name, so whichever server runs the
 * next pass carries on where it stopped.
 *
 * <p>Each pass, every {@link #PASS_INTERVAL}, checks the projection as a whole, repairs what the
 * rows changed since the last pass left wrong, and once a day sweeps away what remains of rows
 * that are gone. Rows changed in the last {@link #SETTLE} are left to the live writes; the
 * previous window's last {@link #OVERLAP} is checked again for transactions that committed after
 * it was checked. The window advances only when a pass finishes.
 */
@Slf4j
public abstract class ScheduledRepairJob implements Managed {
  public static final Duration PASS_INTERVAL = Duration.ofMinutes(15);
  public static final Duration SETTLE = Duration.ofMinutes(1);
  public static final Duration OVERLAP = Duration.ofMinutes(5);
  public static final Duration FIRST_LOOKBACK = Duration.ofHours(1);
  public static final Duration SWEEP_INTERVAL = Duration.ofDays(1);
  private static final Duration FIRST_PASS_DELAY = Duration.ofMinutes(2);
  private static final Duration LOCK_TTL = Duration.ofMinutes(30);

  /** The lock row the server running a pass holds; it expires if the server stops renewing it. */
  public interface PassLock {
    boolean tryAcquire(String passId, String serverId, long now, long expiresAt);

    void renew(String passId, String serverId, long now, long expiresAt);

    void release(String passId);
  }

  private final String name;
  private final PassLock lock;
  private final ProjectionRepairStateDAO states;
  private final LongSupplier clock;
  private final String serverId = UUID.randomUUID().toString();
  private ScheduledExecutorService scheduler;

  /**
   * @param name the repair's row in {@code projection_repair_state}, also its thread's name
   */
  protected ScheduledRepairJob(
      final String name,
      final PassLock lock,
      final ProjectionRepairStateDAO states,
      final LongSupplier clock) {
    this.name = name;
    this.lock = lock;
    this.states = states;
    this.clock = clock;
  }

  /** Whether the projection can be repaired now; a pass that cannot run leaves its window. */
  protected abstract boolean isReady();

  /** Checks the projection as a whole and rebuilds it if it is gone; tried again next pass. */
  protected abstract void checkProjection() throws IOException, InterruptedException;

  /**
   * Repairs what rows changed after {@code since} and no later than {@code until} left wrong.
   *
   * @param heartbeat run between pages, to keep the pass's lock
   * @return how many entities were repaired
   */
  protected abstract int repairChanged(long since, long until, Runnable heartbeat) throws Exception;

  /** Removes what remains of rows that are gone, among what was not rewritten since then. */
  protected abstract void sweep(long untouchedSince, Runnable heartbeat);

  @Override
  public void start() {
    scheduler =
        Executors.newSingleThreadScheduledExecutor(
            Thread.ofPlatform().daemon().name(name).factory());
    scheduler.scheduleWithFixedDelay(
        this::runScheduledPass,
        FIRST_PASS_DELAY.toMillis(),
        PASS_INTERVAL.toMillis(),
        TimeUnit.MILLISECONDS);
  }

  @Override
  public void stop() throws InterruptedException {
    if (scheduler != null) {
      scheduler.shutdownNow();
      scheduler.awaitTermination(30, TimeUnit.SECONDS);
    }
  }

  private void runScheduledPass() {
    runPassNow(false, SETTLE);
  }

  /**
   * Runs a pass now unless another server holds the repair lock.
   *
   * @param sweepNow also sweep, whenever the last sweep ran
   * @param settle rows changed this recently are left to the live writes
   * @return whether this server ran the pass
   */
  public boolean runPassNow(final boolean sweepNow, final Duration settle) {
    final String passId = UUID.randomUUID().toString();
    final boolean first = acquire(passId);
    if (first) {
      try {
        runPass(passId, sweepNow, settle);
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
        LOG.info("{} pass interrupted; the next pass checks its window again", name);
      } catch (Exception e) {
        LOG.error("{} pass failed; the next pass checks its window again", name, e);
      } finally {
        release(passId);
      }
    }
    return first;
  }

  /**
   * A database error taking the lock skips only this pass. Thrown from the scheduled task, it would
   * cancel the schedule and end the repairs on this server until it restarts.
   */
  private boolean acquire(final String passId) {
    final long now = clock.getAsLong();
    try {
      return lock.tryAcquire(passId, serverId, now, now + LOCK_TTL.toMillis());
    } catch (RuntimeException e) {
      LOG.error("{} could not take its lock; the next pass tries again", name, e);
      return false;
    }
  }

  private void release(final String passId) {
    try {
      lock.release(passId);
    } catch (RuntimeException e) {
      LOG.warn("{} could not release its lock, which lapses within {}", name, LOCK_TTL, e);
    }
  }

  /** One pass; the window it checked is recorded only once every step has finished. */
  void runPass(final String passId, final boolean sweepNow, final Duration settle)
      throws Exception {
    if (!isReady()) {
      return;
    }
    final long now = clock.getAsLong();
    final RepairState state = currentState(now);
    checkProjectionOrRetryNextPass();
    final long until = now - settle.toMillis();
    final int repaired =
        repairChanged(state.changedSince() - OVERLAP.toMillis(), until, () -> keepLock(passId));
    final long sweptAt =
        sweepNow || now - state.sweptAt() >= SWEEP_INTERVAL.toMillis()
            ? sweepAll(now, until, passId)
            : state.sweptAt();
    states.upsert(name, until, sweptAt);
    LOG.info("{} pass repaired {} entities changed up to {}", name, repaired, until);
  }

  private RepairState currentState(final long now) {
    final RepairState stored = states.find(name);
    return stored != null ? stored : new RepairState(now - FIRST_LOOKBACK.toMillis(), now);
  }

  private void checkProjectionOrRetryNextPass() throws InterruptedException {
    try {
      checkProjection();
    } catch (IOException | RuntimeException e) {
      LOG.warn("{} could not check the projection; the next pass checks again", name, e);
    }
  }

  private long sweepAll(final long now, final long untouchedSince, final String passId) {
    sweep(untouchedSince, () -> keepLock(passId));
    return now;
  }

  private void keepLock(final String passId) {
    final long now = clock.getAsLong();
    lock.renew(passId, serverId, now, now + LOCK_TTL.toMillis());
  }
}
