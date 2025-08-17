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

package org.openmetadata.service.util;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.StringJoiner;
import lombok.extern.slf4j.Slf4j;

/**
 * Utility class for tracking performance metrics of operations.
 * Tracks elapsed time for different phases of an operation.
 */
@Slf4j
public class PerformanceTimer {
  private final String operation;
  private final Map<String, Long> timings = new LinkedHashMap<>();
  private final Map<String, Long> startTimes = new LinkedHashMap<>();
  private final long startTime;
  private long lastCheckpoint;
  private final long warningThresholdMs;

  public PerformanceTimer(String operation) {
    this(operation, 500); // Default warning threshold
  }

  public PerformanceTimer(String operation, long warningThresholdMs) {
    this.operation = operation;
    this.warningThresholdMs = warningThresholdMs;
    this.startTime = System.currentTimeMillis();
    this.lastCheckpoint = startTime;
  }

  public void startPhase(String phaseName) {
    startTimes.put(phaseName, System.currentTimeMillis());
  }

  public void endPhase(String phaseName) {
    Long start = startTimes.get(phaseName);
    if (start != null) {
      long duration = System.currentTimeMillis() - start;
      timings.put(phaseName, duration);
      startTimes.remove(phaseName);
    }
  }

  public void checkpoint(String phaseName) {
    long now = System.currentTimeMillis();
    long duration = now - lastCheckpoint;
    timings.put(phaseName, duration);
    lastCheckpoint = now;
  }

  public <T> T timePhase(String phaseName, java.util.function.Supplier<T> supplier) {
    startPhase(phaseName);
    try {
      return supplier.get();
    } finally {
      endPhase(phaseName);
    }
  }

  public void timePhase(String phaseName, Runnable runnable) {
    startPhase(phaseName);
    try {
      runnable.run();
    } finally {
      endPhase(phaseName);
    }
  }

  public void logIfSlow() {
    long totalTime = getTotalTime();
    if (totalTime > warningThresholdMs) {
      LOG.warn("Slow operation '{}': {}", operation, getTimingSummary());
    }
  }

  public void logDebug() {
    LOG.debug("Performance '{}': {}", operation, getTimingSummary());
  }

  public void logAlways() {
    LOG.warn("Performance '{}': {}", operation, getTimingSummary());
  }

  public String getOperation() {
    return operation;
  }

  public long getTotalTime() {
    return System.currentTimeMillis() - startTime;
  }

  public Long getPhaseTime(String phaseName) {
    return timings.get(phaseName);
  }

  public String getTimingSummary() {
    long totalTime = getTotalTime();
    StringJoiner details = new StringJoiner(", ");

    timings.forEach(
        (phase, duration) -> {
          long percentage = (duration * 100) / totalTime;
          details.add(String.format("%s: %dms (%d%%)", phase, duration, percentage));
        });

    return String.format("total: %dms [%s]", totalTime, details.toString());
  }

  public PerformanceTimer createChild(String childOperation) {
    return new PerformanceTimer(operation + "." + childOperation, warningThresholdMs);
  }
}
