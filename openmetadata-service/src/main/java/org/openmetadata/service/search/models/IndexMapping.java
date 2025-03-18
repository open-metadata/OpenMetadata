package org.openmetadata.service.search.models;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import lombok.Builder;
import lombok.Getter;
import lombok.extern.jackson.Jacksonized;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@JsonInclude(JsonInclude.Include.NON_NULL)
@Jacksonized
@Getter
@Builder
public class IndexMapping {
  private static final Logger LOG = LoggerFactory.getLogger(IndexMapping.class);
  private static final Map<String, String> SCHEMA_CACHE = new ConcurrentHashMap<>();
  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
  @Getter String indexName;
  String indexMappingFile;
  String alias;
  List<String> parentAliases;
  List<String> childAliases;
  public static final String indexNameSeparator = "_";
  private static final String DATA_ASSET_ALIAS = "dataAsset";

  public String getIndexName(String clusterAlias) {
    return clusterAlias != null && !clusterAlias.isEmpty()
        ? clusterAlias + indexNameSeparator + indexName
        : indexName;
  }

  public String getAlias(String clusterAlias) {
    return clusterAlias != null && !clusterAlias.isEmpty()
        ? clusterAlias + indexNameSeparator + alias
        : alias;
  }

  public List<String> getParentAliases(String clusterAlias) {
    return clusterAlias != null && !clusterAlias.isEmpty()
        ? parentAliases.stream().map(alias -> clusterAlias + indexNameSeparator + alias).toList()
        : parentAliases;
  }

  public List<String> getChildAliases(String clusterAlias) {
    return clusterAlias != null && !clusterAlias.isEmpty()
        ? childAliases.stream().map(alias -> clusterAlias + indexNameSeparator + alias).toList()
        : childAliases;
  }

  private String getAlias() {
    return alias;
  }

  private List<String> getParentAliases() {
    return parentAliases;
  }

  /**
   * Initialize the schema cache for all data asset indexes
   */
  public static void initializeSchemaCache() {
    try {
      // Clear existing cache
      SCHEMA_CACHE.clear();

      // Load mapping from JSON
      JsonNode mappingData;
      try (InputStream in =
          IndexMapping.class.getResourceAsStream("/elasticsearch/indexMapping.json")) {
        if (in == null) {
          throw new IOException("Could not find indexMapping.json");
        }
        String mappingsJson = new String(in.readAllBytes(), StandardCharsets.UTF_8);
        mappingData = OBJECT_MAPPER.readTree(mappingsJson);
      }

      // Process each entity type
      Iterator<String> fieldNames = mappingData.fieldNames();
      while (fieldNames.hasNext()) {
        String entityType = fieldNames.next();
        JsonNode mapping = mappingData.get(entityType);

        // Check if it's a data asset
        if (entityType.equals("table")
            || entityType.equals("dashboard")
            || entityType.equals("topic")
            || entityType.equals("pipeline")
            || entityType.equals("mlmodel")
            || entityType.equals("container")) {

          String indexName = entityType + "_search_index";
          String schema = extractSchemaFromMapping(entityType, mapping);
          if (schema != null) {
            SCHEMA_CACHE.put(indexName, schema);
            LOG.info("Cached schema for data asset index: {}", indexName);
          }
        }
      }

      // Create a default schema with common fields
      SCHEMA_CACHE.put("default", createDefaultSchema());
      LOG.info("Schema cache initialized with {} indexes", SCHEMA_CACHE.size());

    } catch (Exception e) {
      LOG.error("Failed to initialize schema cache", e);
    }
  }

  private static String extractSchemaFromMapping(String entityType, JsonNode mapping) {
    try {
      // Extract properties if available
      JsonNode mappingsNode = mapping.path("mappings");
      JsonNode propertiesNode = mappingsNode.path("properties");

      if (propertiesNode.isMissingNode()) {
        LOG.warn("No properties found for entity type: {}", entityType);
        return null;
      }

      // Create schema info object
      ObjectNode schemaInfo = OBJECT_MAPPER.createObjectNode();
      schemaInfo.put("entityType", entityType);
      schemaInfo.put("indexName", entityType + "_search_index");

      // Extract field definitions
      ObjectNode fields = OBJECT_MAPPER.createObjectNode();
      extractFieldDefinitions(propertiesNode, fields);
      schemaInfo.set("fields", fields);

      return OBJECT_MAPPER.writeValueAsString(schemaInfo);
    } catch (Exception e) {
      LOG.warn("Failed to extract schema for {}", entityType, e);
      return null;
    }
  }

  private static void extractFieldDefinitions(JsonNode properties, ObjectNode result) {
    Iterator<String> fieldNames = properties.fieldNames();
    while (fieldNames.hasNext()) {
      String fieldName = fieldNames.next();
      JsonNode fieldDef = properties.get(fieldName);

      if (fieldDef.has("type")) {
        // Basic field with a type
        result.put(fieldName, fieldDef.get("type").asText());
      } else if (fieldDef.has("properties")) {
        // Nested object with its own properties
        ObjectNode nestedFields = OBJECT_MAPPER.createObjectNode();
        extractFieldDefinitions(fieldDef.get("properties"), nestedFields);
        result.set(fieldName, nestedFields);
      }
    }
  }

  private static String createDefaultSchema() {
    try {
      ObjectNode defaultSchema = OBJECT_MAPPER.createObjectNode();
      defaultSchema.put("entityType", "default");

      // Add common fields that most data assets have
      ObjectNode fields = OBJECT_MAPPER.createObjectNode();
      fields.put("name", "text");
      fields.put("displayName", "text");
      fields.put("description", "text");
      fields.put("fullyQualifiedName", "text");
      fields.put("service.name", "text");
      fields.put("owner.name", "text");

      defaultSchema.set("fields", fields);
      return OBJECT_MAPPER.writeValueAsString(defaultSchema);
    } catch (Exception e) {
      LOG.error("Failed to create default schema", e);
      return "{}";
    }
  }

  /**
   * Get schema information for a specific index
   * @param indexName The name of the index
   * @return JSON string with schema information
   */
  public static String getIndexSchema(String indexName) {
    if (SCHEMA_CACHE.isEmpty()) {
      initializeSchemaCache();
    }

    return SCHEMA_CACHE.getOrDefault(indexName, SCHEMA_CACHE.get("default"));
  }

  /**
   * Check if an index is a data asset index
   * @param indexName The name of the index
   * @return true if it's a data asset index
   */
  public static boolean isDataAssetIndex(String indexName) {
    return SCHEMA_CACHE.containsKey(indexName);
  }
}
