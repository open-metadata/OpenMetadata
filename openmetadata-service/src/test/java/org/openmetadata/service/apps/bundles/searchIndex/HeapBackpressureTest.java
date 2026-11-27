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
import java.util.Arrays;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicLongArray;
import java.util.function.Supplier;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class HeapBackpressureTest {

  /** Production poll/escape-valve/pace constants (kept in sync with {@code HeapBackpressure}). */
  private static final long PROD_POLL_MS = 250L;

  private static final long PROD_MAX_WAIT_MS = 30_000L;

  private static final long PROD_RELEASE_PACE_MS = 1_000L;

  /**
   * The shared gate state of {@link HeapBackpressure} is JVM-wide. JUnit runs tests in a class
   * sequentially, so we just reset before each test. We also shrink the poll interval, the escape
   * valve, and the admission pace so the drain loop, deadline, and paced handoff run on
   * sub-second budgets and the tests don't have to wait through production timeouts. Tests that
   * need a larger window call the corresponding {@code set...ForTest} helpers themselves.
   */
  @BeforeEach
  void resetGateState() {
    HeapBackpressure.resetGateStateForTest();
    HeapBackpressure.setPollMsForTest(10L);
    HeapBackpressure.setMaxWaitMsForTest(2_000L);
    HeapBackpressure.setReleasePaceMsForTest(50L);
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
    // Smoke test: the public no-arg entrypoint delegates to MEMORY.getHeapMemoryUsage. On a
    // healthy runner JVM it fast-paths and returns immediately; on a runner whose heap happens
    // to be at/above the pause threshold mid-suite (this test runs inside a 30-minute, 18k-test
    // JVM), it engages the gate and either drains to headroom or bypasses via the escape valve.
    // The only thing we can assert independent of the runner's heap state is that it returns
    // within the test escape-valve bound (set in @BeforeEach) — i.e. it never wedges. The
    // gate-engaged flag is NOT heap-state independent: if the runner is under sustained pressure
    // for the whole escape valve the escape valve fires, and whether the timeout handoff leaves
    // the gate engaged or cleared depends on whether other workers happen to be queued on the
    // lock at that instant, so it is not asserted here.
    long maxWaitMs = 2_000L; // matches the @BeforeEach setMaxWaitMsForTest(2_000L)
    long start = System.nanoTime();
    HeapBackpressure.awaitHeadroom();
    long elapsedMs = (System.nanoTime() - start) / 1_000_000L;
    assertTrue(
        elapsedMs < maxWaitMs + 2_000L,
        "public awaitHeadroom must return within the escape-valve bound (took "
            + elapsedMs
            + "ms); a wedge would exceed this");
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
   * Reproduces the sustained-pressure failure from #38021: when heap stays at/above
   * {@code PAUSE_ABOVE} past the escape valve, the gate must NOT leave an expired deadline in place
   * for every later batch to reuse — that would permanently disable backpressure and let every
   * subsequent worker skip the drain and allocate immediately (the {@code N × batchSize} burst the
   * gate targets). With no other worker queued, the timeout handoff clears the gate, so the next
   * call re-engages with a fresh deadline and waits the full escape valve again instead of
   * bypassing instantly on the expired one.
   */
  @Test
  void awaitHeadroom_sustainedPressure_soloTimeoutReArmsFreshDeadline() {
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
    // Solo timeout: no one is queued, so the handoff clears the gate so the next batch re-arms.
    assertFalse(
        HeapBackpressure.gateEngaged(),
        "solo escape-valve timeout must clear the gate so the next batch re-arms");
    assertEquals(
        0L, HeapBackpressure.gateDeadlineMs(), "solo escape-valve timeout must clear the deadline");

    // Second call must re-arm a fresh deadline and wait the full escape valve again, NOT bypass
    // immediately on the expired deadline. With the bug (expired deadline left in place) this
    // call would return in ~0ms; with the fix it waits ~400ms again.
    long start2 = System.nanoTime();
    HeapBackpressure.awaitHeadroom(pressure);
    long elapsed2Ms = (System.nanoTime() - start2) / 1_000_000L;
    assertTrue(
        elapsed2Ms >= 350L,
        "second call must re-arm a fresh deadline and wait the escape valve again (took "
            + elapsed2Ms
            + "ms); reusing the expired deadline would bypass immediately and permanently "
            + "disable backpressure under sustained pressure");
    assertFalse(HeapBackpressure.gateEngaged());
    assertEquals(0L, HeapBackpressure.gateDeadlineMs());
  }

  /**
   * Multi-worker sustained-pressure test for #38021: with several workers each pulling multiple
   * batches while heap stays at/above {@code PAUSE_ABOVE}, every admission escapes via the timeout
   * valve. The fix paces admission after each timeout (one worker per {@code releasePaceMs}) and
   * re-arms a fresh deadline for the next admission, so admissions are spread across many
   * escape-valve windows rather than clustering into a single synchronized burst right after the
   * first timeout. This records every (worker, batch) admission timestamp and asserts the span
   * exceeds a single escape-valve window — with the bug, all admissions would cluster within one
   * poll interval of the first timeout and the span would be ~0.
   */
  @Test
  void awaitHeadroom_sustainedPressure_multipleWorkersPacedAcrossBatches() throws Exception {
    int workers = 3;
    int batches = 2;
    long maxWaitMs = 300L;
    long paceMs = 80L;
    HeapBackpressure.setMaxWaitMsForTest(maxWaitMs);
    HeapBackpressure.setReleasePaceMsForTest(paceMs);
    Supplier<MemoryUsage> pressure = () -> new MemoryUsage(0L, 90L, 100L, 100L);

    AtomicLongArray admitNs = new AtomicLongArray(workers * batches);
    CountDownLatch ready = new CountDownLatch(workers);
    AtomicInteger completed = new AtomicInteger(0);

    ExecutorService pool = Executors.newFixedThreadPool(workers);
    try {
      for (int w = 0; w < workers; w++) {
        final int worker = w;
        pool.submit(
            () -> {
              ready.countDown();
              for (int b = 0; b < batches; b++) {
                HeapBackpressure.awaitHeadroom(pressure);
                admitNs.set(worker * batches + b, System.nanoTime());
                completed.incrementAndGet();
              }
              return null;
            });
      }
      assertTrue(ready.await(2L, TimeUnit.SECONDS), "all workers should start");

      // Wait until all workers have reached the gate: one draining, the rest queued on the lock,
      // so the first escape-valve timeout installs a paced handoff (hasQueuedThreads()==true).
      await()
          .pollDelay(Duration.ZERO)
          .pollInterval(Duration.ofMillis(5))
          .atMost(Duration.ofSeconds(3))
          .until(() -> HeapBackpressure.gateQueueLength() == workers - 1);

      await()
          .atMost(Duration.ofSeconds(20))
          .untilAsserted(
              () ->
                  assertEquals(workers * batches, completed.get(), "all batches should complete"));

      // Under sustained pressure every admission escapes via the timeout valve. With the fix,
      // each admission is paced one-per-releasePaceMs and the deadline is re-armed, so admissions
      // span many escape-valve windows. With the bug, every queued worker and every later batch
      // bypasses instantly on the expired deadline, clustering all admissions within a single
      // poll interval of the first timeout — the span would be ~0, far below maxWaitMs.
      long[] ts = new long[workers * batches];
      for (int i = 0; i < ts.length; i++) {
        ts[i] = admitNs.get(i);
      }
      Arrays.sort(ts);
      long spanMs = (ts[ts.length - 1] - ts[0]) / 1_000_000L;
      assertTrue(
          spanMs > maxWaitMs,
          "admissions must span more than one escape-valve window under sustained pressure "
              + "(span="
              + spanMs
              + "ms, maxWait="
              + maxWaitMs
              + "ms); a single synchronized timeout burst would cluster all admissions within "
              + "maxWaitMs");
    } finally {
      pool.shutdownNow();
    }
  }

  /**
   * If a worker's escape valve fired (heap still at/above {@code PAUSE_ABOVE}) and installed a paced
   * handoff (engaged=true, deadline cleared to 0, next admission paced), and the heap then drifts
   * into the hysteresis band [RESUME_BELOW, PAUSE_ABOVE) without headroom while a queued worker is
   * waiting out the pace, that queued worker — on its post-pace re-check — must clear the stale
   * engaged + pace state and proceed, not wedge on stale episode state. This exercises the
   * hysteresis-band clear branch in the paced-handoff context.
   */
  @Test
  void awaitHeadroom_pacedHandoff_heapDriftsToBandDuringPace_clearsAndProceeds() throws Exception {
    int workers = 2;
    long paceMs = 400L;
    HeapBackpressure.setReleasePaceMsForTest(paceMs);
    HeapBackpressure.setMaxWaitMsForTest(200L);
    AtomicLong usedRef = new AtomicLong(90L); // both workers initially sample under-pressure heap
    AtomicInteger completed = new AtomicInteger(0);
    CountDownLatch ready = new CountDownLatch(workers);

    Supplier<MemoryUsage> supplier = () -> new MemoryUsage(0L, usedRef.get(), 100L, 100L);

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

      // Wait until the drainer is parked and the peer is queued on the lock, so the escape-valve
      // timeout installs a paced handoff (hasQueuedThreads()==true).
      await()
          .pollDelay(Duration.ZERO)
          .pollInterval(Duration.ofMillis(5))
          .atMost(Duration.ofSeconds(3))
          .until(() -> HeapBackpressure.gateQueueLength() == workers - 1);

      // Drainer times out and installs a paced handoff (engaged=true, deadline=0,
      // nextAdmission=now+pace); the queued worker acquires the lock and waits the pace under it.
      await()
          .pollDelay(Duration.ZERO)
          .pollInterval(Duration.ofMillis(5))
          .atMost(Duration.ofSeconds(3))
          .until(() -> completed.get() == 1);

      // While the queued worker is in its pace wait, drift the heap into the hysteresis band. Its
      // post-pace re-check sees the band (no pressure, no headroom) and must clear the stale
      // engaged + pace state and proceed, not wedge.
      usedRef.set(75L);

      await()
          .atMost(Duration.ofSeconds(3))
          .untilAsserted(() -> assertEquals(workers, completed.get(), "queued worker should exit"));
      assertFalse(HeapBackpressure.gateEngaged(), "stale engaged flag should be cleared in band");
      assertEquals(
          0L, HeapBackpressure.gateDeadlineMs(), "stale deadline should be cleared in band");
      assertEquals(0L, HeapBackpressure.nextAdmissionMs(), "stale pace should be cleared in band");
    } finally {
      pool.shutdownNow();
    }
  }

  /**
   * After a successful drain (headroom observed), the gate state must be cleared so a subsequent
   * pressure wave installs a fresh deadline rather than reusing a stale one. This guards against
   * the deadline silently shrinking to zero across episodes.
   *
   * <p>The assertion captures the freshly installed deadline <i>while the second pressure wave is
   * waiting in the drain loop</i> (from inside the heap-usage supplier, which runs under the gate
   * lock), and verifies it is a real, future-at-install-time deadline — not the stale {@code 0}
   * left over from the first call's clear. Without this capture the test would pass trivially
   * even if the second call were a no-op, because the post-call state ({@code engaged=false},
   * {@code deadline=0}) is identical to a no-op's result.
   */
  @Test
  void awaitHeadroom_afterDrainCompleted_newEngagementInstallsFreshDeadline() {
    HeapBackpressure.setMaxWaitMsForTest(1_500L);
    AtomicBoolean secondCall = new AtomicBoolean(false);
    AtomicLong capturedDeadline = new AtomicLong(0L);
    AtomicLong capturedAt = new AtomicLong(0L);
    AtomicInteger call = new AtomicInteger(0);
    Supplier<MemoryUsage> pressureThenHeadroom =
        () -> {
          int c = call.incrementAndGet();
          // Capture the largest in-flight deadline observed under the lock during the second
          // call, along with the wall-clock moment we observed it. The fast-path call (before
          // the lock is acquired) does not see the lock held and is excluded.
          if (secondCall.get() && HeapBackpressure.gateLockHeldByCurrentThread()) {
            long d = HeapBackpressure.gateDeadlineMs();
            if (d > capturedDeadline.get()) {
              capturedDeadline.set(d);
              capturedAt.set(System.currentTimeMillis());
            }
          }
          return new MemoryUsage(0L, c < 4 ? 85L : 60L, 100L, 100L);
        };

    // First call: drain then headroom — gate cleared.
    HeapBackpressure.awaitHeadroom(pressureThenHeadroom);
    assertFalse(HeapBackpressure.gateEngaged());
    assertEquals(0L, HeapBackpressure.gateDeadlineMs());

    // Second call: with the gate cleared, the gate must install a FRESH deadline when it sees
    // pressure. Capture it from inside the drain loop so we can assert it was real.
    secondCall.set(true);
    call.set(0);
    long beforeSecond = System.currentTimeMillis();
    HeapBackpressure.awaitHeadroom(pressureThenHeadroom);
    long afterSecond = System.currentTimeMillis();

    long captured = capturedDeadline.get();
    assertTrue(
        captured > 0L,
        "second call must install a fresh deadline (captured=0 means none was installed)");
    assertTrue(
        captured > capturedAt.get(),
        "captured deadline must be in the future at the moment it was observed (captured="
            + captured
            + ", capturedAt="
            + capturedAt.get()
            + ") — a stale or zero deadline would fail this");
    assertTrue(
        captured > beforeSecond && captured <= afterSecond + 1_500L,
        "captured deadline must be a fresh deadline installed during the second call "
            + "(beforeSecond="
            + beforeSecond
            + ", captured="
            + captured
            + ", afterSecond="
            + afterSecond
            + ")");
    // The second call resolved to headroom and cleared state, exactly like the first.
    assertFalse(HeapBackpressure.gateEngaged());
    assertEquals(0L, HeapBackpressure.gateDeadlineMs());
  }

  /**
   * After a drain, queued workers must NOT all be admitted at once — each released worker's batch
   * read has to have time to reflect in heap usage before the next one is admitted, otherwise the
   * {@code N × batchSize} thundering-herd resume the gate exists to prevent just re-occurs across
   * the resume boundary. The paced handoff admits one worker per {@code releasePaceMs} window;
   * this test records each worker's admission timestamp and asserts the gaps between consecutive
   * admissions are at least the pace interval (with tolerance for scheduler jitter), so we are
   * checking the observable behaviour (reader admission after recovery) rather than internal call
   * choreography.
   */
  @Test
  void awaitHeadroom_multipleWorkersResumePacedOneAtATimeAfterDrain() throws Exception {
    int workers = 5;
    long paceMs = 80L;
    HeapBackpressure.setReleasePaceMsForTest(paceMs);
    AtomicLong usedRef = new AtomicLong(90L); // all workers initially sample under-pressure heap
    AtomicInteger completed = new AtomicInteger(0);
    CountDownLatch ready = new CountDownLatch(workers);
    AtomicLongArray admitNs = new AtomicLongArray(workers);
    AtomicInteger admitIndex = new AtomicInteger(0);

    Supplier<MemoryUsage> supplier = () -> new MemoryUsage(0L, usedRef.get(), 100L, 100L);

    ExecutorService pool = Executors.newFixedThreadPool(workers);
    try {
      for (int i = 0; i < workers; i++) {
        pool.submit(
            () -> {
              ready.countDown();
              HeapBackpressure.awaitHeadroom(supplier);
              admitNs.set(admitIndex.getAndIncrement(), System.nanoTime());
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

      // Wait until every other worker has reached the gate and is queued behind the drainer
      // on GATE_LOCK before lowering heap. ready.countDown() fires before a worker reaches the
      // gate, so a delayed starter could otherwise miss the lock queue, take the healthy-heap
      // fast path once we drop usedRef, and return < paceMs apart from a paced worker — failing
      // the spacing assertion even though the queued workers were paced correctly.
      await()
          .pollDelay(Duration.ZERO)
          .pollInterval(Duration.ofMillis(5))
          .atMost(Duration.ofSeconds(3))
          .until(() -> HeapBackpressure.gateQueueLength() == workers - 1);

      // Drop heap below RESUME_BELOW so the draining worker exits and installs the first pace.
      usedRef.set(60L);

      await()
          .atMost(Duration.ofSeconds(5))
          .untilAsserted(() -> assertEquals(workers, completed.get(), "all workers should exit"));

      // Sort the admission timestamps and assert consecutive admissions are spaced at least
      // paceMs apart (with tolerance). The first worker is the drainer and is admitted as soon
      // as heap drops; the remaining workers are admitted one per pace window.
      long[] ts = new long[workers];
      for (int i = 0; i < workers; i++) {
        ts[i] = admitNs.get(i);
      }
      Arrays.sort(ts);
      long toleranceMs = 30L; // scheduler jitter + Thread.sleep granularity
      for (int i = 1; i < workers; i++) {
        long gapMs = (ts[i] - ts[i - 1]) / 1_000_000L;
        assertTrue(
            gapMs >= paceMs - toleranceMs,
            "paced admission gap "
                + i
                + " = "
                + gapMs
                + "ms must be >= "
                + (paceMs - toleranceMs)
                + "ms (pace="
                + paceMs
                + "ms); without the paced handoff all workers would be "
                + "admitted within a single heap-poll interval");
      }
    } finally {
      pool.shutdownNow();
    }
  }

  /**
   * After a successful drain the released worker installs a paced admission handoff: engaged=true,
   * deadline cleared to 0, {@code nextAdmission=now+pace}. If the just-released worker's batch read
   * pushes the heap back above {@code PAUSE_ABOVE} before the next queued worker is admitted, that
   * worker — having waited out the pace under the lock — re-checks the heap, sees pressure, and
   * must NOT reuse the zero deadline (it would skip the drain loop and allocate alongside the
   * just-released worker, the exact OOM burst the gate exists to prevent). It must re-arm a fresh
   * deadline and drain. This test raises heap usage during the pace window and asserts the fresh
   * deadline is installed and observed in flight from inside the drain loop.
   */
  @Test
  void awaitHeadroom_pacedHandoff_pressureReturnsDuringPaceWindow_rearmsFreshDeadline()
      throws Exception {
    int workers = 2;
    long paceMs = 200L;
    HeapBackpressure.setReleasePaceMsForTest(paceMs);
    HeapBackpressure.setMaxWaitMsForTest(1_500L);
    AtomicLong usedRef = new AtomicLong(90L); // both workers initially sample under-pressure heap
    AtomicInteger completed = new AtomicInteger(0);
    CountDownLatch ready = new CountDownLatch(workers);
    AtomicLong capturedDeadline = new AtomicLong(0L);
    AtomicLong capturedAt = new AtomicLong(0L);

    Supplier<MemoryUsage> supplier =
        () -> {
          MemoryUsage usage = new MemoryUsage(0L, usedRef.get(), 100L, 100L);
          // Capture the largest in-flight deadline observed under the lock. The fast-path call
          // (before the lock is acquired) does not see the lock held and is excluded.
          if (HeapBackpressure.gateLockHeldByCurrentThread()) {
            long d = HeapBackpressure.gateDeadlineMs();
            if (d > capturedDeadline.get()) {
              capturedDeadline.set(d);
              capturedAt.set(System.currentTimeMillis());
            }
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

      // Wait until the first worker is parked in the drain loop and the second is queued on the
      // lock, so the paced handoff is guaranteed to install (hasQueuedThreads()==true).
      await()
          .pollDelay(Duration.ZERO)
          .pollInterval(Duration.ofMillis(5))
          .atMost(Duration.ofSeconds(3))
          .until(HeapBackpressure::gateEngaged);
      await()
          .pollDelay(Duration.ZERO)
          .pollInterval(Duration.ofMillis(5))
          .atMost(Duration.ofSeconds(3))
          .until(() -> HeapBackpressure.gateQueueLength() == workers - 1);

      // Drainer exits: drops heap to headroom, installs paced handoff (engaged=true, deadline=0,
      // nextAdmission=now+pace), releases the lock, and completes.
      usedRef.set(60L);

      // Wait for the drainer to release and complete; the second worker then acquires the lock
      // and enters its pace wait (under the lock) for the full paceMs window. The pace wait does
      // not call the usage supplier, so no deadline capture happens during this window.
      await()
          .pollDelay(Duration.ZERO)
          .pollInterval(Duration.ofMillis(5))
          .atMost(Duration.ofSeconds(3))
          .until(() -> completed.get() == 1);

      // Drop the deadline captured during the first worker's drain so the wait below can only
      // succeed on a deadline the second worker installs in its own drain. Without this reset the
      // wait would pass on the first drain's stale capture and the test would not detect a revert
      // of the zero-deadline re-arm fix (the second worker would skip its drain, never install a
      // fresh deadline, and capturedDeadline would still be > 0 from worker 1).
      capturedDeadline.set(0L);
      capturedAt.set(0L);

      // Raise heap back above PAUSE_ABOVE while the second worker is still inside its pace wait,
      // so its post-pace re-check observes pressure. With paceMs=200ms there is a wide margin
      // between the drainer's release and the second worker's post-pace heap re-check.
      usedRef.set(90L);

      // Assert the second worker re-armed a fresh deadline and entered the drain loop (the
      // supplier under the lock observed it). Without the fix the deadline would stay at 0 and
      // the worker would skip the drain and allocate immediately — capturedDeadline stays 0 and
      // this wait times out, failing the test.
      await()
          .pollDelay(Duration.ZERO)
          .pollInterval(Duration.ofMillis(5))
          .atMost(Duration.ofSeconds(3))
          .until(() -> capturedDeadline.get() > 0L);
      long captured = capturedDeadline.get();
      assertTrue(
          captured > capturedAt.get(),
          "captured deadline must be in the future at capture time (captured="
              + captured
              + ", capturedAt="
              + capturedAt.get()
              + ") — a zero/reused deadline would fail this");
      assertTrue(
          HeapBackpressure.gateEngaged(),
          "gate must remain engaged while the second worker drains under the re-armed deadline");

      // Let the second worker finish: drop heap to headroom so its drain loop exits.
      usedRef.set(60L);

      await()
          .atMost(Duration.ofSeconds(5))
          .untilAsserted(() -> assertEquals(workers, completed.get(), "all workers should exit"));
    } finally {
      pool.shutdownNow();
    }
  }

  /**
   * Reset guardrail: explicitly restores production poll/escape-valve/pace values so a later test
   * running in the same JVM (e.g. a sibling @Test elsewhere) does not see the test-shrunk values
   * leak across. Even though {@link #resetGateState()} re-applies them, this is cheap insurance
   * against partial isolation if a future test bypasses {@code @BeforeEach}.
   */
  @org.junit.jupiter.api.AfterEach
  void restoreProductionCadence() {
    HeapBackpressure.resetGateStateForTest();
    HeapBackpressure.setPollMsForTest(PROD_POLL_MS);
    HeapBackpressure.setMaxWaitMsForTest(PROD_MAX_WAIT_MS);
    HeapBackpressure.setReleasePaceMsForTest(PROD_RELEASE_PACE_MS);
  }
}
