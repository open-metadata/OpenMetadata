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
package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchClient;

/**
 * Reproduces the regression from PR #28667 where the atomic alias swap orphaned every canonical
 * {@code *_search_index} alias on OpenSearch.
 *
 * <p>On a fresh install the canonical name (e.g. {@code table_search_index}) is a <em>concrete</em>
 * index. The fix for missing aliases folded a {@code remove_index} action into the {@code _aliases}
 * request so the delete and the alias-add happen atomically. The {@code remove_index} action was
 * built with {@code must_exist(false)}, which OpenSearch's {@code _aliases} parser rejects with
 * {@code [remove_index] unknown field [must_exist]} → {@code [aliases] failed to parse field
 * [actions]} → HTTP 400. The whole request failed, so the alias-add never applied and the canonical
 * name resolved to nothing — surfacing as "table_search_index missing embedding field" in the AI
 * Platform validation.
 *
 * <p>This exercises {@link SearchClient#swapAliases(Set, String, Set, Set)} directly against the
 * live cluster with the exact first-install shape (concrete canonical in {@code indicesToRemove}).
 * It fails before the fix on OpenSearch and passes after; on Elasticsearch (which tolerates
 * {@code must_exist}) it locks down the same correct atomic-swap behavior.
 */
public class AliasSwapConcreteRemovalIT {

  private static final String CANONICAL = "om_it_alias_swap_concrete_search_index";
  private static final String STAGED = CANONICAL + "_rebuild_it";
  private static final String SHORT_ALIAS = "om_it_alias_swap_concrete";

  @BeforeAll
  static void setup() {
    SdkClients.adminClient();
  }

  @AfterEach
  void cleanup() {
    SearchClient client = searchClient();
    // Delete the staged index first so the canonical alias it carries is removed with it, leaving
    // only a concrete canonical (if the swap never ran) for the second delete to clean up.
    for (String index : List.of(STAGED, CANONICAL)) {
      deleteIfExists(client, index);
    }
  }

  private static void deleteIfExists(SearchClient client, String index) {
    if (client.indexExists(index)) {
      client.deleteIndex(index);
    }
  }

  @Test
  void atomicSwapRemovesConcreteCanonicalAndAttachesAlias() {
    SearchClient client = searchClient();

    deleteIfExists(client, STAGED);
    deleteIfExists(client, CANONICAL);
    client.createIndex(CANONICAL, "{}");
    client.createIndex(STAGED, "{}");

    assertTrue(client.indexExists(CANONICAL), "Concrete canonical index should exist before swap");
    assertTrue(
        client.getIndicesByAlias(CANONICAL).isEmpty(),
        "Canonical name should be a concrete index, not an alias, before swap");

    boolean swapped =
        client.swapAliases(Set.of(), STAGED, Set.of(CANONICAL, SHORT_ALIAS), Set.of(CANONICAL));

    assertTrue(
        swapped,
        "Atomic swap with a concrete index in indicesToRemove must succeed; before the fix "
            + "OpenSearch rejected the remove_index must_exist field and returned false");
    assertEquals(
        Set.of(STAGED),
        client.getIndicesByAlias(CANONICAL),
        "Canonical alias must resolve to the staged index after the swap");
    assertTrue(
        client.getIndicesByAlias(SHORT_ALIAS).contains(STAGED),
        "Short alias must resolve to the staged index after the swap");
  }

  private static SearchClient searchClient() {
    return Entity.getSearchRepository().getSearchClient();
  }
}
