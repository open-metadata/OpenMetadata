package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anySet;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
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
import org.openmetadata.service.apps.bundles.searchIndex.ReindexingMetrics;
import org.openmetadata.service.jdbi3.CollectionDAO;

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
    @DisplayName("Should stamp mapping version after successful promotion")
    void testPromoteEntityIndexStampsMappingVersion() throws Exception {
      AliasState aliasState = new AliasState();
      aliasState.put(
          "table_search_index_rebuild_old", Set.of("table", "table_search_index", "all"));
      aliasState.put("table_search_index_rebuild_new", new HashSet<>());

      SearchClient client = aliasState.toMock();
      SearchRepository repo = mock(SearchRepository.class);
      when(repo.getSearchClient()).thenReturn(client);
      when(repo.getClusterAlias()).thenReturn("");
      when(repo.getIndexMapping("table"))
          .thenReturn(
              IndexMapping.builder()
                  .indexName("table_search_index")
                  .alias("table")
                  .parentAliases(List.of("all", "dataAsset"))
                  .childAliases(List.of())
                  .build());

      IndexMappingVersionTracker tracker = mock(IndexMappingVersionTracker.class);
      try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
          MockedStatic<IndexMappingVersionTracker> trackerMock =
              mockStatic(IndexMappingVersionTracker.class)) {
        entityMock.when(Entity::getSearchRepository).thenReturn(repo);
        entityMock.when(Entity::getCollectionDAO).thenReturn(mock(CollectionDAO.class));
        trackerMock.when(() -> IndexMappingVersionTracker.create(any())).thenReturn(tracker);

        EntityReindexContext context =
            EntityReindexContext.builder()
                .entityType("table")
                .canonicalIndex("table_search_index")
                .stagedIndex("table_search_index_rebuild_new")
                .build();

        new DefaultRecreateHandler().promoteEntityIndex(context, true);
      }

      verify(tracker).updateMappingVersion("table");
    }

    @Test
    @DisplayName("Should not stamp mapping version when promotion fails")
    void testPromoteEntityIndexDoesNotStampOnFailure() throws Exception {
      AliasState aliasState = new AliasState();
      aliasState.put("table_search_index_rebuild_new", new HashSet<>());

      SearchClient client = aliasState.toMock();
      when(client.getIndexedDocumentCount("table_search_index_rebuild_new")).thenReturn(0L);
      SearchRepository repo = mock(SearchRepository.class);
      when(repo.getSearchClient()).thenReturn(client);

      IndexMappingVersionTracker tracker = mock(IndexMappingVersionTracker.class);
      try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
          MockedStatic<IndexMappingVersionTracker> trackerMock =
              mockStatic(IndexMappingVersionTracker.class)) {
        entityMock.when(Entity::getSearchRepository).thenReturn(repo);
        trackerMock.when(() -> IndexMappingVersionTracker.create(any())).thenReturn(tracker);

        EntityReindexContext context =
            EntityReindexContext.builder()
                .entityType("table")
                .canonicalIndex("table_search_index")
                .stagedIndex("table_search_index_rebuild_new")
                .build();

        new DefaultRecreateHandler().promoteEntityIndex(context, false);
      }

      verify(tracker, never()).updateMappingVersion(anyString());
    }

    @Test
    @DisplayName(
        "Should promote partial data and record success metrics when failed reindex has documents")
    void testPromoteEntityIndexPromotesPartialData() {
      AliasState aliasState = new AliasState();
      // First-install shape: canonical is a concrete index (OS/ES forbid an alias and a concrete
      // index sharing the same name, so it carries no self-alias).
      aliasState.put("table_search_index", Set.of());
      aliasState.put("table_search_index_rebuild_old", Set.of("legacy"));
      aliasState.put("table_search_index_rebuild_new", new HashSet<>());

      SearchClient client = aliasState.toMock();
      when(client.getIndexedDocumentCount("table_search_index_rebuild_new")).thenReturn(7L);

      SearchRepository repo = mock(SearchRepository.class);
      when(repo.getSearchClient()).thenReturn(client);
      when(repo.getClusterAlias()).thenReturn("");
      when(repo.getIndexMapping("table"))
          .thenReturn(
              IndexMapping.builder()
                  .indexName("table_search_index")
                  .alias("table")
                  .parentAliases(List.of("all"))
                  .childAliases(List.of())
                  .build());

      ReindexingMetrics metrics = mock(ReindexingMetrics.class);
      try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
          MockedStatic<ReindexingMetrics> metricsMock = mockStatic(ReindexingMetrics.class)) {
        entityMock.when(Entity::getSearchRepository).thenReturn(repo);
        metricsMock.when(ReindexingMetrics::getInstance).thenReturn(metrics);

        EntityReindexContext context =
            EntityReindexContext.builder()
                .entityType("table")
                .canonicalIndex("table_search_index")
                .stagedIndex("table_search_index_rebuild_new")
                .build();

        new DefaultRecreateHandler().promoteEntityIndex(context, false);
      }

      assertTrue(aliasState.deletedIndices.contains("table_search_index"));
      assertTrue(aliasState.deletedIndices.contains("table_search_index_rebuild_old"));
      assertTrue(aliasState.indexAliases.get("table_search_index_rebuild_new").contains("table"));
      assertTrue(aliasState.indexAliases.get("table_search_index_rebuild_new").contains("all"));
      verify(metrics).recordPromotionSuccess("table");
    }

    @Test
    @DisplayName("Should promote when document count cannot be determined")
    void testPromoteEntityIndexPromotesWhenDocumentCountUnknown() {
      AliasState aliasState = new AliasState();
      aliasState.put("table_search_index_rebuild_new", new HashSet<>());

      SearchClient client = aliasState.toMock();
      when(client.getIndexedDocumentCount("table_search_index_rebuild_new")).thenReturn(-1L);

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

        new DefaultRecreateHandler().promoteEntityIndex(context, false);
      }

      assertTrue(aliasState.indexAliases.get("table_search_index_rebuild_new").isEmpty());
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
    @DisplayName("Should stop promotion when alias swap fails")
    void testPromoteEntityIndexStopsWhenAliasSwapFails() {
      AliasState aliasState = new AliasState();
      aliasState.put("table_search_index_rebuild_old", Set.of("table"));
      aliasState.put("table_search_index_rebuild_new", new HashSet<>());

      SearchClient client = aliasState.toMock();
      when(client.swapAliases(anySet(), anyString(), anySet(), anySet())).thenReturn(false);

      SearchRepository repo = mock(SearchRepository.class);
      when(repo.getSearchClient()).thenReturn(client);
      when(repo.getClusterAlias()).thenReturn("");
      when(repo.getIndexMapping("table"))
          .thenReturn(
              IndexMapping.builder()
                  .indexName("table_search_index")
                  .alias("table")
                  .parentAliases(List.of("all"))
                  .childAliases(List.of())
                  .build());

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

      assertFalse(aliasState.deletedIndices.contains("table_search_index_rebuild_old"));
      assertTrue(aliasState.indexAliases.get("table_search_index_rebuild_new").isEmpty());
    }

    @Test
    @DisplayName("Should NOT delete old serving index when no aliases resolve (orphan-alias guard)")
    void testPromoteEntityIndexDoesNotOrphanAliasWhenMappingHasNoAliases() {
      AliasState aliasState = new AliasState();
      aliasState.put(
          "table_search_index_rebuild_old",
          new HashSet<>(Set.of("table", "table_search_index", "all")));
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

      assertFalse(
          aliasState.deletedIndices.contains("table_search_index_rebuild_old"),
          "Old serving index must not be deleted when no alias was attached to the staged index");
      assertTrue(
          aliasState
              .indexAliases
              .get("table_search_index_rebuild_old")
              .contains("table_search_index"),
          "Canonical alias must remain resolvable on the old index after an aborted promotion");
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

    @Test
    @DisplayName("Should swallow staged index deletion failures after failed reindex")
    void testPromoteEntityIndexSwallowsDeleteFailure() {
      SearchClient client = mock(SearchClient.class);
      when(client.getIndexedDocumentCount("table_search_index_rebuild_new")).thenReturn(0L);
      when(client.indexExists("table_search_index_rebuild_new")).thenReturn(true);
      doThrow(new IllegalStateException("delete failed"))
          .when(client)
          .deleteIndexWithBackoff("table_search_index_rebuild_new");

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

      verify(client).deleteIndexWithBackoff("table_search_index_rebuild_new");
    }

    @Test
    @DisplayName("Should record promotion failure metrics when promotion throws")
    void testPromoteEntityIndexRecordsPromotionFailure() {
      SearchClient client = mock(SearchClient.class);
      when(client.listIndicesByPrefix("table_search_index"))
          .thenThrow(new IllegalStateException("boom"));

      SearchRepository repo = mock(SearchRepository.class);
      when(repo.getSearchClient()).thenReturn(client);
      when(repo.getClusterAlias()).thenReturn("");
      when(repo.getIndexMapping("table"))
          .thenReturn(
              IndexMapping.builder().indexName("table_search_index").alias("table").build());

      ReindexingMetrics metrics = mock(ReindexingMetrics.class);
      try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
          MockedStatic<ReindexingMetrics> metricsMock = mockStatic(ReindexingMetrics.class)) {
        entityMock.when(Entity::getSearchRepository).thenReturn(repo);
        metricsMock.when(ReindexingMetrics::getInstance).thenReturn(metrics);

        EntityReindexContext context =
            EntityReindexContext.builder()
                .entityType("table")
                .canonicalIndex("table_search_index")
                .stagedIndex("table_search_index_rebuild_new")
                .build();

        new DefaultRecreateHandler().promoteEntityIndex(context, true);
      }

      verify(metrics).recordPromotionFailure("table");
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

  @Nested
  @DisplayName("reCreateIndexes Tests")
  class ReCreateIndexesTests {

    @Test
    @DisplayName("Should return empty context when no entities are provided")
    void testReCreateIndexesWithEmptyEntities() {
      SearchRepository repo = mock(SearchRepository.class);

      try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
        entityMock.when(Entity::getSearchRepository).thenReturn(repo);

        ReindexContext context = new TrackingRecreateHandler().reCreateIndexes(Set.of());
        assertTrue(context.isEmpty());
      }
    }

    @Test
    @DisplayName("Should skip missing mappings and recreate mapped entities")
    void testReCreateIndexesSkipsEntitiesWithoutMappings() {
      SearchRepository repo = mock(SearchRepository.class);
      IndexMapping tableMapping =
          IndexMapping.builder().indexName("table_search_index").alias("table").build();
      when(repo.getIndexMapping("table")).thenReturn(tableMapping);
      when(repo.getIndexMapping("missing")).thenReturn(null);

      TrackingRecreateHandler handler = new TrackingRecreateHandler();
      try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
        entityMock.when(Entity::getSearchRepository).thenReturn(repo);

        ReindexContext context = handler.reCreateIndexes(Set.of("table", "missing"));

        assertTrue(context.getEntities().contains("table"));
        assertFalse(context.getEntities().contains("missing"));
        assertEquals(Set.of("table"), handler.recreatedEntities);
      }
    }
  }

  @Nested
  @DisplayName("finalizeReindex Tests")
  class FinalizeReindexTests {

    @Test
    @DisplayName("Should promote partial data and record success when failed reindex has documents")
    void testFinalizeReindexPromotesPartialData() {
      AliasState aliasState = new AliasState();
      // Canonical is a concrete index with no aliases (the realistic first-reindex shape; OS/ES
      // forbid an alias and a concrete sharing the same name).
      aliasState.put("table_search_index", Set.of());
      aliasState.put("table_search_index_rebuild_old", Set.of("stale"));
      aliasState.put("table_search_index_rebuild_new", new HashSet<>());

      SearchClient client = aliasState.toMock();
      when(client.getIndexedDocumentCount("table_search_index_rebuild_new")).thenReturn(12L);

      SearchRepository repo = mock(SearchRepository.class);
      when(repo.getSearchClient()).thenReturn(client);
      when(repo.getClusterAlias()).thenReturn("");
      when(repo.getIndexMapping("table"))
          .thenReturn(
              IndexMapping.builder()
                  .indexName("table_search_index")
                  .alias("table")
                  .parentAliases(List.of("all"))
                  .childAliases(List.of())
                  .build());

      ReindexingMetrics metrics = mock(ReindexingMetrics.class);
      try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
          MockedStatic<ReindexingMetrics> metricsMock = mockStatic(ReindexingMetrics.class)) {
        entityMock.when(Entity::getSearchRepository).thenReturn(repo);
        metricsMock.when(ReindexingMetrics::getInstance).thenReturn(metrics);

        EntityReindexContext context =
            EntityReindexContext.builder()
                .entityType("table")
                .canonicalIndex("table_search_index")
                .activeIndex("table_search_index")
                .stagedIndex("table_search_index_rebuild_new")
                .build();

        new DefaultRecreateHandler().finalizeReindex(context, false);
      }

      assertTrue(aliasState.deletedIndices.contains("table_search_index"));
      assertTrue(aliasState.deletedIndices.contains("table_search_index_rebuild_old"));
      Set<String> stagedAliases = aliasState.indexAliases.get("table_search_index_rebuild_new");
      assertTrue(stagedAliases.contains("table"));
      assertTrue(stagedAliases.contains("table_search_index"));
      assertTrue(stagedAliases.contains("all"));
      verify(metrics).recordPromotionSuccess("table");
    }

    @Test
    @DisplayName("Should delete staged index when failed reindex has no documents")
    void testFinalizeReindexDeletesEmptyFailedStage() {
      AliasState aliasState = new AliasState();
      aliasState.put("table_search_index_rebuild_new", new HashSet<>());

      SearchClient client = aliasState.toMock();
      when(client.getIndexedDocumentCount("table_search_index_rebuild_new")).thenReturn(0L);

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

        new DefaultRecreateHandler().finalizeReindex(context, false);
      }

      assertTrue(aliasState.deletedIndices.contains("table_search_index_rebuild_new"));
    }

    @Test
    @DisplayName("Should stop cleanup when alias swap fails")
    void testFinalizeReindexStopsWhenAliasSwapFails() {
      AliasState aliasState = new AliasState();
      aliasState.put("table_search_index_rebuild_old", Set.of("table"));
      aliasState.put("table_search_index_rebuild_new", new HashSet<>());

      SearchClient client = aliasState.toMock();
      when(client.swapAliases(anySet(), anyString(), anySet(), anySet())).thenReturn(false);

      SearchRepository repo = mock(SearchRepository.class);
      when(repo.getSearchClient()).thenReturn(client);
      when(repo.getClusterAlias()).thenReturn("");
      when(repo.getIndexMapping("table"))
          .thenReturn(
              IndexMapping.builder()
                  .indexName("table_search_index")
                  .alias("table")
                  .parentAliases(List.of("all"))
                  .childAliases(List.of())
                  .build());

      try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
        entityMock.when(Entity::getSearchRepository).thenReturn(repo);

        EntityReindexContext context =
            EntityReindexContext.builder()
                .entityType("table")
                .canonicalIndex("table_search_index")
                .stagedIndex("table_search_index_rebuild_new")
                .build();

        new DefaultRecreateHandler().finalizeReindex(context, true);
      }

      assertFalse(aliasState.deletedIndices.contains("table_search_index_rebuild_old"));
      assertTrue(aliasState.indexAliases.get("table_search_index_rebuild_new").isEmpty());
    }

    @Test
    @DisplayName("Should stamp mapping version after successful finalize promotion")
    void testFinalizeReindexStampsMappingVersionOnSuccess() throws Exception {
      AliasState aliasState = new AliasState();
      aliasState.put(
          "table_search_index_rebuild_old", Set.of("table", "table_search_index", "all"));
      aliasState.put("table_search_index_rebuild_new", new HashSet<>());

      SearchClient client = aliasState.toMock();
      SearchRepository repo = mock(SearchRepository.class);
      when(repo.getSearchClient()).thenReturn(client);
      when(repo.getClusterAlias()).thenReturn("");
      when(repo.getIndexMapping("table"))
          .thenReturn(
              IndexMapping.builder()
                  .indexName("table_search_index")
                  .alias("table")
                  .parentAliases(List.of("all"))
                  .childAliases(List.of())
                  .build());

      IndexMappingVersionTracker tracker = mock(IndexMappingVersionTracker.class);
      try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
          MockedStatic<IndexMappingVersionTracker> trackerMock =
              mockStatic(IndexMappingVersionTracker.class)) {
        entityMock.when(Entity::getSearchRepository).thenReturn(repo);
        entityMock.when(Entity::getCollectionDAO).thenReturn(mock(CollectionDAO.class));
        trackerMock.when(() -> IndexMappingVersionTracker.create(any())).thenReturn(tracker);

        EntityReindexContext context =
            EntityReindexContext.builder()
                .entityType("table")
                .canonicalIndex("table_search_index")
                .stagedIndex("table_search_index_rebuild_new")
                .build();

        new DefaultRecreateHandler().finalizeReindex(context, true);
      }

      verify(tracker).updateMappingVersion("table");
    }

    @Test
    @DisplayName("Should not stamp mapping version when finalize alias swap fails")
    void testFinalizeReindexDoesNotStampWhenSwapFails() throws Exception {
      AliasState aliasState = new AliasState();
      aliasState.put("table_search_index_rebuild_old", Set.of("table"));
      aliasState.put("table_search_index_rebuild_new", new HashSet<>());

      SearchClient client = aliasState.toMock();
      when(client.swapAliases(anySet(), anyString(), anySet(), anySet())).thenReturn(false);

      SearchRepository repo = mock(SearchRepository.class);
      when(repo.getSearchClient()).thenReturn(client);
      when(repo.getClusterAlias()).thenReturn("");
      when(repo.getIndexMapping("table"))
          .thenReturn(
              IndexMapping.builder()
                  .indexName("table_search_index")
                  .alias("table")
                  .parentAliases(List.of("all"))
                  .childAliases(List.of())
                  .build());

      IndexMappingVersionTracker tracker = mock(IndexMappingVersionTracker.class);
      try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
          MockedStatic<IndexMappingVersionTracker> trackerMock =
              mockStatic(IndexMappingVersionTracker.class)) {
        entityMock.when(Entity::getSearchRepository).thenReturn(repo);
        trackerMock.when(() -> IndexMappingVersionTracker.create(any())).thenReturn(tracker);

        EntityReindexContext context =
            EntityReindexContext.builder()
                .entityType("table")
                .canonicalIndex("table_search_index")
                .stagedIndex("table_search_index_rebuild_new")
                .build();

        new DefaultRecreateHandler().finalizeReindex(context, true);
      }

      verify(tracker, never()).updateMappingVersion(anyString());
    }

    @Test
    @DisplayName("Should NOT delete old serving index when finalize resolves no aliases")
    void testFinalizeReindexDoesNotOrphanAliasWhenNoAliasesResolved() {
      AliasState aliasState = new AliasState();
      aliasState.put(
          "table_search_index_rebuild_old",
          new HashSet<>(Set.of("table", "table_search_index", "all")));
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

        new DefaultRecreateHandler().finalizeReindex(context, true);
      }

      assertFalse(
          aliasState.deletedIndices.contains("table_search_index_rebuild_old"),
          "Old serving index must not be deleted when finalize resolved no aliases");
      assertTrue(
          aliasState
              .indexAliases
              .get("table_search_index_rebuild_old")
              .contains("table_search_index"),
          "Canonical alias must remain resolvable on the old index after an aborted finalize");
    }

    @Test
    @DisplayName("First-install concrete canonical is removed atomically inside the swap")
    void testFinalizeReindexRemovesConcreteCanonicalAtomically() {
      AliasState aliasState = new AliasState();
      aliasState.put("table_search_index", new HashSet<>(Set.of("table", "all")));
      aliasState.put("table_search_index_rebuild_new", new HashSet<>());

      SearchClient client = aliasState.toMock();
      SearchRepository repo = mock(SearchRepository.class);
      when(repo.getSearchClient()).thenReturn(client);
      when(repo.getClusterAlias()).thenReturn("");
      when(repo.getIndexMapping("table"))
          .thenReturn(
              IndexMapping.builder()
                  .indexName("table_search_index")
                  .alias("table")
                  .parentAliases(List.of("all"))
                  .childAliases(List.of())
                  .build());

      try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
        entityMock.when(Entity::getSearchRepository).thenReturn(repo);

        EntityReindexContext context =
            EntityReindexContext.builder()
                .entityType("table")
                .canonicalIndex("table_search_index")
                .activeIndex("table_search_index")
                .stagedIndex("table_search_index_rebuild_new")
                .build();

        new DefaultRecreateHandler().finalizeReindex(context, true);
      }

      verify(client, never()).deleteIndexWithBackoff("table_search_index");
      assertFalse(aliasState.indexAliases.containsKey("table_search_index"));
      Set<String> stagedAliases = aliasState.indexAliases.get("table_search_index_rebuild_new");
      assertTrue(stagedAliases.contains("table_search_index"));
      assertTrue(stagedAliases.contains("table"));
      assertTrue(stagedAliases.contains("all"));
    }

    @Test
    @DisplayName("First-install: a failed atomic swap leaves the concrete index intact (no orphan)")
    void testFinalizeReindexFailedSwapDoesNotOrphanConcreteCanonical() {
      AliasState aliasState = new AliasState();
      aliasState.put("table_search_index", new HashSet<>(Set.of("table", "all")));
      aliasState.put("table_search_index_rebuild_new", new HashSet<>());

      SearchClient client = aliasState.toMock();
      when(client.swapAliases(anySet(), anyString(), anySet(), anySet())).thenReturn(false);

      SearchRepository repo = mock(SearchRepository.class);
      when(repo.getSearchClient()).thenReturn(client);
      when(repo.getClusterAlias()).thenReturn("");
      when(repo.getIndexMapping("table"))
          .thenReturn(
              IndexMapping.builder()
                  .indexName("table_search_index")
                  .alias("table")
                  .parentAliases(List.of("all"))
                  .childAliases(List.of())
                  .build());

      try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
        entityMock.when(Entity::getSearchRepository).thenReturn(repo);

        EntityReindexContext context =
            EntityReindexContext.builder()
                .entityType("table")
                .canonicalIndex("table_search_index")
                .activeIndex("table_search_index")
                .stagedIndex("table_search_index_rebuild_new")
                .build();

        new DefaultRecreateHandler().finalizeReindex(context, true);
      }

      verify(client, never()).deleteIndexWithBackoff("table_search_index");
      assertTrue(aliasState.indexAliases.containsKey("table_search_index"));
      assertTrue(aliasState.indexAliases.get("table_search_index").contains("table"));
      assertFalse(aliasState.deletedIndices.contains("table_search_index"));
    }

    @Test
    @DisplayName("Should record promotion failure when finalize promotion throws")
    void testFinalizeReindexRecordsPromotionFailureOnException() {
      SearchClient client = mock(SearchClient.class);
      when(client.listIndicesByPrefix("table_search_index"))
          .thenThrow(new IllegalStateException("boom"));

      SearchRepository repo = mock(SearchRepository.class);
      when(repo.getSearchClient()).thenReturn(client);
      when(repo.getClusterAlias()).thenReturn("");
      when(repo.getIndexMapping("table"))
          .thenReturn(
              IndexMapping.builder().indexName("table_search_index").alias("table").build());

      ReindexingMetrics metrics = mock(ReindexingMetrics.class);
      try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
          MockedStatic<ReindexingMetrics> metricsMock = mockStatic(ReindexingMetrics.class)) {
        entityMock.when(Entity::getSearchRepository).thenReturn(repo);
        metricsMock.when(ReindexingMetrics::getInstance).thenReturn(metrics);

        EntityReindexContext context =
            EntityReindexContext.builder()
                .entityType("table")
                .canonicalIndex("table_search_index")
                .stagedIndex("table_search_index_rebuild_new")
                .build();

        new DefaultRecreateHandler().finalizeReindex(context, true);
      }

      verify(metrics).recordPromotionFailure("table");
    }

    @Test
    @DisplayName(
        "Should not delete-by-alias-name when canonical is currently an alias on a previous staged")
    void testFinalizeReindexSkipsDeleteWhenCanonicalIsAlias() {
      // After the first reindex, the canonical name (table_search_index) is an alias on the
      // previous staged index, not a concrete one. OpenSearch's listIndicesByPrefix returns the
      // alias name as one of its result keys; without the guard, finalizeReindex would attempt
      // deleteIndexWithBackoff(canonicalIndex), fail with "matches an alias" and burn ~31s of
      // exponential backoff per entity. The guard must drop the alias name from oldIndicesToDelete
      // BEFORE the delete branch fires.
      AliasState aliasState = new AliasState();
      aliasState.put(
          "table_search_index_rebuild_old",
          new HashSet<>(Set.of("table_search_index", "table", "all")));
      aliasState.put("table_search_index_rebuild_new", new HashSet<>());
      // Simulate the OpenSearch behavior where listIndicesByPrefix surfaces the alias name itself
      // among its result keys (the key in our AliasState mock is what listIndicesByPrefix returns).
      aliasState.put("table_search_index", Set.of());

      SearchClient client = aliasState.toMock();
      SearchRepository repo = mock(SearchRepository.class);
      when(repo.getSearchClient()).thenReturn(client);
      when(repo.getClusterAlias()).thenReturn("");
      when(repo.getIndexMapping("table"))
          .thenReturn(
              IndexMapping.builder()
                  .indexName("table_search_index")
                  .alias("table")
                  .parentAliases(List.of("all"))
                  .childAliases(List.of())
                  .build());

      try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
        entityMock.when(Entity::getSearchRepository).thenReturn(repo);

        EntityReindexContext context =
            EntityReindexContext.builder()
                .entityType("table")
                .canonicalIndex("table_search_index")
                .activeIndex("table_search_index_rebuild_old")
                .stagedIndex("table_search_index_rebuild_new")
                .build();

        new DefaultRecreateHandler().finalizeReindex(context, true);
      }

      verify(client, never()).deleteIndexWithBackoff("table_search_index");
      assertTrue(
          aliasState.deletedIndices.contains("table_search_index_rebuild_old"),
          "Old concrete rebuild must still be cleaned up by the swap path");
      Set<String> stagedAliases = aliasState.indexAliases.get("table_search_index_rebuild_new");
      assertTrue(
          stagedAliases.contains("table_search_index"),
          () -> "Canonical alias must end up on staged after promotion; got " + stagedAliases);
      assertTrue(
          stagedAliases.contains("table"),
          () -> "Short alias must end up on staged after promotion; got " + stagedAliases);
      assertTrue(
          stagedAliases.contains("all"),
          () -> "Parent alias must end up on staged after promotion; got " + stagedAliases);
    }

    @Test
    @DisplayName(
        "Should attach parent aliases from the mapping when the context carries none "
            + "(participant-reconstructed context)")
    void testFinalizeReindexDerivesAliasesFromMappingWhenContextHasNoAliases() {
      // Regression for the distributed-reindex alias-loss bug: a participant server reconstructs
      // the
      // ReindexContext from only the job's staged-index mapping (ReindexContext
      // .fromStagedIndexMapping), so existingAliases/parentAliases are empty. finalizeReindex must
      // still attach the column index's parent aliases (all/table/dataAsset) by re-deriving them
      // from indexMapping.json — otherwise the promoted column index drops out of the
      // dataAsset/global-search alias. Before the fix, finalize trusted
      // context.getExistingAliases()
      // (empty here) and aborted promotion without attaching any alias.
      AliasState aliasState = new AliasState();
      aliasState.put(
          "column_search_index_rebuild_old",
          new HashSet<>(Set.of("tableColumn", "column_search_index", "all", "table", "dataAsset")));
      aliasState.put("column_search_index_rebuild_new", new HashSet<>());

      SearchClient client = aliasState.toMock();
      SearchRepository repo = mock(SearchRepository.class);
      when(repo.getSearchClient()).thenReturn(client);
      when(repo.getClusterAlias()).thenReturn("");
      when(repo.getIndexMapping("tableColumn"))
          .thenReturn(
              IndexMapping.builder()
                  .indexName("column_search_index")
                  .alias("tableColumn")
                  .parentAliases(List.of("all", "table", "dataAsset"))
                  .childAliases(List.of())
                  .build());

      try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
        entityMock.when(Entity::getSearchRepository).thenReturn(repo);

        EntityReindexContext context =
            EntityReindexContext.builder()
                .entityType("tableColumn")
                .canonicalIndex("column_search_index")
                .stagedIndex("column_search_index_rebuild_new")
                .existingAliases(new HashSet<>())
                .parentAliases(new HashSet<>())
                .build();

        new DefaultRecreateHandler().finalizeReindex(context, true);
      }

      Set<String> stagedAliases = aliasState.indexAliases.get("column_search_index_rebuild_new");
      assertTrue(stagedAliases.contains("tableColumn"));
      assertTrue(stagedAliases.contains("column_search_index"));
      assertTrue(
          stagedAliases.contains("all"),
          () -> "parent alias 'all' must be derived from the mapping; got " + stagedAliases);
      assertTrue(
          stagedAliases.contains("table"),
          () -> "parent alias 'table' must be derived from the mapping; got " + stagedAliases);
      assertTrue(
          stagedAliases.contains("dataAsset"),
          () ->
              "parent alias 'dataAsset' must be derived from the mapping — this is the regression; "
                  + "got "
                  + stagedAliases);
      assertTrue(aliasState.deletedIndices.contains("column_search_index_rebuild_old"));
    }
  }

  @Nested
  @DisplayName("recreateIndexFromMapping Tests")
  class RecreateIndexFromMappingTests {

    @Test
    @DisplayName("Should derive aliases from the mapping only, never from the live index in ES")
    void testRecreateIndexFromMappingUsesAliasTargetAsActiveIndex() {
      SearchClient client = mock(SearchClient.class);
      when(client.indexExists("table_search_index")).thenReturn(false);
      when(client.getIndicesByAlias("table")).thenReturn(Set.of("table_search_index_v1"));

      SearchRepository repo = mock(SearchRepository.class);
      when(repo.getClusterAlias()).thenReturn("");
      when(repo.getSearchClient()).thenReturn(client);

      IndexMapping mapping =
          IndexMapping.builder()
              .indexName("table_search_index")
              .alias("table")
              .parentAliases(List.of("all"))
              .childAliases(List.of())
              .build();
      when(repo.readIndexMapping(mapping)).thenReturn("{\"mappings\":{}}");

      ReindexContext context = new ReindexContext();
      try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
        entityMock.when(Entity::getSearchRepository).thenReturn(repo);

        new DefaultRecreateHandler().recreateIndexFromMapping(context, mapping, "table");
      }

      assertEquals("table_search_index", context.getCanonicalIndex("table").orElseThrow());
      assertEquals("table_search_index_v1", context.getOriginalIndex("table").orElseThrow());
      // Aliases come purely from the mapping (short alias + raw index name); stray aliases on the
      // live index are never read or carried forward.
      verify(client, never()).getAliases(anyString());
      assertTrue(context.getExistingAliases("table").contains("table"));
      assertTrue(context.getExistingAliases("table").contains("table_search_index"));
      assertTrue(context.getParentAliases("table").contains("all"));
      assertTrue(
          context.getStagedIndex("table").orElseThrow().startsWith("table_search_index_rebuild_"));
    }

    @Test
    @DisplayName("Should rebuild from scratch when no active index or alias exists")
    void testRecreateIndexFromMappingBuildsFromScratch() {
      SearchClient client = mock(SearchClient.class);
      when(client.indexExists("table_search_index")).thenReturn(false);
      when(client.getIndicesByAlias("table")).thenReturn(Set.of());

      SearchRepository repo = mock(SearchRepository.class);
      when(repo.getClusterAlias()).thenReturn("");
      when(repo.getSearchClient()).thenReturn(client);

      IndexMapping mapping =
          IndexMapping.builder().indexName("table_search_index").alias("table").build();
      when(repo.readIndexMapping(mapping)).thenReturn("{\"mappings\":{}}");

      ReindexContext context = new ReindexContext();
      try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
        entityMock.when(Entity::getSearchRepository).thenReturn(repo);

        new DefaultRecreateHandler().recreateIndexFromMapping(context, mapping, "table");
      }

      assertTrue(context.getOriginalIndex("table").isEmpty());
      assertTrue(context.getExistingAliases("table").contains("table"));
      assertTrue(context.getExistingAliases("table").contains("table_search_index"));
    }

    @Test
    @DisplayName("Should stop when mapping content cannot be read")
    void testRecreateIndexFromMappingStopsWhenMappingContentIsMissing() {
      SearchClient client = mock(SearchClient.class);
      when(client.indexExists("table_search_index")).thenReturn(true);

      SearchRepository repo = mock(SearchRepository.class);
      when(repo.getClusterAlias()).thenReturn("");
      when(repo.getSearchClient()).thenReturn(client);

      IndexMapping mapping =
          IndexMapping.builder().indexName("table_search_index").alias("table").build();
      when(repo.readIndexMapping(mapping)).thenReturn(null);

      ReindexContext context = new ReindexContext();
      try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
        entityMock.when(Entity::getSearchRepository).thenReturn(repo);

        new DefaultRecreateHandler().recreateIndexFromMapping(context, mapping, "table");
      }

      assertTrue(context.isEmpty());
    }

    @Test
    @DisplayName("Should ignore null context and index mappings")
    void testRecreateIndexFromMappingIgnoresNullInputs() {
      DefaultRecreateHandler handler = new DefaultRecreateHandler();
      IndexMapping mapping =
          IndexMapping.builder().indexName("table_search_index").alias("table").build();

      handler.recreateIndexFromMapping(new ReindexContext(), null, "table");
      handler.recreateIndexFromMapping(null, mapping, "table");

      assertNotNull(handler);
    }
  }

  private static final class TrackingRecreateHandler extends DefaultRecreateHandler {
    private final Set<String> recreatedEntities = new HashSet<>();

    @Override
    protected void recreateIndexFromMapping(
        ReindexContext context, IndexMapping indexMapping, String entityType) {
      recreatedEntities.add(entityType);
      context.add(entityType, "canonical", "active", "staged", Set.of("alias"), "alias", List.of());
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
                Set<String> aliases = new HashSet<>(invocation.getArgument(1));
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
                Set<String> aliases = new HashSet<>(invocation.getArgument(1));
                indexAliases.computeIfAbsent(index, k -> new HashSet<>()).addAll(aliases);
                return null;
              })
          .when(client)
          .addAliases(anyString(), anySet());

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

      // Atomic swap: remove aliases from old indices, delete any concrete indicesToRemove
      // (remove_index) and add aliases to the new index — all or nothing.
      lenient()
          .doAnswer(
              invocation -> {
                @SuppressWarnings("unchecked")
                Set<String> oldIndices = invocation.getArgument(0);
                String newIndex = invocation.getArgument(1);
                @SuppressWarnings("unchecked")
                Set<String> aliases = new HashSet<>(invocation.getArgument(2));
                @SuppressWarnings("unchecked")
                Set<String> indicesToRemove = invocation.getArgument(3);

                for (String oldIndex : oldIndices) {
                  Set<String> oldAliases = indexAliases.get(oldIndex);
                  if (oldAliases != null) {
                    oldAliases.removeAll(aliases);
                  }
                }

                for (String indexToRemove : indicesToRemove) {
                  indexAliases.remove(indexToRemove);
                  deletedIndices.add(indexToRemove);
                }

                indexAliases.computeIfAbsent(newIndex, k -> new HashSet<>()).addAll(aliases);
                return true;
              })
          .when(client)
          .swapAliases(anySet(), anyString(), anySet(), anySet());

      return client;
    }
  }

  @Nested
  @DisplayName("buildRevertJson Tests")
  class BuildRevertJsonTests {

    @Test
    @DisplayName("Returns null when both live and bulk are unset")
    void noConfig() {
      assertEquals(null, DefaultRecreateHandler.buildRevertJson(null, null));
    }

    @Test
    @DisplayName("Returns only fields the admin set when bulk overrides were not applied")
    void liveOnlyWithoutBulk() {
      org.openmetadata.schema.system.IndexSettings live =
          new org.openmetadata.schema.system.IndexSettings()
              .withRefreshInterval("30s")
              .withNumberOfReplicas(2);
      String json = DefaultRecreateHandler.buildRevertJson(live, null);
      assertNotNull(json);
      assertTrue(json.contains("\"refresh_interval\":\"30s\""));
      assertTrue(json.contains("\"number_of_replicas\":2"));
      // No bulk → no implicit safety fields
      assertFalse(json.contains("\"translog\""));
    }

    @Test
    @DisplayName("Bulk override + missing live: revert fills safe defaults for every bulk field")
    void bulkOverrideTriggersFullRevert() {
      org.openmetadata.schema.system.BulkIndexOverrides bulk =
          new org.openmetadata.schema.system.BulkIndexOverrides()
              .withRefreshInterval("-1")
              .withNumberOfReplicas(0)
              .withTranslogDurability(
                  org.openmetadata.schema.system.BulkIndexOverrides.TranslogDurability.ASYNC)
              .withTranslogSyncInterval("30s");
      String json = DefaultRecreateHandler.buildRevertJson(null, bulk);
      assertNotNull(json);
      // Every field bulk touched gets a safe live default — never the bulk value.
      assertTrue(json.contains("\"refresh_interval\":\"1s\""));
      assertTrue(json.contains("\"number_of_replicas\":1"));
      // Translog fields land in a nested object — what the OS/ES typed IndexSettings
      // model expects when its _DESERIALIZER parses the body.
      assertTrue(json.contains("\"translog\":{"));
      assertTrue(json.contains("\"durability\":\"request\""));
      assertTrue(json.contains("\"sync_interval\":\"5s\""));
    }

    @Test
    @DisplayName(
        "Partial live + full bulk: live values win, bulk-only fields fall back to defaults")
    void partialLiveOverridesBulk() {
      // Admin only set translogDurability on live; bulk disabled refresh, replicas, both translog
      // fields. Expectation: translogDurability comes from live; the rest fall back to safe
      // defaults (NOT bulk values).
      org.openmetadata.schema.system.IndexSettings live =
          new org.openmetadata.schema.system.IndexSettings()
              .withTranslogDurability(
                  org.openmetadata.schema.system.IndexSettings.TranslogDurability.REQUEST);
      org.openmetadata.schema.system.BulkIndexOverrides bulk =
          new org.openmetadata.schema.system.BulkIndexOverrides()
              .withRefreshInterval("-1")
              .withNumberOfReplicas(0)
              .withTranslogDurability(
                  org.openmetadata.schema.system.BulkIndexOverrides.TranslogDurability.ASYNC)
              .withTranslogSyncInterval("30s");
      String json = DefaultRecreateHandler.buildRevertJson(live, bulk);
      assertNotNull(json);
      assertTrue(json.contains("\"refresh_interval\":\"1s\""));
      assertTrue(json.contains("\"number_of_replicas\":1"));
      // Translog fields land in a nested object — what the OS/ES typed IndexSettings
      // model expects when its _DESERIALIZER parses the body.
      assertTrue(json.contains("\"translog\":{"));
      assertTrue(json.contains("\"durability\":\"request\""));
      assertTrue(json.contains("\"sync_interval\":\"5s\""));
    }

    @Test
    @DisplayName("Live refresh_interval '-1' is never applied as a live value (guard -> 1s)")
    void liveRefreshDisabledIsOverriddenToDefault() {
      // Misconfiguration: liveIndexSettings.refreshInterval is "-1" (refresh disabled) — e.g.
      // copied from the bulk side or a stale saved config. Without the guard the revert would
      // faithfully re-apply "-1" to the promoted index, leaving it unsearchable until a manual
      // _refresh (the "reindex finishes but the page is empty" symptom). The revert must override
      // it back to the near-real-time default.
      org.openmetadata.schema.system.IndexSettings live =
          new org.openmetadata.schema.system.IndexSettings().withRefreshInterval("-1");
      org.openmetadata.schema.system.BulkIndexOverrides bulk =
          new org.openmetadata.schema.system.BulkIndexOverrides().withRefreshInterval("-1");
      String json = DefaultRecreateHandler.buildRevertJson(live, bulk);
      assertNotNull(json);
      assertTrue(json.contains("\"refresh_interval\":\"1s\""));
      assertFalse(json.contains("\"refresh_interval\":\"-1\""));
    }

    @Test
    @DisplayName("Bulk JSON properly escapes admin-supplied string values")
    void bulkSettingsEscapesQuotesInValues() {
      // Hostile / unusual but legal admin input — quote, backslash, newline. Naive string
      // concatenation would produce invalid JSON; Jackson must escape these.
      org.openmetadata.schema.system.BulkIndexOverrides bulk =
          new org.openmetadata.schema.system.BulkIndexOverrides()
              .withRefreshInterval("3s\"; \\rogue")
              .withTranslogSyncInterval("60s\n");
      String json = DefaultRecreateHandler.buildBulkSettingsJson(bulk);
      assertNotNull(json);
      // Must round-trip parse — the strongest evidence escaping worked.
      org.openmetadata.schema.utils.JsonUtils.readTree(json);
      assertTrue(json.contains("\\\"")); // escaped quote present
      assertTrue(json.contains("\\\\")); // escaped backslash present
    }
  }
}
