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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class RatioPromotionPolicyTest {

  private static EntityPromotionContext ctx(long total, long success, long failed, long processed) {
    return new EntityPromotionContext("table", total, success, failed, processed);
  }

  private static EntityPromotionContext completeCtx(long total, long success, long failed) {
    return ctx(total, success, failed, success + failed);
  }

  @Test
  void fullySuccessfulAtOrAboveThreshold() {
    RatioPromotionPolicy policy = new RatioPromotionPolicy(0.95);

    assertTrue(
        policy.evaluate(completeCtx(100, 95, 5)).fullySuccessful(),
        "exactly at threshold must report fully successful");
    assertTrue(
        policy.evaluate(completeCtx(100, 100, 0)).fullySuccessful(),
        "100% must report fully successful");
  }

  @Test
  void notFullySuccessfulBelowThreshold() {
    RatioPromotionPolicy policy = new RatioPromotionPolicy(0.95);

    PromotionPolicy.Decision decision = policy.evaluate(completeCtx(100, 40, 60));

    assertFalse(
        decision.fullySuccessful(),
        "below threshold must NOT be fully successful — handler's doc-count rescue decides"
            + " whether the staged index is promoted");
    assertTrue(
        decision.reason().contains("rescue"),
        () -> "reason should mention the downstream rescue; got: " + decision.reason());
  }

  @Test
  void zeroSuccessRecordsNotFullySuccessful() {
    RatioPromotionPolicy policy = new RatioPromotionPolicy(0.95);

    assertFalse(policy.evaluate(completeCtx(100, 0, 100)).fullySuccessful());
  }

  @Test
  void noRecordsScheduledIsFullySuccessful() {
    RatioPromotionPolicy policy = new RatioPromotionPolicy(0.95);

    assertTrue(
        policy.evaluate(ctx(0, 0, 0, 0)).fullySuccessful(), "empty entity types are not failures");
  }

  @Test
  void incompleteRunIsNotFullySuccessfulEvenAtHighRatio() {
    RatioPromotionPolicy policy = new RatioPromotionPolicy(0.95);

    PromotionPolicy.Decision decision = policy.evaluate(ctx(100, 96, 0, 96));

    assertFalse(
        decision.fullySuccessful(),
        "only 96 of 100 records were processed — job stopped early; must NOT be fully"
            + " successful regardless of ratio over the processed subset");
    assertTrue(
        decision.reason().contains("incomplete run"),
        () -> "reason should call out the incomplete run explicitly; got: " + decision.reason());
  }

  @Test
  void defaultFactoryUsesNinetyFivePercentThreshold() {
    assertEquals(
        0.95d,
        RatioPromotionPolicy.withDefaultThreshold().minSuccessRatio(),
        "default threshold should be 0.95 — change in lockstep with eventPublisherJob.json");
  }

  @Test
  void rejectsConstructionOutsideUnitInterval() {
    assertThrows(IllegalArgumentException.class, () -> new RatioPromotionPolicy(-0.01));
    assertThrows(IllegalArgumentException.class, () -> new RatioPromotionPolicy(1.5));
  }

  @Test
  void successRatioComputedCorrectlyOnContext() {
    assertEquals(1.0d, ctx(0, 0, 0, 0).successRatio());
    assertEquals(0.5d, completeCtx(10, 5, 5).successRatio());
    assertEquals(0.95d, completeCtx(100, 95, 5).successRatio());
  }
}
