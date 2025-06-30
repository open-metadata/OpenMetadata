package org.openmetadata.service.search;

import java.util.Map;
import lombok.Builder;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.service.search.elasticsearch.ElasticSearchClient;
import org.openmetadata.service.search.opensearch.OpenSearchClient;

@Slf4j
@Builder
@Getter
public class SearchClusterMetrics {
  private final int availableProcessors;
  private final long heapSizeBytes;
  private final long availableMemoryBytes;
  private final int totalShards;
  private final int totalNodes;
  private final double cpuUsagePercent;
  private final double memoryUsagePercent;
  private final long maxPayloadSizeBytes;
  private final int recommendedConcurrentRequests;
  private final int recommendedBatchSize;
  private final int recommendedProducerThreads;

  public static SearchClusterMetrics fetchClusterMetrics(
      SearchRepository searchRepository, long totalEntities) {
    ElasticSearchConfiguration.SearchType searchType = searchRepository.getSearchType();

    try {
      if (searchType.equals(ElasticSearchConfiguration.SearchType.OPENSEARCH)) {
        return fetchOpenSearchMetrics(
            (OpenSearchClient) searchRepository.getSearchClient(), totalEntities);
      } else {
        return fetchElasticSearchMetrics(
            (ElasticSearchClient) searchRepository.getSearchClient(), totalEntities);
      }
    } catch (Exception e) {
      LOG.warn("Failed to fetch cluster metrics, using conservative defaults: {}", e.getMessage());
      return getConservativeDefaults(totalEntities);
    }
  }

  @SuppressWarnings("unchecked")
  private static SearchClusterMetrics fetchOpenSearchMetrics(
      OpenSearchClient osClient, long totalEntities) {
    try {
      Map<String, Object> clusterStats = osClient.clusterStats();
      Map<String, Object> nodesStats = osClient.nodesStats();
      Map<String, Object> clusterSettings = osClient.clusterSettings();

      Map<String, Object> nodes = (Map<String, Object>) clusterStats.get("nodes");
      int totalNodes = ((Number) nodes.get("count")).intValue();

      Map<String, Object> indices = (Map<String, Object>) clusterStats.get("indices");
      Map<String, Object> shards = (Map<String, Object>) indices.get("shards");
      int totalShards = ((Number) shards.get("total")).intValue();

      Map<String, Object> nodesMap = (Map<String, Object>) nodesStats.get("nodes");
      Map<String, Object> firstNode = (Map<String, Object>) nodesMap.values().iterator().next();

      Map<String, Object> os = (Map<String, Object>) firstNode.get("os");
      Map<String, Object> cpu = (Map<String, Object>) os.get("cpu");
      double cpuUsagePercent = ((Number) cpu.get("percent")).doubleValue();

      Map<String, Object> jvm = (Map<String, Object>) firstNode.get("jvm");
      Map<String, Object> mem = (Map<String, Object>) jvm.get("mem");
      long heapUsedBytes = ((Number) mem.get("heap_used_in_bytes")).longValue();
      long heapMaxBytes = ((Number) mem.get("heap_max_in_bytes")).longValue();
      double memoryUsagePercent = (double) heapUsedBytes / heapMaxBytes * 100;

      long maxContentLength = extractMaxContentLength(clusterSettings);

      return calculateRecommendations(
          totalNodes,
          totalShards,
          cpuUsagePercent,
          memoryUsagePercent,
          heapMaxBytes,
          maxContentLength,
          totalEntities);

    } catch (Exception e) {
      LOG.warn("Failed to fetch OpenSearch cluster metrics: {}", e.getMessage());
      return getConservativeDefaults(totalEntities);
    }
  }

