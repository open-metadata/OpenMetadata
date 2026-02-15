package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anySet;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;

@ExtendWith(MockitoExtension.class)
@DisplayName("DefaultRecreateHandler Tests")
class DefaultRecreateHandlerTest {

  @Nested
  @DisplayName("promoteEntityIndex Tests")
  class PromoteEntityIndexTests {

    @Test
    @DisplayName("Should promote staged index with aliases from indexMapping")
    void testPromoteEntityIndexSuccess() {
      AliasState aliasState = new AliasState();
      aliasState.put(
          "table_search_index_rebuild_old", Set.of("table", "table_search_index", "all"));
      aliasState.put("table_search_index_rebuild_new", new HashSet<>());

      SearchClient client = aliasState.toMock();
      SearchRepository repo = mock(SearchRepository.class);
      when(repo.getSearchClient()).thenReturn(client);
      when(repo.getClusterAlias()).thenReturn("");

      IndexMapping indexMapping =
          IndexMapping.builder()
              .indexName("table_search_index")
              .alias("table")
              .parentAliases(List.of("all", "dataAsset"))
              .childAliases(List.of())
              .build();
      when(repo.getIndexMapping("table")).thenReturn(indexMapping);

      try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
        entityMock.when(Entity::getSearchRepository).thenReturn(repo);

        EntityReindexContext context =
            EntityReindexContext.builder()
                .entityType("table")
                .canonicalIndex("table_search_index")
                .stagedIndex("table_search_index_rebuild_new")
                .build();

        new DefaultRecreateHandler().promoteEntityIndex(context, true);
      }

      assertTrue(aliasState.deletedIndices.contains("table_search_index_rebuild_old"));
      Set<String> stagedAliases = aliasState.indexAliases.get("table_search_index_rebuild_new");
      assertTrue(stagedAliases.contains("table"));
      assertTrue(stagedAliases.contains("table_search_index"));
      assertTrue(stagedAliases.contains("all"));
      assertTrue(stagedAliases.contains("dataAsset"));
    }

    @Test
    @DisplayName("Should delete staged index on failure")
    void testPromoteEntityIndexFailure() {
      AliasState aliasState = new AliasState();
      aliasState.put("table_search_index_rebuild_new", new HashSet<>());

      SearchClient client = aliasState.toMock();
      SearchRepository repo = mock(SearchRepository.class);
      when(repo.getSearchClient()).thenReturn(client);

      try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
        entityMock.when(Entity::getSearchRepository).thenReturn(repo);

        EntityReindexContext context =
            EntityReindexContext.builder()
                .entityType("table")
                .canonicalIndex("table_search_index")
                .stagedIndex("table_search_index_rebuild_new")
                .build();

        new DefaultRecreateHandler().promoteEntityIndex(context, false);
      }

