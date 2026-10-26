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

package org.openmetadata.it.tests.security.scale;

import java.util.Arrays;
import java.util.List;
import java.util.Locale;

/** Order statistics over raw samples; every figure comes from sorting, not from buckets. */
public final class Percentiles {
  private Percentiles() {}

  /** The nearest-rank percentile of {@code samples}; {@code percent} is 0 to 100. */
  public static double of(double[] samples, double percent) {
    double[] sorted = samples.clone();
    Arrays.sort(sorted);
    int rank = (int) Math.ceil(sorted.length * percent / 100.0);
    return sorted[Math.max(0, Math.min(sorted.length, rank) - 1)];
  }

  public static double median(List<Double> values) {
    return of(values.stream().mapToDouble(Double::doubleValue).toArray(), 50);
  }

  public static double min(List<Double> values) {
    return values.stream().mapToDouble(Double::doubleValue).min().orElse(Double.NaN);
  }

  public static double max(List<Double> values) {
    return values.stream().mapToDouble(Double::doubleValue).max().orElse(Double.NaN);
  }

  /** "median (min to max)" for a figure repeated across runs. */
  public static String spread(List<Double> values, String format) {
    return String.format(
        Locale.ROOT,
        format + " (" + format + " to " + format + ")",
        median(values),
        min(values),
        max(values));
  }
}
