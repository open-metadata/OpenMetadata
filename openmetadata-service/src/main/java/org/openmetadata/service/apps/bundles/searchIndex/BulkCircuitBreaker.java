package org.openmetadata.service.apps.bundles.searchIndex;

import java.util.Iterator;
import java.util.concurrent.ConcurrentLinkedDeque;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicReference;
import lombok.extern.slf4j.Slf4j;

/**
 * Sliding-window circuit breaker for bulk search-index requests.
 *
 * <p>State transitions: CLOSED → OPEN (after N failed bulk requests in the window) → HALF_OPEN
 * (after the probe interval, one request probes the cluster) → CLOSED (probe succeeded) or back to
 * OPEN (probe failed).
 *
 * <p>An open circuit pauses bulks rather than failing them: callers hold a rejected bulk and offer
 * it again when {@link #millisUntilProbe()} says a probe may run, until the bulk's own deadline
 * passes. ADR:2026-10-27-bulk-requests-never-outnumber-search-connections
 */
@Slf4j
public class BulkCircuitBreaker {

  public enum State {
    CLOSED,
    OPEN,
    HALF_OPEN
  }

  /**
   * A probe that has not reported back within this many probe intervals is presumed lost (its
   * callback may never fire), and another request may probe instead.
   */
  private static final int PROBE_TIMEOUT_INTERVALS = 3;

  private static final long NO_PROBE = -1L;

  private final int failureThreshold;
  private final long windowMs;
  private final long halfOpenProbeMs;

  private final AtomicReference<State> state = new AtomicReference<>(State.CLOSED);
  private final ConcurrentLinkedDeque<Long> failureTimestamps = new ConcurrentLinkedDeque<>();

  /** When the current probe was sent, or {@link #NO_PROBE}; one compare-and-set claims the slot. */
  private final AtomicLong probeStartedAt = new AtomicLong(NO_PROBE);

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

  /** CLOSED admits everything; an open circuit admits one probe once the probe interval passes. */
  public boolean allowRequest() {
    return switch (state.get()) {
      case CLOSED -> true;
      case OPEN -> isProbeDue() && enterHalfOpen() && claimProbe();
      case HALF_OPEN -> claimProbe();
    };
  }

  public void recordSuccess() {
    if (state.compareAndSet(State.HALF_OPEN, State.CLOSED)) {
      failureTimestamps.clear();
      releaseProbe();
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
        releaseProbe();
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

  /**
   * Records a failed send attempt. A request that only timed out waiting for a pooled connection
   * never reached the cluster, so it says nothing about cluster health and frees the probe slot.
   * Otherwise a bulk request counts once, on its first attempt, so one bulk's retries cannot open
   * the circuit on their own; a failure while half-open is the probe's verdict and always counts.
   */
  public void recordBulkFailure(Throwable error, int attemptNumber) {
    if (BulkConnectionBudget.isPoolWaitTimeout(error)) {
      releaseProbe();
    } else if (attemptNumber == 0 || state.get() == State.HALF_OPEN) {
      recordFailure();
    }
  }

  /** Milliseconds until an open circuit lets a probe through; 0 when it is not open. */
  public long millisUntilProbe() {
    long remaining = openedAt + halfOpenProbeMs - System.currentTimeMillis();
    return state.get() == State.OPEN ? Math.max(0, remaining) : 0;
  }

  public State getState() {
    return state.get();
  }

  public void reset() {
    state.set(State.CLOSED);
    failureTimestamps.clear();
    releaseProbe();
  }

  private boolean isProbeDue() {
    return System.currentTimeMillis() - openedAt >= halfOpenProbeMs;
  }

  private boolean enterHalfOpen() {
    if (state.compareAndSet(State.OPEN, State.HALF_OPEN)) {
      LOG.warn("Circuit breaker transitioning OPEN → HALF_OPEN (probe request allowed)");
      recordTransition("open_to_half_open");
    }
    return state.get() == State.HALF_OPEN;
  }

  /** Claims the probe slot when it is free or its probe is presumed lost; one caller wins. */
  private boolean claimProbe() {
    long now = System.currentTimeMillis();
    long current = probeStartedAt.get();
    boolean slotFree =
        current == NO_PROBE || now - current >= PROBE_TIMEOUT_INTERVALS * halfOpenProbeMs;
    return slotFree && probeStartedAt.compareAndSet(current, now);
  }

  private void releaseProbe() {
    probeStartedAt.set(NO_PROBE);
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
