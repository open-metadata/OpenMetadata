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

import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.elasticsearch.ElasticSearchClient;
import org.openmetadata.service.search.opensearch.OpenSearchClient;

/**
 * Validates cluster capacity before creating new indices. This helps prevent hitting the
 * cluster.max_shards_per_node limit which causes index creation failures.
 */
@Slf4j
public class SearchIndexClusterValidator {

  private static final double DEFAULT_SHARD_USAGE_THRESHOLD = 0.85;
  private static final int DEFAULT_SHARDS_PER_INDEX = 5;
  private static final int DEFAULT_MAX_SHARDS_PER_NODE = 1000;

  private final double shardUsageThreshold;
  private final int estimatedShardsPerIndex;

  public SearchIndexClusterValidator() {
    this(DEFAULT_SHARD_USAGE_THRESHOLD, DEFAULT_SHARDS_PER_INDEX);
  }

  public SearchIndexClusterValidator(double shardUsageThreshold, int estimatedShardsPerIndex) {
    this.shardUsageThreshold = shardUsageThreshold;
    this.estimatedShardsPerIndex = estimatedShardsPerIndex;
  }

  public record ClusterCapacity(
      int currentShards, int maxShards, double usagePercent, int availableShards) {

    public boolean hasCapacityFor(int requestedShards) {
      return (currentShards + requestedShards) <= (maxShards * 0.95);
    }

    public boolean isAboveThreshold(double threshold) {
      return usagePercent >= threshold;
    }
  }

  public ClusterCapacity getClusterCapacity(SearchRepository searchRepository) {
    SearchClient client = searchRepository.getSearchClient();
    ElasticSearchConfiguration.SearchType searchType = searchRepository.getSearchType();

    try {
      if (searchType.equals(ElasticSearchConfiguration.SearchType.OPENSEARCH)) {
        return getOpenSearchCapacity((OpenSearchClient) client);
      } else {
        return getElasticSearchCapacity((ElasticSearchClient) client);
      }
    } catch (Exception e) {
      LOG.warn("Failed to get cluster capacity, using conservative estimate: {}", e.getMessage());
      return getConservativeEstimate();
    }
  }

  private ClusterCapacity getOpenSearchCapacity(OpenSearchClient client) {
    try {
      var clusterStats = client.clusterStats();

      int totalNodes = clusterStats.nodes().count().total();
      int totalShards =
          clusterStats.indices().shards().total() != null
              ? clusterStats.indices().shards().total().intValue()
              : 0;

      int maxShardsPerNode = getMaxShardsPerNode(client);
      int maxShards = totalNodes * maxShardsPerNode;

      double usagePercent = maxShards > 0 ? (double) totalShards / maxShards : 0;
      int availableShards = maxShards - totalShards;

      LOG.debug(
          "OpenSearch cluster capacity: {} current shards, {} max shards ({} nodes x {} per node), {:.1f}% used",
          totalShards, maxShards, totalNodes, maxShardsPerNode, usagePercent * 100);

      return new ClusterCapacity(totalShards, maxShards, usagePercent, availableShards);
    } catch (Exception e) {
      LOG.warn("Failed to get OpenSearch cluster capacity: {}", e.getMessage());
      return getConservativeEstimate();
    }
  }

  private ClusterCapacity getElasticSearchCapacity(ElasticSearchClient client) {
    try {
      var clusterStats = client.clusterStats();

      int totalNodes = clusterStats.nodes().count().total();
      int totalShards =
          clusterStats.indices().shards().total() != null
              ? clusterStats.indices().shards().total().intValue()
              : 0;

      int maxShardsPerNode = getMaxShardsPerNode(client);
      int maxShards = totalNodes * maxShardsPerNode;

      double usagePercent = maxShards > 0 ? (double) totalShards / maxShards : 0;
      int availableShards = maxShards - totalShards;

      LOG.debug(
          "ElasticSearch cluster capacity: {} current shards, {} max shards ({} nodes x {} per node), {:.1f}% used",
          totalShards, maxShards, totalNodes, maxShardsPerNode, usagePercent * 100);

      return new ClusterCapacity(totalShards, maxShards, usagePercent, availableShards);
    } catch (Exception e) {
      LOG.warn("Failed to get ElasticSearch cluster capacity: {}", e.getMessage());
      return getConservativeEstimate();
    }
  }

