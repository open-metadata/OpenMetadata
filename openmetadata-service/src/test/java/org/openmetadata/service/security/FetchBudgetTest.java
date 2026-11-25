package org.openmetadata.service.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.Test;

class FetchBudgetTest {
  private static final Duration REFILL_INTERVAL = Duration.ofSeconds(6);

  private final AtomicLong nanos = new AtomicLong(1_000_000_000L);

  @Test
  void allowsTheBurstThenRefusesUntilTheIntervalPasses() {
    FetchBudget budget = new FetchBudget(2, REFILL_INTERVAL, nanos::get);

    assertTrue(budget.tryAcquire());
    assertTrue(budget.tryAcquire());
    assertFalse(budget.tryAcquire());
    assertEquals(REFILL_INTERVAL.toMillis(), budget.millisUntilNextFetch());
  }

  @Test
  void refillsOneFetchPerInterval() {
    FetchBudget budget = new FetchBudget(1, REFILL_INTERVAL, nanos::get);
    assertTrue(budget.tryAcquire());

    advance(REFILL_INTERVAL.minusMillis(1));
    assertFalse(budget.tryAcquire());
    advance(Duration.ofMillis(1));

    assertTrue(budget.tryAcquire());
    assertFalse(budget.tryAcquire());
  }

  @Test
  void neverRefillsBeyondTheBurst() {
    FetchBudget budget = new FetchBudget(2, REFILL_INTERVAL, nanos::get);

    advance(REFILL_INTERVAL.multipliedBy(10));

    assertTrue(budget.tryAcquire());
    assertTrue(budget.tryAcquire());
    assertFalse(budget.tryAcquire());
  }

  @Test
  void reportsNoWaitWhileAFetchIsAvailable() {
    FetchBudget budget = new FetchBudget(1, REFILL_INTERVAL, nanos::get);

    assertEquals(0, budget.millisUntilNextFetch());
  }

  private void advance(Duration duration) {
    nanos.addAndGet(duration.toNanos());
  }
}
