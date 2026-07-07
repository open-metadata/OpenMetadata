/*
 *  Copyright 2025 Collate
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
package org.openmetadata.mcp.util;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class ResponseBudgetTest {

  private static List<Map<String, Object>> items(int count, int charsEach) {
    List<Map<String, Object>> items = new ArrayList<>();
    for (int i = 0; i < count; i++) {
      items.add(Map.of("i", i, "blob", "x".repeat(charsEach)));
    }
    return items;
  }

  @Test
  void allItemsFitWhenWellUnderBudget() {
    List<Map<String, Object>> items = items(10, 100);

    int fit = ResponseBudget.fitCount(items, 0, 100_000);

    assertThat(fit).isEqualTo(10);
  }

  @Test
  void fitsExactlyToBudgetByMeasuringEachItem() {
    List<Map<String, Object>> items = items(1_000, 200);

    int fit = ResponseBudget.fitCount(items, 0, 10_000);

    assertThat(fit).isBetween(1, 1_000);
    long used = 0;
    for (int i = 0; i < fit; i++) {
      used += McpResponseTrim.serializedLength(items.get(i)) + 1;
    }
    assertThat(used).isLessThanOrEqualTo(10_000);
  }

  @Test
  void overheadReducesHowManyItemsFit() {
    List<Map<String, Object>> items = items(100, 100);

    int withoutOverhead = ResponseBudget.fitCount(items, 0, 5_000);
    int withOverhead = ResponseBudget.fitCount(items, 4_000, 5_000);

    assertThat(withOverhead).isLessThan(withoutOverhead);
  }

  @Test
  void firstItemOverflowStillReturnsOneForForwardProgress() {
    List<Map<String, Object>> items = items(3, 20_000);

    int fit = ResponseBudget.fitCount(items, 0, 5_000);

    assertThat(fit).isEqualTo(1);
  }

  @Test
  void overheadExceedingBudgetReturnsZero() {
    List<Map<String, Object>> items = items(5, 100);

    int fit = ResponseBudget.fitCount(items, 6_000, 5_000);

    assertThat(fit).isZero();
  }

  @Test
  void emptyListReturnsZero() {
    assertThat(ResponseBudget.fitCount(List.of(), 0, 5_000)).isZero();
  }

  @Test
  void singleItemOverMaxResponseCharsStillReturnsOne() {
    List<Map<String, Object>> items = items(1, McpResponseTrim.MAX_RESPONSE_CHARS + 1_000);

    int fit = ResponseBudget.fitCount(items, 0, ResponseBudget.defaultBudgetChars());

    assertThat(fit)
        .as(
            "un-pageable single item returns one (forward progress); the dispatch floor envelopes it")
        .isEqualTo(1);
    assertThat(McpResponseTrim.serializedLength(items.getFirst()))
        .isGreaterThan(McpResponseTrim.MAX_RESPONSE_CHARS);
  }
}
