package org.openmetadata.service.apps.bundles.searchIndex;

import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CopyOnWriteArrayList;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.schema.system.StepStats;

/**
 * Composite pattern implementation for multiple progress listeners. Listeners are called in
 * priority order (lower priority value = called first). Each listener call is wrapped in try-catch
 * to prevent one listener's failure from affecting others.
 */
@Slf4j
public class CompositeProgressListener implements ReindexingProgressListener {

  private final List<ReindexingProgressListener> listeners = new CopyOnWriteArrayList<>();

  /** Add a progress listener. Listeners are automatically sorted by priority. */
  public void addListener(ReindexingProgressListener listener) {
    listeners.add(listener);
    listeners.sort(Comparator.comparingInt(ReindexingProgressListener::getPriority));
  }

  /** Remove a progress listener. */
  public void removeListener(ReindexingProgressListener listener) {
    listeners.remove(listener);
  }

  /** Get the number of registered listeners. */
  public int getListenerCount() {
    return listeners.size();
  }

  /** Clear all listeners. */
  public void clearListeners() {
    listeners.clear();
  }

  @Override
  public void onJobStarted(ReindexingJobContext context) {
    for (ReindexingProgressListener listener : listeners) {
      try {
        listener.onJobStarted(context);
      } catch (Exception e) {
        LOG.error("Listener {} failed on onJobStarted", listener.getClass().getSimpleName(), e);
      }
    }
  }

  @Override
  public void onJobConfigured(ReindexingJobContext context, ReindexingConfiguration config) {
    for (ReindexingProgressListener listener : listeners) {
      try {
        listener.onJobConfigured(context, config);
      } catch (Exception e) {
        LOG.error("Listener {} failed on onJobConfigured", listener.getClass().getSimpleName(), e);
      }
    }
  }

  @Override
  public void onIndexRecreationStarted(Set<String> entities) {
    for (ReindexingProgressListener listener : listeners) {
      try {
        listener.onIndexRecreationStarted(entities);
      } catch (Exception e) {
        LOG.error(
            "Listener {} failed on onIndexRecreationStarted",
            listener.getClass().getSimpleName(),
            e);
      }
    }
  }

  @Override
  public void onEntityTypeStarted(String entityType, long totalRecords) {
    for (ReindexingProgressListener listener : listeners) {
      try {
        listener.onEntityTypeStarted(entityType, totalRecords);
      } catch (Exception e) {
        LOG.error(
            "Listener {} failed on onEntityTypeStarted", listener.getClass().getSimpleName(), e);
      }
    }
  }

  @Override
  public void onProgressUpdate(Stats stats, ReindexingJobContext context) {
    for (ReindexingProgressListener listener : listeners) {
      try {
        listener.onProgressUpdate(stats, context);
      } catch (Exception e) {
        LOG.error("Listener {} failed on onProgressUpdate", listener.getClass().getSimpleName(), e);
      }
    }
  }

  @Override
  public void onEntityTypeCompleted(String entityType, StepStats entityStats) {
    for (ReindexingProgressListener listener : listeners) {
      try {
        listener.onEntityTypeCompleted(entityType, entityStats);
      } catch (Exception e) {
        LOG.error(
            "Listener {} failed on onEntityTypeCompleted", listener.getClass().getSimpleName(), e);
      }
    }
  }

  @Override
  public void onError(String entityType, IndexingError error, Stats currentStats) {
    for (ReindexingProgressListener listener : listeners) {
      try {
        listener.onError(entityType, error, currentStats);
      } catch (Exception e) {
        LOG.error("Listener {} failed on onError", listener.getClass().getSimpleName(), e);
      }
    }
  }

  @Override
  public void onJobCompleted(Stats finalStats, long elapsedMillis) {
    for (ReindexingProgressListener listener : listeners) {
      try {
        listener.onJobCompleted(finalStats, elapsedMillis);
      } catch (Exception e) {
        LOG.error("Listener {} failed on onJobCompleted", listener.getClass().getSimpleName(), e);
      }
    }
  }

  @Override
  public void onJobCompletedWithErrors(Stats finalStats, long elapsedMillis) {
    for (ReindexingProgressListener listener : listeners) {
      try {
        listener.onJobCompletedWithErrors(finalStats, elapsedMillis);
      } catch (Exception e) {
        LOG.error(
            "Listener {} failed on onJobCompletedWithErrors",
            listener.getClass().getSimpleName(),
            e);
      }
    }
  }

  @Override
  public void onJobFailed(Stats currentStats, Exception error) {
    for (ReindexingProgressListener listener : listeners) {
      try {
        listener.onJobFailed(currentStats, error);
      } catch (Exception e) {
        LOG.error("Listener {} failed on onJobFailed", listener.getClass().getSimpleName(), e);
      }
    }
  }

  @Override
  public void onJobStopped(Stats currentStats) {
    for (ReindexingProgressListener listener : listeners) {
      try {
        listener.onJobStopped(currentStats);
      } catch (Exception e) {
        LOG.error("Listener {} failed on onJobStopped", listener.getClass().getSimpleName(), e);
      }
    }
  }

  @Override
  public int getPriority() {
    return 0;
  }
}
