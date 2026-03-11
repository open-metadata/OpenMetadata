/*
 *  Copyright 2025 Collate
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

package org.openmetadata.service.monitoring;

import com.google.common.cache.Cache;
import com.google.common.cache.CacheBuilder;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.Consumer;
import javax.inject.Inject;
import javax.inject.Singleton;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.services.ingestionPipelines.OperationMetricsBatch;
import org.openmetadata.schema.entity.services.ingestionPipelines.ProgressUpdate;

@Slf4j
@Singleton
public class IngestionProgressTracker {

  private final MeterRegistry meterRegistry;

  private final Cache<String, ProgressState> activeProgress;

  private final Map<String, List<Consumer<ProgressUpdate>>> progressListeners;

  private final Cache<String, List<OperationMetricsBatch>> metricsBuffer;

  private final Counter progressUpdatesReceived;
  private final Counter metricsBatchesReceived;
  private final AtomicInteger activeProgressStreams;

  @Inject
  public IngestionProgressTracker(MeterRegistry meterRegistry) {
    this.meterRegistry = meterRegistry;

    this.activeProgress =
        CacheBuilder.newBuilder().maximumSize(500).expireAfterAccess(1, TimeUnit.HOURS).build();

    this.progressListeners = new ConcurrentHashMap<>();

    this.metricsBuffer =
        CacheBuilder.newBuilder().maximumSize(500).expireAfterAccess(1, TimeUnit.HOURS).build();

    this.progressUpdatesReceived =
        Counter.builder("om_ingestion_progress_updates_total")
            .description("Total progress updates received")
            .register(meterRegistry);

    this.metricsBatchesReceived =
        Counter.builder("om_operation_metrics_batches_total")
            .description("Total operation metrics batches received")
            .register(meterRegistry);

    this.activeProgressStreams = new AtomicInteger(0);
    Gauge.builder("om_active_progress_streams", activeProgressStreams, AtomicInteger::get)
        .description("Number of active progress SSE streams")
        .register(meterRegistry);
  }

  public void updateProgress(String pipelineFqn, UUID runId, ProgressUpdate update) {
    String key = buildKey(pipelineFqn, runId);
    progressUpdatesReceived.increment();

    try {
      ProgressState state = activeProgress.get(key, ProgressState::new);
      state.applyUpdate(update);
    } catch (Exception e) {
      LOG.warn("Error updating progress state: {}", e.getMessage());
    }

    notifyListeners(key, update);
  }

  public void addMetricsBatch(String pipelineFqn, UUID runId, OperationMetricsBatch batch) {
    String key = buildKey(pipelineFqn, runId);
    metricsBatchesReceived.increment();

    try {
      List<OperationMetricsBatch> batches = metricsBuffer.get(key, CopyOnWriteArrayList::new);
      batches.add(batch);
    } catch (Exception e) {
      LOG.warn("Error adding metrics batch: {}", e.getMessage());
    }
  }

  public List<OperationMetricsBatch> getAndClearMetricsBatches(String pipelineFqn, UUID runId) {
    String key = buildKey(pipelineFqn, runId);
    List<OperationMetricsBatch> batches = metricsBuffer.getIfPresent(key);
    metricsBuffer.invalidate(key);
    return batches;
  }

  public ProgressState getProgressState(String pipelineFqn, UUID runId) {
    String key = buildKey(pipelineFqn, runId);
    return activeProgress.getIfPresent(key);
  }

  public void registerProgressListener(
      String pipelineFqn, UUID runId, Consumer<ProgressUpdate> listener) {
    String key = buildKey(pipelineFqn, runId);
    progressListeners.computeIfAbsent(key, k -> new CopyOnWriteArrayList<>()).add(listener);
    activeProgressStreams.incrementAndGet();
  }

  public void unregisterProgressListener(
      String pipelineFqn, UUID runId, Consumer<ProgressUpdate> listener) {
    String key = buildKey(pipelineFqn, runId);
    List<Consumer<ProgressUpdate>> listeners = progressListeners.get(key);
    if (listeners != null) {
      listeners.remove(listener);
      activeProgressStreams.decrementAndGet();
      if (listeners.isEmpty()) {
        progressListeners.remove(key);
      }
    }
  }

  public void clearProgressState(String pipelineFqn, UUID runId) {
    String key = buildKey(pipelineFqn, runId);
    activeProgress.invalidate(key);
    metricsBuffer.invalidate(key);
    progressListeners.remove(key);
  }

  private void notifyListeners(String key, ProgressUpdate update) {
    List<Consumer<ProgressUpdate>> listeners = progressListeners.get(key);
    if (listeners != null) {
      for (Consumer<ProgressUpdate> listener : listeners) {
        try {
          listener.accept(update);
        } catch (Exception e) {
          LOG.warn("Error notifying progress listener: {}", e.getMessage());
        }
      }
    }
  }

  private String buildKey(String pipelineFqn, UUID runId) {
    return pipelineFqn + "/" + runId.toString();
  }

  public static class ProgressState {
    private volatile ProgressUpdate latestUpdate;
    private final Map<String, EntityProgressState> entityProgress = new ConcurrentHashMap<>();

    public void applyUpdate(ProgressUpdate update) {
      this.latestUpdate = update;
      if (update.getProgress() != null) {
        update
            .getProgress()
            .forEach(
                (entityType, progress) -> {
                  entityProgress
                      .computeIfAbsent(entityType, k -> new EntityProgressState())
                      .update(progress);
                });
      }
    }

    public ProgressUpdate getLatestUpdate() {
      return latestUpdate;
    }

    public Map<String, EntityProgressState> getEntityProgress() {
      return entityProgress;
    }

    public ProgressUpdate toProgressUpdate() {
      return latestUpdate;
    }
  }

  public static class EntityProgressState {
    private volatile int total;
    private volatile int processed;
    private volatile Integer estimatedRemainingSeconds;

    public void update(Object progress) {
      if (progress instanceof Map) {
        Map<?, ?> map = (Map<?, ?>) progress;
        if (map.get("total") != null) {
          this.total = ((Number) map.get("total")).intValue();
        }
        if (map.get("processed") != null) {
          this.processed = ((Number) map.get("processed")).intValue();
        }
        if (map.get("estimatedRemainingSeconds") != null) {
          this.estimatedRemainingSeconds =
              ((Number) map.get("estimatedRemainingSeconds")).intValue();
        }
      }
    }

    public int getTotal() {
      return total;
    }

    public int getProcessed() {
      return processed;
    }

    public Integer getEstimatedRemainingSeconds() {
      return estimatedRemainingSeconds;
    }
  }
}
