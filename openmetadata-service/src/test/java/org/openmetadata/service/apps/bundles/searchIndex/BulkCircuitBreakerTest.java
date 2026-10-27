package org.openmetadata.service.apps.bundles.searchIndex;

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
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

    twoBulks.recordBulkFailure(rejected, 0);
    twoBulks.recordBulkFailure(rejected, 1);
    twoBulks.recordBulkFailure(rejected, 2);
    twoBulks.recordBulkFailure(rejected, 3);
    assertEquals(BulkCircuitBreaker.State.CLOSED, twoBulks.getState());

    twoBulks.recordBulkFailure(rejected, 0);
    assertEquals(BulkCircuitBreaker.State.OPEN, twoBulks.getState());
  }

  @Test
  @DisplayName("waiting for a pooled connection never opens the circuit")
  void poolWaitTimeoutsDoNotOpenTheCircuit() {
    BulkCircuitBreaker sensitive = new BulkCircuitBreaker(1, 5000, 1000);

    for (int attempt = 0; attempt < 5; attempt++) {
      sensitive.recordBulkFailure(poolWaitTimeout(), 0);
    }

    assertEquals(BulkCircuitBreaker.State.CLOSED, sensitive.getState());
  }

  @Test
  @DisplayName("a probe that only waited for the pool frees the probe slot without reopening")
  void probeThatNeverReachedTheClusterFreesTheProbeSlot() {
    BulkCircuitBreaker fastBreaker = new BulkCircuitBreaker(1, 5000, 50);
    fastBreaker.recordFailure();
    await().atMost(Duration.ofSeconds(2)).until(fastBreaker::allowRequest);

    fastBreaker.recordBulkFailure(poolWaitTimeout(), 3);

    assertEquals(BulkCircuitBreaker.State.HALF_OPEN, fastBreaker.getState());
    assertTrue(fastBreaker.allowRequest(), "another request may probe straight away");
  }

  @Test
  @DisplayName("a failed probe reopens the circuit even when it was a retry")
  void failedRetryProbeReopens() {
    BulkCircuitBreaker fastBreaker = new BulkCircuitBreaker(1, 5000, 50);
    fastBreaker.recordFailure();
    await().atMost(Duration.ofSeconds(2)).until(fastBreaker::allowRequest);

    fastBreaker.recordBulkFailure(new RuntimeException("es_rejected_execution_exception"), 3);

    assertEquals(BulkCircuitBreaker.State.OPEN, fastBreaker.getState());
  }

  @Test
  @DisplayName("callers learn how long an open circuit stays shut and how long they may pause")
  void reportsProbeDelayAndPauseLimit() {
    BulkCircuitBreaker pausing = new BulkCircuitBreaker(1, 5000, 1000, 200);
    assertEquals(0, pausing.millisUntilProbe());

    pausing.recordFailure();
    long untilProbe = pausing.millisUntilProbe();
    assertTrue(untilProbe > 0 && untilProbe <= 1000, "remaining open time, got " + untilProbe);

    long now = System.currentTimeMillis();
    assertFalse(pausing.hasPausedTooLong(now));
    assertTrue(pausing.hasPausedTooLong(now - 200));
  }

  @Test
  @DisplayName("rejects a non-positive pause limit")
  void rejectsNonPositivePauseLimit() {
    assertThrows(IllegalArgumentException.class, () -> new BulkCircuitBreaker(1, 5000, 50, 0));
  }

  private static DeadlineTimeoutException poolWaitTimeout() {
    return DeadlineTimeoutException.from(
        Deadline.fromUnixMilliseconds(System.currentTimeMillis() - 100));
  }
}
