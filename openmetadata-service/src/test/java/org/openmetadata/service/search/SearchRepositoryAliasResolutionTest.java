/*
 *  Copyright 2021 Collate
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
package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.search.IndexMappingLoader;

class SearchRepositoryAliasResolutionTest {

  private static Map<String, IndexMapping> entityIndexMap;
  private static Map<String, List<String>> aliasToChildEntityTypes;

  @BeforeAll
  static void loadMappings() throws IOException {
    IndexMappingLoader.init();
    entityIndexMap = IndexMappingLoader.getInstance().getIndexMapping();
    aliasToChildEntityTypes = SearchRepository.buildAliasToChildEntityTypes(entityIndexMap);
  }

  @Test
  void bothFiltersNoneReturnsOnlyOwnIndex() {
    String resolved =
        SearchRepository.resolveIndexes(
            "table", "none", "none", entityIndexMap, aliasToChildEntityTypes, "");
    assertEquals("table_search_index", resolved);
  }

  @Test
  void wildcardChildrenIncludesEveryReverseMapEntry() {
    String resolved =
        SearchRepository.resolveIndexes(
            "table", "none", "*", entityIndexMap, aliasToChildEntityTypes, "");
    List<String> indexes = Arrays.asList(resolved.split(","));
    assertTrue(
        indexes.contains("table_search_index"), "Own index must always be present: " + resolved);
    assertTrue(
        indexes.contains("column_search_index"),
        "tableColumn lists 'table' as parent, so column index should be expanded: " + resolved);
    assertFalse(
        indexes.contains("database_search_index"),
        "Database is a parent of table, not a child — must not appear: " + resolved);
  }

  @Test
  void namedChildrenIncludesOnlyTheListedEntityTypes() {
    String resolved =
        SearchRepository.resolveIndexes(
            "table", "none", "tableColumn", entityIndexMap, aliasToChildEntityTypes, "");
    List<String> indexes = Arrays.asList(resolved.split(","));
    assertTrue(indexes.contains("table_search_index"));
    assertTrue(
        indexes.contains("column_search_index"), "tableColumn explicitly listed: " + resolved);
    // No other reverse-map child should leak through.
    for (String idx : indexes) {
      assertTrue(
          idx.equals("table_search_index") || idx.equals("column_search_index"),
          "Unexpected index in named-filter result: " + idx + "; full=" + resolved);
    }
  }

  @Test
  void namedFilterIgnoresEntriesNotInTheGraph() {
    // 'topic' is not a child of 'table' (its parentAliases don't list 'table'). Including it in
    // the filter must not magically introduce topic_search_index.
    String resolved =
        SearchRepository.resolveIndexes(
            "table", "none", "tableColumn,topic", entityIndexMap, aliasToChildEntityTypes, "");
    List<String> indexes = Arrays.asList(resolved.split(","));
    assertTrue(indexes.contains("column_search_index"));
    assertFalse(
        indexes.contains("topic_search_index"),
        "Filter accepts 'topic', but topic isn't a child of 'table': " + resolved);
  }

  @Test
  void wildcardParentsIncludesDeclaredParentEntities() {
    String resolved =
        SearchRepository.resolveIndexes(
            "tableColumn", "*", "none", entityIndexMap, aliasToChildEntityTypes, "");
    List<String> indexes = Arrays.asList(resolved.split(","));
    assertTrue(indexes.contains("column_search_index"), "Own index must be present: " + resolved);
    assertTrue(
        indexes.contains("table_search_index"),
        "tableColumn declares 'table' in its parentAliases: " + resolved);
    // Compound aliases like 'all'/'dataAsset' have no IndexMapping entry and must be silently
    // skipped (no NPE), and must not introduce bogus indexes.
    assertFalse(indexes.contains("all"));
    assertFalse(indexes.contains("dataAsset"));
  }

  @Test
  void namedParentsIncludesOnlyListedEntities() {
    String resolved =
        SearchRepository.resolveIndexes(
            "tableColumn", "table", "none", entityIndexMap, aliasToChildEntityTypes, "");
    List<String> indexes = Arrays.asList(resolved.split(","));
    assertTrue(indexes.contains("column_search_index"));
    assertTrue(indexes.contains("table_search_index"));
    // 'database' is not a parent of tableColumn, only of table — must not be picked up.
    assertFalse(indexes.contains("database_search_index"));
  }

  @Test
  void compoundAliasExpandsToAllDeclaredChildrenWhenChildrenIsWildcard() {
    String resolved =
        SearchRepository.resolveIndexes(
            "dataAsset", "none", "*", entityIndexMap, aliasToChildEntityTypes, "");
    List<String> indexes = Arrays.asList(resolved.split(","));
    assertTrue(
        indexes.contains("table_search_index"),
        "table declares dataAsset as a parent: " + resolved);
    assertTrue(
        indexes.contains("topic_search_index"),
        "topic declares dataAsset as a parent: " + resolved);
    assertFalse(
        indexes.contains("dataAsset"),
        "Compound alias literal must not appear when an expansion happened: " + resolved);
  }

  @Test
  void unknownTokenWithoutExpansionFallsBackToOriginalToken() {
    String resolved =
        SearchRepository.resolveIndexes(
            "definitely_not_an_alias", "none", "*", entityIndexMap, aliasToChildEntityTypes, "");
    assertEquals("definitely_not_an_alias", resolved);
  }

  @Test
  void clusterAliasIsAppliedUniformlyToAllResolvedIndexes() {
    String resolved =
        SearchRepository.resolveIndexes(
            "table", "none", "*", entityIndexMap, aliasToChildEntityTypes, "tenant42");
    for (String token : resolved.split(",")) {
      assertTrue(
          token.startsWith("tenant42_"),
          "Every resolved index must carry the cluster prefix: " + resolved);
    }
  }

  @Test
  void commaSeparatedInputResolvesEachTokenIndependentlyAndDeduplicates() {
    String resolved =
        SearchRepository.resolveIndexes(
            "table,topic", "none", "none", entityIndexMap, aliasToChildEntityTypes, "");
    List<String> indexes = Arrays.asList(resolved.split(","));
    assertTrue(indexes.contains("table_search_index"));
    assertTrue(indexes.contains("topic_search_index"));
    assertEquals(
        indexes.size(),
        indexes.stream().distinct().count(),
        "Comma-separated tokens must be deduplicated: " + resolved);
  }

  /**
   * Defense-in-depth: even after the resource-layer pre-resolution was removed for /aggregate,
   * /fieldQuery, and /entityTypeCounts, an already-prefixed token must not be prefixed again if
   * any future code path hands it back into the resolver. Exercises the fallback path of
   * {@link SearchRepository#resolveIndexes}, which routes unknown tokens through
   * {@code prefixWithClusterAlias}.
   */
  @Test
  void resolveIndexesDoesNotDoublePrefixAlreadyPrefixedTokens() {
    String alreadyPrefixed =
        SearchRepository.resolveIndexes(
            "tenant42_some_search_index",
            "none",
            "none",
            entityIndexMap,
            aliasToChildEntityTypes,
            "tenant42");
    assertEquals("tenant42_some_search_index", alreadyPrefixed);

    String mixed =
        SearchRepository.resolveIndexes(
            "tenant42_some_search_index,topic_search_index",
            "none",
            "none",
            entityIndexMap,
            aliasToChildEntityTypes,
            "tenant42");
    List<String> tokens = Arrays.asList(mixed.split(","));
    assertTrue(
        tokens.contains("tenant42_some_search_index"),
        "Already-prefixed token must not be re-prefixed: " + mixed);
    assertTrue(
        tokens.contains("tenant42_topic_search_index"),
        "Unprefixed token must be prefixed exactly once: " + mixed);
  }

  /**
   * Empty tokens from inputs like {@code "table,"} (trailing comma) or {@code ","} must not
   * materialize as bare-prefixed index targets such as {@code "tenant42_"} — those would 404 in
   * a confusing way at the ES boundary.
   */
  @Test
  void resolveIndexesDropsEmptyTokensFromStrayCommas() {
    String trailing =
        SearchRepository.resolveIndexes(
            "table,", "none", "none", entityIndexMap, aliasToChildEntityTypes, "tenant42");
    assertEquals("tenant42_table_search_index", trailing);

    String embedded =
        SearchRepository.resolveIndexes(
            "table, ,topic", "none", "none", entityIndexMap, aliasToChildEntityTypes, "tenant42");
    List<String> tokens = Arrays.asList(embedded.split(","));
    assertTrue(tokens.contains("tenant42_table_search_index"));
    assertTrue(tokens.contains("tenant42_topic_search_index"));
    assertFalse(
        tokens.contains("tenant42_"),
        "Bare cluster prefix must not be emitted from empty tokens: " + embedded);

    String allEmpty =
        SearchRepository.resolveIndexes(
            ", ,", "none", "none", entityIndexMap, aliasToChildEntityTypes, "tenant42");
    assertEquals(", ,", allEmpty);
    assertFalse(
        allEmpty.isEmpty(), "All-empty input must not collapse to an empty string: " + allEmpty);
  }

  @Test
  void buildReverseMapMatchesEveryEntityWithItsDeclaredParents() {
    for (Map.Entry<String, IndexMapping> entry : entityIndexMap.entrySet()) {
      List<String> parents = entry.getValue().getParentAliases();
      if (parents == null) {
        continue;
      }
      for (String parentAlias : parents) {
        List<String> reverseChildren = aliasToChildEntityTypes.get(parentAlias);
        assertTrue(
            reverseChildren != null && reverseChildren.contains(entry.getKey()),
            entry.getKey()
                + " declares "
                + parentAlias
                + " as a parent, so the reverse map must list it as a child");
      }
    }
  }
}
