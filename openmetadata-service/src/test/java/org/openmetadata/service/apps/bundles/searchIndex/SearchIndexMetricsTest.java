package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockConstruction;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.search.IndexManagementClient;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.search.SearchRepository;

class SearchIndexMetricsTest {

  @Test
  void refreshStatsUpdatesCachedSnapshotFromOneBulkInventory() throws IOException {
    SimpleMeterRegistry registry = new SimpleMeterRegistry();
    SearchRepository searchRepository = mock(SearchRepository.class);
    SearchClient searchClient = mock(SearchClient.class);
    IndexMapping tableMapping = mock(IndexMapping.class);
    IndexMapping userMapping = mock(IndexMapping.class);
    String oldRebuildIndex = "table_rebuild_" + (System.currentTimeMillis() - (31L * 60 * 1000));

    when(searchRepository.getSearchClient()).thenReturn(searchClient);
    when(searchRepository.getClusterAlias()).thenReturn("");
    when(searchClient.getAllIndexStats())
        .thenReturn(
            List.of(
                indexStats("table_v1", Set.of("table")),
                indexStats("topic", Set.of()),
                indexStats(oldRebuildIndex, Set.of())));
    when(searchRepository.getEntityIndexMap())
        .thenReturn(Map.of("table", tableMapping, "user", userMapping));
    when(tableMapping.getIndexName("")).thenReturn("table");
    when(userMapping.getIndexName("")).thenReturn("user");

    try (var validatorMock =
        mockConstruction(
            SearchIndexClusterValidator.class,
            (mock, context) ->
                when(mock.getClusterCapacity(searchRepository))
                    .thenReturn(
                        new SearchIndexClusterValidator.ClusterCapacity(45, 100, 0.45, 55)))) {
      SearchIndexMetrics metrics = new SearchIndexMetrics(registry, searchRepository);
      metrics.registerMetrics();
      metrics.refreshStats();

      SearchIndexMetrics.IndexStats stats = metrics.getCurrentStats();
      assertEquals(3, stats.totalIndices());
      assertEquals(1, stats.rebuildIndices());
      assertEquals(1, stats.orphanedIndices());
      assertEquals(45, stats.currentShards());
      assertEquals(100, stats.maxShards());
      assertEquals(45.0, stats.shardUsagePercent(), 0.0001);
      assertEquals(1, stats.missingIndices());
      assertEquals(2, stats.expectedIndices());
      assertTrue(stats.lastUpdated() > 0);

      assertEquals(3.0, registry.get("search_index_total_count").gauge().value(), 0.0001);
      assertEquals(1.0, registry.get("search_index_rebuild_count").gauge().value(), 0.0001);
      assertEquals(1.0, registry.get("search_index_orphaned_count").gauge().value(), 0.0001);
      assertEquals(45.0, registry.get("search_index_shard_current").gauge().value(), 0.0001);
      assertEquals(100.0, registry.get("search_index_shard_max").gauge().value(), 0.0001);
      assertEquals(45.0, registry.get("search_index_shard_usage_percent").gauge().value(), 0.0001);
      assertEquals(1.0, registry.get("search_index_missing_count").gauge().value(), 0.0001);
      assertEquals(2.0, registry.get("search_index_expected_count").gauge().value(), 0.0001);
      verify(searchClient).getAllIndexStats();
      verify(searchRepository, never()).indexExists(any(IndexMapping.class));
    }
  }

  @Test
  void refreshStatsRetainsLastSnapshotWhenBulkInventoryFails() throws IOException {
    SimpleMeterRegistry registry = new SimpleMeterRegistry();
    SearchRepository searchRepository = mock(SearchRepository.class);
    SearchClient searchClient = mock(SearchClient.class);

    when(searchRepository.getSearchClient()).thenReturn(searchClient);
    when(searchClient.getAllIndexStats()).thenReturn(List.of(indexStats("table", Set.of())));
    when(searchRepository.getEntityIndexMap()).thenReturn(Map.of());

    SearchIndexMetrics metrics = new SearchIndexMetrics(registry, searchRepository);

    try (var validatorMock =
        mockConstruction(
            SearchIndexClusterValidator.class,
            (mock, context) ->
                when(mock.getClusterCapacity(searchRepository))
                    .thenReturn(
                        new SearchIndexClusterValidator.ClusterCapacity(10, 100, 0.10, 90)))) {
      metrics.refreshStats();
    }

    SearchIndexMetrics.IndexStats initial = metrics.getCurrentStats();
    when(searchClient.getAllIndexStats()).thenThrow(new IOException("cluster down"));

    metrics.refreshStats();

    SearchIndexMetrics.IndexStats fallback = metrics.getCurrentStats();
    assertEquals(initial, fallback);
  }

  private static IndexManagementClient.IndexStats indexStats(String name, Set<String> aliases) {
    return new IndexManagementClient.IndexStats(name, 0, 0, 1, 0, 0, "GREEN", aliases);
  }
}
