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
import static org.assertj.core.api.Assertions.within;

import java.util.concurrent.TimeUnit;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;

/**
 * The histogram replaces exact samples with buckets, so the published percentiles must stay within
 * the bucket precision of what {@link LatencySampler} would report over the same values.
 */
class LatencyHistogramTest {

  private static final double ONE_BUCKET = LatencyHistogram.GROWTH - 1;

  @Test
  void percentilesTrackTheExactNearestRankValuesWithinOneBucket() {
    final LatencyHistogram histogram = new LatencyHistogram();
    final long[] samples = new long[1000];
    for (int index = 0; index < samples.length; index++) {
      samples[index] = index + 1;
      histogram.record(TimeUnit.MILLISECONDS.toNanos(index + 1));
    }

    final Latency bucketed = histogram.toLatency();
    final Latency exact = LatencySampler.reduce(samples, 0);

    assertThat(bucketed.p50Millis()).isCloseTo(exact.p50Millis(), within(bound(exact.p50Millis())));
    assertThat(bucketed.p95Millis()).isCloseTo(exact.p95Millis(), within(bound(exact.p95Millis())));
    assertThat(bucketed.p99Millis()).isCloseTo(exact.p99Millis(), within(bound(exact.p99Millis())));
    assertThat(bucketed.maxMillis()).isEqualTo(1000);
    assertThat(bucketed.meanMillis()).isEqualTo(500.5);
    assertThat(bucketed.sampleCount()).isEqualTo(1000);
  }

  @Test
  void aSingleSlowCallIsTheTailNotTheMedian() {
    final LatencyHistogram histogram = new LatencyHistogram();
    IntStream.range(0, 99).forEach(index -> histogram.record(TimeUnit.MILLISECONDS.toNanos(10)));
    histogram.record(TimeUnit.SECONDS.toNanos(5));

    final Latency latency = histogram.toLatency();

    assertThat(latency.p50Millis()).isCloseTo(10, within(1L));
    assertThat(latency.p95Millis()).isCloseTo(10, within(1L));
    assertThat(latency.maxMillis()).isEqualTo(5000);
  }

  @Test
  void neverReportsAPercentileAboveTheSlowestCall() {
    final LatencyHistogram histogram = new LatencyHistogram();
    histogram.record(TimeUnit.MILLISECONDS.toNanos(7));

    final Latency latency = histogram.toLatency();

    assertThat(latency.p99Millis()).isLessThanOrEqualTo(latency.maxMillis());
  }

  @Test
  void callsSlowerThanTheTrackedRangeLandInTheLastBucketButKeepAnExactMax() {
    final LatencyHistogram histogram = new LatencyHistogram();
    histogram.record(TimeUnit.HOURS.toNanos(3));

    assertThat(histogram.toLatency().maxMillis()).isEqualTo(TimeUnit.HOURS.toMillis(3));
    assertThat(LatencyHistogram.bucketOf(TimeUnit.HOURS.toMicros(3)))
        .isEqualTo(LatencyHistogram.bucketOf(LatencyHistogram.MAX_TRACKED_MICROS));
  }

  @Test
  void subMillisecondCallsRoundToZeroMillis() {
    final LatencyHistogram histogram = new LatencyHistogram();
    histogram.record(TimeUnit.MICROSECONDS.toNanos(300));

    assertThat(histogram.toLatency().p50Millis()).isZero();
  }

  @Test
  void refusesToReduceAnEmptyHistogram() {
    assertThatThrownBy(() -> new LatencyHistogram().toLatency())
        .isInstanceOf(IllegalStateException.class);
  }

  private static long bound(final long value) {
    return Math.max(1, Math.round(value * ONE_BUCKET));
  }
}
