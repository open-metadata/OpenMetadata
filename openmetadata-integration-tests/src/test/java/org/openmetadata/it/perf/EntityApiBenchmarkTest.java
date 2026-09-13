package org.openmetadata.it.perf;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.List;
import java.util.stream.LongStream;
import org.junit.jupiter.api.Test;
import org.openmetadata.it.perf.EntityApiBenchmark.Measurement;
import org.openmetadata.it.perf.EntityApiBenchmark.Sampling;

class EntityApiBenchmarkTest {
  @Test
  void usesNearestRankPercentilesWithoutExposingMutableSamples() {
    final long[] values = LongStream.rangeClosed(1, 100).map(value -> value * 1_000_000).toArray();
    final Measurement measurement = new Measurement(values, 0, 1, List.of());
    values[49] = 0;
    measurement.sortedNanoseconds()[49] = 0;

    assertEquals(50, measurement.percentile(0.5));
    assertEquals(95, measurement.percentile(0.95));
    assertEquals(99, measurement.percentile(0.99));
    assertEquals(1, measurement.percentile(0));
    assertEquals(100, measurement.percentile(1));
  }

  @Test
  void emptyWarmupIsAllowedButInvalidPercentilesAreRejected() {
    final Measurement empty = new Measurement(new long[0], 0, 0, List.of());
    assertEquals(0, empty.percentile(0.99));
    assertThrows(IllegalArgumentException.class, () -> empty.percentile(Double.NaN));
    assertThrows(IllegalArgumentException.class, () -> empty.percentile(-1));
    assertThrows(IllegalArgumentException.class, () -> empty.percentile(1.1));
  }

  @Test
  void samplingRejectsUnboundedCountsAndInvalidRates() {
    assertThrows(IllegalArgumentException.class, () -> new Sampling(0, 0, 1));
    assertThrows(IllegalArgumentException.class, () -> new Sampling(100_001, 0, 1));
    assertThrows(IllegalArgumentException.class, () -> new Sampling(1, 100_001, 1));
    assertThrows(IllegalArgumentException.class, () -> new Sampling(1, -1, 1));
    assertThrows(IllegalArgumentException.class, () -> new Sampling(1, 0, Double.NaN));
    assertThrows(IllegalArgumentException.class, () -> new Sampling(1, 0, 0));
    assertThrows(
        IllegalArgumentException.class, () -> new Sampling(1, 0, Double.POSITIVE_INFINITY));
  }
}
