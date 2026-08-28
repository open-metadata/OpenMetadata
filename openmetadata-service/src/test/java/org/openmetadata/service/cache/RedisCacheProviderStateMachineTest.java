/*
 *  Copyright 2026 Collate
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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.concurrent.ConcurrentLinkedDeque;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * Focused unit tests for the {@link RedisCacheProvider} sliding-window availability state
 * machine. The flap pattern this fixes is documented in PR #27876:
 *
 * <ul>
 *   <li>Pre-fix: a single 300ms timeout flipped {@code available=false}; the next PING
 *       success flipped it back. Indexing paid the 300ms timeout per call indefinitely.
 *   <li>Post-fix: 5 failures within a 30s window are required before flipping unavailable;
 *       3 consecutive successes are required to flip back available.
 * </ul>
 *
 * <p>The state-mutating methods ({@code recordSuccess}, {@code recordFailure},
 * {@code pruneOldFailures}) are package-private-via-reflection. The transitions only depend
 * on the threshold constants and the failure deque, so we exercise them without a live Redis
 * connection.
 */
class RedisCacheProviderStateMachineTest {

  private RedisCacheProvider provider;

  @BeforeEach
  void setUp() throws Exception {
    // Use the package-private no-arg constructor that skips Redis IO. The state-machine
    // fields (failureTimestamps, consecutiveSuccesses, available) live on the instance and
    // are valid as soon as the object exists.
    provider = new RedisCacheProvider();
    setAvailable(true);
  }

  @Test
  void singleFailureDoesNotFlipUnavailable() throws Exception {
    recordFailure();
    assertTrue(provider.available(), "single failure must not flip unavailable");
    assertEquals(1, failureTimestamps().size());
  }

  @Test
  void belowThresholdFailuresStayAvailable() throws Exception {
    for (int i = 0; i < 4; i++) {
      recordFailure();
    }
    assertTrue(provider.available(), "4 failures (below threshold of 5) must stay available");
  }

  @Test
  void thresholdFailuresFlipUnavailable() throws Exception {
    for (int i = 0; i < 5; i++) {
      recordFailure();
    }
    assertFalse(provider.available(), "5 failures within window must flip unavailable");
  }

  @Test
  void successWhileAvailableTrimsWindow() throws Exception {
    for (int i = 0; i < 4; i++) {
      recordFailure();
    }
    assertTrue(provider.available());
    // Backdate every timestamp past the window so prune drops them all on the next success.
    long ancient = System.currentTimeMillis() - 60_000L;
    failureTimestamps().clear();
    failureTimestamps().add(ancient);
    failureTimestamps().add(ancient);
    recordSuccess();
    assertTrue(failureTimestamps().isEmpty(), "stale entries must be pruned");
    assertTrue(provider.available());
  }

  @Test
  void singleSuccessDoesNotFlipBackAvailable() throws Exception {
    flipUnavailableViaThreshold();
    recordSuccess();
    assertFalse(provider.available(), "single success after going unavailable must not recover");
  }

  @Test
  void recoveryThresholdSuccessesFlipBackAvailable() throws Exception {
    flipUnavailableViaThreshold();
    recordSuccess();
    assertFalse(provider.available());
    recordSuccess();
    assertFalse(provider.available());
    recordSuccess();
    assertTrue(provider.available(), "3 consecutive successes must recover");
    assertTrue(failureTimestamps().isEmpty(), "recovery clears the failure window");
  }

  @Test
  void interleavedFailureResetsRecoveryProgress() throws Exception {
    flipUnavailableViaThreshold();
    recordSuccess();
    recordSuccess();
    // A failure in the middle of recovery resets consecutiveSuccesses, so we need 3 fresh
    // successes after this point — proving recovery requires *consecutive*, not cumulative,
    // healthy ops.
    recordFailure();
    recordSuccess();
    recordSuccess();
    assertFalse(provider.available(), "interleaved failure must restart recovery counter");
    recordSuccess();
    assertTrue(provider.available(), "3 consecutive successes after interrupt must recover");
  }

  @Test
  void pruneOutOfOrderTimestamps() throws Exception {
    long now = System.currentTimeMillis();
    long ancient = now - 60_000L;
    long recent = now - 1000L;
    failureTimestamps().clear();
    // Out-of-order: ancient is enqueued *after* recent. The early-break-on-first-stale
    // implementation called out by gitar-bot would have stopped at index 0 (recent < ancient
    // is false, so it reaches ancient anyway in this ordering — but the more general case is
    // a recent timestamp appearing after an ancient one due to clock-sample / addLast race).
    failureTimestamps().add(recent);
    failureTimestamps().add(ancient);
    failureTimestamps().add(recent);
    pruneOldFailures(now);
    for (Long ts : failureTimestamps()) {
      assertTrue(ts >= now - 30_000L, () -> "stale timestamp left after prune: " + ts);
    }
  }

  // --- reflection helpers ---------------------------------------------------------------

  private void recordSuccess() throws Exception {
    Method m = RedisCacheProvider.class.getDeclaredMethod("recordSuccess");
    m.setAccessible(true);
    m.invoke(provider);
  }

  private void recordFailure() throws Exception {
    Method m = RedisCacheProvider.class.getDeclaredMethod("recordFailure", Exception.class);
    m.setAccessible(true);
    m.invoke(provider, new RuntimeException("test"));
  }

  private void pruneOldFailures(long now) throws Exception {
    Method m = RedisCacheProvider.class.getDeclaredMethod("pruneOldFailures", long.class);
    m.setAccessible(true);
    m.invoke(provider, now);
  }

  private void flipUnavailableViaThreshold() throws Exception {
    for (int i = 0; i < 5; i++) {
      recordFailure();
    }
    assertFalse(provider.available());
  }

  private void setAvailable(boolean value) throws Exception {
    Field f = RedisCacheProvider.class.getDeclaredField("available");
    f.setAccessible(true);
    f.setBoolean(provider, value);
  }

  @SuppressWarnings("unchecked")
  private ConcurrentLinkedDeque<Long> failureTimestamps() throws Exception {
    Field f = RedisCacheProvider.class.getDeclaredField("failureTimestamps");
    f.setAccessible(true);
    return (ConcurrentLinkedDeque<Long>) f.get(provider);
  }
}
