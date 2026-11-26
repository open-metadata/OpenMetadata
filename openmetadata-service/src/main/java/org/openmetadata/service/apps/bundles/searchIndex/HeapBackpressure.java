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
 * so the timeout can never collapse into a synchronized multi-worker bypass. After an escape-valve
 * timeout the same paced handoff used after a successful drain re-arms a fresh deadline for the
 * next admission, so sustained pressure bounds admission to one worker per
 * {@code releasePaceMs + maxWaitMs} and never permanently disables the gate.
 *
 * <p><b>Paced handoff after a drain or escape-valve timeout.</b> Serializing the heap check is not
 * enough on its own: the lock is released before the released worker calls {@code processBatch()}
 * and reads its next batch, so queued workers can all acquire the lock in succession and see the
 * same healthy heap sample before the first batch read has returned its entities — an
 * {@code N × batchSize} burst across the resume boundary. To prevent that, every released worker
 * installs an admission pace ({@link #NEXT_ADMISSION_MS} = now + {@link #RELEASE_PACE_MS}) and
 * leaves the gate engaged while the pace window is open; the next queued worker acquires the
 * lock, waits out the pace under the lock, then re-checks the heap — so each released worker's
 * batch allocation has time to be reflected in heap usage before the next worker is admitted. If
 * the previous worker's allocation pushed the heap back to pressure, the next worker re-enters
 * the drain instead of admitting, so the gate reacts to the actual post-resume heap, not a stale
 * sample taken before the burst. The escape valve uses the same handoff so a timeout does not let
 * queued workers (or later batches) all rush the next batch read together on the expired
 * deadline.
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
   * Pace at which workers are admitted one at a time after a successful drain, so each released
   * worker's batch read has time to reflect in heap usage before the next worker is admitted.
   * Chosen to comfortably exceed one batch read + its heap allocation becoming visible to a heap
   * poll, while keeping the resume burst short enough that reindex throughput is not the cost of
   * safety.
   */
  private static final long RELEASE_PACE_MS = 1_000;

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

  /**
   * Test-settable mirror of {@link #RELEASE_PACE_MS} so tests can exercise the paced handoff on a
   * sub-second budget. Volatile for cross-thread visibility once a test reconfigures it.
   */
  private static volatile long releasePaceMs = RELEASE_PACE_MS;

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
   * lockstep under sustained pressure. Cleared when the gate releases with headroom restored, and
   * cleared to {@code 0} by {@link #admitWithPacedHandoff()} after an escape-valve timeout so the
   * next admitted worker re-arms a fresh deadline and drains again instead of bypassing
   * indefinitely on the expired one.
   */
  private static final AtomicLong GATE_DEADLINE_MS = new AtomicLong(0L);

  /**
   * Earliest epoch ms at which the next queued worker may be admitted after a paced handoff. Set by
   * a released worker (the lock holder that just observed headroom) to {@code now + releasePaceMs}
   * and cleared once no worker is queued behind the most recent admission. While this is in the
   * future, the next worker that acquires the lock waits it out before re-checking the heap, so each
   * released worker's batch allocation is reflected in heap usage before the next one is admitted.
   */
  private static final AtomicLong NEXT_ADMISSION_MS = new AtomicLong(0L);

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
      NEXT_ADMISSION_MS.set(0L);
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

  /** Shrinks the admission pace so tests can exercise the paced handoff on a sub-second budget. */
  @VisibleForTesting
  static void setReleasePaceMsForTest(long ms) {
    releasePaceMs = ms;
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

  /** Current admission pace (epoch ms), or {@code 0} when no paced handoff is in flight. */
  @VisibleForTesting
  static long nextAdmissionMs() {
    return NEXT_ADMISSION_MS.get();
  }

  /** Whether the calling thread currently holds {@link #GATE_LOCK}; tests use it to assert mutual
   * exclusion of gate-critical sections. */
  @VisibleForTesting
  static boolean gateLockHeldByCurrentThread() {
    return GATE_LOCK.isHeldByCurrentThread();
  }

  /**
   * Number of workers queued waiting to acquire {@link #GATE_LOCK}; tests use it to wait until
   * every other worker is parked behind the drainer before changing heap state, so the paced
   * handoff is observed by all queued workers rather than being short-circuited by a late starter
   * taking the healthy-heap fast path.
   */
  @VisibleForTesting
  static int gateQueueLength() {
    return GATE_LOCK.getQueueLength();
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

    // Paced handoff: a previous worker was released from the drain and installed an admission
    // pace so its batch read has time to reflect in heap usage before the next worker is admitted.
    // Wait out the pace (under the lock — queued workers are blocked on the lock anyway) and then
    // re-check the heap below; if the previous worker's allocation pushed us back to pressure,
    // we fall through to the drain instead of admitting.
    long paceDeadline = NEXT_ADMISSION_MS.get();
    if (paceDeadline > 0L) {
      long now = System.currentTimeMillis();
      while (!Thread.currentThread().isInterrupted()
          && (now = System.currentTimeMillis()) < paceDeadline) {
        sleep(Math.min(pollMs, Math.max(1L, paceDeadline - now)));
      }
      usage = usageSupplier.get();
      maxBytes = usage.getMax();
      usedBytes = usage.getUsed();
    }

    if (hasHeadroom(usedBytes, maxBytes)) {
      // Headroom confirmed: admit ourselves and install a fresh pace so the next queued worker
      // does not read its batch alongside ours. The pace only matters when someone is queued
      // behind us; if no one is, clear the gate so the fast path returns for healthy heap.
      admitWithPacedHandoff();
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
      NEXT_ADMISSION_MS.set(0L);
      return;
    }

    // Heap is at/above PAUSE_ABOVE. Engage (or re-arm) the gate. The first engager installs the
    // shared deadline; later joiners share it, so the 30 s escape valve applies once per episode
    // and cannot become a synchronized N-worker bypass. A joiner that arrives during a paced
    // admission handoff (engaged=true, deadline cleared to 0 by the previous admission) must NOT
    // reuse that zero deadline — it would skip the drain loop and allocate alongside the
    // just-released worker. Re-arm a fresh deadline in that case so the worker drains.
    boolean firstEngager = !GATE_ENGAGED.getAndSet(true);
    long existingDeadline = firstEngager ? 0L : GATE_DEADLINE_MS.get();
    long deadline;
    if (firstEngager || existingDeadline == 0L) {
      deadline = System.currentTimeMillis() + maxWaitMs;
      GATE_DEADLINE_MS.set(deadline);
      LOG.warn(
          "Reindex reader pausing: heap at {}% of {} MB (>= {}% threshold); draining in-flight work",
          percentUsed(usedBytes, maxBytes),
          maxBytes / (1024 * 1024),
          Math.round(PAUSE_ABOVE * 100));
    } else {
      deadline = existingDeadline;
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

    // Whether the episode resolved with headroom or the escape valve fired under sustained
    // pressure, install a paced handoff. Queued workers are then admitted one at a time (one per
    // releasePaceMs), and on the next admission each re-checks the heap and either re-arms a fresh
    // deadline (still under pressure) or clears the gate (headroom or hysteresis band). Leaving an
    // expired deadline in place here — the old behaviour — let every queued worker and every later
    // batch skip the drain loop and allocate immediately, permanently disabling the gate under
    // sustained pressure (the N × batchSize burst #38021 targets). With no worker queued,
    // admitWithPacedHandoff clears the gate so the next batch re-engages with a fresh deadline.
    admitWithPacedHandoff();
  }

  /**
   * Admits the current lock-holding worker after a successful drain (or after an escape-valve
   * timeout, or after waiting out a peer's admission pace and confirming headroom). If other
   * workers are queued behind us, stay engaged and install the next pace so they are admitted one
   * at a time, each with time for their predecessor's batch allocation to be reflected in heap
   * usage; the cleared deadline forces the next admission to re-arm a fresh one (or clear the gate)
   * based on the live heap sample rather than bypassing on an expired deadline. If no one is
   * queued, clear the gate so the fast path returns immediately for healthy heap.
   */
  private static void admitWithPacedHandoff() {
    if (GATE_LOCK.hasQueuedThreads()) {
      GATE_ENGAGED.set(true);
      NEXT_ADMISSION_MS.set(System.currentTimeMillis() + releasePaceMs);
      GATE_DEADLINE_MS.set(0L);
    } else {
      GATE_ENGAGED.set(false);
      GATE_DEADLINE_MS.set(0L);
      NEXT_ADMISSION_MS.set(0L);
    }
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
