package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
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
}
