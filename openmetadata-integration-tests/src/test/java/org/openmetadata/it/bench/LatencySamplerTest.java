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

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * The percentile arithmetic here decides every published number, so it is tested against known
 * distributions rather than against the clock — {@link LatencySampler#reduce} exists to make that
 * possible without sleeping.
 */
class LatencySamplerTest {

  /** 1..100 sorted: nearest-rank p50 is the 50th value, p95 the 95th, p99 the 99th. */
  @Test
  void computesNearestRankPercentilesOverAHundredSamples() {
    final Latency latency = LatencySampler.reduce(ascending(100), 0);

    assertThat(latency.p50Millis()).isEqualTo(50);
    assertThat(latency.p95Millis()).isEqualTo(95);
    assertThat(latency.p99Millis()).isEqualTo(99);
    assertThat(latency.maxMillis()).isEqualTo(100);
    assertThat(latency.meanMillis()).isEqualTo(50.5);
  }

  @Test
  void sortsBeforeReducingSoSampleOrderDoesNotMatter() {
    final Latency ordered = LatencySampler.reduce(new long[] {1, 2, 3, 4, 5}, 0);
    final Latency shuffled = LatencySampler.reduce(new long[] {4, 1, 5, 3, 2}, 0);

    assertThat(shuffled).isEqualTo(ordered);
  }

  @Test
  void doesNotMutateTheCallersSampleArray() {
    final long[] samples = {9, 1, 5};

    LatencySampler.reduce(samples, 0);

    assertThat(samples).containsExactly(9, 1, 5);
  }

  /**
   * At the default sample count the tail percentiles collapse onto the top of the distribution.
   * This is a documented property, not a bug — but it must not drift silently, because a p99 that
   * is really the max is a very different claim.
   */
  @Test
  void atTwentySamplesP99IsTheMaxAndP95IsTheSecondHighest() {
    final Latency latency = LatencySampler.reduce(ascending(20), 0);

    assertThat(latency.p99Millis()).isEqualTo(latency.maxMillis()).isEqualTo(20);
    assertThat(latency.p95Millis()).isEqualTo(19);
  }

  @Test
  void clampsEveryPercentileToTheOnlySampleWhenThereIsOne() {
    final Latency latency = LatencySampler.reduce(new long[] {7}, 0);

    assertThat(latency.p50Millis()).isEqualTo(7);
    assertThat(latency.p95Millis()).isEqualTo(7);
    assertThat(latency.p99Millis()).isEqualTo(7);
    assertThat(latency.maxMillis()).isEqualTo(7);
  }

  @Test
  void neverIndexesPastTheEndForAnySampleCount() {
    for (int count = 1; count <= 200; count++) {
      final Latency latency = LatencySampler.reduce(ascending(count), 0);

      assertThat(latency.p99Millis()).isLessThanOrEqualTo(latency.maxMillis());
      assertThat(latency.p95Millis()).isLessThanOrEqualTo(latency.p99Millis());
      assertThat(latency.p50Millis()).isLessThanOrEqualTo(latency.p95Millis());
    }
  }

  @Test
  void rejectsAnEmptySampleSetRatherThanIndexingOutOfBounds() {
    assertThatThrownBy(() -> LatencySampler.reduce(new long[0], 0))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void recordsTheSampleAndWarmupCountsItWasGiven() {
    final Latency latency = LatencySampler.reduce(ascending(20), 5);

    assertThat(latency.sampleCount()).isEqualTo(20);
    assertThat(latency.warmupCount()).isEqualTo(5);
  }

  @Test
  void runsWarmupsThenSamplesAndNumbersEveryIterationContinuously() throws Exception {
    final List<Integer> iterations = new ArrayList<>();

    final Latency latency = LatencySampler.measure(3, 4, iterations::add);

    // Warmups are iterations 0-2 and measured runs 3-6: a scenario that varies a request
    // parameter by iteration relies on the measured runs never reusing a warmup's value.
    assertThat(iterations).containsExactly(0, 1, 2, 3, 4, 5, 6);
    assertThat(latency.sampleCount()).isEqualTo(4);
    assertThat(latency.warmupCount()).isEqualTo(3);
  }

  @Test
  void propagatesAFailingInteractionInsteadOfPublishingAFastNumber() {
    assertThatThrownBy(
            () ->
                LatencySampler.measure(
                    0,
                    3,
                    iteration -> {
                      throw new IllegalStateException("scene request failed");
                    }))
        .isInstanceOf(IllegalStateException.class)
        .hasMessage("scene request failed");
  }

  @Test
  void stagedMeasurementRunsSetupAndActionOncePerIterationAndClosesEverySubject() throws Exception {
    final List<String> events = new ArrayList<>();

    final Latency latency =
        LatencySampler.measureStaged(
            2,
            3,
            iteration -> {
              events.add("setup" + iteration);
              return () -> events.add("close" + iteration);
            },
            subject -> events.add("action"));

    assertThat(events)
        .containsExactly(
            "setup0", "action", "close0", "setup1", "action", "close1", "setup2", "action",
            "close2", "setup3", "action", "close3", "setup4", "action", "close4");
    assertThat(latency.sampleCount()).isEqualTo(3);
    assertThat(latency.warmupCount()).isEqualTo(2);
  }

  /** A leaked browser page per failed iteration would exhaust the run long before the suite ends. */
  @Test
  void stagedMeasurementClosesTheSubjectEvenWhenTheInteractionFails() {
    final List<String> events = new ArrayList<>();

    assertThatThrownBy(
            () ->
                LatencySampler.measureStaged(
                    0,
                    1,
                    iteration -> () -> events.add("closed"),
                    subject -> {
                      throw new IllegalStateException("drill never settled");
                    }))
        .isInstanceOf(IllegalStateException.class);

    assertThat(events).containsExactly("closed");
  }

  private static long[] ascending(final int count) {
    final long[] samples = new long[count];
    for (int index = 0; index < count; index++) {
      samples[index] = index + 1L;
    }
    return samples;
  }
}
