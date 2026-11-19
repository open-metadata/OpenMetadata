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
package org.openmetadata.service.search.vector;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;

/** How the word and meaning rankings of one question are fused into one. */
class HybridRankingTest {

  private static final HybridRanking RANKING = new HybridRanking(0.6, 0.4, 30);

  private static Map<String, Object> hit(final String id, final String entityType) {
    return Map.of("parentId", id, "entityType", entityType, "fullyQualifiedName", id);
  }

  private static Map<String, Object> column(final String id, final String table) {
    return Map.of(
        "parentId",
        id,
        "entityType",
        "tableColumn",
        "fullyQualifiedName",
        id,
        "table",
        Map.of("id", table, "type", "table"));
  }

  private static List<Object> ids(final List<Map<String, Object>> hits) {
    return hits.stream().map(hit -> hit.get("parentId")).toList();
  }

  /**
   * Both rankings as the play server returned them for "Give me the SQL for total revenue per
   * month.", over the data asset types: the column is found only by words, since columns carry no
   * embeddings, and the orders table is ninth by words but first by meaning.
   */
  @Test
  void aQuestionsTermsTableAndColumnAllRankInTheFirstFive() {
    final List<Map<String, Object>> byWords =
        List.of(
            hit("Revenue", "glossaryTerm"),
            column("orders.order_total", "orders"),
            hit("Revenue After Tax", "glossaryTerm"),
            hit("Revenue Before Tax", "glossaryTerm"),
            column("orders.order_total_cents", "orders"),
            column("stg_orders.order_total", "stg_orders"),
            column("stg_orders.order_total_cents", "stg_orders"),
            column("orders.subtotal", "orders"),
            hit("orders", "table"),
            column("orders.subtotal_cents", "orders"),
            hit("stg_orders", "table"));
    final List<Map<String, Object>> byMeaning =
        List.of(
            hit("orders", "table"),
            hit("stg_orders", "table"),
            hit("Revenue", "glossaryTerm"),
            hit("customers", "table"),
            hit("Revenue After Tax", "glossaryTerm"),
            hit("Revenue Before Tax", "glossaryTerm"),
            hit("stg_supplies", "table"),
            hit("order_items", "table"));

    assertThat(ids(RANKING.fuse(byWords, byMeaning, 5)))
        .containsExactly(
            "orders", "Revenue", "orders.order_total", "Revenue After Tax", "stg_orders");
  }

  @Test
  void aTypeWithoutEmbeddingsIsRankedByItsWordsInBothLegs() {
    final List<Map<String, Object>> byWords =
        List.of(
            hit("customers", "table"),
            column("lifetime_spend", "t9"),
            hit("Spend", "glossaryTerm"));
    final List<Map<String, Object>> byMeaning =
        List.of(hit("customers", "table"), hit("Spend", "glossaryTerm"));

    assertThat(ids(RANKING.fuse(byWords, byMeaning, 3)))
        .containsExactly("customers", "lifetime_spend", "Spend");
  }

  @Test
  void aColumnFoundByWordsCountsAsAWordMatchForItsTable() {
    final List<Map<String, Object>> byWords =
        List.of(
            column("orders.order_total", "orders"),
            hit("payments", "table"),
            hit("orders", "table"));
    final List<Map<String, Object>> byMeaning =
        List.of(hit("payments", "table"), hit("orders", "table"));

    assertThat(ids(RANKING.fuse(byWords, byMeaning, 3))).containsSubsequence("orders", "payments");
  }

  @Test
  void eachEntityComesBackOnceWithItsFusedScoreAndTiesKeepTheWordOrder() {
    final List<Map<String, Object>> fused =
        RANKING.fuse(List.of(column("a", "x"), column("b", "y")), List.of(hit("t", "table")), 10);

    assertThat(ids(fused)).containsExactly("a", "b", "t");
    assertThat((double) fused.getFirst().get("_score")).isCloseTo(1.0 / 31, within(1e-12));
    assertThat(ids(RANKING.fuse(List.of(hit("t", "table")), List.of(hit("t", "table")), 10)))
        .containsExactly("t");
  }

  @Test
  void aTypeSearchedByMeaningAloneIsRankedByItsMeaningInBothLegs() {
    final List<Map<String, Object>> byWords =
        List.of(hit("orders", "table"), column("customers.last_ordered_at", "customers"));
    final List<Map<String, Object>> byMeaning =
        List.of(hit("orders_row_count", "testCase"), hit("orders", "table"));

    assertThat(ids(RANKING.fuse(byWords, byMeaning, Set.of("testCase"), 3)))
        .containsExactly("orders_row_count", "orders", "customers.last_ordered_at");
  }
}
