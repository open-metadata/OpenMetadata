package org.openmetadata.dsl.alerts;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.LongAdder;
import lombok.Data;

public class AlertExecutionMetrics {
  private final Map<UUID, AlertMetrics> alertMetrics = new ConcurrentHashMap<>();
  private final Map<UUID, ThrottleTracker> throttleTrackers = new ConcurrentHashMap<>();

  public void recordEvaluation(UUID alertId, long executionTime, boolean conditionMet) {
    AlertMetrics metrics = alertMetrics.computeIfAbsent(alertId, k -> new AlertMetrics());
    metrics.totalEvaluations.increment();
    metrics.totalExecutionTime.add(executionTime);

    if (conditionMet) {
      metrics.conditionMatches.increment();
    }

    metrics.lastEvaluationTime = System.currentTimeMillis();
  }

  public void recordAlertTriggered(UUID alertId) {
    AlertMetrics metrics = alertMetrics.computeIfAbsent(alertId, k -> new AlertMetrics());
    metrics.alertsTriggered.increment();
    metrics.lastTriggeredTime = System.currentTimeMillis();
  }

  public void recordError(UUID alertId, Exception error) {
    AlertMetrics metrics = alertMetrics.computeIfAbsent(alertId, k -> new AlertMetrics());
    metrics.errors.increment();
    metrics.lastError = error.getMessage();
    metrics.lastErrorTime = System.currentTimeMillis();
  }

  public boolean shouldThrottle(UUID alertId, Duration duration, int maxAlerts) {
    ThrottleTracker tracker = throttleTrackers.computeIfAbsent(alertId, k -> new ThrottleTracker());
    return tracker.shouldThrottle(duration, maxAlerts);
  }

  public AlertMetrics getMetrics(UUID alertId) {
    return alertMetrics.get(alertId);
  }

  public Map<UUID, AlertMetrics> getAllMetrics() {
    return new ConcurrentHashMap<>(alertMetrics);
  }

  @Data
  public static class AlertMetrics {
    private final LongAdder totalEvaluations = new LongAdder();
    private final LongAdder conditionMatches = new LongAdder();
    private final LongAdder alertsTriggered = new LongAdder();
    private final LongAdder errors = new LongAdder();
    private final LongAdder totalExecutionTime = new LongAdder();

    private volatile long lastEvaluationTime;
    private volatile long lastTriggeredTime;
    private volatile long lastErrorTime;
    private volatile String lastError;

    public long getTotalEvaluations() {
      return totalEvaluations.sum();
    }

    public long getConditionMatches() {
      return conditionMatches.sum();
    }

    public long getAlertsTriggered() {
      return alertsTriggered.sum();
    }

    public long getErrors() {
      return errors.sum();
    }

    public double getAverageExecutionTime() {
      long total = totalEvaluations.sum();
      return total > 0 ? (double) totalExecutionTime.sum() / total : 0.0;
    }

    public double getSuccessRate() {
      long total = totalEvaluations.sum();
      long successful = total - errors.sum();
      return total > 0 ? (double) successful / total : 0.0;
    }

    public double getMatchRate() {
      long total = totalEvaluations.sum();
      return total > 0 ? (double) conditionMatches.sum() / total : 0.0;
    }
  }

  private static class ThrottleTracker {
    private final Map<Long, AtomicLong> buckets = new ConcurrentHashMap<>();

    public boolean shouldThrottle(Duration duration, int maxAlerts) {
      long now = Instant.now().toEpochMilli();
      long bucketSize = duration.toMillis();
      long currentBucket = now / bucketSize;

      // Clean old buckets
      buckets.entrySet().removeIf(entry -> entry.getKey() < currentBucket - 1);

      // Get current bucket count
      AtomicLong currentCount = buckets.computeIfAbsent(currentBucket, k -> new AtomicLong(0));

      if (currentCount.get() >= maxAlerts) {
        return true; // Should throttle
      }

      currentCount.incrementAndGet();
      return false; // Should not throttle
    }
  }
}