      assertTrue(aliasState.deletedIndices.contains("table_search_index_rebuild_new"));
    }

    @Test
    @DisplayName("Should not promote when canonical index is null")
    void testPromoteWithNullCanonicalIndex() {
      SearchClient client = mock(SearchClient.class);
      SearchRepository repo = mock(SearchRepository.class);
      when(repo.getSearchClient()).thenReturn(client);

      try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
        entityMock.when(Entity::getSearchRepository).thenReturn(repo);

        EntityReindexContext context =
            EntityReindexContext.builder()
                .entityType("table")
                .canonicalIndex(null)
                .stagedIndex("table_search_index_rebuild_new")
                .build();

        new DefaultRecreateHandler().promoteEntityIndex(context, true);

        verify(client, never()).addAliases(anyString(), anySet());
      }
    }

    @Test
    @DisplayName("Should not promote when staged index is null")
    void testPromoteWithNullStagedIndex() {
      SearchClient client = mock(SearchClient.class);
      SearchRepository repo = mock(SearchRepository.class);
      when(repo.getSearchClient()).thenReturn(client);

      try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
        entityMock.when(Entity::getSearchRepository).thenReturn(repo);

        EntityReindexContext context =
            EntityReindexContext.builder()
                .entityType("table")
                .canonicalIndex("table_search_index")
                .stagedIndex(null)
                .build();

        new DefaultRecreateHandler().promoteEntityIndex(context, true);

        verify(client, never()).addAliases(anyString(), anySet());
      }
    }

    @Test
    @DisplayName("Should cleanup multiple old indices during promotion")
    void testCleanupMultipleOldIndices() {
      AliasState aliasState = new AliasState();
      aliasState.put("table_search_index_rebuild_1000", Set.of("table"));
      aliasState.put("table_search_index_rebuild_2000", Set.of("table"));
      aliasState.put("table_search_index_rebuild_3000", new HashSet<>());

      SearchClient client = aliasState.toMock();
      SearchRepository repo = mock(SearchRepository.class);
      when(repo.getSearchClient()).thenReturn(client);
      when(repo.getClusterAlias()).thenReturn("");

      IndexMapping indexMapping =
          IndexMapping.builder()
              .indexName("table_search_index")
              .alias("table")
              .parentAliases(List.of("all"))
              .childAliases(List.of())
              .build();
      when(repo.getIndexMapping("table")).thenReturn(indexMapping);

      try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
        entityMock.when(Entity::getSearchRepository).thenReturn(repo);

        EntityReindexContext context =
            EntityReindexContext.builder()
                .entityType("table")
                .canonicalIndex("table_search_index")
                .stagedIndex("table_search_index_rebuild_3000")
                .build();

        new DefaultRecreateHandler().promoteEntityIndex(context, true);
      }

      assertTrue(aliasState.deletedIndices.contains("table_search_index_rebuild_1000"));
      assertTrue(aliasState.deletedIndices.contains("table_search_index_rebuild_2000"));
      assertFalse(aliasState.deletedIndices.contains("table_search_index_rebuild_3000"));
    }

    @Test
    @DisplayName("Should handle null indexMapping gracefully")
    void testPromoteWithNullIndexMapping() {
      AliasState aliasState = new AliasState();
      aliasState.put("table_search_index_rebuild_new", new HashSet<>());

      SearchClient client = aliasState.toMock();
      SearchRepository repo = mock(SearchRepository.class);
      when(repo.getSearchClient()).thenReturn(client);
      when(repo.getClusterAlias()).thenReturn("");
      when(repo.getIndexMapping("table")).thenReturn(null);

      try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
        entityMock.when(Entity::getSearchRepository).thenReturn(repo);

        EntityReindexContext context =
            EntityReindexContext.builder()
                .entityType("table")
                .canonicalIndex("table_search_index")
                .stagedIndex("table_search_index_rebuild_new")
                .build();

        new DefaultRecreateHandler().promoteEntityIndex(context, true);
      }

      Set<String> stagedAliases = aliasState.indexAliases.get("table_search_index_rebuild_new");
      assertTrue(stagedAliases.isEmpty());
    }

    @Test
    @DisplayName("Should include cluster alias prefix in aliases")
    void testPromoteWithClusterAlias() {
      AliasState aliasState = new AliasState();
      aliasState.put("cluster_table_search_index_rebuild_new", new HashSet<>());

      SearchClient client = aliasState.toMock();
      SearchRepository repo = mock(SearchRepository.class);
      when(repo.getSearchClient()).thenReturn(client);
      when(repo.getClusterAlias()).thenReturn("cluster");

      IndexMapping indexMapping =
          IndexMapping.builder()
              .indexName("table_search_index")
              .alias("table")
              .parentAliases(List.of("all"))
              .childAliases(List.of())
              .build();
      when(repo.getIndexMapping("table")).thenReturn(indexMapping);

      try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
        entityMock.when(Entity::getSearchRepository).thenReturn(repo);

        EntityReindexContext context =
            EntityReindexContext.builder()
                .entityType("table")
                .canonicalIndex("cluster_table_search_index")
                .stagedIndex("cluster_table_search_index_rebuild_new")
                .build();

        new DefaultRecreateHandler().promoteEntityIndex(context, true);
      }

      Set<String> stagedAliases =
          aliasState.indexAliases.get("cluster_table_search_index_rebuild_new");
      assertTrue(stagedAliases.contains("cluster_table"));
      assertTrue(stagedAliases.contains("cluster_table_search_index"));
      assertTrue(stagedAliases.contains("cluster_all"));
    }
  }

  @Nested
  @DisplayName("getAliasesFromMapping Tests")
  class GetAliasesFromMappingTests {

    @Test
    @DisplayName("Should return all aliases from indexMapping")
    void testGetAliasesFromMapping() {
      AliasState aliasState = new AliasState();
      aliasState.put("table_search_index_rebuild_new", new HashSet<>());

      SearchClient client = aliasState.toMock();
      SearchRepository repo = mock(SearchRepository.class);
      when(repo.getSearchClient()).thenReturn(client);
      when(repo.getClusterAlias()).thenReturn("");

      IndexMapping indexMapping =
          IndexMapping.builder()
              .indexName("table_search_index")
              .alias("table")
              .parentAliases(List.of("all", "dataAsset"))
              .childAliases(List.of())
              .build();
      when(repo.getIndexMapping("table")).thenReturn(indexMapping);

      try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
        entityMock.when(Entity::getSearchRepository).thenReturn(repo);

        EntityReindexContext context =
            EntityReindexContext.builder()
                .entityType("table")
                .canonicalIndex("table_search_index")
                .stagedIndex("table_search_index_rebuild_new")
                .build();

        new DefaultRecreateHandler().promoteEntityIndex(context, true);
      }

      Set<String> aliases = aliasState.indexAliases.get("table_search_index_rebuild_new");
      assertEquals(4, aliases.size());
      assertTrue(aliases.contains("table"));
      assertTrue(aliases.contains("table_search_index"));
      assertTrue(aliases.contains("all"));
      assertTrue(aliases.contains("dataAsset"));
    }
  }

  private static class AliasState {
    final Map<String, Set<String>> indexAliases = new HashMap<>();
    final Set<String> deletedIndices = new HashSet<>();

    void put(String indexName, Set<String> aliases) {
      indexAliases.put(indexName, new HashSet<>(aliases));
    }

    SearchClient toMock() {
      SearchClient client = mock(SearchClient.class);

      lenient().when(client.isClientAvailable()).thenReturn(true);
      lenient()
          .when(client.getSearchType())
          .thenReturn(ElasticSearchConfiguration.SearchType.ELASTICSEARCH);
      lenient()
          .when(client.indexExists(anyString()))
          .thenAnswer(invocation -> indexAliases.containsKey(invocation.getArgument(0)));
      lenient()
          .when(client.getAliases(anyString()))
          .thenAnswer(
              invocation ->
                  new HashSet<>(indexAliases.getOrDefault(invocation.getArgument(0), Set.of())));
      lenient()
          .when(client.getIndicesByAlias(anyString()))
          .thenAnswer(
              invocation ->
                  indexAliases.entrySet().stream()
                      .filter(e -> e.getValue().contains(invocation.getArgument(0)))
                      .map(Map.Entry::getKey)
                      .collect(Collectors.toSet()));

      lenient()
          .when(client.listIndicesByPrefix(anyString()))
          .thenAnswer(
              invocation -> {
                String prefix = invocation.getArgument(0);
                return indexAliases.keySet().stream()
                    .filter(idx -> idx.startsWith(prefix))
                    .collect(Collectors.toSet());
              });

      lenient()
          .doAnswer(
              invocation -> {
                String index = invocation.getArgument(0);
                @SuppressWarnings("unchecked")
                Set<String> aliases = new HashSet<>((Set<String>) invocation.getArgument(1));
                indexAliases.computeIfPresent(
                    index,
                    (k, v) -> {
                      v.removeAll(aliases);
                      return v;
                    });
                return null;
              })
          .when(client)
          .removeAliases(anyString(), anySet());

      lenient()
          .doAnswer(
              invocation -> {
                String index = invocation.getArgument(0);
                @SuppressWarnings("unchecked")
                Set<String> aliases = new HashSet<>((Set<String>) invocation.getArgument(1));
                indexAliases.computeIfAbsent(index, k -> new HashSet<>()).addAll(aliases);
                return null;
              })
          .when(client)
          .addAliases(anyString(), anySet());

      // Mock swapAliases - atomically remove aliases from old indices and add to new index
      lenient()
          .doAnswer(
              invocation -> {
                @SuppressWarnings("unchecked")
                Set<String> oldIndices = (Set<String>) invocation.getArgument(0);
                String newIndex = invocation.getArgument(1);
                @SuppressWarnings("unchecked")
                Set<String> aliases = new HashSet<>((Set<String>) invocation.getArgument(2));

                // Remove aliases from old indices
                for (String oldIndex : oldIndices) {
                  indexAliases.computeIfPresent(
                      oldIndex,
                      (k, v) -> {
                        v.removeAll(aliases);
                        return v;
                      });
                }

                // Add aliases to new index
                indexAliases.computeIfAbsent(newIndex, k -> new HashSet<>()).addAll(aliases);
                return true;
              })
          .when(client)
          .swapAliases(anySet(), anyString(), anySet());

      lenient()
          .doAnswer(
              invocation -> {
                String index = invocation.getArgument(0);
                indexAliases.remove(index);
                deletedIndices.add(index);
                return null;
              })
          .when(client)
          .deleteIndex(anyString());

      lenient()
          .doAnswer(
              invocation -> {
                String index = invocation.getArgument(0);
                indexAliases.remove(index);
                deletedIndices.add(index);
                return null;
              })
          .when(client)
          .deleteIndexWithBackoff(anyString());

      lenient()
          .doAnswer(
              invocation -> {
                @SuppressWarnings("unchecked")
                Set<String> oldIndices = (Set<String>) invocation.getArgument(0);
                String newIndex = invocation.getArgument(1);
                @SuppressWarnings("unchecked")
                Set<String> aliases = new HashSet<>((Set<String>) invocation.getArgument(2));

                // Remove aliases from old indices
                for (String oldIndex : oldIndices) {
                  Set<String> oldAliases = indexAliases.get(oldIndex);
                  if (oldAliases != null) {
                    oldAliases.removeAll(aliases);
                  }
                }

                // Add aliases to new index
                indexAliases.computeIfAbsent(newIndex, k -> new HashSet<>()).addAll(aliases);

                return true;
              })
          .when(client)
          .swapAliases(anySet(), anyString(), anySet());

      return client;
    }
  }
}
