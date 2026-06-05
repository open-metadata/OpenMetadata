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
package org.openmetadata.service.secrets;

import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

/**
 * Verifies the throttle that replaced the hand-rolled {@code Thread.sleep}: a no-op limiter never
 * blocks, the first permit is granted immediately, and back-to-back calls beyond the initial burst
 * are paced to the configured rate. Assertions are one-sided (lower bounds on the paced case, a
 * generous upper bound on the no-op case) so they cannot flake under CI scheduling jitter.
 */
class SecretsManagerRateLimiterTest {

  @Test
  void noOpLimiterNeverBlocks() {
    SecretsManagerRateLimiter limiter = SecretsManagerRateLimiter.noOp();

    long start = System.nanoTime();
    for (int i = 0; i < 1000; i++) {
      limiter.acquire();
    }
    long elapsedMillis = (System.nanoTime() - start) / 1_000_000;

    assertTrue(
        elapsedMillis < 200,
        "A no-op limiter must add no delay; 1000 acquires took " + elapsedMillis + "ms");
  }

  @Test
  void perSecondLimiterGrantsTheFirstPermitImmediately() {
    SecretsManagerRateLimiter limiter = SecretsManagerRateLimiter.perSecond(2.0);

    long start = System.nanoTime();
    limiter.acquire();
    long elapsedMillis = (System.nanoTime() - start) / 1_000_000;

    assertTrue(
        elapsedMillis < 100,
        "The first permit after creation should be granted without waiting, took "
            + elapsedMillis
            + "ms");
  }

  @Test
  void perSecondLimiterPacesCallsBeyondTheInitialBurst() {
    // At 5 permits/sec each permit past the first is spaced ~200ms apart, so three back-to-back
    // acquires must take noticeably longer than a single one (~400ms total).
    SecretsManagerRateLimiter limiter = SecretsManagerRateLimiter.perSecond(5.0);

    long start = System.nanoTime();
    limiter.acquire();
    limiter.acquire();
    limiter.acquire();
    long elapsedMillis = (System.nanoTime() - start) / 1_000_000;

    assertTrue(
        elapsedMillis >= 250,
        "Three acquires at 5/sec should be paced to at least ~400ms, took " + elapsedMillis + "ms");
  }
}
