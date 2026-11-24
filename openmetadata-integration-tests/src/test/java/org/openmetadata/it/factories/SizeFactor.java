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

package org.openmetadata.it.factories;

/**
 * Scales the fixed seed cohorts of the heavy search and reindex ITs. Unset, {@code
 * jpw.sizeFactor} is 1.0 and every class seeds the size the nightly measures; the fast on-demand
 * run passes a small factor so the same classes finish in seconds.
 *
 * <p>openmetadata-nightly's k8s-java-it fast tier passes this property, and its plan script only
 * runs these classes at low scale on refs that contain this class. A rename has to change both.
 */
public final class SizeFactor {

  public static final String PROPERTY = "jpw.sizeFactor";

  // Below this a cohort no longer spans more than one reindex batch, so it stops exercising
  // batching, partitioning and the probes that run while a reindex is in flight.
  static final int FLOOR = 50;

  private SizeFactor() {}

  public static int scale(final int fullSize) {
    return scale(fullSize, System.getProperty(PROPERTY));
  }

  static int scale(final int fullSize, final String rawFactor) {
    final long scaled = Math.round(fullSize * parse(rawFactor));
    return (int) Math.min(Integer.MAX_VALUE, Math.max(Math.min(FLOOR, fullSize), scaled));
  }

  private static double parse(final String raw) {
    if (raw == null || raw.isBlank()) {
      return 1.0;
    }
    final double factor;
    try {
      factor = Double.parseDouble(raw.trim());
    } catch (NumberFormatException e) {
      throw invalid(raw, e);
    }
    if (!(factor > 0) || Double.isInfinite(factor)) {
      throw invalid(raw, null);
    }
    return factor;
  }

  private static IllegalArgumentException invalid(final String raw, final Throwable cause) {
    return new IllegalArgumentException(
        PROPERTY + " must be a positive number, got '" + raw + "'", cause);
  }
}