  @SuppressWarnings("unchecked")
  private static SearchClusterMetrics fetchElasticSearchMetrics(
      ElasticSearchClient client, long totalEntities) {
    try {
      Map<String, Object> clusterStats = client.clusterStats();
      Map<String, Object> nodesStats = client.nodesStats();
      Map<String, Object> clusterSettings = client.clusterSettings();

      Map<String, Object> nodes = (Map<String, Object>) clusterStats.get("nodes");
      int totalNodes = ((Number) nodes.get("count")).intValue();

      Map<String, Object> indices = (Map<String, Object>) clusterStats.get("indices");
      Map<String, Object> shards = (Map<String, Object>) indices.get("shards");
      int totalShards = ((Number) shards.get("total")).intValue();

      Map<String, Object> nodesMap = (Map<String, Object>) nodesStats.get("nodes");
      Map<String, Object> firstNode = (Map<String, Object>) nodesMap.values().iterator().next();

      Map<String, Object> os = (Map<String, Object>) firstNode.get("os");
      Map<String, Object> cpu = (Map<String, Object>) os.get("cpu");
      double cpuUsagePercent = ((Number) cpu.get("percent")).doubleValue();

      Map<String, Object> jvm = (Map<String, Object>) firstNode.get("jvm");
      Map<String, Object> mem = (Map<String, Object>) jvm.get("mem");
      long heapUsedBytes = ((Number) mem.get("heap_used_in_bytes")).longValue();
      long heapMaxBytes = ((Number) mem.get("heap_max_in_bytes")).longValue();
      double memoryUsagePercent = (double) heapUsedBytes / heapMaxBytes * 100;

      long maxContentLength = extractMaxContentLength(clusterSettings);

      return calculateRecommendations(
          totalNodes,
          totalShards,
          cpuUsagePercent,
          memoryUsagePercent,
          heapMaxBytes,
          maxContentLength,
          totalEntities);

    } catch (Exception e) {
      LOG.warn("Failed to fetch ElasticSearch cluster metrics: {}", e.getMessage());
      return getConservativeDefaults(totalEntities);
    }
  }

  private static SearchClusterMetrics calculateRecommendations(
      int totalNodes,
      int totalShards,
      double cpuUsagePercent,
      double memoryUsagePercent,
      long heapMaxBytes,
      long maxContentLength,
      long totalEntities) {

    int baseThreadsPerNode = Runtime.getRuntime().availableProcessors() * 4;
    int recommendedProducerThreads = Math.min(100, baseThreadsPerNode * totalNodes);

    if (cpuUsagePercent > 80) {
      recommendedProducerThreads = Math.max(10, recommendedProducerThreads / 2);
    } else if (cpuUsagePercent < 40) {
      recommendedProducerThreads = Math.min(200, recommendedProducerThreads * 3);
    }

    int baseConcurrentRequests = totalNodes * 50;
    if (memoryUsagePercent > 80) {
      baseConcurrentRequests = Math.max(10, baseConcurrentRequests / 2);
    } else if (memoryUsagePercent < 50) {
      baseConcurrentRequests = Math.min(500, baseConcurrentRequests * 2);
    }

    long heapBasedPayloadSize =
        Math.min(500 * 1024 * 1024L, heapMaxBytes / 20); // Max 500MB or 5% of heap

    double compressionRatio = 0.25; // Conservative estimate: compressed size is 25% of original
    long effectiveMaxContentLength = (long) (maxContentLength / compressionRatio);
    long maxPayloadSize =
        Math.min(heapBasedPayloadSize, effectiveMaxContentLength * 8 / 10); // Use 80% for safety

    int avgEntitySizeKB = 2; // Assume 2KB average entity size (uncompressed)
    int recommendedBatchSize = (int) Math.min(2000, maxPayloadSize / (avgEntitySizeKB * 1024L));
    recommendedBatchSize = Math.max(100, recommendedBatchSize);

    if (totalEntities > 1000000) {
      recommendedBatchSize = Math.max(500, recommendedBatchSize);
      recommendedProducerThreads =
          Math.min(50, recommendedProducerThreads); // Increased from 10 to 50
    }

    return SearchClusterMetrics.builder()
        .availableProcessors(Runtime.getRuntime().availableProcessors())
        .heapSizeBytes(heapMaxBytes)
        .availableMemoryBytes(heapMaxBytes - (long) (heapMaxBytes * memoryUsagePercent / 100))
        .totalShards(totalShards)
        .totalNodes(totalNodes)
        .cpuUsagePercent(cpuUsagePercent)
        .memoryUsagePercent(memoryUsagePercent)
        .maxPayloadSizeBytes(maxPayloadSize)
        .recommendedConcurrentRequests(baseConcurrentRequests)
        .recommendedBatchSize(recommendedBatchSize)
        .recommendedProducerThreads(recommendedProducerThreads)
        .build();
  }

