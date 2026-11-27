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
package org.openmetadata.service.governance.workflows.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.openmetadata.service.governance.workflows.util.ChangePreviewUtils.PROPOSED_CHANGES_BASE_VERSION_KEY;
import static org.openmetadata.service.governance.workflows.util.ChangePreviewUtils.PROPOSED_CHANGES_KEY;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.OptionalDouble;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.DoubleSupplier;
import org.junit.jupiter.api.Test;

class ApprovalCycleTest {
  private static final double UNKNOWN_BASE = 0.2;

  private final AtomicInteger unknownReads = new AtomicInteger();
  private final DoubleSupplier unknownBase =
      () -> {
        unknownReads.incrementAndGet();
        return UNKNOWN_BASE;
      };

  @Test
  void theCycleBeginsAtTheEarliestOfTheTriggeringBaseAndEachCarriedBase() {
    double base =
        ApprovalCycle.baseVersion(
            OptionalDouble.of(0.7), carried(withBase(0.4), withBase(0.5)), unknownBase);

    assertEquals(0.4, base);
    assertEquals(0, unknownReads.get());
  }

  @Test
  void aTriggeringEditOlderThanTheCarriedTaskKeepsItsOwnBase() {
    assertEquals(
        0.3,
        ApprovalCycle.baseVersion(OptionalDouble.of(0.3), carried(withBase(0.6)), unknownBase));
  }

  @Test
  void tasksStoredBeforeBasesWereRecordedReadTheUnknownBaseOnce() {
    double base =
        ApprovalCycle.baseVersion(
            OptionalDouble.of(0.7),
            carried(Map.of(PROPOSED_CHANGES_KEY, Map.of()), Map.of(), null),
            unknownBase);

    assertEquals(UNKNOWN_BASE, base);
    assertEquals(1, unknownReads.get());
  }

  @Test
  void anOpeningTaskUsesAnEarlierApprovedBaseline() {
    assertEquals(
        UNKNOWN_BASE, ApprovalCycle.baseVersion(OptionalDouble.of(0.7), List.of(), unknownBase));
    assertEquals(1, unknownReads.get());
  }

  @Test
  void anOpeningTaskKeepsAnEarlierTriggeringBase() {
    assertEquals(0.1, ApprovalCycle.baseVersion(OptionalDouble.of(0.1), List.of(), unknownBase));
  }

  @Test
  void aRunWithoutATriggeringVersionBeginsAtTheUnknownBase() {
    assertEquals(
        UNKNOWN_BASE, ApprovalCycle.baseVersion(OptionalDouble.empty(), List.of(), unknownBase));
  }

  // Two runs that opened tasks at the same time each recorded their own base; whichever task is
  // superseded last, the survivor covers both.
  @Test
  void racingRunsAgreeOnTheEarlierBaseInEitherOrder() {
    assertEquals(
        0.3,
        ApprovalCycle.baseVersion(
            OptionalDouble.of(0.9), carried(withBase(0.3), withBase(0.6)), unknownBase));
    assertEquals(
        0.3,
        ApprovalCycle.baseVersion(
            OptionalDouble.of(0.9), carried(withBase(0.6), withBase(0.3)), unknownBase));
  }

  @Test
  void aRecordedBaseThatIsNotAVersionCountsAsUnknown() {
    double base =
        ApprovalCycle.baseVersion(
            OptionalDouble.of(0.7),
            carried(
                Map.of(PROPOSED_CHANGES_BASE_VERSION_KEY, -1.0),
                Map.of(PROPOSED_CHANGES_BASE_VERSION_KEY, Double.NaN),
                Map.of(PROPOSED_CHANGES_BASE_VERSION_KEY, "0.1")),
            unknownBase);

    assertEquals(UNKNOWN_BASE, base);
    assertEquals(1, unknownReads.get());
  }

  private static Map<String, Object> withBase(double base) {
    return Map.of(PROPOSED_CHANGES_BASE_VERSION_KEY, base);
  }

  private static List<Object> carried(Object... payloads) {
    return Arrays.asList(payloads);
  }
}
