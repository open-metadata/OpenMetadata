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
package org.openmetadata.service.aicontext;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.function.Function;
import org.junit.jupiter.api.Test;

class MetricContextBudgetTest {
  @Test
  void retainsWholeValuesAtTheExactCharacterBoundary() {
    final MetricContextBudget budget =
        new MetricContextBudget(MetricContextBudget.ENVELOPE_CHARS + 7, 50);
    final List<String> values = List.of("abc", "de", "f");

    assertEquals(List.of("abc", "de"), budget.take(values, Function.identity()));
    assertTrue(budget.truncated());
    assertEquals(List.of("abc", "de", "f"), values);
  }

  @Test
  void stopsAtTheExistingItemLimit() {
    final MetricContextBudget budget = new MetricContextBudget(8000, 2);
    assertEquals(List.of("a", "b"), budget.take(List.of("a", "b", "c"), Function.identity()));
    assertTrue(budget.truncated());
  }

  @Test
  void filtersAreAtomicAndDoNotSpendBudgetWhenTheyDoNotFit() {
    final MetricContextBudget budget =
        new MetricContextBudget(MetricContextBudget.ENVELOPE_CHARS + 5, 50);
    assertNull(budget.takeAll(List.of("abc", "de"), Function.identity()));
    assertEquals(List.of("a"), budget.take(List.of("a"), Function.identity()));
    assertTrue(budget.truncated());
  }

  @Test
  void aCompleteFilterGroupFitsAtTheBoundary() {
    final MetricContextBudget budget =
        new MetricContextBudget(MetricContextBudget.ENVELOPE_CHARS + 7, 50);
    assertEquals(List.of("abc", "de"), budget.takeAll(List.of("abc", "de"), Function.identity()));
    assertFalse(budget.truncated());
  }

  @Test
  void oversizedAndEmptyGroupsAreOmittedWithoutMutatingInputs() {
    final MetricContextBudget budget = new MetricContextBudget(0, 50);
    final List<String> values = new ArrayList<>(List.of("oversized"));
    assertNull(budget.take(values, Function.identity()));
    assertEquals(List.of("oversized"), values);
    assertNull(budget.takeAll(List.of(), Function.identity()));
    assertTrue(budget.truncated());
    assertFalse(new MetricContextBudget(800, 50).truncated());
  }

  @Test
  void aFilterGroupOverTheItemLimitIsOmittedInFull() {
    final MetricContextBudget budget = new MetricContextBudget(8000, 1);
    assertNull(budget.takeAll(List.of("a", "b"), Function.identity()));
    assertTrue(budget.truncated());
  }
}