  @SuppressWarnings("unchecked")
  private static long extractMaxContentLength(Map<String, Object> clusterSettings) {
    try {
      long defaultMaxContentLength = 100 * 1024 * 1024L; // 100MB

      Map<String, Object> persistentSettings =
          (Map<String, Object>) clusterSettings.get("persistent");
      Map<String, Object> transientSettings =
          (Map<String, Object>) clusterSettings.get("transient");

      String maxContentLengthStr = null;
      if (persistentSettings != null && persistentSettings.containsKey("http.max_content_length")) {
        maxContentLengthStr = (String) persistentSettings.get("http.max_content_length");
      }

      if (maxContentLengthStr == null
          && transientSettings != null
          && transientSettings.containsKey("http.max_content_length")) {
        maxContentLengthStr = (String) transientSettings.get("http.max_content_length");
      }

      if (maxContentLengthStr != null) {
        return parseByteSize(maxContentLengthStr);
      }

      return defaultMaxContentLength;
    } catch (Exception e) {
      LOG.warn("Failed to extract maxContentLength from cluster settings: {}", e.getMessage());
      return 100 * 1024 * 1024L; // Default 100MB
    }
  }

  private static long parseByteSize(String sizeStr) {
    if (sizeStr == null || sizeStr.trim().isEmpty()) {
      return 100 * 1024 * 1024L; // Default 100MB
    }

    sizeStr = sizeStr.trim().toLowerCase();

    String numStr = sizeStr.replaceAll("[^0-9.]", "");
    String unit = sizeStr.replaceAll("[0-9.]", "");

    try {
      double num = Double.parseDouble(numStr);

      return switch (unit) {
        case "b", "" -> (long) num;
        case "kb" -> (long) (num * 1024);
        case "mb" -> (long) (num * 1024 * 1024);
        case "gb" -> (long) (num * 1024 * 1024 * 1024);
        default -> (long) num; // Default to bytes
      };
    } catch (NumberFormatException e) {
      LOG.warn("Failed to parse byte size: {}", sizeStr);
      return 100 * 1024 * 1024L; // Default 100MB
    }
  }

  private static SearchClusterMetrics getConservativeDefaults(long totalEntities) {
    int conservativeBatchSize = totalEntities > 100000 ? 200 : 100;
    // More aggressive defaults with virtual threads - they're lightweight
    int conservativeThreads = totalEntities > 500000 ? 20 : 10; // Increased from 3:2 to 20:10
    int conservativeConcurrentRequests = totalEntities > 100000 ? 100 : 50; // Doubled

    return SearchClusterMetrics.builder()
        .availableProcessors(Runtime.getRuntime().availableProcessors())
        .heapSizeBytes(0L)
        .availableMemoryBytes(0L)
        .totalShards(0)
        .totalNodes(1)
        .cpuUsagePercent(50.0)
        .memoryUsagePercent(50.0)
        .maxPayloadSizeBytes(50 * 1024 * 1024L) // Conservative 50MB
        .recommendedConcurrentRequests(conservativeConcurrentRequests)
        .recommendedBatchSize(conservativeBatchSize)
        .recommendedProducerThreads(conservativeThreads)
        .build();
  }

  public void logRecommendations() {
    LOG.info("=== Auto-Tune Cluster Analysis ===");
    LOG.info("Cluster: {} nodes, {} shards", totalNodes, totalShards);
    LOG.info(
        "Resource Usage: CPU {}%, Memory {}%",
        String.format("%.1f", cpuUsagePercent), String.format("%.1f", memoryUsagePercent));
    LOG.info(
        "Heap: {} MB total, {} MB available",
        heapSizeBytes / (1024 * 1024),
        availableMemoryBytes / (1024 * 1024));
    LOG.info("=== Auto-Tune Recommendations (Virtual Threads Optimized) ===");
    LOG.info("Batch Size: {}", recommendedBatchSize);
    LOG.info(
        "Producer Threads: {} (virtual threads - lightweight & scalable)",
        recommendedProducerThreads);
    LOG.info("Concurrent Requests: {}", recommendedConcurrentRequests);
    LOG.info(
        "Max Payload Size: {} MB (with compression optimization)",
        maxPayloadSizeBytes / (1024 * 1024));
    LOG.info("Note: Virtual threads enable high concurrency for I/O-bound operations");
    LOG.info("Note: Request compression is enabled (~75% size reduction for JSON)");
    LOG.info("================================================================");
  }
}
