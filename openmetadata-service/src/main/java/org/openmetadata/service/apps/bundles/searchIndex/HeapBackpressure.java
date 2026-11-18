/*
 *  Copyright 2024 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.apps.bundles.searchIndex;

import com.google.common.annotations.VisibleForTesting;
import java.lang.management.ManagementFactory;
import java.lang.management.MemoryMXBean;
import java.lang.management.MemoryUsage;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.locks.ReentrantLock;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;

/**
 * Runtime heap backpressure for the reindex reader.
 *
 * <p>AutoTune sizes batch/queue once at job start from a fixed per-entity estimate. Real entities
 * (wide tables, vector embeddings, large status history) and anything else sharing the pod push
 * actual heap far past any single estimate, so a static count-based buffer silently overflows a
 * heap — a 748 MB pod OOM'd on 2026-08-03 seconds after AutoTune upsized its queue to 1840 entities.
 * No formula can predict runtime pressure; the only thing that works in all situations is to react
 * to it.
 *
 * <p>This gate pauses the calling reader — never the in-flight writes — while used heap is above
 * {@link #PAUSE_ABOVE}, letting in-flight docs drain and GC reclaim before the reader allocates the
 * next batch. It is a no-op on a healthy heap (the common case), so it costs nothing until the pod
 * is actually close to OOM.
 *
 * <p><b>Multi-worker coordination.</b> The distributed reindex runs up to
 * {@code min(consumerThreads, MAX_IN_FLIGHT_PARTITIONS_PER_SERVER=5)} {@code PartitionWorker}s
 * concurrently that all call {@link #awaitHeadroom()} before pulling their next batch. A stateless,
 * per-thread gate fails in two ways with more than one worker:
 *
 * <ul>
 *   <li>every paused worker polls the same {@link MemoryMXBean} every {@link #POLL_MS}; the first
 *       poll that observes heap below {@link #RESUME_BELOW} breaks every paused worker out of its
 *       loop in the same instant, and each then immediately allocates a full batch — an
 *       {@code N × batchSize} synchronized burst across the resume boundary (thundering-herd
 *       resume).
 *   <li>each worker runs its own {@link #MAX_WAIT_MS} escape valve; under sustained pressure
 *       workers enter their pause windows together and time out together, so the escape silently
 *       becomes a synchronized N-worker bypass that allocates another {@code N × batchSize} wave
 *       while the heap is still at/above the pause threshold.
 * </ul>
 *
 * <p>This gate is JVM-wide. Once any worker detects pressure it engages the gate; every other
 * worker that reaches the check joins the gate instead of allocating through the burst window.
 * Drain and resume are serialized on {@link #GATE_LOCK}: only the lock holder polls the heap and
 * decides when to release the next worker; queued workers wait for the lock and re-check the heap
 * before proceeding, so resume is staggered one worker at a time rather than a synchronized herd.
 * The {@link #MAX_WAIT_MS} forward-progress escape valve is applied against a single shared
 * deadline ({@link #GATE_DEADLINE_MS}) installed when the gate first engages — not one per worker —
 * so the timeout can never collapse into a synchronized multi-worker bypass.
 */
@Slf4j
public final class HeapBackpressure {
  private HeapBackpressure() {}

  /** Pause reading at/above this fraction of max heap. */
  static final double PAUSE_ABOVE = 0.80;

  /** Resume once heap drains below this fraction (hysteresis avoids pause/resume flapping). */
  static final double RESUME_BELOW = 0.68;

  private static final long POLL_MS = 250;
  private static final long MAX_WAIT_MS = 30_000;

  /**
   * Test-settable mirror of {@link #POLL_MS} so tests can run the drain loop on a sub-millisecond
   * budget; production code reads this field, not the constant. Volatile for cross-thread
   * visibility once a test reconfigures it.
   */
  private static volatile long pollMs = POLL_MS;

  /**
   * Test-settable mirror of {@link #MAX_WAIT_MS} so tests can exercise the escape valve without
   * waiting 30 seconds; production code reads this field, not the constant. Volatile for
   * cross-thread visibility once a test reconfigures it.
   */
  private static volatile long maxWaitMs = MAX_WAIT_MS;

  private static final MemoryMXBean MEMORY = ManagementFactory.getMemoryMXBean();

