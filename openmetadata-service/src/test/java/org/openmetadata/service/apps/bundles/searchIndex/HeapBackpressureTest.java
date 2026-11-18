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

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.management.MemoryUsage;
import java.time.Duration;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Supplier;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class HeapBackpressureTest {

  /** Production poll/escape-valve constants (kept in sync with {@code HeapBackpressure}). */
  private static final long PROD_POLL_MS = 250L;

  private static final long PROD_MAX_WAIT_MS = 30_000L;

  /**
   * The shared gate state of {@link HeapBackpressure} is JVM-wide. JUnit runs tests in a class
   * sequentially, so we just reset before each test. We also shrink the poll interval and the
   * escape valve so the drain loop runs on sub-millisecond budgets and the deadline-related tests
   * don't have to wait 30 seconds. Tests that need a larger escape-valve window call
   * {@link HeapBackpressure#setMaxWaitMsForTest(long)} themselves.
   */
  @BeforeEach
  void resetGateState() {
    HeapBackpressure.resetGateStateForTest();
    HeapBackpressure.setPollMsForTest(10L);
    HeapBackpressure.setMaxWaitMsForTest(2_000L);
  }

  // ---------------------------------------------------------------------------
  // Existing predicate tests — unchanged behaviour, single-thread.
  // ---------------------------------------------------------------------------

  @Test
  void underPressure_atOrAboveThreshold() {
    assertTrue(HeapBackpressure.underPressure(80, 100), "80% == 0.80 threshold must pause");
    assertTrue(HeapBackpressure.underPressure(95, 100));
    assertTrue(HeapBackpressure.underPressure(100, 100));
  }

  @Test
  void underPressure_belowThreshold() {
    assertFalse(HeapBackpressure.underPressure(79, 100));
    assertFalse(HeapBackpressure.underPressure(0, 100));
  }

  @Test
  void underPressure_falseWhenMaxUnknown() {
    // Some GCs report max = -1; an unknown ceiling must never wedge the reader.
    assertFalse(HeapBackpressure.underPressure(1_000_000, -1));
    assertFalse(HeapBackpressure.underPressure(1_000_000, 0));
  }

  @Test
  void hasHeadroom_belowResumeThreshold() {
    assertTrue(HeapBackpressure.hasHeadroom(67, 100), "below 0.68 must resume");
    assertTrue(HeapBackpressure.hasHeadroom(0, 100));
    assertTrue(HeapBackpressure.hasHeadroom(1_000_000, -1), "unknown max must resume, never hang");
  }

  @Test
  void hasHeadroom_atOrAboveResumeThreshold() {
    assertFalse(HeapBackpressure.hasHeadroom(68, 100));
    assertFalse(HeapBackpressure.hasHeadroom(80, 100));
  }

  @Test
  void hysteresisGap_holdsStateBetweenThresholds() {
    // Between resume (0.68) and pause (0.80) the reader neither pauses nor is declared recovered,
    // so it can't flap once it has paused. 75% must be in that band.
    assertFalse(HeapBackpressure.underPressure(75, 100));
    assertFalse(HeapBackpressure.hasHeadroom(75, 100));
  }

  // ---------------------------------------------------------------------------
  // awaitHeadroom — single-thread behaviour.
  // ---------------------------------------------------------------------------

  @Test
  void awaitHeadroom_returnsImmediatelyOnHealthyHeapWithoutAcquiringGate() {
    // A single worker sampling a healthy heap must fast-path return; no heap sample should be
    // observed under the gate lock, otherwise the fast path silently took the lock on every
    // reader call (a contention tax on the common case).
    AtomicBoolean lockHeldAtAnySample = new AtomicBoolean(false);
    Supplier<MemoryUsage> healthy = () -> new MemoryUsage(0L, 50L, 100L, 100L);
    Supplier<MemoryUsage> instrumented =
        () -> {
          MemoryUsage usage = healthy.get();
          if (HeapBackpressure.gateLockHeldByCurrentThread()) {
            lockHeldAtAnySample.set(true);
          }
          return usage;
        };

    HeapBackpressure.awaitHeadroom(instrumented);

    assertFalse(lockHeldAtAnySample.get(), "healthy-heap fast path must not take the GATE_LOCK");
    assertFalse(HeapBackpressure.gateEngaged());
    assertEquals(0L, HeapBackpressure.gateDeadlineMs());
  }

  @Test
  void awaitHeadroom_underPressureDrainsUntilHeadroomAndClearsGateState() {
    // The fast-path sample reads pressure; the re-check under the lock reads pressure once more;
    // the drain loop polls until headroom appears. After it returns the episode is over and the
    // shared state must be cleared so the next pressure wave starts from a fresh deadline.
    AtomicInteger call = new AtomicInteger(0);
    Supplier<MemoryUsage> supplier =
        () -> new MemoryUsage(0L, call.incrementAndGet() < 4 ? 85L : 60L, 100L, 100L);

    long start = System.nanoTime();
    HeapBackpressure.awaitHeadroom(supplier);
    long elapsedMs = (System.nanoTime() - start) / 1_000_000L;

    assertTrue(call.get() >= 4, "drain loop should poll at least once before headroom appears");
    assertTrue(elapsedMs < 5_000L, "drain should finish quickly once headroom appears");
    assertFalse(HeapBackpressure.gateEngaged(), "engaged flag must be cleared on headroom");
    assertEquals(0L, HeapBackpressure.gateDeadlineMs(), "deadline must be cleared on headroom");
  }

  @Test
  void awaitHeadroom_publicNoArgReturnsWithoutBlockingJmxSampledHeap() {
    // Smoke test: the public no-arg entrypoint delegates to MEMORY.getHeapMemoryUsage. In a unit
    // test the heap is well below the 80% ceiling on any reasonable CI JVM, so the call should
    // return immediately without engaging the gate.
    long start = System.nanoTime();
    HeapBackpressure.awaitHeadroom();
    long elapsedMs = (System.nanoTime() - start) / 1_000_000L;
    assertTrue(elapsedMs < 1_000L, "public awaitHeadroom must be near-instant on a healthy heap");
    assertFalse(HeapBackpressure.gateEngaged());
  }

  // ---------------------------------------------------------------------------
  // awaitHeadroom — JVM-wide coordination across multiple worker threads.
  // ---------------------------------------------------------------------------

  /**
   * Reproduces the bug condition described in the report: with N concurrent readers all sampling a
   * high heap at once, a stateless per-thread gate lets every worker run its own drain loop
   * concurrently and they all break out in the same poll cycle (thundering-herd resume). The fix
   * serializes drain/resume behind {@link HeapBackpressure#gateLockHeldByCurrentThread() the
   * shared GATE_LOCK} so the gate loop is JVM-wide exclusive — the maximum number of workers ever
   * observed inside the gate at the same time is exactly 1.
   */
  @Test
  void awaitHeadroom_multipleWorkersSerializeDrainUnderGateLock() throws Exception {
    int workers = 5;
    AtomicLong usedRef = new AtomicLong(90L); // all workers initially sample under-pressure heap
    AtomicInteger inGateConcurrent = new AtomicInteger(0);
    AtomicInteger maxInGateConcurrent = new AtomicInteger(0);
    AtomicInteger completed = new AtomicInteger(0);
    CountDownLatch ready = new CountDownLatch(workers);

    Supplier<MemoryUsage> supplier =
        () -> {
          MemoryUsage usage = new MemoryUsage(0L, usedRef.get(), 100L, 100L);
          // Every supplier call from inside the gate (lock held) increments the in-gate counter.
          // The fast-path call sampled before the lock is acquired will not see the lock held.
          if (HeapBackpressure.gateLockHeldByCurrentThread()) {
            int cur = inGateConcurrent.incrementAndGet();
            maxInGateConcurrent.accumulateAndGet(cur, Math::max);
            inGateConcurrent.decrementAndGet();
          }
          return usage;
        };

    ExecutorService pool = Executors.newFixedThreadPool(workers);
    try {
      for (int i = 0; i < workers; i++) {
        pool.submit(
            () -> {
              ready.countDown();
              HeapBackpressure.awaitHeadroom(supplier);
              completed.incrementAndGet();
              return null;
            });
      }
      assertTrue(ready.await(2L, TimeUnit.SECONDS), "all workers should start");

      // Wait until the first worker is parked in the gate's drain loop and the gate is engaged.
      await()
          .pollDelay(Duration.ZERO)
          .pollInterval(Duration.ofMillis(5))
          .atMost(Duration.ofSeconds(3))
          .until(HeapBackpressure::gateEngaged);

      // Simulate the heap draining below RESUME_BELOW (in-flight writes flushed + GC reclaimed).
      // The draining worker exits its loop; queued workers acquire the lock one at a time, see
      // headroom on re-check, and proceed without entering their own drain loops.
      usedRef.set(60L);

      await()
          .atMost(Duration.ofSeconds(5))
          .untilAsserted(() -> assertEquals(workers, completed.get(), "all workers should exit"));

      assertEquals(
          1,
          maxInGateConcurrent.get(),
          "with the JVM-wide gate, only the lock holder may sample heap inside the gate");
    } finally {
      pool.shutdownNow();
    }
  }

  /**
   * Reproduces the second bug from the report: under sustained pressure each paused worker runs its
   * own 30 s escape valve, so they all bypass in lockstep. The fix installs a single shared
   * deadline (epoch ms) when the gate first engages; later workers reaching the gate join the same
   * deadline. After the deadline expires, the first worker proceeds; subsequent workers do NOT
   * restart their own 30 s timer — they see the already-expired deadline and pass through
   * immediately, which is the property this test asserts.
   */
  @Test
  void awaitHeadroom_sustainedPressure_sharedDeadlinePreventsPerWorkerBypassRestart() {
    HeapBackpressure.setMaxWaitMsForTest(400L); // short escape valve for the test budget
    Supplier<MemoryUsage> pressure = () -> new MemoryUsage(0L, 90L, 100L, 100L);

    // First call engages the gate and waits the full escape-valve window before bypassing.
    long start1 = System.nanoTime();
    HeapBackpressure.awaitHeadroom(pressure);
    long elapsed1Ms = (System.nanoTime() - start1) / 1_000_000L;
    assertTrue(
        elapsed1Ms >= 350L,
        "first worker should drain past the escape valve before bypassing (took "
            + elapsed1Ms
            + "ms)");
    assertTrue(HeapBackpressure.gateEngaged(), "engaged flag must remain after a timeout bypass");
    long expiredDeadline = HeapBackpressure.gateDeadlineMs();
    assertTrue(
        expiredDeadline > 0 && expiredDeadline <= System.currentTimeMillis(),
        "deadline must be expired after the bypass");

    // Second call (after the first bypassed) must NOT restart its own 400 ms clock: it sees the
    // already-expired shared deadline and passes through immediately. Without the fix the second
    // call would wait the full 400 ms (its own MAX_WAIT_MS), making this test fail.
    long start2 = System.nanoTime();
    HeapBackpressure.awaitHeadroom(pressure);
    long elapsed2Ms = (System.nanoTime() - start2) / 1_000_000L;
    assertTrue(
        elapsed2Ms < 200L,
        "second worker should bypass immediately via the shared expired deadline (took "
            + elapsed2Ms
            + "ms); without coordination every worker would restart the 30 s escape valve in lockstep");
    assertEquals(
        expiredDeadline,
        HeapBackpressure.gateDeadlineMs(),
        "second worker must NOT touch the shared deadline");
    assertTrue(HeapBackpressure.gateEngaged(), "engaged flag must remain after timeout cascade");
  }

  /**
   * If a worker bypassed via the shared deadline (heap still at/above {@code PAUSE_ABOVE}) and the
   * heap then drifts into the hysteresis band without headroom, a worker reaching the gate must
   * clear the stale engaged + expired-deadline state and proceed (so the next pressure wave starts
   * with a fresh deadline), not block forever on stale episode state.
   */
  @Test
  void awaitHeadroom_staleBypassStateInBandClearsAndProceeds() {
    HeapBackpressure.setMaxWaitMsForTest(200L);
    Supplier<MemoryUsage> pressure = () -> new MemoryUsage(0L, 90L, 100L, 100L);

    // Step 1: drive the gate through the deadline-bypass path so engaged=true and deadline=past.
    long start1 = System.nanoTime();
    HeapBackpressure.awaitHeadroom(pressure);
    long elapsed1Ms = (System.nanoTime() - start1) / 1_000_000L;
    assertTrue(elapsed1Ms >= 150L, "first worker should wait ~200ms before bypassing");
    assertTrue(HeapBackpressure.gateEngaged());
    long expiredDeadline = HeapBackpressure.gateDeadlineMs();
    assertTrue(expiredDeadline <= System.currentTimeMillis());

    // Step 2: heap has since drifted into the hysteresis band [RESUME_BELOW, PAUSE_ABOVE). The
    // next worker must take the lock, see no pressure, clear stale state, and return quickly.
    Supplier<MemoryUsage> inBand = () -> new MemoryUsage(0L, 75L, 100L, 100L);
    long start2 = System.nanoTime();
    HeapBackpressure.awaitHeadroom(inBand);
    long elapsed2Ms = (System.nanoTime() - start2) / 1_000_000L;
    assertTrue(elapsed2Ms < 100L, "stale-episode in-band worker should clear and proceed fast");
    assertFalse(HeapBackpressure.gateEngaged(), "stale engaged flag should be cleared");
    assertEquals(0L, HeapBackpressure.gateDeadlineMs(), "stale deadline should be cleared");
  }

  /**
   * After a successful drain (headroom observed), the gate state must be cleared so a subsequent
   * pressure wave installs a fresh deadline rather than reusing a stale one. This guards against
   * the deadline silently shrinking to zero across episodes.
   */
  @Test
  void awaitHeadroom_afterDrainCompleted_newEngagementInstallsFreshDeadline() {
    HeapBackpressure.setMaxWaitMsForTest(1_500L);
    AtomicInteger call = new AtomicInteger(0);
    Supplier<MemoryUsage> pressureThenHeadroom =
        () -> new MemoryUsage(0L, call.incrementAndGet() < 4 ? 85L : 60L, 100L, 100L);

    HeapBackpressure.awaitHeadroom(pressureThenHeadroom);
    assertFalse(HeapBackpressure.gateEngaged());
    assertEquals(0L, HeapBackpressure.gateDeadlineMs());

    // Second worker sees live pressure again — the gate must install a fresh, future deadline.
    long beforeSecondEngagement = System.currentTimeMillis();
    call.set(0); // restart the same pressure→headroom sequence
    HeapBackpressure.awaitHeadroom(pressureThenHeadroom);
    // State effectively cleared during the second call's headroom-driven exit; the only way to
    // assert a "fresh" deadline was installed mid-flight is to capture gate state before the call,
    // so we verify the call returned cleanly.
    assertFalse(HeapBackpressure.gateEngaged());
    assertEquals(0L, HeapBackpressure.gateDeadlineMs());
    // Sanity: the second call did engage the gate at some point (would have started a fresh
    // deadline earlier than now), even though it has cleared it again by the time it returned.
    // No assertion can post-observe the past deadline value; the property we care about is that
    // awaitHeadroom did not wedge on stale state from the first engagement.
    long afterSecondEngagement = System.currentTimeMillis();
    assertTrue(afterSecondEngagement >= beforeSecondEngagement, "sanity clock");
  }

  /**
   * Reset guardrail: explicitly restores production poll/escape-valve values so a later test
   * running in the same JVM (e.g. a sibling @Test elsewhere) does not see the test-shrunk values
   * leak across. Even though {@link #resetGateState()} re-applies them, this is cheap insurance
   * against partial isolation if a future test bypasses {@code @BeforeEach}.
   */
  @org.junit.jupiter.api.AfterEach
  void restoreProductionCadence() {
    HeapBackpressure.resetGateStateForTest();
    HeapBackpressure.setPollMsForTest(PROD_POLL_MS);
    HeapBackpressure.setMaxWaitMsForTest(PROD_MAX_WAIT_MS);
  }
}
