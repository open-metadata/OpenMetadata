package org.openmetadata.service.apps.bundles.searchIndex;

import java.util.ArrayList;
import java.util.List;
import lombok.extern.slf4j.Slf4j;

/**
 * The stop request of one reindex run, shared by every piece that takes part in it.
 *
 * <p>The pieces of a run are created one after another (orchestrator, strategy, executor, job),
 * and a stop can arrive at any moment in between. Each piece that must act on a stop registers
 * that action with {@link #onStop} when it is created. If the run was already stopped by then,
 * the action runs at once, so a stop never misses a piece that is created after it.
 */
@Slf4j
public final class ReindexStopSignal {
  private final List<Runnable> stopActions = new ArrayList<>();
  private boolean stopRequested;

  /** Stops the run. Runs every registered action once, on the calling thread. Idempotent. */
  public void requestStop() {
    markStoppedAndTakeActions().forEach(ReindexStopSignal::runSafely);
  }

  public synchronized boolean isStopRequested() {
    return stopRequested;
  }

  /** Runs {@code stopAction} when the run is stopped, or at once if it already is. */
  public void onStop(Runnable stopAction) {
    if (registerUnlessStopped(stopAction)) {
      runSafely(stopAction);
    }
  }

  private synchronized List<Runnable> markStoppedAndTakeActions() {
    List<Runnable> pending = stopRequested ? List.of() : List.copyOf(stopActions);
    stopRequested = true;
    stopActions.clear();
    return pending;
  }

  /** Returns whether the run was already stopped, in which case the action was not registered. */
  private synchronized boolean registerUnlessStopped(Runnable stopAction) {
    if (!stopRequested) {
      stopActions.add(stopAction);
    }
    return stopRequested;
  }

  private static void runSafely(Runnable stopAction) {
    try {
      stopAction.run();
    } catch (RuntimeException e) {
      LOG.error("A reindex stop action failed; the other stop actions still run", e);
    }
  }
}
