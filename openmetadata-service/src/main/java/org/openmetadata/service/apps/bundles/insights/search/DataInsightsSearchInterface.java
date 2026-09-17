package org.openmetadata.service.apps.bundles.insights.search;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Iterator;
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

  /** Returns {@code GET /<dataStream>/_mapping} (all backing indexes), or {@code null} if absent. */
  String getDataStreamMappings(String name) throws IOException;

  /**
   * Version stamp for the Data Insights data-asset mapping. Bump this whenever the mapping or its
   * dynamic templates change (e.g. bumped to 2 for the completeness-evidence fields added in
   * #33079) so an existing data stream rolls over once to pick up the new template. The write
   * index's stored value gates the rollover; see {@link #updateDataAssetsDataStream}.
   */
  int MAPPING_VERSION = 2;

  default IndexMappingTemplate prepareDataAssetTemplates(
      String name, String entityType, IndexMapping mapping, String language, String resourcePath)
      throws IOException {
    String built =
        buildMapping(
            entityType,
            mapping,
            language,
            readResource(resourcePath + "/indexMappingsTemplate.json"));

    // Stamp the version onto the component template only. A rollover's new backing index inherits
    // it; the PUT _mapping in updateDataAssetsDataStream deliberately omits it, so a stream whose
    // rollover failed still reads as stale and is retried on the next run.
    createComponentTemplate(name + "-mapping", withMappingVersion(built));
    createIndexTemplate(
        name,
        IndexTemplate.forDataStream(name, readResource(resourcePath + "/indexTemplate.json")));
    return JsonUtils.readValue(built, IndexMappingTemplate.class);
  }

  /** Adds {@code mappings._meta.mappingVersion} to a built component-template body. */
  private static String withMappingVersion(String built) {
    try {
      ObjectNode root = (ObjectNode) JsonUtils.readTree(built);
      ObjectNode mappings = (ObjectNode) root.path("template").path("mappings");
      mappings.set("_meta", mappings.objectNode().put("mappingVersion", MAPPING_VERSION));
      return JsonUtils.pojoToJson(root);
    } catch (Exception e) {
      return built;
    }
  }

  /**
   * The mapping version currently on the data stream's write index, or {@code -1} when the stream
   * predates the version stamp (i.e. it was created on an older release and needs a rollover). A
   * failed read is reported as {@link #MAPPING_VERSION} so a transient error neither forces a
   * rollover nor trips the recreate fallback in the caller; it is simply retried on the next run.
   */
  default int writeIndexMappingVersion(String name) {
    String body;
    try {
      body = getDataStreamMappings(name);
    } catch (IOException e) {
      return MAPPING_VERSION;
    }
    if (body == null) {
      return -1;
    }
    JsonNode indices = JsonUtils.readTree(body);
    String writeIndex = null;
    Iterator<String> names = indices.fieldNames();
    while (names.hasNext()) {
      String candidate = names.next();
      // Backing index names end in a zero-padded generation, so the largest name is the write
      // index.
      if (writeIndex == null || candidate.compareTo(writeIndex) > 0) {
        writeIndex = candidate;
      }
    }
    if (writeIndex == null) {
      return -1;
    }
    return indices.path(writeIndex).path("mappings").path("_meta").path("mappingVersion").asInt(-1);
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
   * @return {@code true} when the write index's stored {@link #MAPPING_VERSION} is stale (so the
   *     caller should roll the stream over), {@code false} when it is already current.
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
