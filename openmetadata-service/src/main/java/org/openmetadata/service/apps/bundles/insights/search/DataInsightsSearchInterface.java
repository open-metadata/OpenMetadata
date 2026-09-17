package org.openmetadata.service.apps.bundles.insights.search;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import org.openmetadata.schema.dataInsight.custom.DataAssetType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.exception.UnhandledServerException;

public interface DataInsightsSearchInterface {
  String DATA_INSIGHTS_SEARCH_CONFIG_PATH = "/dataInsights/config.json";

  void createComponentTemplate(String name, String template) throws IOException;

  String getComponentTemplate(String name) throws IOException;

  void createIndexTemplate(String name, String template) throws IOException;

  void createDataStream(String name) throws IOException;

  record TemplateUpdateResult(IndexMappingTemplate template, boolean changed) {}

  default TemplateUpdateResult prepareDataAssetTemplates(
      String name, String entityType, IndexMapping mapping, String language, String resourcePath)
      throws IOException {
    String built =
        buildMapping(
            entityType,
            mapping,
            language,
            readResource(resourcePath + "/indexMappingsTemplate.json"));

    String componentName = name + "-mapping";
    boolean changed = !templateBodyMatches(getComponentTemplate(componentName), built);

    createComponentTemplate(componentName, built);
    createIndexTemplate(
        name,
        IndexTemplate.forDataStream(name, readResource(resourcePath + "/indexTemplate.json")));
    return new TemplateUpdateResult(
        JsonUtils.readValue(built, IndexMappingTemplate.class), changed);
  }

  /**
   * Compares the stored component-template body against the newly built mapping. The GET
   * /_component_template response wraps the template inside {@code
   * component_templates[0].component_template}, so a raw string comparison would always mismatch.
   */
  private static boolean templateBodyMatches(String getResponse, String built) {
    if (getResponse == null) {
      return false;
    }
    try {
      JsonNode root = JsonUtils.readTree(getResponse);
      JsonNode stored = root.path("component_templates").path(0).path("component_template");
      if (stored.isMissingNode()) {
        return false;
      }
      JsonNode expected = JsonUtils.readTree(built);
      return stored.equals(expected);
    } catch (Exception e) {
      return false;
    }
  }

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
    DataInsightsSearchConfiguration.MappingFields mappingFields =
        dataInsightsSearchConfiguration.getMappingFields();
    List<String> typeFields = mappingFields.getByType().get(DataAssetType.fromValue(entityType));
    if (typeFields == null) {
      throw new IllegalStateException(
          String.format(
              "%s declares no mappingFields for '%s', so its documents would carry only the common attributes",
              DATA_INSIGHTS_SEARCH_CONFIG_PATH, entityType));
    }
    // Copy: the common list is shared across every call, so appending to it in place would leak one
    // entity type's attributes into the next.
    List<String> entityAttributeFields = new ArrayList<>(mappingFields.getCommon());
    entityAttributeFields.addAll(typeFields);
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

  /**
   * Updates existing backing indexes and the template used when the data stream rolls over.
   *
   * @return {@code true} when the component template was changed (i.e. the new mapping differs from
   *     what was already registered), {@code false} when no change was needed.
   */
  boolean updateDataAssetsDataStream(
      String name, String entityType, IndexMapping entityIndexMapping, String language)
      throws IOException;

  /**
   * Forces the data stream to roll over so the next write targets a new backing index created from
   * the current index template. This is needed after a template update adds {@code
   * dynamic_templates} or settings that {@code PUT _mapping} cannot apply to an existing index.
   */
  void rolloverDataStream(String name) throws IOException;

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