  private int getMaxShardsPerNode(OpenSearchClient client) {
    try {
      var settings = client.clusterSettings();
      if (settings != null && settings.persistent() != null) {
        var maxShards = settings.persistent().get("cluster.max_shards_per_node");
        if (maxShards != null) {
          return Integer.parseInt(maxShards.toString());
        }
      }
      if (settings != null && settings.defaults() != null) {
        var maxShards = settings.defaults().get("cluster.max_shards_per_node");
        if (maxShards != null) {
          return Integer.parseInt(maxShards.toString());
        }
      }
    } catch (Exception e) {
      LOG.debug(
          "Could not extract max_shards_per_node from OpenSearch settings: {}", e.getMessage());
    }
    return DEFAULT_MAX_SHARDS_PER_NODE;
  }

  private int getMaxShardsPerNode(ElasticSearchClient client) {
    try {
      var settings = client.clusterSettings();
      if (settings != null && settings.persistent() != null) {
        var maxShards = settings.persistent().get("cluster.max_shards_per_node");
        if (maxShards != null) {
          return Integer.parseInt(maxShards.toString());
        }
      }
      if (settings != null && settings.defaults() != null) {
        var maxShards = settings.defaults().get("cluster.max_shards_per_node");
        if (maxShards != null) {
          return Integer.parseInt(maxShards.toString());
        }
      }
    } catch (Exception e) {
      LOG.debug(
          "Could not extract max_shards_per_node from ElasticSearch settings: {}", e.getMessage());
    }
    return DEFAULT_MAX_SHARDS_PER_NODE;
  }

  private ClusterCapacity getConservativeEstimate() {
    return new ClusterCapacity(0, DEFAULT_MAX_SHARDS_PER_NODE, 0.0, DEFAULT_MAX_SHARDS_PER_NODE);
  }

  public void validateCapacityForRecreate(SearchRepository searchRepository, Set<String> entities)
      throws InsufficientClusterCapacityException {
    ClusterCapacity capacity = getClusterCapacity(searchRepository);

    int requestedShards = entities.size() * estimatedShardsPerIndex;

    LOG.info(
        "Pre-flight cluster check: {}/{} shards ({:.1f}% used), requesting {} shards for {} entities",
        capacity.currentShards(),
        capacity.maxShards(),
        capacity.usagePercent() * 100,
        requestedShards,
        entities.size());

    if (capacity.isAboveThreshold(shardUsageThreshold)) {
      LOG.warn(
          "Cluster shard usage ({:.1f}%) exceeds threshold ({:.1f}%). "
              + "Consider cleaning up orphaned indices.",
          capacity.usagePercent() * 100, shardUsageThreshold * 100);
      throw new InsufficientClusterCapacityException(
          capacity.currentShards(), capacity.maxShards(), capacity.usagePercent());
    }

    if (!capacity.hasCapacityFor(requestedShards)) {
      LOG.error(
          "Insufficient cluster capacity: need {} shards but only {} available",
          requestedShards,
          capacity.availableShards());
      throw new InsufficientClusterCapacityException(
          capacity.currentShards(), capacity.maxShards(), requestedShards, capacity.usagePercent());
    }

    LOG.info(
        "Pre-flight check passed: sufficient capacity for {} new indices ({} shards)",
        entities.size(),
        requestedShards);
  }

  public boolean hasCapacityFor(SearchRepository searchRepository, int newIndicesCount) {
    try {
      ClusterCapacity capacity = getClusterCapacity(searchRepository);
      int requestedShards = newIndicesCount * estimatedShardsPerIndex;
      return capacity.hasCapacityFor(requestedShards)
          && !capacity.isAboveThreshold(shardUsageThreshold);
    } catch (Exception e) {
      LOG.warn("Failed to check cluster capacity: {}", e.getMessage());
      return true;
    }
  }
}
