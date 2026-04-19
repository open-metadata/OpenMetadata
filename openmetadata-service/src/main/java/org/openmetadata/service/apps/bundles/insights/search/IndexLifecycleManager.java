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

      try {
        searchInterface.deleteDataAssetDataStream(streamName);
      } catch (IOException e) {
        LOG.warn(
            "Could not delete data stream {} (may not exist): {}", streamName, e.getMessage());
      }

      for (DailyIndex index : searchInterface.listDailyIndices(clusterAlias, entityType)) {
        searchInterface.deleteDailyIndex(index);
      }
    }
  }
}
