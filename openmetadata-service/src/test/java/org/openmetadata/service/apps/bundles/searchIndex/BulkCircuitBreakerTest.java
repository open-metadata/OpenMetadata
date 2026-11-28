package org.openmetadata.service.apps.bundles.searchIndex;

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import org.apache.hc.core5.util.Deadline;
import org.apache.hc.core5.util.DeadlineTimeoutException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("BulkCircuitBreaker Tests")
class BulkCircuitBreakerTest {

  private BulkCircuitBreaker breaker;

  @BeforeEach
  void setUp() {
    breaker = new BulkCircuitBreaker(3, 5000, 1000);
  }

  @Test
  @DisplayName("starts in CLOSED state")
  void startsInClosedState() {
    assertEquals(BulkCircuitBreaker.State.CLOSED, breaker.getState());
    assertTrue(breaker.allowRequest());
  }

  @Test
  @DisplayName("transitions CLOSED → OPEN after threshold failures in window")
  void closedToOpenOnThreshold() {
    breaker.recordFailure();
    breaker.recordFailure();
    assertEquals(BulkCircuitBreaker.State.CLOSED, breaker.getState());

    breaker.recordFailure();
    assertEquals(BulkCircuitBreaker.State.OPEN, breaker.getState());
    assertFalse(breaker.allowRequest());
  }

  @Test
  @DisplayName("transitions OPEN → HALF_OPEN after probe interval")
  void openToHalfOpenAfterInterval() {
    BulkCircuitBreaker fastBreaker = new BulkCircuitBreaker(1, 5000, 50);

    fastBreaker.recordFailure();
    assertEquals(BulkCircuitBreaker.State.OPEN, fastBreaker.getState());
    assertFalse(fastBreaker.allowRequest());

    try {
      Thread.sleep(60);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    }

    assertTrue(fastBreaker.allowRequest());
    assertEquals(BulkCircuitBreaker.State.HALF_OPEN, fastBreaker.getState());
  }

  @Test
  @DisplayName("transitions HALF_OPEN → CLOSED on success")
  void halfOpenToClosedOnSuccess() {
    BulkCircuitBreaker fastBreaker = new BulkCircuitBreaker(1, 5000, 50);

    fastBreaker.recordFailure();
    assertEquals(BulkCircuitBreaker.State.OPEN, fastBreaker.getState());

    try {
      Thread.sleep(60);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    }

    fastBreaker.allowRequest();
    assertEquals(BulkCircuitBreaker.State.HALF_OPEN, fastBreaker.getState());

    fastBreaker.recordSuccess();
    assertEquals(BulkCircuitBreaker.State.CLOSED, fastBreaker.getState());
    assertTrue(fastBreaker.allowRequest());
  }

  @Test
  @DisplayName("transitions HALF_OPEN → OPEN on failure")
  void halfOpenToOpenOnFailure() {
    BulkCircuitBreaker fastBreaker = new BulkCircuitBreaker(1, 5000, 50);

    fastBreaker.recordFailure();

    try {
      Thread.sleep(60);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    }

    fastBreaker.allowRequest();
    assertEquals(BulkCircuitBreaker.State.HALF_OPEN, fastBreaker.getState());

    fastBreaker.recordFailure();
    assertEquals(BulkCircuitBreaker.State.OPEN, fastBreaker.getState());
  }

  @Test
  @DisplayName("failures outside window do not count toward threshold")
  void expiryOutsideWindow() {
    BulkCircuitBreaker shortWindow = new BulkCircuitBreaker(3, 100, 1000);

    shortWindow.recordFailure();
    shortWindow.recordFailure();

    try {
      Thread.sleep(150);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
    }

    shortWindow.recordFailure();
    assertEquals(BulkCircuitBreaker.State.CLOSED, shortWindow.getState());
  }

  @Test
  @DisplayName("reset forces CLOSED state")
  void resetForcesClosed() {
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordFailure();
    assertEquals(BulkCircuitBreaker.State.OPEN, breaker.getState());

    breaker.reset();
    assertEquals(BulkCircuitBreaker.State.CLOSED, breaker.getState());
    assertTrue(breaker.allowRequest());
  }

  @Test
  @DisplayName("thread safety under concurrent access")
  void threadSafety() throws InterruptedException {
    BulkCircuitBreaker concurrentBreaker = new BulkCircuitBreaker(100, 10_000, 1000);
    int threadCount = 10;
    int failuresPerThread = 15;
    CountDownLatch latch = new CountDownLatch(threadCount);
    AtomicInteger allowedCount = new AtomicInteger(0);

    ExecutorService executor = Executors.newFixedThreadPool(threadCount);
    for (int i = 0; i < threadCount; i++) {
      executor.submit(
          () -> {
            try {
              for (int j = 0; j < failuresPerThread; j++) {
                concurrentBreaker.recordFailure();
                if (concurrentBreaker.allowRequest()) {
                  allowedCount.incrementAndGet();
                }
              }
            } finally {
              latch.countDown();
            }
          });
    }

    latch.await(5, TimeUnit.SECONDS);
    executor.shutdown();

    BulkCircuitBreaker.State finalState = concurrentBreaker.getState();
    assertTrue(
        finalState == BulkCircuitBreaker.State.OPEN
            || finalState == BulkCircuitBreaker.State.CLOSED);
  }

