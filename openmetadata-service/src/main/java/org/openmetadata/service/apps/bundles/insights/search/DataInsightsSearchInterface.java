package org.openmetadata.service.apps.bundles.insights.search;

import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import org.openmetadata.service.exception.UnhandledServerException;
import org.openmetadata.service.search.models.IndexMapping;
import org.openmetadata.service.util.JsonUtils;

public interface DataInsightsSearchInterface {
  String DATA_INSIGHTS_SEARCH_CONFIG_PATH = "/dataInsights/config.json";

  void createLifecyclePolicy(String name, String policy) throws IOException;

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
    DataInsightsSearchConfiguration dataInsightsSearchConfiguration =
        JsonUtils.readOrConvertValue(
            readResource(DATA_INSIGHTS_SEARCH_CONFIG_PATH), DataInsightsSearchConfiguration.class);
    EntityIndexMap entityIndexMap =
        JsonUtils.readOrConvertValue(
            readResource(
                String.format(entityIndexMapping.getIndexMappingFile(), language.toLowerCase())),
            EntityIndexMap.class);

    List<String> entityAttributes =
        dataInsightsSearchConfiguration.getMappingFields().get("common");
    entityAttributes.addAll(dataInsightsSearchConfiguration.getMappingFields().get(entityType));

    indexMappingTemplate
        .getTemplate()
        .getSettings()
        .put("analysis", entityIndexMap.getSettings().get("analysis"));

    for (String attribute : entityAttributes) {
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

  void createDataAssetsDataStream(
      String name, String entityType, IndexMapping entityIndexMapping, String language)
      throws IOException;

  void deleteDataAssetDataStream(String name) throws IOException;

  Boolean dataAssetDataStreamExists(String name) throws IOException;
}