  /**
   * Serializes drain/resume JVM-wide. When the gate is engaged, every worker that observes
   * pressure (or that arrives during an ongoing episode and consults {@link #GATE_ENGAGED})
   * acquires this lock; only the lock holder polls the heap, and each queued worker re-checks the
   * heap before proceeding — so resume is staggered one worker at a time instead of every paused
   * worker breaking out in the same 250 ms poll cycle.
   */
  private static final ReentrantLock GATE_LOCK = new ReentrantLock();

  /**
   * True while the gate is throttling at least one worker. The fast path consults this flag to
   * admit workers — whose own stale sample already sees no pressure — into the gate when another
   * worker is known to be draining, so they do not allocate a batch during the current burst
   * window.
   */
  private static final AtomicBoolean GATE_ENGAGED = new AtomicBoolean(false);

  /**
   * Single shared deadline (epoch ms) installed when the gate first engages. Replaces the
   * per-worker 30 s escape valve in the original design, which let all paused workers bypass in
   * lockstep under sustained pressure. Cleared when the gate releases with headroom restored; an
   * expired deadline is left in place so workers queued behind the timeout pass through
   * immediately instead of restarting their own 30 s clock.
   */
  private static final AtomicLong GATE_DEADLINE_MS = new AtomicLong(0L);

  /** True when used heap is at/above the pause threshold. Unknown max ({@code <= 0}) is never a pause. */
  static boolean underPressure(long usedBytes, long maxBytes) {
    return maxBytes > 0 && (double) usedBytes / maxBytes >= PAUSE_ABOVE;
  }

  /** True when used heap is below the resume threshold, or max is unknown. */
  static boolean hasHeadroom(long usedBytes, long maxBytes) {
    return maxBytes <= 0 || (double) usedBytes / maxBytes < RESUME_BELOW;
  }

  /**
   * Blocks the caller while heap is under pressure, up to {@link #MAX_WAIT_MS}, so a burst of
   * large entities cannot push the heap into OOM. Returns immediately on a healthy heap. JVM-wide
   * state coordinates every reindex reader: once the gate engages, all workers reaching this
   * check wait on the shared lock and resume is staggered one worker at a time, so
   * {@code N × batchSize} thundering-herd resumes and synchronized 30 s bypasses cannot occur.
   *
   * @see #awaitHeadroom(Supplier)
   */
  public static void awaitHeadroom() {
    awaitHeadroom(MEMORY::getHeapMemoryUsage);
  }

  /**
   * Testable variant that accepts a heap-usage supplier so tests can simulate pressure profiles
   * without touching the platform {@link MemoryMXBean}. Behaviour is otherwise identical to
   * {@link #awaitHeadroom()}.
   */
  @VisibleForTesting
  static void awaitHeadroom(Supplier<MemoryUsage> usageSupplier) {
    MemoryUsage usage = usageSupplier.get();
    long maxBytes = usage.getMax();
    if (!underPressure(usage.getUsed(), maxBytes) && !GATE_ENGAGED.get()) {
      return;
    }
    GATE_LOCK.lock();
    try {
      drainUntilHeadroomShared(usageSupplier);
    } finally {
      GATE_LOCK.unlock();
    }
  }

  /** Resets shared gate state. Production code never calls this; tests do, to isolate episodes. */
  @VisibleForTesting
  static void resetGateStateForTest() {
    GATE_LOCK.lock();
    try {
      GATE_ENGAGED.set(false);
      GATE_DEADLINE_MS.set(0L);
    } finally {
      GATE_LOCK.unlock();
    }
  }

  /** Shrinks the poll interval so tests can cycle the drain loop on a sub-millisecond budget. */
  @VisibleForTesting
  static void setPollMsForTest(long ms) {
    pollMs = ms;
  }

  /** Shrinks the escape-valve bound so tests can exercise the deadline without waiting 30 seconds. */
  @VisibleForTesting
  static void setMaxWaitMsForTest(long ms) {
    maxWaitMs = ms;
  }

  /** Whether the gate is currently engaged (visible to tests for episode-state assertions). */
  @VisibleForTesting
  static boolean gateEngaged() {
    return GATE_ENGAGED.get();
  }

  /** Current shared deadline (epoch ms), or {@code 0} when no episode is active. */
  @VisibleForTesting
  static long gateDeadlineMs() {
    return GATE_DEADLINE_MS.get();
  }

