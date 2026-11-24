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

import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicLong;
import java.util.concurrent.atomic.AtomicLongArray;
import java.util.concurrent.atomic.LongAdder;

/**
 * A thread-safe latency histogram with logarithmic buckets and a fixed memory footprint.
 *
 * <p>{@link LatencySampler} keeps every sample, which is right for a benchmark's 20 samples and
 * wrong for passive API recording: a 100k-entity seed issues 100k calls to one route. Buckets grow
 * by {@link #GROWTH} per step, so a reported percentile is within about 1% of the true value, from
 * one microsecond up to {@link #MAX_TRACKED_MICROS}; anything slower lands in the last bucket. The
 * maximum and the mean are exact.
 *
 * <p>Percentiles use the same nearest-rank definition as {@link LatencySampler}, so the two kinds of
 * report read the same way.
 */
final class LatencyHistogram {

  static final double GROWTH = 1.02;
  static final long MAX_TRACKED_MICROS = TimeUnit.HOURS.toMicros(1);

  private static final double LOG_GROWTH = Math.log(GROWTH);
  private static final int BUCKETS = bucketOf(MAX_TRACKED_MICROS) + 1;
  private static final double MICROS_PER_MILLI = 1000.0;

  private final AtomicLongArray counts = new AtomicLongArray(BUCKETS);
  private final LongAdder totalMicros = new LongAdder();
  private final LongAdder samples = new LongAdder();
  private final AtomicLong maxMicros = new AtomicLong();

  void record(final long durationNanos) {
    final long micros = Math.max(0, TimeUnit.NANOSECONDS.toMicros(durationNanos));
    counts.incrementAndGet(bucketOf(micros));
    totalMicros.add(micros);
    samples.increment();
    maxMicros.accumulateAndGet(micros, Math::max);
  }

  long count() {
    return samples.sum();
  }

  /** Reduces the recorded samples to the published {@link Latency} shape. */
  Latency toLatency() {
    final long[] snapshot = snapshotCounts();
    final long total = sum(snapshot);
    if (total == 0) {
      throw new IllegalStateException("Cannot reduce an empty histogram");
    }
    return new Latency(
        percentileMillis(snapshot, total, 0.50),
        percentileMillis(snapshot, total, 0.95),
        percentileMillis(snapshot, total, 0.99),
        toMillis(maxMicros.get()),
        totalMicros.sum() / MICROS_PER_MILLI / samples.sum(),
        (int) Math.min(Integer.MAX_VALUE, total),
        0);
  }

  static int bucketOf(final long micros) {
    if (micros <= 1) {
      return 0;
    }
    final long clamped = Math.min(micros, MAX_TRACKED_MICROS);
    return (int) Math.floor(Math.log(clamped) / LOG_GROWTH);
  }

  /** The geometric middle of a bucket's range — at most half a step away from any value in it. */
  static long representativeMicros(final int bucket) {
    return Math.round(Math.pow(GROWTH, bucket + 0.5));
  }

  private long[] snapshotCounts() {
    final long[] snapshot = new long[BUCKETS];
    for (int bucket = 0; bucket < BUCKETS; bucket++) {
      snapshot[bucket] = counts.get(bucket);
    }
    return snapshot;
  }

  private long percentileMillis(final long[] snapshot, final long total, final double percentile) {
    final long rank = Math.max(1, (long) Math.ceil(total * percentile));
    long seen = 0;
    int bucket = 0;
    while (seen + snapshot[bucket] < rank) {
      seen += snapshot[bucket];
      bucket++;
    }
    // The top bucket's middle can overshoot the slowest real sample; never report past the max.
    return Math.min(toMillis(representativeMicros(bucket)), toMillis(maxMicros.get()));
  }

  private static long sum(final long[] values) {
    long total = 0;
    for (final long value : values) {
      total += value;
    }
    return total;
  }

  private static long toMillis(final long micros) {
    return Math.round(micros / MICROS_PER_MILLI);
  }
}
