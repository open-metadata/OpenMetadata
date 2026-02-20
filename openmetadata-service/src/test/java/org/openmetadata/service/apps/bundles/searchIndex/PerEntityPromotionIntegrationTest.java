package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anySet;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.apps.bundles.searchIndex.stats.StageStatsTracker;
import org.openmetadata.service.apps.bundles.searchIndex.stats.StatsResult;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.DefaultRecreateHandler;
import org.openmetadata.service.search.EntityReindexContext;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.socket.WebSocketManager;

@ExtendWith(MockitoExtension.class)
@Slf4j
@DisplayName("Per-Entity Promotion Integration Tests")
class PerEntityPromotionIntegrationTest extends OpenMetadataApplicationTest {

  @Mock private CollectionDAO collectionDAO;
  @Mock private SearchRepository searchRepository;
  @Mock private BulkSink mockSink;
  @Mock private WebSocketManager webSocketManager;
  @Mock private CollectionDAO.SearchIndexServerStatsDAO statsDAO;

  private SearchIndexExecutor executor;
  private MockedStatic<WebSocketManager> webSocketManagerMock;

  @BeforeEach
  void setUp() {
    executor = new SearchIndexExecutor(collectionDAO, searchRepository);

    webSocketManagerMock = mockStatic(WebSocketManager.class);
    webSocketManagerMock.when(WebSocketManager::getInstance).thenReturn(webSocketManager);
  }

  @AfterEach
  void tearDown() {
    if (webSocketManagerMock != null) {
      webSocketManagerMock.close();
    }
    if (executor != null) {
      executor.close();
    }
  }

  @Nested
  @DisplayName("StageStatsTracker Integration Tests")
  class StageStatsTrackerIntegrationTests {

    @Test
    @DisplayName("Should track stats for each entity type separately")
    void testTrackerPerEntityType() {
      String jobId = UUID.randomUUID().toString();
      String serverId = "test-server";

      StageStatsTracker tableTracker = new StageStatsTracker(jobId, serverId, "table", statsDAO);
      StageStatsTracker userTracker = new StageStatsTracker(jobId, serverId, "user", statsDAO);

      tableTracker.recordReader(StatsResult.SUCCESS);
      tableTracker.recordReader(StatsResult.SUCCESS);
      tableTracker.recordProcess(StatsResult.SUCCESS);
      tableTracker.recordSink(StatsResult.SUCCESS);

      userTracker.recordReader(StatsResult.SUCCESS);
      userTracker.recordProcess(StatsResult.FAILED);

      assertEquals(2, tableTracker.getReader().getSuccess().get());
      assertEquals(1, tableTracker.getProcess().getSuccess().get());
      assertEquals(1, tableTracker.getSink().getSuccess().get());

      assertEquals(1, userTracker.getReader().getSuccess().get());
      assertEquals(1, userTracker.getProcess().getFailed().get());
      assertEquals(0, userTracker.getSink().getSuccess().get());
    }

    @Test
    @DisplayName("Should track warnings separately from failures")
    void testWarningsTrackedSeparately() {
      String jobId = UUID.randomUUID().toString();
      String serverId = "test-server";

      StageStatsTracker tracker = new StageStatsTracker(jobId, serverId, "table", statsDAO);

      tracker.recordReader(StatsResult.SUCCESS);
      tracker.recordReader(StatsResult.WARNING);
      tracker.recordReader(StatsResult.FAILED);
      tracker.recordReader(StatsResult.WARNING);

      assertEquals(1, tracker.getReader().getSuccess().get());
      assertEquals(1, tracker.getReader().getFailed().get());
      assertEquals(2, tracker.getReader().getWarnings().get());
      assertEquals(2, tracker.getReader().getTotal());
    }

    @Test
    @DisplayName("Should track all four pipeline stages")
    void testAllFourStagesTracked() {
      String jobId = UUID.randomUUID().toString();
      String serverId = "test-server";

      StageStatsTracker tracker = new StageStatsTracker(jobId, serverId, "table", statsDAO);

      tracker.recordReader(StatsResult.SUCCESS);
      tracker.recordProcess(StatsResult.SUCCESS);
      tracker.recordSink(StatsResult.SUCCESS);
      tracker.recordVector(StatsResult.SUCCESS);

      assertEquals(1, tracker.getReader().getSuccess().get());
      assertEquals(1, tracker.getProcess().getSuccess().get());
      assertEquals(1, tracker.getSink().getSuccess().get());
      assertEquals(1, tracker.getVector().getSuccess().get());
    }
  }

