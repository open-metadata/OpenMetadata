/*
 *  Copyright 2024 Collate
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
package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class HeapBackpressureTest {

  @Test
  void underPressure_atOrAboveThreshold() {
    assertTrue(HeapBackpressure.underPressure(80, 100), "80% == 0.80 threshold must pause");
    assertTrue(HeapBackpressure.underPressure(95, 100));
    assertTrue(HeapBackpressure.underPressure(100, 100));
  }

  @Test
  void underPressure_belowThreshold() {
    assertFalse(HeapBackpressure.underPressure(79, 100));
    assertFalse(HeapBackpressure.underPressure(0, 100));
  }

  @Test
  void underPressure_falseWhenMaxUnknown() {
    // Some GCs report max = -1; an unknown ceiling must never wedge the reader.
    assertFalse(HeapBackpressure.underPressure(1_000_000, -1));
    assertFalse(HeapBackpressure.underPressure(1_000_000, 0));
  }

  @Test
  void hasHeadroom_belowResumeThreshold() {
    assertTrue(HeapBackpressure.hasHeadroom(67, 100), "below 0.68 must resume");
    assertTrue(HeapBackpressure.hasHeadroom(0, 100));
    assertTrue(HeapBackpressure.hasHeadroom(1_000_000, -1), "unknown max must resume, never hang");
  }

  @Test
  void hasHeadroom_atOrAboveResumeThreshold() {
    assertFalse(HeapBackpressure.hasHeadroom(68, 100));
    assertFalse(HeapBackpressure.hasHeadroom(80, 100));
  }

  @Test
  void hysteresisGap_holdsStateBetweenThresholds() {
    // Between resume (0.68) and pause (0.80) the reader neither pauses nor is declared recovered,
    // so it can't flap once it has paused. 75% must be in that band.
    assertFalse(HeapBackpressure.underPressure(75, 100));
    assertFalse(HeapBackpressure.hasHeadroom(75, 100));
  }
}
