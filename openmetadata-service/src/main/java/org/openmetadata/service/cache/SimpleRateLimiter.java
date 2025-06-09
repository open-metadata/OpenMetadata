/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.cache;

import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;
import lombok.extern.slf4j.Slf4j;

/**
 * Production-ready rate limiter implementation using token bucket algorithm.
 * This is a lightweight alternative to Guava's @Beta RateLimiter for production use.
 */
@Slf4j
public class SimpleRateLimiter {

  private final double permitsPerSecond;
  private final long nanosPerPermit;
  private final AtomicReference<Instant> nextFreeTicket;
  private final double maxStoredPermits;
  private final AtomicLong storedPermitsNanos;

  private SimpleRateLimiter(double permitsPerSecond) {
    this.permitsPerSecond = permitsPerSecond;
    this.nanosPerPermit = (long) (Duration.ofSeconds(1).toNanos() / permitsPerSecond);
    this.nextFreeTicket = new AtomicReference<>(Instant.now());
    this.maxStoredPermits = permitsPerSecond; // Allow burst up to 1 second worth
    this.storedPermitsNanos = new AtomicLong((long) (maxStoredPermits * nanosPerPermit));
  }

  /**
   * Create a rate limiter with the specified permits per second.
   *
   * @param permitsPerSecond the rate at which permits are replenished
   * @return a new RateLimiter instance
   */
  public static SimpleRateLimiter create(double permitsPerSecond) {
    if (permitsPerSecond <= 0.0) {
      throw new IllegalArgumentException("Rate must be positive, but was: " + permitsPerSecond);
    }
    return new SimpleRateLimiter(permitsPerSecond);
  }

  /**
   * Acquire a permit from this rate limiter, blocking until one is available.
   * This method is equivalent to {@code acquire(1)}.
   */
  public void acquire() {
    acquire(1);
  }

  /**
   * Acquire the given number of permits from this rate limiter, blocking until they are available.
   *
   * @param permits the number of permits to acquire
   */
  public void acquire(int permits) {
    if (permits <= 0) {
      throw new IllegalArgumentException("Permits must be positive, but was: " + permits);
    }

    long waitTimeNanos = reserve(permits);
    if (waitTimeNanos > 0) {
      try {
        Thread.sleep(waitTimeNanos / 1_000_000, (int) (waitTimeNanos % 1_000_000));
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
        throw new RuntimeException("Interrupted while waiting for permit", e);
      }
    }
  }

  /**
   * Try to acquire a permit without blocking.
   *
   * @return true if permit was acquired, false otherwise
   */
  public boolean tryAcquire() {
    return tryAcquire(1);
  }

  /**
   * Try to acquire the specified number of permits without blocking.
   *
   * @param permits the number of permits to try to acquire
   * @return true if permits were acquired, false otherwise
   */
  public boolean tryAcquire(int permits) {
    if (permits <= 0) {
      throw new IllegalArgumentException("Permits must be positive, but was: " + permits);
    }
    return reserve(permits) == 0;
  }

  /**
   * Reserve permits and return the wait time in nanoseconds.
   * This is the core algorithm using token bucket approach.
   */
  private long reserve(int permits) {
    synchronized (this) {
      Instant now = Instant.now();
      Instant nextFree = nextFreeTicket.get();

      // Replenish tokens based on elapsed time
      if (now.isAfter(nextFree)) {
        long elapsedNanos = Duration.between(nextFree, now).toNanos();
        long newPermitsNanos = Math.min(elapsedNanos, (long) (maxStoredPermits * nanosPerPermit));
        storedPermitsNanos.set(
            Math.min(
                storedPermitsNanos.get() + newPermitsNanos,
                (long) (maxStoredPermits * nanosPerPermit)));
        nextFreeTicket.set(now);
      }

      // Calculate cost in nanoseconds for requested permits
      long costNanos = permits * nanosPerPermit;
      long available = storedPermitsNanos.get();

      if (available >= costNanos) {
        // Can satisfy from stored permits
        storedPermitsNanos.addAndGet(-costNanos);
        return 0;
      } else {
        // Use all stored permits and wait for the rest
        long shortfallNanos = costNanos - available;
        storedPermitsNanos.set(0);
        nextFreeTicket.set(now.plusNanos(shortfallNanos));
        return shortfallNanos;
      }
    }
  }

  /**
   * Get the current rate of this rate limiter.
   *
   * @return the rate in permits per second
   */
  public double getRate() {
    return permitsPerSecond;
  }

  @Override
  public String toString() {
    return String.format("SimpleRateLimiter[rate=%.2f permits/sec]", permitsPerSecond);
  }
}
