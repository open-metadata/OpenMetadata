package org.openmetadata.service.apps.bundles.searchIndex;

import java.util.concurrent.Semaphore;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.LongSupplier;

/**
 * The two permits a bulk request holds while it is outstanding: a slot in its own processor and a
 * share of the search client's {@link BulkConnectionBudget}.
 *
 * <p>Waiting for them gives up only after a stall window in which no bulk attempt completed — the
 * signature of a leaked future whose callback never fires, as when the HC5 I/O reactor dies. A bulk
 * waiting out a retry backoff or an open circuit completes no attempt for up to its lifetime, so the
 * window is the stall timeout plus that lifetime. A slow or recovering cluster then slows the
 * producers down instead of failing their batches.
 */
final class BulkSendPermits {
  static final long DEFAULT_STALL_TIMEOUT_MILLIS = 60_000;

  /**
   * Threads in each bulk processor's scheduler. Its periodic flush can block waiting for these
   * permits, or for the lock a waiting flush holds, while the bulks that hold the permits need a
   * scheduler thread to retry or to resume after a pause. With two threads one is always free.
   */
  static final int PROCESSOR_SCHEDULER_THREADS = 2;

  private static final long POLL_MILLIS = 100;

  private final Semaphore processorSlots;
  private final BulkConnectionBudget connectionBudget;
  private final AtomicLong completedAttempts = new AtomicLong();
  private final long maxParkMillis;
  private volatile long stallTimeoutMillis = DEFAULT_STALL_TIMEOUT_MILLIS;

  /**
   * @param maxParkMillis the longest a permit holder may wait without sending, which is the bulk
   *     lifetime of the processor's retry policy
   */
  BulkSendPermits(
      int concurrentRequests, BulkConnectionBudget connectionBudget, long maxParkMillis) {
    this.processorSlots = new Semaphore(Math.max(1, concurrentRequests));
    this.connectionBudget = connectionBudget;
    this.maxParkMillis = Math.max(0, maxParkMillis);
  }

  /** True once both permits are held; false if nothing completed for a whole stall window. */
  boolean acquire() throws InterruptedException {
    return awaitPermit(this::tryAcquireSlot, completedAttempts::get) && acquireBudgetPermit();
  }

  void release() {
    connectionBudget.release();
    processorSlots.release();
  }

  /** Every finished send attempt, successful or not, proves the pipeline is still moving. */
  void recordAttemptCompleted() {
    completedAttempts.incrementAndGet();
    connectionBudget.recordAttemptCompleted();
  }

  long stallTimeoutSeconds() {
    return TimeUnit.MILLISECONDS.toSeconds(stallWindowMillis());
  }

  void setStallTimeoutMillisForTesting(long millis) {
    this.stallTimeoutMillis = millis;
  }

  private boolean acquireBudgetPermit() throws InterruptedException {
    boolean acquired = false;
    try {
      acquired = awaitPermit(this::tryAcquireBudget, connectionBudget::completedAttempts);
    } finally {
      if (!acquired) {
        processorSlots.release();
      }
    }
    return acquired;
  }

  private boolean awaitPermit(PermitPoll poll, LongSupplier progress) throws InterruptedException {
    StallWatch stallWatch = new StallWatch(progress, stallWindowMillis());
    boolean acquired = poll.tryAcquire();
    while (!acquired && !stallWatch.isStalled()) {
      acquired = poll.tryAcquire();
    }
    return acquired;
  }

  private long stallWindowMillis() {
    return stallTimeoutMillis + maxParkMillis;
  }

  private boolean tryAcquireSlot() throws InterruptedException {
    return processorSlots.tryAcquire(POLL_MILLIS, TimeUnit.MILLISECONDS);
  }

  private boolean tryAcquireBudget() throws InterruptedException {
    return connectionBudget.tryAcquire(POLL_MILLIS, TimeUnit.MILLISECONDS);
  }

  @FunctionalInterface
  private interface PermitPoll {
    boolean tryAcquire() throws InterruptedException;
  }

  /** Measures how long it has been since a watched counter of completed attempts last moved. */
  private static final class StallWatch {
    private final LongSupplier progress;
    private final long stallTimeoutNanos;
    private long lastSeenProgress;
    private long lastProgressNanos;

    StallWatch(LongSupplier progress, long stallTimeoutMillis) {
      this.progress = progress;
      this.stallTimeoutNanos = TimeUnit.MILLISECONDS.toNanos(stallTimeoutMillis);
      this.lastSeenProgress = progress.getAsLong();
      this.lastProgressNanos = System.nanoTime();
    }

    boolean isStalled() {
      long now = System.nanoTime();
      long currentProgress = progress.getAsLong();
      if (currentProgress != lastSeenProgress) {
        lastSeenProgress = currentProgress;
        lastProgressNanos = now;
      }
      return now - lastProgressNanos >= stallTimeoutNanos;
    }
  }
}
