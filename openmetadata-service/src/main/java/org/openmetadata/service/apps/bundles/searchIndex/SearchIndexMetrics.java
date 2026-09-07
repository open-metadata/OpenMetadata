/*
 *  Copyright 2024 Collate
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

package org.openmetadata.service.apps.bundles.searchIndex;

import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicReference;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.search.IndexManagementClient;
import org.openmetadata.service.search.SearchRepository;

/**
 * Exposes Prometheus metrics for search index health monitoring. Tracks index counts, shard usage,
 * and orphaned rebuild indices.
 */
@Slf4j
public class SearchIndexMetrics {

  private static final String METRIC_PREFIX = "search_index_";

  private final MeterRegistry meterRegistry;
  private final SearchRepository searchRepository;
  private final AtomicReference<IndexStats> cachedStats = new AtomicReference<>(IndexStats.empty());

  public record IndexStats(
      int totalIndices,
      int rebuildIndices,
      int orphanedIndices,
      int currentShards,
      int maxShards,
      double shardUsagePercent,
      int missingIndices,
      int expectedIndices,
      long lastUpdated) {

    public static IndexStats empty() {
      return new IndexStats(0, 0, 0, 0, 0, 0.0, 0, 0, 0);
    }
  }

  public SearchIndexMetrics(MeterRegistry meterRegistry, SearchRepository searchRepository) {
    this.meterRegistry = meterRegistry;
    this.searchRepository = searchRepository;
  }

  public void registerMetrics() {
    Gauge.builder(METRIC_PREFIX + "total_count", () -> cachedStats.get().totalIndices())
        .description("Total number of search indices")
        .register(meterRegistry);

    Gauge.builder(METRIC_PREFIX + "rebuild_count", () -> cachedStats.get().rebuildIndices())
        .description("Count of rebuild indices (containing _rebuild_ in name)")
        .register(meterRegistry);

    Gauge.builder(METRIC_PREFIX + "orphaned_count", () -> cachedStats.get().orphanedIndices())
        .description("Count of orphaned rebuild indices (no aliases)")
        .register(meterRegistry);

    Gauge.builder(METRIC_PREFIX + "shard_current", () -> cachedStats.get().currentShards())
        .description("Current number of shards in the cluster")
        .register(meterRegistry);

    Gauge.builder(METRIC_PREFIX + "shard_max", () -> cachedStats.get().maxShards())
        .description("Maximum number of shards allowed in the cluster")
        .register(meterRegistry);

    Gauge.builder(
            METRIC_PREFIX + "shard_usage_percent", () -> cachedStats.get().shardUsagePercent())
        .description("Shard usage as a percentage (0-100)")
        .register(meterRegistry);

    Gauge.builder(METRIC_PREFIX + "missing_count", () -> cachedStats.get().missingIndices())
        .description("Expected indices not found in the search cluster")
        .register(meterRegistry);

    Gauge.builder(METRIC_PREFIX + "expected_count", () -> cachedStats.get().expectedIndices())
        .description("Total expected indices from entity index mappings")
        .register(meterRegistry);

    LOG.info("Search index metrics registered with Prometheus");
  }

  public void refreshStats() {
    try {
      // Keep this refresh bounded. Per-index existence and alias probes amplify a saturated
      // connection pool, while one inventory provides every name and alias needed below.
      List<IndexManagementClient.IndexStats> indexStats =
          searchRepository.getSearchClient().getAllIndexStats();
      int totalIndices = indexStats.size();
      OrphanedIndexCleaner cleaner = new OrphanedIndexCleaner();
      int rebuildIndices = cleaner.countRebuildIndices(indexStats);
      int orphanedIndices = cleaner.countOrphanedIndices(indexStats);

      Map<String, IndexMapping> indexMap = searchRepository.getEntityIndexMap();
      int expectedIndices = indexMap.size();
      int missingIndices = countMissingIndices(indexMap, indexStats);

      SearchIndexClusterValidator validator = new SearchIndexClusterValidator();
      SearchIndexClusterValidator.ClusterCapacity capacity =
          validator.getClusterCapacity(searchRepository);

      IndexStats stats =
          new IndexStats(
              totalIndices,
              rebuildIndices,
              orphanedIndices,
              capacity.currentShards(),
              capacity.maxShards(),
              capacity.usagePercent() * 100,
              missingIndices,
              expectedIndices,
              System.currentTimeMillis());

      cachedStats.set(stats);

      LOG.debug(
          "Search index metrics refreshed: total={}, rebuild={}, orphaned={}, shards={}/{}, missing={}, expected={}",
          totalIndices,
          rebuildIndices,
          orphanedIndices,
          capacity.currentShards(),
          capacity.maxShards(),
          missingIndices,
          expectedIndices);
    } catch (Exception e) {
      LOG.warn("Failed to refresh search index metrics: {}", e.getMessage());
    }
  }

  public IndexStats getCurrentStats() {
    return cachedStats.get();
  }

  private int countMissingIndices(
      Map<String, IndexMapping> indexMap, List<IndexManagementClient.IndexStats> indexStats) {
    Set<String> availableNames = new HashSet<>();
    for (IndexManagementClient.IndexStats stats : indexStats) {
      availableNames.add(stats.name());
      if (stats.aliases() != null) {
        availableNames.addAll(stats.aliases());
      }
    }

    List<String> missingNames = new ArrayList<>();
    for (Map.Entry<String, IndexMapping> entry : indexMap.entrySet()) {
      String expectedIndexName = entry.getValue().getIndexName(searchRepository.getClusterAlias());
      if (!availableNames.contains(expectedIndexName)) {
        missingNames.add(entry.getKey());
      }
    }
    if (!missingNames.isEmpty()) {
      LOG.warn("Missing search indices (expected but not found): {}", missingNames);
    }
    return missingNames.size();
  }
}
