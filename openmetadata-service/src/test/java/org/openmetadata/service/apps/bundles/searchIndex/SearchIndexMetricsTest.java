package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockConstruction;
import static org.mockito.Mockito.when;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.search.SearchRepository;

class SearchIndexMetricsTest {

  @Test
  void refreshStatsUpdatesCachedSnapshotAndPublishedGauges() {
    SimpleMeterRegistry registry = new SimpleMeterRegistry();
    SearchRepository searchRepository = mock(SearchRepository.class);
    SearchClient searchClient = mock(SearchClient.class);
    IndexMapping tableMapping = mock(IndexMapping.class);
    IndexMapping userMapping = mock(IndexMapping.class);

    when(searchRepository.getSearchClient()).thenReturn(searchClient);
    when(searchClient.listIndicesByPrefix(""))
        .thenReturn(Set.of("table", "user", "table_rebuild_123"));
    when(searchRepository.getEntityIndexMap())
        .thenReturn(Map.of("table", tableMapping, "user", userMapping));
    when(searchRepository.indexExists(tableMapping)).thenReturn(true);
    when(searchRepository.indexExists(userMapping)).thenReturn(false);

    try (var orphanedCleanerMock =
            mockConstruction(
                OrphanedIndexCleaner.class,
                (mock, context) -> {
                  when(mock.countRebuildIndices(searchClient)).thenReturn(1);
                  when(mock.countOrphanedIndices(searchClient)).thenReturn(1);
                });
        var validatorMock =
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
    }
  }

  @Test
  void refreshStatsFallsBackToConservativeSnapshotWhenRefreshDependenciesFail() {
    SimpleMeterRegistry registry = new SimpleMeterRegistry();
    SearchRepository searchRepository = mock(SearchRepository.class);
    SearchClient searchClient = mock(SearchClient.class);

    when(searchRepository.getSearchClient()).thenReturn(searchClient);
    when(searchClient.listIndicesByPrefix("")).thenReturn(Set.of("table"));
    when(searchRepository.getEntityIndexMap()).thenReturn(Map.of());

    SearchIndexMetrics metrics = new SearchIndexMetrics(registry, searchRepository);

    try (var orphanedCleanerMock =
            mockConstruction(
                OrphanedIndexCleaner.class,
                (mock, context) -> {
                  when(mock.countRebuildIndices(searchClient)).thenReturn(0);
                  when(mock.countOrphanedIndices(searchClient)).thenReturn(0);
                });
        var validatorMock =
            mockConstruction(
                SearchIndexClusterValidator.class,
                (mock, context) ->
                    when(mock.getClusterCapacity(searchRepository))
                        .thenReturn(
                            new SearchIndexClusterValidator.ClusterCapacity(10, 100, 0.10, 90)))) {
      metrics.refreshStats();
    }

    SearchIndexMetrics.IndexStats initial = metrics.getCurrentStats();
    when(searchClient.listIndicesByPrefix("")).thenThrow(new RuntimeException("cluster down"));

    metrics.refreshStats();

    SearchIndexMetrics.IndexStats fallback = metrics.getCurrentStats();
    assertEquals(0, fallback.totalIndices());
    assertEquals(0, fallback.rebuildIndices());
    assertEquals(0, fallback.orphanedIndices());
    assertEquals(0, fallback.currentShards());
    assertEquals(1000, fallback.maxShards());
    assertEquals(0.0, fallback.shardUsagePercent(), 0.0001);
    assertTrue(fallback.lastUpdated() >= initial.lastUpdated());
  }
}