  @Nested
  @DisplayName("Per-Entity Promotion Flow Tests")
  class PerEntityPromotionFlowTests {

    @Test
    @DisplayName("Should promote entity index immediately after reindex success")
    void testImmediatePromotionOnSuccess() {
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
      Set<String> aliases = aliasState.indexAliases.get("table_search_index_rebuild_new");
      assertTrue(aliases.contains("table"));
      assertTrue(aliases.contains("table_search_index"));
      assertTrue(aliases.contains("all"));
      assertTrue(aliases.contains("dataAsset"));
    }

    @Test
    @DisplayName("Should not affect other entity types during promotion")
    void testPromotionIsolation() {
      AliasState aliasState = new AliasState();
      aliasState.put(
          "table_search_index_rebuild_old",
          Set.of("table", "table_search_index", "all", "dataAsset"));
      aliasState.put("table_search_index_rebuild_new", new HashSet<>());
      aliasState.put("user_search_index_rebuild_old", Set.of("user", "user_search_index", "all"));

      SearchClient client = aliasState.toMock();
      SearchRepository repo = mock(SearchRepository.class);
      when(repo.getSearchClient()).thenReturn(client);
      when(repo.getClusterAlias()).thenReturn("");

      IndexMapping tableMapping =
          IndexMapping.builder()
              .indexName("table_search_index")
              .alias("table")
              .parentAliases(List.of("all", "dataAsset"))
              .childAliases(List.of())
              .build();
      when(repo.getIndexMapping("table")).thenReturn(tableMapping);

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
      assertTrue(
          aliasState.indexAliases.containsKey("user_search_index_rebuild_old"),
          "User index should not be affected");
      assertEquals(
          Set.of("user", "user_search_index", "all"),
          aliasState.indexAliases.get("user_search_index_rebuild_old"),
          "User aliases should remain unchanged");
    }

    @Test
    @DisplayName("Should delete staged index on reindex failure")
    void testStagedIndexDeletedOnFailure() {
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
  }

  @Nested
  @DisplayName("Stats DAO Integration Tests")
  class StatsDaoIntegrationTests {

    @Test
    @DisplayName("Should flush stats to DAO periodically")
    void testPeriodicFlushToDao() {
      String jobId = UUID.randomUUID().toString();
      String serverId = "test-server";

      StageStatsTracker tracker = new StageStatsTracker(jobId, serverId, "table", statsDAO);

      for (int i = 0; i < 100; i++) {
        tracker.recordReader(StatsResult.SUCCESS);
      }

      verify(statsDAO, atLeastOnce())
          .incrementStats(
              anyString(),
              eq(jobId),
              eq(serverId),
              eq("table"),
              any(),
              any(),
              any(),
              any(),
              any(),
              any(),
              any(),
              any(),
              any(),
              any(),
              any(),
              any());
    }

    @Test
    @DisplayName("Should include all stage stats in incrementStats")
    void testAllStatsIncludedInIncrementStats() {
      String jobId = UUID.randomUUID().toString();
      String serverId = "test-server";

      StageStatsTracker tracker = new StageStatsTracker(jobId, serverId, "table", statsDAO);

      tracker.recordReader(StatsResult.SUCCESS);
      tracker.recordProcess(StatsResult.FAILED);
      tracker.recordSink(StatsResult.WARNING);
      tracker.recordVector(StatsResult.SUCCESS);

      tracker.flush();

      // Verify incrementStats is called with delta values
      verify(statsDAO, times(1))
          .incrementStats(
              anyString(),
              eq(jobId),
              eq(serverId),
              eq("table"),
              eq(1L), // readerSuccess
              eq(0L), // readerFailed
              eq(0L), // readerWarnings
              eq(0L), // sinkSuccess (warning doesn't count as success)
              eq(0L), // sinkFailed
              eq(0L), // processSuccess
              eq(1L), // processFailed
              eq(1L), // vectorSuccess
              eq(0L), // vectorFailed
              any(),
              any(),
              any());
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

      return client;
    }
  }
}
