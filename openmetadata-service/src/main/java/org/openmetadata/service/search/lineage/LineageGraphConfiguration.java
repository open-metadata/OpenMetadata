package org.openmetadata.service.search.lineage;

import lombok.Builder;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.lineage.GraphPerformanceConfig;
import org.openmetadata.schema.api.lineage.LineageSettings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.service.resources.settings.SettingsCache;

/**
 * Configuration manager for lineage graph builder performance settings.
 * Fetches configuration from the database via SettingsCache.
 */
@Slf4j
@Getter
@Builder
public class LineageGraphConfiguration {

  private final int smallGraphThreshold;
  private final int mediumGraphThreshold;
  private final int maxInMemoryNodes;
  private final int smallGraphBatchSize;
  private final int mediumGraphBatchSize;
  private final int largeGraphBatchSize;
  private final int streamingBatchSize;
  private final boolean enableCaching;
  private final int cacheTTLSeconds;
  private final int maxCachedGraphs;
  private final boolean enableProgressTracking;
  private final int progressReportInterval;
  private final boolean useScrollForLargeGraphs;
  private final int scrollTimeoutMinutes;

  private LineageGraphConfiguration(GraphPerformanceConfig config) {
    this.smallGraphThreshold = config.getSmallGraphThreshold();
    this.mediumGraphThreshold = config.getMediumGraphThreshold();
    this.maxInMemoryNodes = config.getMaxInMemoryNodes();
    this.smallGraphBatchSize = config.getSmallGraphBatchSize();
    this.mediumGraphBatchSize = config.getMediumGraphBatchSize();
    this.largeGraphBatchSize = config.getLargeGraphBatchSize();
    this.streamingBatchSize = config.getStreamingBatchSize();
    this.enableCaching = config.getEnableCaching();
    this.cacheTTLSeconds = config.getCacheTTLSeconds();
    this.maxCachedGraphs = config.getMaxCachedGraphs();
    this.enableProgressTracking = config.getEnableProgressTracking();
    this.progressReportInterval = config.getProgressReportInterval();
    this.useScrollForLargeGraphs = config.getUseScrollForLargeGraphs();
    this.scrollTimeoutMinutes = config.getScrollTimeoutMinutes();
  }

  /**
   * Creates a LineageGraphConfiguration from database settings.
   * Falls back to default values if settings are not available.
   *
   * @return LineageGraphConfiguration instance
   */
  public static LineageGraphConfiguration fromSettings() {
    try {
      LineageSettings lineageSettings =
          SettingsCache.getSetting(SettingsType.LINEAGE_SETTINGS, LineageSettings.class);

      if (lineageSettings != null && lineageSettings.getGraphPerformanceConfig() != null) {
        return new LineageGraphConfiguration(lineageSettings.getGraphPerformanceConfig());
      }

      LOG.warn("GraphPerformanceConfig not found in settings, using defaults");
      return getDefault();
    } catch (Exception e) {
      LOG.error("Failed to load LineageGraphConfiguration from settings, using defaults", e);
      return getDefault();
    }
  }

  /**
   * Returns default configuration values.
   *
   * @return Default LineageGraphConfiguration
   */
  public static LineageGraphConfiguration getDefault() {
    GraphPerformanceConfig defaultConfig =
        new GraphPerformanceConfig()
            .withSmallGraphThreshold(5000)
            .withMediumGraphThreshold(50000)
            .withMaxInMemoryNodes(100000)
            .withSmallGraphBatchSize(10000)
            .withMediumGraphBatchSize(5000)
            .withLargeGraphBatchSize(1000)
            .withStreamingBatchSize(500)
            .withEnableCaching(true)
            .withCacheTTLSeconds(300)
            .withMaxCachedGraphs(100)
            .withEnableProgressTracking(false)
            .withProgressReportInterval(1000)
            .withUseScrollForLargeGraphs(true)
            .withScrollTimeoutMinutes(5);

    return new LineageGraphConfiguration(defaultConfig);
  }

  /**
   * Gets the appropriate batch size based on estimated graph size.
   *
   * @param estimatedNodeCount Estimated number of nodes in the graph
   * @return Appropriate batch size
   */
  public int getBatchSizeForGraphSize(int estimatedNodeCount) {
    if (estimatedNodeCount < smallGraphThreshold) {
      return smallGraphBatchSize;
    } else if (estimatedNodeCount < mediumGraphThreshold) {
      return mediumGraphBatchSize;
    } else if (estimatedNodeCount < maxInMemoryNodes) {
      return largeGraphBatchSize;
    } else {
      return streamingBatchSize;
    }
  }

  /**
   * Determines if a graph of given size should be cached.
   *
   * @param nodeCount Number of nodes in the graph
   * @return true if the graph should be cached
   */
  public boolean shouldCacheGraph(int nodeCount) {
    return enableCaching && nodeCount <= mediumGraphThreshold;
  }

  /**
   * Determines if streaming mode should be used for a graph of given size.
   *
   * @param estimatedNodeCount Estimated number of nodes
   * @return true if streaming should be used
   */
  public boolean shouldUseStreaming(int estimatedNodeCount) {
    return estimatedNodeCount >= maxInMemoryNodes;
  }
}
