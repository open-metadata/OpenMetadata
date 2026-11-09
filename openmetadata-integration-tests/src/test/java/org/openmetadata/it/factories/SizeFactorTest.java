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

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

class SizeFactorTest {

  @ParameterizedTest
  @NullAndEmptySource
  @ValueSource(strings = {"  ", "1", "1.0"})
  void keepsTheFullSizeWhenTheFactorIsUnsetOrOne(final String factor) {
    assertThat(SizeFactor.scale(10_000, factor)).isEqualTo(10_000);
  }

  @Test
  void shrinksByTheFactor() {
    assertThat(SizeFactor.scale(10_000, "0.05")).isEqualTo(500);
    assertThat(SizeFactor.scale(50_000, " 0.02 ")).isEqualTo(1_000);
  }

  @Test
  void growsWhenTheFactorIsAboveOne() {
    assertThat(SizeFactor.scale(2_000, "2.5")).isEqualTo(5_000);
  }

  @Test
  void neverShrinksBelowTheFloor() {
    assertThat(SizeFactor.scale(10_000, "0.0001")).isEqualTo(SizeFactor.FLOOR);
    assertThat(SizeFactor.scale(800, "0.02")).isEqualTo(SizeFactor.FLOOR);
  }

  @Test
  void leavesACohortSmallerThanTheFloorAsItIs() {
    assertThat(SizeFactor.scale(20, "0.1")).isEqualTo(20);
  }

  @Test
  void capsAtTheLargestInt() {
    assertThat(SizeFactor.scale(Integer.MAX_VALUE, "4")).isEqualTo(Integer.MAX_VALUE);
  }

  @ParameterizedTest
  @ValueSource(strings = {"abc", "0", "-0.5", "NaN", "Infinity", "-Infinity"})
  void rejectsAFactorThatIsNotAPositiveNumber(final String factor) {
    assertThatThrownBy(() -> SizeFactor.scale(10_000, factor))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining(SizeFactor.PROPERTY)
        .hasMessageContaining(factor);
  }
}
