/*
 *  Copyright 2026 Collate.
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
package org.openmetadata.service.apps.bundles.searchIndex.promotion;

/**
 * Promotes the staged index when the per-record success ratio meets {@code minSuccessRatio}. Any
 * staged index that contains at least one successful record is still promoted (a partial reindex
 * is strictly better than reverting to a stale live index), but the ratio decides whether we
 * surface the run as healthy or as "rescued".
 *
 * <p>The previous binary rule ({@code failedRecords == 0}) blocked promotion on a single failed
 * record, which combined with the doc-count fallback in {@code DefaultRecreateHandler} masked the
 * underlying issue. The ratio rule makes the threshold explicit.
 */
public class RatioPromotionPolicy implements PromotionPolicy {

  public static final double DEFAULT_MIN_SUCCESS_RATIO = 0.95d;

  private final double minSuccessRatio;

  public RatioPromotionPolicy(double minSuccessRatio) {
    if (minSuccessRatio < 0.0d || minSuccessRatio > 1.0d) {
      throw new IllegalArgumentException(
          "minSuccessRatio must be in [0.0, 1.0]; got " + minSuccessRatio);
    }
    this.minSuccessRatio = minSuccessRatio;
  }

  public static RatioPromotionPolicy withDefaultThreshold() {
    return new RatioPromotionPolicy(DEFAULT_MIN_SUCCESS_RATIO);
  }

  public double minSuccessRatio() {
    return minSuccessRatio;
  }

  @Override
  public Decision evaluate(EntityPromotionContext context) {
    if (context.totalRecords() <= 0L) {
      return new Decision(true, "no records scheduled; promoting empty staging is a no-op swap");
    }
    double ratio = context.successRatio();
    if (ratio >= minSuccessRatio) {
      return new Decision(
          true, "successRatio %.4f >= minSuccessRatio %.4f".formatted(ratio, minSuccessRatio));
    }
    if (context.successRecords() > 0L) {
      return new Decision(
          true,
          "successRatio %.4f below threshold %.4f but %d records indexed; partial promote"
              .formatted(ratio, minSuccessRatio, context.successRecords()));
    }
    return new Decision(false, "no successful records; rejecting promotion");
  }
}