  @Test
  @DisplayName("half-open admits one probe at a time, then everything once it succeeds")
  void halfOpenAdmitsASingleProbe() {
    BulkCircuitBreaker fastBreaker = new BulkCircuitBreaker(1, 5000, 500);
    fastBreaker.recordFailure();

    await().atMost(Duration.ofSeconds(2)).until(fastBreaker::allowRequest);
    assertEquals(BulkCircuitBreaker.State.HALF_OPEN, fastBreaker.getState());
    assertFalse(fastBreaker.allowRequest(), "a second request must wait for the probe");

    fastBreaker.recordSuccess();
    assertTrue(fastBreaker.allowRequest());
    assertTrue(fastBreaker.allowRequest());
  }

  @Test
  @DisplayName("a probe that never reports back is replaced after three probe intervals")
  void lostProbeIsReplaced() {
    BulkCircuitBreaker fastBreaker = new BulkCircuitBreaker(1, 5000, 50);
    fastBreaker.recordFailure();
    await().atMost(Duration.ofSeconds(2)).until(fastBreaker::allowRequest);

    await()
        .atLeast(Duration.ofMillis(100))
        .atMost(Duration.ofSeconds(2))
        .until(fastBreaker::allowRequest);
    assertEquals(BulkCircuitBreaker.State.HALF_OPEN, fastBreaker.getState());
  }

  @Test
  @DisplayName("one bulk's retries count once toward opening the circuit")
  void retriesOfOneBulkCountOnce() {
    BulkCircuitBreaker twoBulks = new BulkCircuitBreaker(2, 5000, 1000);
    RuntimeException rejected = new RuntimeException("es_rejected_execution_exception");

    // One bulk: attempt 0 reaches the cluster and fails (counted); every real retry is suppressed.
    twoBulks.recordBulkFailure(rejected, false);
    twoBulks.recordBulkFailure(rejected, true);
    twoBulks.recordBulkFailure(rejected, true);
    twoBulks.recordBulkFailure(rejected, true);
    assertEquals(BulkCircuitBreaker.State.CLOSED, twoBulks.getState());

    // A second bulk's first real failure trips the threshold.
    twoBulks.recordBulkFailure(rejected, false);
    assertEquals(BulkCircuitBreaker.State.OPEN, twoBulks.getState());
  }

  @Test
  @DisplayName("waiting for a pooled connection never opens the circuit")
  void poolWaitTimeoutsDoNotOpenTheCircuit() {
    BulkCircuitBreaker sensitive = new BulkCircuitBreaker(1, 5000, 1000);

    for (int attempt = 0; attempt < 5; attempt++) {
      sensitive.recordBulkFailure(poolWaitTimeout(), false);
    }

    assertEquals(BulkCircuitBreaker.State.CLOSED, sensitive.getState());
  }

  @Test
  @DisplayName(
      "a real cluster error on a retry after a pool-wait first attempt counts while CLOSED")
  void realFailureOnRetryAfterPoolWaitCountsWhileClosed() {
    BulkCircuitBreaker twoBulks = new BulkCircuitBreaker(2, 5000, 1000);
    RuntimeException rejected = new RuntimeException("es_rejected_execution_exception");

    // Bulk A: attempt 0 timed out waiting for a pooled connection (ignored, bulk still uncounted),
    // then the retry reached the cluster and failed for real — the bulk's one verdict counts.
    twoBulks.recordBulkFailure(poolWaitTimeout(), false);
    twoBulks.recordBulkFailure(rejected, false);
    assertEquals(BulkCircuitBreaker.State.CLOSED, twoBulks.getState());

    // Bulk B: the same mixed profile contributes its one verdict and trips the threshold.
    twoBulks.recordBulkFailure(poolWaitTimeout(), false);
    twoBulks.recordBulkFailure(rejected, false);
    assertEquals(BulkCircuitBreaker.State.OPEN, twoBulks.getState());
  }

