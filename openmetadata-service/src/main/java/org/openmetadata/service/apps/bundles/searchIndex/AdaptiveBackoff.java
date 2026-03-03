package org.openmetadata.service.apps.bundles.searchIndex;

/**
 * Replaces fixed-delay sleep in backpressure loops with exponential backoff. Starts at an initial
 * delay and doubles on each call up to a configurable maximum. Call {@link #reset()} when
 * backpressure clears so the next occurrence starts fresh.
 */
public class AdaptiveBackoff {

  private final long initialMs;
  private final long maxMs;
  private long currentMs;

  public AdaptiveBackoff(long initialMs, long maxMs) {
    if (initialMs <= 0) {
      throw new IllegalArgumentException("initialMs must be > 0");
    }
    if (maxMs < initialMs) {
      throw new IllegalArgumentException("maxMs must be >= initialMs");
    }
    this.initialMs = initialMs;
    this.maxMs = maxMs;
    this.currentMs = initialMs;
  }

  public long nextDelay() {
    long delay = currentMs;
    currentMs = Math.min(currentMs * 2, maxMs);
    return delay;
  }

  public void reset() {
    currentMs = initialMs;
  }
}
