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
package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchClient.RawSearchResponse;

class SearchIndexCheckTest {
  private static final String CLUSTER = "om";
  private static final String ALL_USABLE =
      """
      {
        "om_table_search_index_rebuild_17": {"aliases": {"om_table_search_index": {}, "om_table": {}}},
        "om_topic_search_index": {"aliases": {"om_topic": {}, "om_dataAsset": {}}},
        "om_table_column_search_index": {"aliases": {"om_tableColumn": {}}}
      }
      """;

  private final SearchRepository searchRepository = mock(SearchRepository.class);
  private final SearchClient searchClient = mock(SearchClient.class);
  private final List<String> steps = new ArrayList<>();
  private boolean reindexRunning;
  private final SearchIndexCheck check =
      new SearchIndexCheck(
          searchRepository,
          () -> reindexRunning,
          entityTypes -> steps.add("reindex " + entityTypes),
          Duration.ZERO);

  @BeforeEach
  void wireBoundaries() {
    when(searchRepository.getSearchClient()).thenReturn(searchClient);
    when(searchRepository.getClusterAlias()).thenReturn(CLUSTER);
    when(searchRepository.getIndexedEntityTypes())
        .thenReturn(Set.of(Entity.TABLE, Entity.TOPIC, Entity.TABLE_COLUMN));
    givenMapping(Entity.TABLE, "table_search_index");
    givenMapping(Entity.TOPIC, "topic_search_index");
    givenMapping(Entity.TABLE_COLUMN, "table_column_search_index");
    doAnswer(invocation -> steps.add("templates"))
        .when(searchRepository)
        .createOrUpdateIndexTemplates();
    doAnswer(invocation -> steps.add("create missing") ? 1 : 0)
        .when(searchRepository)
        .createMissingIndexes();
  }

  @Test
  void indexesServedThroughTheirAliasAreUsable() throws Exception {
    givenAliases(ALL_USABLE);

    assertTrue(check.unusableTypes().isEmpty());
  }

  @Test
  void missingIndexesAndIndexesALiveWriteCreatedAreUnusable() throws Exception {
    givenAliases(
        """
        {
          "om_table_search_index": {"aliases": {}},
          "om_table_column_search_index": {"aliases": {"om_tableColumn": {}}}
        }
        """);

    assertEquals(Set.of(Entity.TABLE, Entity.TOPIC), check.unusableTypes());
  }

  @Test
  void unusableIndexesAreRebuiltAfterTheirTemplates() throws Exception {
    givenAliases(
        """
        {
          "om_table_search_index_rebuild_17": {"aliases": {"om_table_search_index": {}, "om_table": {}}},
          "om_topic_search_index": {"aliases": {"om_topic": {}}}
        }
        """);

    check.repairUnusableIndexes();

    assertEquals(List.of("templates", "reindex [table, tableColumn]", "create missing"), steps);
  }

  @Test
  void anIndexThatBecomesUsableBeforeConfirmationIsLeftAlone() throws Exception {
    when(searchClient.rawSearchRequest(eq("GET"), anyString(), isNull()))
        .thenReturn(new RawSearchResponse(200, "{}"), new RawSearchResponse(200, ALL_USABLE));

    check.repairUnusableIndexes();

    assertTrue(steps.isEmpty());
  }

  @Test
  void aliasesAreReadByNamingTheServingIndexes() throws Exception {
    givenAliases(ALL_USABLE);

    check.unusableTypes();

    verify(searchClient)
        .rawSearchRequest(
            "GET",
            "/om_table_search_index,om_table_column_search_index,om_topic_search_index"
                + "/_alias?ignore_unavailable=true",
            null);
  }

  @Test
  void manyTypesAreReadAFewIndexesAtATime() throws Exception {
    final Set<String> types =
        IntStream.range(0, 45).mapToObj(n -> "type" + n).collect(Collectors.toSet());
    when(searchRepository.getIndexedEntityTypes()).thenReturn(types);
    when(searchRepository.getIndexMapping(anyString()))
        .thenAnswer(
            invocation ->
                IndexMapping.builder()
                    .indexName(invocation.getArgument(0) + "_search_index")
                    .alias(invocation.getArgument(0))
                    .build());
    givenAliases("{}");

    assertEquals(types, check.unusableTypes());

    final ArgumentCaptor<String> paths = ArgumentCaptor.forClass(String.class);
    verify(searchClient, times(3)).rawSearchRequest(eq("GET"), paths.capture(), isNull());
    paths
        .getAllValues()
        .forEach(
            requestPath ->
                assertTrue(
                    requestPath.split(",").length <= SearchIndexCheck.INDEXES_PER_REQUEST,
                    requestPath));
  }

  @Test
  void nothingChangesWhileAReindexRuns() throws Exception {
    givenAliases("{}");
    reindexRunning = true;

    check.repairUnusableIndexes();

    assertTrue(steps.isEmpty());
  }

  private void givenMapping(final String entityType, final String indexName) {
    when(searchRepository.getIndexMapping(entityType))
        .thenReturn(IndexMapping.builder().indexName(indexName).alias(entityType).build());
  }

  private void givenAliases(final String aliasesByIndex) throws Exception {
    when(searchClient.rawSearchRequest(eq("GET"), anyString(), isNull()))
        .thenReturn(new RawSearchResponse(200, aliasesByIndex));
  }
}
