package org.openmetadata.service.security;

import java.time.Duration;
import java.util.concurrent.TimeUnit;
import java.util.function.LongSupplier;

/** A token bucket: a burst of fetches, then one more each time the refill interval passes. */
final class FetchBudget {
  private final int burst;
  private final long refillIntervalNanos;
  private final LongSupplier nanoClock;
  private int available;
  private long lastRefillNanos;

  FetchBudget(int burst, Duration refillInterval, LongSupplier nanoClock) {
    this.burst = burst;
    this.refillIntervalNanos = refillInterval.toNanos();
    this.nanoClock = nanoClock;
    this.available = burst;
    this.lastRefillNanos = nanoClock.getAsLong();
  }

  synchronized boolean tryAcquire() {
    refill();
    boolean isAllowed = available > 0;
    if (isAllowed) {
      available--;
    }
    return isAllowed;
  }

  synchronized long millisUntilNextFetch() {
    refill();
    long waitNanos =
        available > 0 ? 0 : lastRefillNanos + refillIntervalNanos - nanoClock.getAsLong();
    return TimeUnit.NANOSECONDS.toMillis(Math.max(0, waitNanos));
  }

  private void refill() {
    long earned = (nanoClock.getAsLong() - lastRefillNanos) / refillIntervalNanos;
    if (earned > 0) {
      available = (int) Math.min(burst, available + earned);
      lastRefillNanos += earned * refillIntervalNanos;
    }
  }
}
