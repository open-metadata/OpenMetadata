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

package org.openmetadata.service.util;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.function.LongSupplier;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;

@Slf4j
public final class StartupTimer {
  private final LongSupplier nanoTime;
  private final long startupStartNanos;
  private final List<StepTiming> stepTimings = new ArrayList<>();

  public StartupTimer() {
    this(System::nanoTime);
  }

  StartupTimer(LongSupplier nanoTime) {
    this.nanoTime = nanoTime;
    this.startupStartNanos = nanoTime.getAsLong();
  }

  public <T> T time(String step, Supplier<T> work) {
    long startNanos = nanoTime.getAsLong();
    try {
      return work.get();
    } finally {
      record(step, nanoTime.getAsLong() - startNanos);
    }
  }

  public void time(String step, Runnable work) {
    long startNanos = nanoTime.getAsLong();
    try {
      work.run();
    } finally {
      record(step, nanoTime.getAsLong() - startNanos);
    }
  }

  public void logSummary() {
    long elapsedMillis = toMillis(nanoTime.getAsLong() - startupStartNanos);
    LOG.info(
        "Startup timing summary: {} measured steps; {} ms elapsed",
        stepTimings.size(),
        elapsedMillis);
    stepTimings.stream()
        .sorted(Comparator.comparingLong(StepTiming::durationNanos).reversed())
        .forEach(
            timing ->
                LOG.info(
                    "Startup step '{}' took {} ms",
                    timing.step(),
                    toMillis(timing.durationNanos())));
  }

  private void record(String step, long durationNanos) {
    stepTimings.add(new StepTiming(step, durationNanos));
  }

  private static long toMillis(long durationNanos) {
    return TimeUnit.NANOSECONDS.toMillis(durationNanos);
  }

  private record StepTiming(String step, long durationNanos) {}
}
