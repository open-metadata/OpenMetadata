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

package org.openmetadata.it.bench;

import java.util.Arrays;
import java.util.concurrent.TimeUnit;

/**
 * Runs a benchmark interaction {@code warmups + samples} times and reduces the measured runs to a
 * {@link Latency}.
 *
 * <p>Extracted from the sampling loop {@code OntologyScaleIT} and {@code
 * LineageImpactAnalysisBenchmarkIT} each grew independently, so every benchmark reports percentiles
 * the same way.
 */
public final class LatencySampler {

  private LatencySampler() {}

  public static Latency measure(
      final int warmups, final int samples, final BenchmarkInteraction interaction)
      throws Exception {
    for (int warmup = 0; warmup < warmups; warmup++) {
      interaction.run(warmup);
    }
    final long[] measured = new long[samples];
    for (int sample = 0; sample < samples; sample++) {
      final long startedAt = System.nanoTime();
      interaction.run(warmups + sample);
      measured[sample] = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startedAt);
    }
    return reduce(measured, warmups);
  }

  /**
   * Times only {@code action}, after an untimed {@code setup} per iteration.
   *
   * <p>UI interaction benchmarks need this: getting to the state an interaction starts from costs a
   * page load and a full first render, which at scale dwarfs the interaction itself. Folding that
   * into the sample would measure the wrong thing entirely. The subject is closed after every
   * iteration, so each sample starts from a genuinely fresh page.
   */
  public static <T extends AutoCloseable> Latency measureStaged(
      final int warmups,
      final int samples,
      final StagedSetup<T> setup,
      final StagedAction<T> action)
      throws Exception {
    final long[] measured = new long[samples];
    for (int iteration = 0; iteration < warmups + samples; iteration++) {
      final T subject = setup.prepare(iteration);
      try {
        final long startedAt = System.nanoTime();
        action.perform(subject);
        recordSample(measured, iteration, warmups, System.nanoTime() - startedAt);
      } finally {
        subject.close();
      }
    }
    return reduce(measured, warmups);
  }

  private static void recordSample(
      final long[] measured, final int iteration, final int warmups, final long elapsedNanos) {
    if (iteration >= warmups) {
      measured[iteration - warmups] = TimeUnit.NANOSECONDS.toMillis(elapsedNanos);
    }
  }

  /** Builds the state an interaction starts from. Not timed. */
  @FunctionalInterface
  public interface StagedSetup<T> {
    T prepare(int iteration) throws Exception;
  }

  /** The interaction under measurement. Timed. */
  @FunctionalInterface
  public interface StagedAction<T> {
    void perform(T subject) throws Exception;
  }

  /**
   * Reduces raw millisecond samples to a {@link Latency}. Separate from {@link #measure} so the
   * percentile arithmetic can be tested against known distributions instead of against the clock.
   */
  static Latency reduce(final long[] samples, final int warmups) {
    if (samples.length == 0) {
      throw new IllegalArgumentException("Cannot reduce an empty sample set");
    }
    final long[] sorted = samples.clone();
    Arrays.sort(sorted);
    return new Latency(
        sorted[percentileIndex(sorted.length, 0.50)],
        sorted[percentileIndex(sorted.length, 0.95)],
        sorted[percentileIndex(sorted.length, 0.99)],
        sorted[sorted.length - 1],
        Arrays.stream(sorted).average().orElse(0D),
        sorted.length,
        warmups);
  }

  /**
   * Nearest-rank percentile, clamped to the last index. Matches {@code OntologyScaleIT}. Note the
   * consequence at the default sample count: p99 over 20 samples IS the max, and p95 is the
   * second-highest. Raise {@code jpw.lineage.samples} before reading either as a true tail.
   */
  private static int percentileIndex(final int sampleCount, final double percentile) {
    return Math.min(sampleCount - 1, (int) Math.ceil(sampleCount * percentile) - 1);
  }
}
