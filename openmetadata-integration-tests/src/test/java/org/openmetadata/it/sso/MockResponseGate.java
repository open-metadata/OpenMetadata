package org.openmetadata.it.sso;

import java.time.Duration;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/**
 * Holds one mock response until the test releases it, so a test can line up concurrent requests
 * deterministically (for example two refreshes racing for the same session) or keep the server
 * under test waiting on its identity provider.
 */
public final class MockResponseGate {
  private static final Duration MAX_HOLD = Duration.ofMinutes(2);

  private final CountDownLatch arrived = new CountDownLatch(1);
  private final CountDownLatch released = new CountDownLatch(1);

  /** Blocks the mock's handler thread until {@link #release()}, or {@link #MAX_HOLD} passes. */
  public void holdResponse() {
    arrived.countDown();
    awaitQuietly(released, MAX_HOLD);
  }

  /** Waits until the held request has reached the mock. */
  public boolean awaitArrival(Duration timeout) {
    return awaitQuietly(arrived, timeout);
  }

  public void release() {
    released.countDown();
  }

  private static boolean awaitQuietly(CountDownLatch latch, Duration timeout) {
    try {
      return latch.await(timeout.toMillis(), TimeUnit.MILLISECONDS);
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      return false;
    }
  }
}
