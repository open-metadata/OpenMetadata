package org.openmetadata.service.migration.utils.v172;

import java.util.List;
import lombok.SneakyThrows;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.search.SearchRepository;

@Slf4j
public class MigrationUtil {
  private MigrationUtil() {}

  private static final String DATA_INSIGHTS_PREFIX = "di-data-assets";
  private static final String INDEX_TEMPLATE_NAME = "di-data-assets";
  private static final String ILM_POLICY_NAME = "di-data-assets-lifecycle";
  private static final List<String> COMPONENT_TEMPLATES_NAMES =
      List.of("di-data-assets-mapping", "di-data-assets-settings");
  private static String clusterAlias;

  public static void removeOldDataInsightsObjects() {
    // From 1.6.6 we implemented the support for CLUSTER_ALIAS for Data Insights.
    // The old objects without CLUSTER_ALIAS were not cleaned then.
    // From 1.7.1 we removed the ILM policy.
    LOG.info("Starting cleanup of old Data Insights objects");
    SearchRepository searchRepository = org.openmetadata.service.Entity.getSearchRepository();
    SearchClient searchClient = searchRepository.getSearchClient();
    clusterAlias = searchRepository.getClusterAlias();

    if (clusterAlias != null && !clusterAlias.isEmpty()) {
      // Delete data insights objects without cluster alias
      try {
        deleteDataInsightsDataStreams(searchClient);
        deleteIndexTemplate(searchClient);
        deleteComponentTemplate(searchClient);
        deleteIlmPolicy(searchClient, null);
      } catch (Exception e) {
        LOG.error("Error deleting Data Insights objects", e);
      }
    } else {
      LOG.info("No CLUSTER_ALIAS found, skipping cleanup");
    }

    deleteIlmPolicy(searchClient, clusterAlias);
    LOG.info("Successfully completed Data Insights ILM cleanup");
  }

  private static String getClusteredPrefix(String clusterAlias, String prefix) {
    if (CommonUtil.nullOrEmpty(clusterAlias)) {
      return prefix;
    } else {
      return String.format("%s-%s", clusterAlias, prefix);
    }
  }

  @SneakyThrows
  private static void deleteDataInsightsDataStreams(SearchClient searchClient) {
    try {
      // Get and delete data streams that don't have cluster alias
      List<String> dataStreams =
          searchClient.getDataStreams(String.format("%s-*", DATA_INSIGHTS_PREFIX));
      for (String name : dataStreams) {
        try {
          if (!name.startsWith(clusterAlias)) {
            searchClient.deleteDataStream(name);
          }
        } catch (Exception e) {
          LOG.error(String.format("Error deleting %s Data Stream", name), e);
        }
      }
    } catch (Exception e) {
      LOG.error("Error deleting data insights data streams", e);
    }
  }

  @SneakyThrows
  private static void deleteIlmPolicy(SearchClient searchClient, String clusterAlias) {
    try {
      searchClient.removeILMFromComponentTemplate(
          String.format(
              "%s-%s", getClusteredPrefix(clusterAlias, INDEX_TEMPLATE_NAME), "settings"));
      searchClient.dettachIlmPolicyFromIndexes(
          String.format("*%s-*", getClusteredPrefix(clusterAlias, DATA_INSIGHTS_PREFIX)));
      searchClient.deleteILMPolicy(getClusteredPrefix(clusterAlias, ILM_POLICY_NAME));
    } catch (Exception e) {
      LOG.error("Error deleting ILM policies", e);
    }
  }

  @SneakyThrows
  private static void deleteIndexTemplate(SearchClient searchClient) {
    try {
      searchClient.deleteIndexTemplate(INDEX_TEMPLATE_NAME);
    } catch (Exception e) {
      LOG.error("Error deleting index template", e);
    }
  }

  @SneakyThrows
  private static void deleteComponentTemplate(SearchClient searchClient) {
    for (String componentName : COMPONENT_TEMPLATES_NAMES) {
      try {
        searchClient.deleteComponentTemplate(componentName);
      } catch (Exception e) {
        LOG.error("Error deleting component template", e);
      }
    }
  }
}
