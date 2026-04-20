package org.openmetadata.service.apps.bundles.insights.search;

import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.exception.UnhandledServerException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public interface DataInsightsSearchInterface {
  Logger LOG = LoggerFactory.getLogger(DataInsightsSearchInterface.class);
  String DATA_INSIGHTS_SEARCH_CONFIG_PATH = "/dataInsights/config.json";

  void createComponentTemplate(String name, String template) throws IOException;

  void createIndexTemplate(String name, String template) throws IOException;

  void createDataStream(String name) throws IOException;

  default String readResource(String resourceFile) {
    try (InputStream in = getClass().getResourceAsStream(resourceFile)) {
      assert in != null;
      return new String(in.readAllBytes());
    } catch (Exception e) {
      throw new UnhandledServerException("Failed to load DataInsight Search Configurations.");
    }
  }

  default String buildMapping(
      String entityType,
      IndexMapping entityIndexMapping,
      String language,
      String indexMappingTemplateStr) {
    IndexMappingTemplate indexMappingTemplate =
        JsonUtils.readOrConvertValue(indexMappingTemplateStr, IndexMappingTemplate.class);
    EntityIndexMap entityIndexMap =
        JsonUtils.readOrConvertValue(
            readResource(
                String.format(entityIndexMapping.getIndexMappingFile(), language.toLowerCase())),
            EntityIndexMap.class);

    DataInsightsSearchConfiguration dataInsightsSearchConfiguration =
        readDataInsightsSearchConfiguration();
    List<String> entityAttributeFields =
        getEntityAttributeFields(dataInsightsSearchConfiguration, entityType);

    indexMappingTemplate
        .getTemplate()
        .getSettings()
        .put("analysis", entityIndexMap.getSettings().get("analysis"));

    for (String attribute : entityAttributeFields) {
      if (!indexMappingTemplate
          .getTemplate()
          .getMappings()
          .getProperties()
          .containsKey(attribute)) {
        Object value = entityIndexMap.getMappings().getProperties().get(attribute);
        if (value != null) {
          indexMappingTemplate.getTemplate().getMappings().getProperties().put(attribute, value);
        } else {
          LOG.warn(
              "[DI] config.json field '{}' not found in {}/{} entity mapping — will be absent from DI index",
              attribute,
              entityType,
              language);
        }
      }
    }

    return JsonUtils.pojoToJson(indexMappingTemplate);
  }

  default DataInsightsSearchConfiguration readDataInsightsSearchConfiguration() {
    return JsonUtils.readOrConvertValue(
        readResource(DATA_INSIGHTS_SEARCH_CONFIG_PATH), DataInsightsSearchConfiguration.class);
  }

  default List<String> getEntityAttributeFields(
      DataInsightsSearchConfiguration dataInsightsSearchConfiguration, String entityType) {
    List<String> result =
        new ArrayList<>(
            dataInsightsSearchConfiguration.getMappingFields().getOrDefault("common", List.of()));
    List<String> typeFields = dataInsightsSearchConfiguration.getMappingFields().get(entityType);
    if (typeFields != null) {
      result.addAll(typeFields);
    }
    return result;
  }

  void createDataAssetsDataStream(
      String name,
      String entityType,
      IndexMapping entityIndexMapping,
      String language,
      int retentionDays)
      throws IOException;

  void deleteDataAssetDataStream(String name) throws IOException;

  Boolean dataAssetDataStreamExists(String name) throws IOException;

  String getClusterAlias();

  boolean dailyIndexExists(DailyIndex index) throws IOException;

  List<DailyIndex> listDailyIndices(String clusterAlias, String entityType) throws IOException;

  void rollForward(DailyIndex from, DailyIndex to) throws IOException;

  void deleteDailyIndex(DailyIndex index) throws IOException;

  /** Deletes all regular indices matching a wildcard pattern (e.g. {@code di-data-assets-table-*}). */
  void deleteIndicesByPattern(String pattern) throws IOException;

  /** Creates the daily index if it does not already exist. Index template auto-applies mappings. */
  void createDailyIndex(DailyIndex index) throws IOException;

  /** Blocks until cluster health reaches at least Yellow or the 60-second timeout expires. */
  void waitForYellow() throws IOException;

  default String getStringWithClusterAlias(String s) {
    return getStringWithClusterAlias(getClusterAlias(), s);
  }

  static String getStringWithClusterAlias(String clusterAlias, String s) {
    if (!(clusterAlias == null || clusterAlias.isEmpty())) {
      return String.format("%s-%s", clusterAlias, s);
    }
    return s;
  }
}
