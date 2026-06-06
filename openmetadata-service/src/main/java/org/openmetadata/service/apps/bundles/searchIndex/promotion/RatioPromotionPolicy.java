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
 * Per-entity reindex is "fully successful" when the per-record success ratio meets
 * {@code minSuccessRatio}. The policy's {@link Decision#fullySuccessful()} captures that
 * strict outcome; the caller hands it to {@code DefaultRecreateHandler.finalizeReindex} which
 * already has a doc-count rescue path for cases where strict success was missed but the staged
 * index still has data. Promotion is therefore unconditional at the policy level (the rescue
 * decides whether to keep or drop the staged index), and the success flag carries the operator-
 * visible "did this entity run cleanly" signal that {@code minSuccessRatio} controls.
 *
 * <p>The previous binary rule ({@code failedRecords == 0}) blocked the success signal on a
 * single failed record. The ratio gives operators a tunable strict bar; below it, the
 * downstream rescue still salvages a non-empty staged index.
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
      return new Decision(true, "no records scheduled; nothing to evaluate");
    }
    if (!context.allRecordsAccountedFor()) {
      return new Decision(
          false,
          "incomplete run: only %d of %d records processed; not fully successful"
              .formatted(
                  Math.max(
                      context.processedRecords(),
                      context.successRecords() + context.failedRecords()),
                  context.totalRecords()));
    }
    double ratio = context.successRatio();
    if (ratio >= minSuccessRatio) {
      return new Decision(
          true, "successRatio %.4f >= minSuccessRatio %.4f".formatted(ratio, minSuccessRatio));
    }
    return new Decision(
        false,
        "successRatio %.4f below threshold %.4f; DefaultRecreateHandler will rescue via doc-count"
            .formatted(ratio, minSuccessRatio));
  }
}
