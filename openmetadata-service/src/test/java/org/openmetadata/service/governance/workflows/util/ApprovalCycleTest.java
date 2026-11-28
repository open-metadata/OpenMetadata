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

import java.util.List;
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
    double base = ApprovalCycle.baseVersion(OptionalDouble.of(0.7), List.of(0.4, 0.5), unknownBase);

    assertEquals(0.4, base);
    assertEquals(0, unknownReads.get());
  }

  @Test
  void aTriggeringEditOlderThanTheCarriedTaskKeepsItsOwnBase() {
    assertEquals(0.3, ApprovalCycle.baseVersion(OptionalDouble.of(0.3), List.of(0.6), unknownBase));
  }

  @Test
  void tasksStoredBeforeBasesWereRecordedKeepTheTriggeringEditBase() {
    double base = ApprovalCycle.baseVersion(OptionalDouble.of(0.7), List.of(), unknownBase);

    assertEquals(0.7, base);
    assertEquals(0, unknownReads.get());
  }

  @Test
  void anOpeningTaskNeverLooksBackPastTheTriggeringEdit() {
    assertEquals(0.7, ApprovalCycle.baseVersion(OptionalDouble.of(0.7), List.of(), unknownBase));
    assertEquals(0, unknownReads.get());
  }

  @Test
  void anOpeningTaskKeepsAnEarlierTriggeringBase() {
    assertEquals(0.1, ApprovalCycle.baseVersion(OptionalDouble.of(0.1), List.of(), unknownBase));
  }

  @Test
  void aRunWithoutATriggeringVersionBeginsAtTheUnknownBase() {
    assertEquals(
        UNKNOWN_BASE, ApprovalCycle.baseVersion(OptionalDouble.empty(), List.of(), unknownBase));
    assertEquals(1, unknownReads.get());
  }

  // Two runs that opened tasks at the same time each recorded their own base; whichever task is
  // superseded last, the survivor covers both.
  @Test
  void racingRunsAgreeOnTheEarlierBaseInEitherOrder() {
    assertEquals(
        0.3, ApprovalCycle.baseVersion(OptionalDouble.of(0.9), List.of(0.3, 0.6), unknownBase));
    assertEquals(
        0.3, ApprovalCycle.baseVersion(OptionalDouble.of(0.9), List.of(0.6, 0.3), unknownBase));
  }
}
