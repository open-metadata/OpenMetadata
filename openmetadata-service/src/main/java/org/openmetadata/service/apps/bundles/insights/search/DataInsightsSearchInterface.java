package org.openmetadata.service.apps.bundles.insights.search;

import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.exception.UnhandledServerException;

public interface DataInsightsSearchInterface {
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
    List<String> entityAttributeFields =
        dataInsightsSearchConfiguration.getMappingFields().get("common");
    entityAttributeFields.addAll(
        dataInsightsSearchConfiguration.getMappingFields().get(entityType));

    return entityAttributeFields;
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
