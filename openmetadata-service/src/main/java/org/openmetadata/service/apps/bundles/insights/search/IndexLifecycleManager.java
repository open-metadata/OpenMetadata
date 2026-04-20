package org.openmetadata.service.apps.bundles.insights.search;

import java.io.IOException;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public record IndexLifecycleManager(
    DataInsightsSearchInterface searchInterface, Set<String> entityTypes) {

  private static final Logger LOG = LoggerFactory.getLogger(IndexLifecycleManager.class);

  public void deleteAll() throws IOException {
    String clusterAlias = searchInterface.getClusterAlias();
    for (String entityType : entityTypes) {
      String base = "di-data-assets-" + entityType.toLowerCase();
      String streamName =
          (clusterAlias == null || clusterAlias.isBlank()) ? base : clusterAlias + "-" + base;

      // Use wildcard to cover both the base stream and any per-day variants
      // (e.g. di-data-assets-chart AND di-data-assets-chart-2026.03.21).
      try {
        searchInterface.deleteDataAssetDataStream(streamName + "*");
      } catch (IOException e) {
        LOG.warn("Could not delete data stream {}*: {}", streamName, e.getMessage());
      }

      try {
        for (DailyIndex index : searchInterface.listDailyIndices(clusterAlias, entityType)) {
          try {
            searchInterface.deleteDailyIndex(index);
          } catch (IOException e) {
            LOG.warn("Could not delete daily index {}: {}", index.name(), e.getMessage());
          }
        }
      } catch (IOException e) {
        LOG.warn("Could not list daily indices for {}: {}", entityType, e.getMessage());
      }
    }
  }
}
