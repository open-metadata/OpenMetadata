package org.openmetadata.service.apps.bundles.insights.search;

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

  void createIndexTemplate(String name, String template) throws IOException;

  void createDataStream(String name) throws IOException;

  default IndexMappingTemplate prepareDataAssetTemplates(
      String name, String entityType, IndexMapping mapping, String language, String resourcePath)
      throws IOException {
    String built =
        buildMapping(
            entityType,
            mapping,
            language,
            readResource(resourcePath + "/indexMappingsTemplate.json"));
    createComponentTemplate(name + "-mapping", built);
    createIndexTemplate(
        name,
        IndexTemplate.forDataStream(name, readResource(resourcePath + "/indexTemplate.json")));
    return JsonUtils.readValue(built, IndexMappingTemplate.class);
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

  /** The engine's template resource path (e.g. {@code /dataInsights/elasticsearch}). */
  String getResourcePath();

  /**
   * Updates the data stream's mapping. Applies the current template to the write index only
   * ({@code write_index_only=true}); when the engine rejects an in-place field-type change with a
   * 400 (e.g. a stream created before 1.13, where {@code owners} became {@code nested} and {@code
   * extension} became an {@code object}), the stream is rolled over so the next write index is
   * created fresh from the template, and the mapping is applied to that new index. Any other failure
   * propagates to the caller, which logs and retries on the next run. History is preserved either
   * way — no backing index is deleted.
   */
  default void updateDataAssetsDataStream(
      String name, String entityType, IndexMapping entityIndexMapping, String language)
      throws IOException {
    String mappings =
        JsonUtils.pojoToJson(
            prepareDataAssetTemplates(
                    name, entityType, entityIndexMapping, language, getResourcePath())
                .getTemplate()
                .getMappings());
    try {
      putWriteIndexMapping(name, mappings);
    } catch (IOException e) {
      if (!isMappingConflict(e)) {
        throw e;
      }
      rolloverDataStream(name);
      putWriteIndexMapping(name, mappings);
    }
  }

  /**
   * Applies {@code mappings} to the data stream's current write index only ({@code PUT
   * /<stream>/_mapping?write_index_only=true}), so older backing indexes carrying an incompatible
   * mapping do not reject the update on later runs.
   */
  void putWriteIndexMapping(String name, String mappings) throws IOException;

  /**
   * True when a request failed with HTTP 400 — e.g. the engine rejected an in-place field-type
   * change, which is the signal to roll the stream over.
   */
  default boolean isMappingConflict(IOException e) {
    return e.getMessage() != null && e.getMessage().contains("400");
  }

  /**
   * Forces the data stream to roll over so the next write targets a new backing index created from
   * the current index template. Needed when a template change cannot be applied in place (a new
   * field type, dynamic template, or setting).
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