  @Test
  @DisplayName("a bulk counts at most once across pool-wait attempts and real-error retries")
  void aBulkCountsAtMostOnceAcrossPoolWaitThenRealRetries() {
    BulkCircuitBreaker twoBulks = new BulkCircuitBreaker(2, 5000, 1000);
    RuntimeException rejected = new RuntimeException("es_rejected_execution_exception");

    // pool-waits never count and never mark the bulk; the first real failure is the one verdict,
    // and later real retries stay suppressed.
    twoBulks.recordBulkFailure(poolWaitTimeout(), false);
    twoBulks.recordBulkFailure(poolWaitTimeout(), false);
    twoBulks.recordBulkFailure(rejected, false);
    twoBulks.recordBulkFailure(rejected, true);
    twoBulks.recordBulkFailure(rejected, true);
    assertEquals(BulkCircuitBreaker.State.CLOSED, twoBulks.getState());

    twoBulks.recordBulkFailure(rejected, false);
    assertEquals(BulkCircuitBreaker.State.OPEN, twoBulks.getState());
  }

  @Test
  @DisplayName("a pool-wait after a real failure does not reset the bulk's one-count memory")
  void poolWaitAfterRealFailureDoesNotResetTheBulkCount() {
    BulkCircuitBreaker twoBulks = new BulkCircuitBreaker(2, 5000, 1000);
    RuntimeException rejected = new RuntimeException("es_rejected_execution_exception");

    // attempt 0 real (counted), attempt 1 pool-wait (ignored, memory kept), attempt 2 real
    // (suppressed).
    twoBulks.recordBulkFailure(rejected, false);
    twoBulks.recordBulkFailure(poolWaitTimeout(), true);
    twoBulks.recordBulkFailure(rejected, true);
    assertEquals(BulkCircuitBreaker.State.CLOSED, twoBulks.getState());

    twoBulks.recordBulkFailure(rejected, false);
    assertEquals(BulkCircuitBreaker.State.OPEN, twoBulks.getState());
  }

  @Test
  @DisplayName("a probe that only waited for the pool frees the probe slot without reopening")
  void probeThatNeverReachedTheClusterFreesTheProbeSlot() {
    BulkCircuitBreaker fastBreaker = new BulkCircuitBreaker(1, 5000, 50);
    fastBreaker.recordFailure();
    await().atMost(Duration.ofSeconds(2)).until(fastBreaker::allowRequest);

    fastBreaker.recordBulkFailure(poolWaitTimeout(), false);

    assertEquals(BulkCircuitBreaker.State.HALF_OPEN, fastBreaker.getState());
    assertTrue(fastBreaker.allowRequest(), "another request may probe straight away");
  }

  @Test
  @DisplayName("a failed probe reopens the circuit even when it was a retry")
  void failedRetryProbeReopens() {
    BulkCircuitBreaker fastBreaker = new BulkCircuitBreaker(1, 5000, 50);
    fastBreaker.recordFailure();
    await().atMost(Duration.ofSeconds(2)).until(fastBreaker::allowRequest);

    // The probe always counts even though this bulk already opened the circuit once (counted):
    // the half-open verdict overrides the per-bulk "already counted" memory.
    fastBreaker.recordBulkFailure(new RuntimeException("es_rejected_execution_exception"), true);

    assertEquals(BulkCircuitBreaker.State.OPEN, fastBreaker.getState());
  }

  @Test
  @DisplayName("callers learn how long an open circuit stays shut")
  void reportsHowLongAnOpenCircuitStaysShut() {
    BulkCircuitBreaker pausing = new BulkCircuitBreaker(1, 5000, 1000);
    assertEquals(0, pausing.millisUntilProbe());

    pausing.recordFailure();
    long untilProbe = pausing.millisUntilProbe();
    assertTrue(untilProbe > 0 && untilProbe <= 1000, "remaining open time, got " + untilProbe);
  }

  @Test
  @DisplayName("callers racing for a half-open circuit get exactly one probe")
  void racingCallersShareASingleProbe() throws Exception {
    int callers = 32;
    ExecutorService pool = Executors.newFixedThreadPool(callers);
    try {
      for (int round = 0; round < 3; round++) {
        BulkCircuitBreaker racing = new BulkCircuitBreaker(1, 5000, 500);
        racing.recordFailure();
        await().atMost(Duration.ofSeconds(3)).until(() -> racing.millisUntilProbe() == 0);

        CountDownLatch start = new CountDownLatch(1);
        List<Future<Boolean>> admissions = new ArrayList<>();
        for (int caller = 0; caller < callers; caller++) {
          admissions.add(
              pool.submit(
                  () -> {
                    start.await();
                    return racing.allowRequest();
                  }));
        }
        start.countDown();

        int probes = 0;
        for (Future<Boolean> admission : admissions) {
          probes += admission.get(5, TimeUnit.SECONDS) ? 1 : 0;
        }
        assertEquals(1, probes, "round " + round + " let several probes through");
      }
    } finally {
      pool.shutdownNow();
    }
  }

  private static DeadlineTimeoutException poolWaitTimeout() {
    return DeadlineTimeoutException.from(
        Deadline.fromUnixMilliseconds(System.currentTimeMillis() - 100));
  }
}