  /** Whether the calling thread currently holds {@link #GATE_LOCK}; tests use it to assert mutual
   * exclusion of gate-critical sections. */
  @VisibleForTesting
  static boolean gateLockHeldByCurrentThread() {
    return GATE_LOCK.isHeldByCurrentThread();
  }

  /**
   * Drains the gate while holding {@link #GATE_LOCK}. Only the lock holder runs this method, so
   * heap polls are serialized across all workers. Each worker re-checks on entry so a worker that
   * acquired the lock after the previous drainer already restored headroom can proceed without
   * re-arming the gate.
   */
  private static void drainUntilHeadroomShared(Supplier<MemoryUsage> usageSupplier) {
    MemoryUsage usage = usageSupplier.get();
    long maxBytes = usage.getMax();
    long usedBytes = usage.getUsed();

    if (hasHeadroom(usedBytes, maxBytes)) {
      // A peer already drained to headroom while we waited for the lock; clear state and
      // proceed (the next-pressure worker will re-engage and install a fresh deadline).
      GATE_ENGAGED.set(false);
      GATE_DEADLINE_MS.set(0L);
      return;
    }

    if (!underPressure(usedBytes, maxBytes)) {
      // Hysteresis band [RESUME_BELOW, PAUSE_ABOVE): the gate is not actively throttling on its
      // own. We only reach this branch when GATE_ENGAGED was true on entry (otherwise the fast
      // path returns without the lock); that engaged state is stale left over from a prior drain
      // that hit the deadline past the pause threshold (or was interrupted mid-drain) while the
      // heap has since drifted into the band. Clear it so the next-pressure worker installs a
      // fresh deadline, and proceed.
      GATE_ENGAGED.set(false);
      GATE_DEADLINE_MS.set(0L);
      return;
    }

    // Heap is at/above PAUSE_ABOVE. Engage (or re-arm) the gate. The first engager installs the
    // shared deadline; later joiners share it, so the 30 s escape valve applies once per episode
    // and cannot become a synchronized N-worker bypass.
    boolean firstEngager = !GATE_ENGAGED.getAndSet(true);
    long deadline;
    if (firstEngager) {
      deadline = System.currentTimeMillis() + maxWaitMs;
      GATE_DEADLINE_MS.set(deadline);
      LOG.warn(
          "Reindex reader pausing: heap at {}% of {} MB (>= {}% threshold); draining in-flight work",
          percentUsed(usedBytes, maxBytes),
          maxBytes / (1024 * 1024),
          Math.round(PAUSE_ABOVE * 100));
    } else {
      deadline = GATE_DEADLINE_MS.get();
    }

    long waited = 0;
    while (System.currentTimeMillis() < deadline && !Thread.currentThread().isInterrupted()) {
      sleep(pollMs);
      waited += pollMs;
      usedBytes = usageSupplier.get().getUsed();
      if (hasHeadroom(usedBytes, maxBytes)) {
        break;
      }
    }
    logResume(usedBytes, maxBytes, waited);

    if (hasHeadroom(usedBytes, maxBytes)) {
      // Episode resolved: clear state so the next pressure wave starts with a fresh deadline.
      GATE_ENGAGED.set(false);
      GATE_DEADLINE_MS.set(0L);
    }
    // Otherwise leave engaged=true and the (expired) deadline in place so workers queued behind
    // this bypass flow through immediately instead of each restarting their own 30 s clock.
  }

  private static void logResume(long usedBytes, long maxBytes, long waited) {
    if (hasHeadroom(usedBytes, maxBytes)) {
      LOG.info(
          "Reindex reader resuming after {} ms; heap back to {}%",
          waited, percentUsed(usedBytes, maxBytes));
    } else {
      LOG.warn(
          "Reindex reader proceeding after {} ms; heap still {}% — GC could not free enough. "
              + "Reduce batch/queue size or raise the heap for this reindex.",
          waited, percentUsed(usedBytes, maxBytes));
    }
  }

  private static long percentUsed(long usedBytes, long maxBytes) {
    return maxBytes > 0 ? Math.round(100.0 * usedBytes / maxBytes) : 0;
  }

  private static void sleep(long millis) {
    try {
      Thread.sleep(millis);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    }
  }
}
