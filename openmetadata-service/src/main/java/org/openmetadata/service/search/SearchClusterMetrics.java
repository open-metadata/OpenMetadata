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
  private final long maxContentLength;
  private final int recommendedConcurrentRequests;
  private final int recommendedBatchSize;
  private final int recommendedProducerThreads;
  private final int recommendedConsumerThreads;
  private final int recommendedQueueSize;
  private final int recommendedFieldFetchThreads;
  private final int recommendedDocBuildThreads;
  private final long recommendedStatsIntervalMs;

  public static final double DEFAULT_CPU_PERCENT = 50.0;
  public static final long DEFAULT_HEAP_USED_BYTES = 512L * 1024 * 1024; // 512 MB
  public static final long DEFAULT_HEAP_MAX_BYTES = 1024L * 1024 * 1024; // 1 GB
  public static final long DEFAULT_MAX_CONTENT_LENGTH =
      10 * 1024 * 1024L; // Conservative 10MB default

  public static SearchClusterMetrics fetchClusterMetrics(
      SearchRepository searchRepository, long totalEntities, int maxDbConnections) {
    ElasticSearchConfiguration.SearchType searchType = searchRepository.getSearchType();

    try {
      if (searchType.equals(ElasticSearchConfiguration.SearchType.OPENSEARCH)) {
        return fetchOpenSearchMetrics(
            searchRepository,
            (OpenSearchClient) searchRepository.getSearchClient(),
            totalEntities,
            maxDbConnections);
      } else {
        return fetchElasticSearchMetrics(
            searchRepository,
            (ElasticSearchClient) searchRepository.getSearchClient(),
            totalEntities,
            maxDbConnections);
      }
    } catch (Exception e) {
      LOG.warn("Failed to fetch cluster metrics, using conservative defaults: {}", e.getMessage());
      return getConservativeDefaults(searchRepository, totalEntities, maxDbConnections);
    }
  }

  private static SearchClusterMetrics fetchOpenSearchMetrics(
      SearchRepository searchRepository,
      OpenSearchClient osClient,
      long totalEntities,
      int maxDbConnections) {
    try {
      var clusterStats = osClient.clusterStats();
      var nodesStats = osClient.nodesStats();
      var clusterSettings = osClient.clusterSettings();

      LOG.debug("ClusterStats response: {}", clusterStats);
      LOG.debug("NodesStats response: {}", nodesStats);

      int totalNodes = clusterStats.nodes().count().total();
      int totalShards =
          clusterStats.indices().shards().total() != null
              ? clusterStats.indices().shards().total().intValue()
              : 0;

      double cpuUsagePercent = osClient.averageCpuPercentFromNodesStats(nodesStats);
      var jvmStats = osClient.extractJvmMemoryStats(nodesStats);
      long heapMaxBytes = (long) jvmStats.get("heapMaxBytes");
      double memoryUsagePercent = (double) jvmStats.get("memoryUsagePercent");

      String maxContentLengthStr = osClient.extractMaxContentLengthStr(clusterSettings);
      long maxContentLength = extractMaxContentLength(maxContentLengthStr);

      return calculateRecommendations(
          totalNodes,
          totalShards,
          cpuUsagePercent,
          memoryUsagePercent,
          heapMaxBytes,
          maxContentLength,
          totalEntities,
          maxDbConnections);

    } catch (Exception e) {
      LOG.warn("Failed to fetch OpenSearch cluster metrics: {}", e.getMessage(), e);
      return getConservativeDefaults(searchRepository, totalEntities, maxDbConnections);
    }
  }

  private static SearchClusterMetrics fetchElasticSearchMetrics(
      SearchRepository searchRepository,
      ElasticSearchClient client,
      long totalEntities,
      int maxDbConnections) {
    try {
      var clusterStats = client.clusterStats();
      var nodesStats = client.nodesStats();
      var clusterSettings = client.clusterSettings();

      int totalNodes = clusterStats.nodes().count().total();
      int totalShards =
          clusterStats.indices().shards().total() != null
              ? clusterStats.indices().shards().total().intValue()
              : 0;

      double cpuUsagePercent = client.averageCpuPercentFromNodesStats(nodesStats);
      var jvmStats = client.extractJvmMemoryStats(nodesStats);
      long heapMaxBytes = (long) jvmStats.get("heapMaxBytes");
      double memoryUsagePercent = (double) jvmStats.get("memoryUsagePercent");

      String maxContentLengthStr = client.extractMaxContentLengthStr(clusterSettings);
      long maxContentLength = extractMaxContentLength(maxContentLengthStr);

      return calculateRecommendations(
          totalNodes,
          totalShards,
          cpuUsagePercent,
          memoryUsagePercent,
          heapMaxBytes,
          maxContentLength,
          totalEntities,
          maxDbConnections);

    } catch (Exception e) {
      LOG.warn(
          "Failed to fetch ElasticSearch cluster metrics ({}): {}",
          e.getClass().getSimpleName(),
          e.getMessage(),
          e);
      LOG.info("Using conservative defaults for {} total entities", totalEntities);
      SearchClusterMetrics defaults =
          getConservativeDefaults(searchRepository, totalEntities, maxDbConnections);
      LOG.info(
          "Conservative defaults: Batch size={}, Producer threads={}, Concurrent requests={}, Max payload={} MB",
          defaults.getRecommendedBatchSize(),
          defaults.getRecommendedProducerThreads(),
          defaults.getRecommendedConcurrentRequests(),
          defaults.getMaxPayloadSizeBytes() / (1024 * 1024));
      return defaults;
    }
  }

  private static SearchClusterMetrics calculateRecommendations(
      int totalNodes,
      int totalShards,
      double cpuUsagePercent,
      double memoryUsagePercent,
      long heapMaxBytes,
      long maxContentLength,
      long totalEntities,
      int maxDbConnections) {

    int availableCores = Runtime.getRuntime().availableProcessors();
    long jvmMaxHeap = Runtime.getRuntime().maxMemory();
    long jvmUsedMemory = Runtime.getRuntime().totalMemory() - Runtime.getRuntime().freeMemory();
    double jvmHeapUsagePercent = (jvmMaxHeap > 0) ? (double) jvmUsedMemory / jvmMaxHeap * 100 : 50;

    boolean clusterOverloaded = cpuUsagePercent > 80 || memoryUsagePercent > 80;

    LOG.info(
        "Auto-tune inputs: {} entities, {} cores, {} MB JVM heap ({}% used), "
            + "cluster: {} nodes, CPU {}%, mem {}%{}",
        totalEntities,
        availableCores,
        jvmMaxHeap / (1024 * 1024),
        String.format("%.0f", jvmHeapUsagePercent),
        totalNodes,
        String.format("%.0f", cpuUsagePercent),
        String.format("%.0f", memoryUsagePercent),
        clusterOverloaded ? " [OVERLOADED]" : "");

    // --- Producer threads: bounded by DB connections and JVM cores ---
    // Use at most 75% of DB connections, capped by cores
    int maxProducerThreads = Math.max(2, (maxDbConnections * 3) / 4);
    int recommendedProducerThreads = Math.min(maxProducerThreads, availableCores * 2);
    // Scale with cluster nodes but don't go wild
    recommendedProducerThreads = Math.min(recommendedProducerThreads, 5 * totalNodes);
    if (clusterOverloaded) {
      recommendedProducerThreads = Math.max(2, (recommendedProducerThreads * 3) / 4);
    }

    // --- Consumer threads: based on cores and cluster capacity ---
    int recommendedConsumerThreads = Math.min(30, Math.max(2, availableCores * 2));
    if (totalNodes > 3) {
      recommendedConsumerThreads = Math.min(40, recommendedConsumerThreads + (totalNodes * 2));
    }
    if (clusterOverloaded) {
      recommendedConsumerThreads = Math.max(2, (recommendedConsumerThreads * 3) / 4);
    }

    // --- Concurrent requests: based on cluster nodes ---
    int requestsPerNode = clusterOverloaded ? 25 : 50;
    int recommendedConcurrentRequests = Math.min(200, totalNodes * requestsPerNode);
    recommendedConcurrentRequests = Math.min(recommendedConcurrentRequests, availableCores * 25);

    // --- Payload size: use cluster content length limit and JVM heap ---
    long heapBasedPayloadSize = Math.min(500 * 1024 * 1024L, jvmMaxHeap / 20);
    long maxPayloadSize = Math.min(heapBasedPayloadSize, maxContentLength * 9 / 10);

    LOG.info(
        "Payload size: {} MB (JVM-based: {} MB, cluster limit: {} MB)",
        maxPayloadSize / (1024 * 1024),
        heapBasedPayloadSize / (1024 * 1024),
        maxContentLength / (1024 * 1024));

    // --- Batch size: derived from payload size and entity count tier ---
    int avgEntitySizeKB = maxPayloadSize <= 10 * 1024 * 1024 ? 20 : 10;
    int recommendedBatchSize = (int) Math.min(1000, maxPayloadSize / (avgEntitySizeKB * 1024L));
    if (maxPayloadSize <= 10 * 1024 * 1024) {
      recommendedBatchSize = Math.min(500, recommendedBatchSize);
    }
    recommendedBatchSize = Math.max(50, recommendedBatchSize);

    // Scale down for large datasets to control memory pressure from in-flight entities
    if (totalEntities > 1_000_000) {
      recommendedBatchSize = Math.min(300, recommendedBatchSize);
      recommendedProducerThreads = Math.min(15, recommendedProducerThreads);
      recommendedConcurrentRequests = Math.min(100, recommendedConcurrentRequests);
    } else if (totalEntities > 500_000) {
      recommendedBatchSize = Math.min(500, recommendedBatchSize);
      recommendedProducerThreads = Math.min(20, recommendedProducerThreads);
    } else if (totalEntities > 100_000) {
      recommendedBatchSize = Math.min(800, recommendedBatchSize);
    }

    // JVM heap pressure: if the OM server JVM itself is tight, scale down
    if (jvmHeapUsagePercent > 70) {
      recommendedBatchSize = Math.max(50, (recommendedBatchSize * 3) / 4);
      recommendedProducerThreads = Math.max(2, (recommendedProducerThreads * 3) / 4);
      LOG.info(
          "JVM heap usage {}% > 70%, reducing batch size and producer threads",
          String.format("%.0f", jvmHeapUsagePercent));
    }

    // --- Queue size: proportional to batch size and producer threads ---
    int queueBatches = Math.min(recommendedProducerThreads * 2, 20);
    int recommendedQueueSize = Math.min(10000, recommendedBatchSize * queueBatches);
    recommendedQueueSize = Math.max(1000, recommendedQueueSize);

    // --- CPU budget: derive internal thread pool sizes from available cores ---
    // Each worker is a platform thread driving: DB read → field-fetch → doc-build → bulk send
    // On small instances (2 vCPUs), uncapped threads cause 99%+ CPU and throughput collapse
    double targetCpuPercent = 0.70;
    double cpuBudget = availableCores * targetCpuPercent;
    int cpuBudgetedWorkers = Math.max(1, availableCores - 1);
    recommendedConsumerThreads = Math.min(recommendedConsumerThreads, cpuBudgetedWorkers);
    int recommendedFieldFetchThreads = Math.max(2, Math.min(50, availableCores * 2));
    int recommendedDocBuildThreads = Math.max(1, Math.min(50, (int) Math.floor(cpuBudget * 2)));
    recommendedConcurrentRequests =
        Math.min(recommendedConcurrentRequests, Math.max(10, availableCores * 10));
    long recommendedStatsIntervalMs =
        availableCores <= 2 ? 2000 : availableCores <= 4 ? 1500 : 1000;

    if (clusterOverloaded) {
      recommendedFieldFetchThreads = Math.max(2, (recommendedFieldFetchThreads * 3) / 4);
      recommendedDocBuildThreads = Math.max(1, (recommendedDocBuildThreads * 3) / 4);
    }

    LOG.info(
        "CPU budget: {} cores × {}% = {} → workers={}, fieldFetch={}, docBuild={}, concurrentReqs={}, statsInterval={}ms",
        availableCores,
        (int) (targetCpuPercent * 100),
        String.format("%.1f", cpuBudget),
        recommendedConsumerThreads,
        recommendedFieldFetchThreads,
        recommendedDocBuildThreads,
        recommendedConcurrentRequests,
        recommendedStatsIntervalMs);

    return SearchClusterMetrics.builder()
        .availableProcessors(availableCores)
        .heapSizeBytes(heapMaxBytes)
        .availableMemoryBytes(heapMaxBytes - (long) (heapMaxBytes * memoryUsagePercent / 100))
        .totalShards(totalShards)
        .totalNodes(totalNodes)
        .cpuUsagePercent(cpuUsagePercent)
        .memoryUsagePercent(memoryUsagePercent)
        .maxPayloadSizeBytes(maxPayloadSize)
        .maxContentLength(maxContentLength)
        .recommendedConcurrentRequests(recommendedConcurrentRequests)
        .recommendedBatchSize(recommendedBatchSize)
        .recommendedProducerThreads(recommendedProducerThreads)
        .recommendedConsumerThreads(recommendedConsumerThreads)
        .recommendedQueueSize(recommendedQueueSize)
        .recommendedFieldFetchThreads(recommendedFieldFetchThreads)
        .recommendedDocBuildThreads(recommendedDocBuildThreads)
        .recommendedStatsIntervalMs(recommendedStatsIntervalMs)
        .build();
  }

  /**
   * Check if HTTP compression is enabled in cluster settings
   */
  @SuppressWarnings("unchecked")
  public static boolean isCompressionEnabled(Map<String, Object> clusterSettings) {
    try {
      Map<String, Object> persistentSettings =
          (Map<String, Object>) clusterSettings.get("persistent");
      Map<String, Object> transientSettings =
          (Map<String, Object>) clusterSettings.get("transient");
      Map<String, Object> defaultSettings = (Map<String, Object>) clusterSettings.get("defaults");

      // Check in order: transient -> persistent -> defaults
      Boolean compressionEnabled = null;

      if (transientSettings != null && transientSettings.containsKey("http.compression")) {
        compressionEnabled = (Boolean) transientSettings.get("http.compression");
      }

      if (compressionEnabled == null
          && persistentSettings != null
          && persistentSettings.containsKey("http.compression")) {
        compressionEnabled = (Boolean) persistentSettings.get("http.compression");
      }

      if (compressionEnabled == null
          && defaultSettings != null
          && defaultSettings.containsKey("http.compression")) {
        compressionEnabled = (Boolean) defaultSettings.get("http.compression");
      }

      return compressionEnabled != null ? compressionEnabled : false;
    } catch (Exception e) {
      LOG.debug("Failed to check compression setting, assuming disabled: {}", e.getMessage());
      return false;
    }
  }

  public static long extractMaxContentLength(String maxContentLengthStr) {
    try {
      // Use a conservative 10MB default for AWS-managed OpenSearch/ElasticSearch
      // AWS OpenSearch has a hard limit of 10MB that may not be exposed in cluster settings
      if (maxContentLengthStr != null) {
        long maxContentLength = parseByteSize(maxContentLengthStr);
        LOG.info(
            "Detected cluster max_content_length setting: {} ({})",
            maxContentLengthStr,
            maxContentLength + " bytes");
        return maxContentLength;
      }

      LOG.info(
          "No max_content_length setting found in cluster, using conservative default: {} bytes",
          DEFAULT_MAX_CONTENT_LENGTH);
      return DEFAULT_MAX_CONTENT_LENGTH;
    } catch (Exception e) {
      LOG.warn("Failed to extract maxContentLength from cluster settings: {}", e.getMessage());
      return DEFAULT_MAX_CONTENT_LENGTH; // Conservative 10MB default for safety
    }
  }

  private static long parseByteSize(String sizeStr) {
    if (sizeStr == null || sizeStr.trim().isEmpty()) {
      return DEFAULT_MAX_CONTENT_LENGTH; // Conservative 10MB default for safety
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
      return DEFAULT_MAX_CONTENT_LENGTH; // Conservative 10MB default for safety
    }
  }

  private static long extractLongValue(Map<String, Object> map, String key, long defaultValue) {
    Object value = map.get(key);
    if (value instanceof Number number) {
      return number.longValue();
    }
    LOG.debug("Unable to extract long value for key '{}', using default: {}", key, defaultValue);
    return defaultValue;
  }

  private static int extractIntValue(Map<String, Object> map, String key, int defaultValue) {
    Object value = map.get(key);
    if (value instanceof Number number) {
      return number.intValue();
    }
    LOG.debug("Unable to extract int value for key '{}', using default: {}", key, defaultValue);
    return defaultValue;
  }

  private static SearchClusterMetrics getConservativeDefaults(
      SearchRepository searchRepository, long totalEntities, int maxDbConnections) {
    int conservativeBatchSize;
    if (totalEntities > 1000000) {
      conservativeBatchSize = 300;
    } else if (totalEntities > 500000) {
      conservativeBatchSize = 225;
    } else if (totalEntities > 250000) {
      conservativeBatchSize = 200;
    } else if (totalEntities > 100000) {
      conservativeBatchSize = 150;
    } else if (totalEntities > 50000) {
      conservativeBatchSize = 125;
    } else {
      conservativeBatchSize = 100;
    }

    int availCores = Runtime.getRuntime().availableProcessors();
    int conservativeThreads = Math.min((maxDbConnections * 3) / 4, availCores * 4);
    int conservativeConcurrentRequests = totalEntities > 100000 ? 50 : 25;
    conservativeConcurrentRequests =
        Math.min(conservativeConcurrentRequests, Math.max(10, availCores * 10));
    int conservativeConsumerThreads = Math.min(20, Math.max(1, availCores - 1));
    int conservativeQueueSize = conservativeBatchSize * conservativeConcurrentRequests * 2;

    long maxHeap = Runtime.getRuntime().maxMemory();
    long totalHeap = Runtime.getRuntime().totalMemory();
    long freeHeap = Runtime.getRuntime().freeMemory();
    long usedHeap = totalHeap - freeHeap;
    double heapUsagePercent = (maxHeap > 0) ? (double) usedHeap / maxHeap * 100 : 50.0;

    // Default to conservative 10MB for AWS-managed clusters if we can't fetch from cluster
    long maxPayloadSize = DEFAULT_MAX_CONTENT_LENGTH; // Conservative 10MB default
    try {
      if (searchRepository != null) {
        SearchClient searchClient = searchRepository.getSearchClient();
        Map<String, Object> clusterSettings = null;

        long maxContentLength = DEFAULT_MAX_CONTENT_LENGTH; // Conservative 10MB default;
        String maxContentLengthStr;

        // Get cluster settings based on search client type
        if (searchClient instanceof OpenSearchClient) {
          var osClusterSettings = ((OpenSearchClient) searchClient).clusterSettings();
          maxContentLengthStr =
              ((OpenSearchClient) searchClient).extractMaxContentLengthStr(osClusterSettings);
          maxContentLength = extractMaxContentLength(maxContentLengthStr);
        } else if (searchClient instanceof ElasticSearchClient) {
          var esClusterSettings = ((ElasticSearchClient) searchClient).clusterSettings();
          maxContentLengthStr =
              ((ElasticSearchClient) searchClient).extractMaxContentLengthStr(esClusterSettings);
          maxContentLength = extractMaxContentLength(maxContentLengthStr);
        }

        // Use actual max content length from cluster settings
        // Apply 90% to leave small buffer for HTTP headers and request overhead
        maxPayloadSize = maxContentLength * 9 / 10;
        LOG.info(
            "Conservative defaults: Detected max content length: {} MB, effective payload size: {} MB",
            maxContentLength / (1024 * 1024),
            maxPayloadSize / (1024 * 1024));
      }
    } catch (Exception e) {
      LOG.debug(
          "Could not fetch max content length from cluster, using default: {}", e.getMessage());
    }

    double cpuBudget = availCores * 0.70;
    int conservativeFieldFetchThreads = Math.max(2, Math.min(50, availCores * 2));
    int conservativeDocBuildThreads = Math.max(1, Math.min(50, (int) Math.floor(cpuBudget * 2)));
    long conservativeStatsIntervalMs = availCores <= 2 ? 2000 : availCores <= 4 ? 1500 : 1000;

    return SearchClusterMetrics.builder()
        .availableProcessors(Runtime.getRuntime().availableProcessors())
        .heapSizeBytes(maxHeap)
        .availableMemoryBytes(maxHeap - usedHeap)
        .totalShards(0)
        .totalNodes(1)
        .cpuUsagePercent(50.0)
        .memoryUsagePercent(heapUsagePercent)
        .maxPayloadSizeBytes(maxPayloadSize)
        .maxContentLength(maxPayloadSize * 10 / 9)
        .recommendedConcurrentRequests(conservativeConcurrentRequests)
        .recommendedBatchSize(conservativeBatchSize)
        .recommendedProducerThreads(conservativeThreads)
        .recommendedConsumerThreads(conservativeConsumerThreads)
        .recommendedQueueSize(conservativeQueueSize)
        .recommendedFieldFetchThreads(conservativeFieldFetchThreads)
        .recommendedDocBuildThreads(conservativeDocBuildThreads)
        .recommendedStatsIntervalMs(conservativeStatsIntervalMs)
        .build();
  }

  public void logRecommendations() {
    LOG.info("=== Auto-Tune Cluster Analysis ===");
    LOG.info(
        "JVM: {} CPUs, {} MB max heap",
        Runtime.getRuntime().availableProcessors(),
        Runtime.getRuntime().maxMemory() / (1024 * 1024));
    LOG.info("Cluster: {} nodes, {} shards", totalNodes, totalShards);
    LOG.info(
        "Resource Usage: CPU {}%, Memory {}%",
        String.format("%.1f", cpuUsagePercent), String.format("%.1f", memoryUsagePercent));
    LOG.info(
        "Heap: {} MB total, {} MB available",
        heapSizeBytes / (1024 * 1024),
        availableMemoryBytes / (1024 * 1024));
    LOG.info("=== Auto-Tune Recommendations ===");
    LOG.info("Batch Size: {} (entities per batch)", recommendedBatchSize);
    LOG.info("Producer Threads: {} (DB readers)", recommendedProducerThreads);
    LOG.info("Consumer Threads: {} (ES/OS writers)", recommendedConsumerThreads);
    LOG.info("Queue Size: {} (buffered entities)", recommendedQueueSize);
    LOG.info("Concurrent Bulk Requests: {}", recommendedConcurrentRequests);
    LOG.info("Field-Fetch Threads: {} (Jackson deserialization)", recommendedFieldFetchThreads);
    LOG.info("Doc-Build Threads: {} (Jackson serialization)", recommendedDocBuildThreads);
    LOG.info("Stats Poll Interval: {} ms", recommendedStatsIntervalMs);
    LOG.info("Max Payload Size: {} MB per bulk request", maxPayloadSizeBytes / (1024 * 1024));
    LOG.info("=== Estimated Performance ===");

    // Calculate estimated throughput
    long estimatedThroughput = (long) recommendedBatchSize * recommendedConcurrentRequests;
    LOG.info(
        "Estimated throughput: ~{} entities/second",
        estimatedThroughput / 5); // Assume 5 sec per batch

    // Memory usage estimate
    long queueMemoryMB = (recommendedQueueSize * 10L) / 1024; // Assume 10KB per entity
    LOG.info("Estimated queue memory usage: ~{} MB", queueMemoryMB);

    LOG.info(
        "Note: Settings are conservative to ensure stability. The system will adapt during execution.");
    LOG.info("================================================================");
  }
}
