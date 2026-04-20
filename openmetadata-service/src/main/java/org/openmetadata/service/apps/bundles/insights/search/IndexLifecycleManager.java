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
      String prefix =
          (clusterAlias == null || clusterAlias.isBlank()) ? base : clusterAlias + "-" + base;

      // Delete any data streams matching the prefix (v1 base stream + v2 per-day streams).
      try {
        searchInterface.deleteDataAssetDataStream(prefix + "*");
      } catch (IOException e) {
        LOG.warn("Could not delete data streams {}*: {}", prefix, e.getMessage());
      }

      // Delete any regular daily indices matching the prefix (single wildcard API call).
      try {
        searchInterface.deleteIndicesByPattern(prefix + "-*");
      } catch (IOException e) {
        LOG.warn("Could not delete indices {}-*: {}", prefix, e.getMessage());
      }
    }
  }
}
