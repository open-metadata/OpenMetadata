package org.openmetadata.service.apps.bundles.searchIndex;

import java.util.Iterator;
import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.concurrent.atomic.AtomicReference;
import lombok.extern.slf4j.Slf4j;

/**
 * Sliding-window circuit breaker for bulk search-index requests.
 *
 * <p>State transitions: CLOSED → OPEN (after N failures in window) → HALF_OPEN (probe after
 * interval) → CLOSED (on probe success) or back to OPEN (on probe failure).
 */
@Slf4j
public class BulkCircuitBreaker {

  public enum State {
    CLOSED,
    OPEN,
    HALF_OPEN
  }

  private final int failureThreshold;
  private final long windowMs;
  private final long halfOpenProbeMs;

  private final AtomicReference<State> state = new AtomicReference<>(State.CLOSED);
  private final ConcurrentLinkedDeque<Long> failureTimestamps = new ConcurrentLinkedDeque<>();
  private volatile long openedAt;

  public BulkCircuitBreaker(int failureThreshold, long windowMs, long halfOpenProbeMs) {
    if (failureThreshold <= 0) {
      throw new IllegalArgumentException("failureThreshold must be > 0");
    }
    if (windowMs <= 0) {
      throw new IllegalArgumentException("windowMs must be > 0");
    }
    if (halfOpenProbeMs <= 0) {
      throw new IllegalArgumentException("halfOpenProbeMs must be > 0");
    }
    this.failureThreshold = failureThreshold;
    this.windowMs = windowMs;
    this.halfOpenProbeMs = halfOpenProbeMs;
  }

  public boolean allowRequest() {
    State current = state.get();
    if (current == State.CLOSED) {
      return true;
    }
    if (current == State.HALF_OPEN) {
      return true;
    }
    // OPEN: check if probe interval has elapsed
    if (System.currentTimeMillis() - openedAt >= halfOpenProbeMs) {
      if (state.compareAndSet(State.OPEN, State.HALF_OPEN)) {
        LOG.warn("Circuit breaker transitioning OPEN → HALF_OPEN (probe request allowed)");
        recordTransition("open_to_half_open");
      }
      return true;
    }
    return false;
  }

  public void recordSuccess() {
    if (state.compareAndSet(State.HALF_OPEN, State.CLOSED)) {
      failureTimestamps.clear();
      LOG.warn("Circuit breaker transitioning HALF_OPEN → CLOSED (probe succeeded)");
      recordTransition("half_open_to_closed");
    }
  }

  public void recordFailure() {
    long now = System.currentTimeMillis();

    State current = state.get();
    if (current == State.HALF_OPEN) {
      if (state.compareAndSet(State.HALF_OPEN, State.OPEN)) {
        openedAt = now;
        LOG.warn("Circuit breaker transitioning HALF_OPEN → OPEN (probe failed)");
        recordTransition("half_open_to_open");
      }
      return;
    }

    failureTimestamps.addLast(now);
    pruneOldFailures(now);

    if (failureTimestamps.size() >= failureThreshold
        && state.compareAndSet(State.CLOSED, State.OPEN)) {
      openedAt = now;
      LOG.warn(
          "Circuit breaker transitioning CLOSED → OPEN ({} failures in {}ms window)",
          failureThreshold,
          windowMs);
      recordTransition("closed_to_open");
    }
  }

  public State getState() {
    return state.get();
  }

  public void reset() {
    state.set(State.CLOSED);
    failureTimestamps.clear();
  }

  private void pruneOldFailures(long now) {
    long cutoff = now - windowMs;
    Iterator<Long> it = failureTimestamps.iterator();
    while (it.hasNext()) {
      if (it.next() < cutoff) {
        it.remove();
      } else {
        break;
      }
    }
  }

  private void recordTransition(String transition) {
    ReindexingMetrics metrics = ReindexingMetrics.getInstance();
    if (metrics != null) {
      metrics.recordCircuitBreakerTrip(transition);
    }
  }
}
