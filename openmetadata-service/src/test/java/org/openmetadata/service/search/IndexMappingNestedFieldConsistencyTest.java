package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.search.IndexMappingLoader;

class IndexMappingNestedFieldConsistencyTest {

  private static final List<String> LANGUAGES = List.of("en", "jp", "ru", "zh");
  private static final String TESTS_SCHEMA_DIR = "json/schema/tests/";
  private static final String RESOLUTION_STATUS_ENTITY = "testCaseResolutionStatus";
  private static final String RESOLUTION_DETAILS_FIELD = "testCaseResolutionStatusDetails";
  private static Map<String, JsonNode> allMappings;

  @BeforeAll
  static void loadAllMappings() throws IOException {
    IndexMappingLoader.init();
    IndexMappingLoader loader = IndexMappingLoader.getInstance();
    allMappings = new HashMap<>();
    for (Map.Entry<String, IndexMapping> entry : loader.getIndexMapping().entrySet()) {
      String entity = entry.getKey();
      IndexMapping indexMapping = entry.getValue();
      for (String language : LANGUAGES) {
        String filePath = indexMapping.getIndexMappingFile(language);
        try (InputStream in =
            IndexMappingNestedFieldConsistencyTest.class
                .getClassLoader()
                .getResourceAsStream(filePath)) {
          if (in == null) {
            continue;
          }
          String key = entity + "[" + language + "]";
          allMappings.put(
              key, JsonUtils.readTree(new String(in.readAllBytes(), StandardCharsets.UTF_8)));
        }
      }
    }
    assertTrue(allMappings.size() > 1, "Should load more than one index mapping");
  }

  @Test
  void extensionFieldMustBeDisabledObjectInAllIndices() {
    List<String> violations = new ArrayList<>();
    for (Map.Entry<String, JsonNode> entry : allMappings.entrySet()) {
      String entity = entry.getKey();
      JsonNode properties = getTopLevelProperties(entry.getValue());
      assertNotNull(
          properties,
          "Index mapping for '" + entity + "' has no properties — mapping file may be malformed.");
      findExtensionTypeViolations(properties, "", violations, entity);
    }
    assertTrue(
        violations.isEmpty(),
        "The 'extension' field must be \"type\": \"object\" with \"enabled\": false in all index "
            + "mappings. It stores arbitrary custom-property (entityExtension) values without "
            + "indexing them, which avoids field explosion and the Lucene 32766-byte immense-term "
            + "failure that flattened/flat_object leaves hit on OpenSearch. Custom-property search "
            + "goes through customPropertiesTyped. Violations: "
            + violations);
  }

  @Test
  void taggableIndexFieldsMustAppearTogether() {
    List<String> violations = new ArrayList<>();
    for (Map.Entry<String, JsonNode> entry : allMappings.entrySet()) {
      String entity = entry.getKey();
      JsonNode properties = getTopLevelProperties(entry.getValue());
      assertNotNull(
          properties,
          "Index mapping for '" + entity + "' has no properties — mapping file may be malformed.");
      boolean hasClassificationTags = properties.has("classificationTags");
      boolean hasGlossaryTags = properties.has("glossaryTags");
      if (hasClassificationTags != hasGlossaryTags) {
        violations.add(
            entity
                + " (classificationTags="
                + hasClassificationTags
                + ", glossaryTags="
                + hasGlossaryTags
                + ")");
      }
    }
    assertTrue(
        violations.isEmpty(),
        "Indexes whose backing index class implements TaggableIndex must define both "
            + "'classificationTags' and 'glossaryTags' as top-level keyword fields. "
            + "TaggableIndex.applyTagFields() writes both into every doc; if the mapping omits "
            + "one, OpenSearch dynamic-maps it as text and aggregations/sorts/scripts on it fail "
            + "at reindex time. Violations: "
            + violations);
  }

  @Test
  void ownersFieldMustBeNestedInAllIndices() {
    List<String> violations = new ArrayList<>();
    for (Map.Entry<String, JsonNode> entry : allMappings.entrySet()) {
      String entity = entry.getKey();
      JsonNode properties = getTopLevelProperties(entry.getValue());
      assertNotNull(
          properties,
          "Index mapping for '" + entity + "' has no properties — mapping file may be malformed.");
      List<String> paths = new ArrayList<>();
      findViolations(properties, "owners", "", paths);
      for (String path : paths) {
        violations.add(entity + " (" + path + ")");
      }
    }
    assertTrue(
        violations.isEmpty(),
        "The 'owners' field must have \"type\": \"nested\" in all index mappings. "
            + "Missing in: "
            + violations
            + ". RBAC nested queries will fail on these indices.");
  }

  @Test
  void customPropertiesTypedMustBeNestedWhereExtensionExists() {
    List<String> violations = new ArrayList<>();
    for (Map.Entry<String, JsonNode> entry : allMappings.entrySet()) {
      String entity = entry.getKey();
      JsonNode properties = getTopLevelProperties(entry.getValue());
      assertNotNull(
          properties,
          "Index mapping for '" + entity + "' has no properties — mapping file may be malformed.");
      if (properties.has("extension")) {
        JsonNode typed = properties.get("customPropertiesTyped");
        boolean nested = typed != null && "nested".equals(typed.path("type").asText());
        if (!nested) {
          String detail = typed == null ? "missing" : "\"" + typed.path("type").asText("") + "\"";
          violations.add(entity + " (customPropertiesTyped=" + detail + ")");
        }
      }
    }
    assertTrue(
        violations.isEmpty(),
        "Every index whose mapping declares a top-level 'extension' field (i.e. it stores "
            + "custom-property values) must also declare 'customPropertiesTyped' with "
            + "\"type\": \"nested\". SearchIndex writes customPropertiesTyped into every such doc; "
            + "if the mapping omits it, OpenSearch dynamic-maps it as a plain object and the nested "
            + "custom-property search query fails at runtime with '[nested] nested object under "
            + "path [customPropertiesTyped] is not of nested type'. Violations: "
            + violations);
  }

  @Test
  void aiGovernanceProjectionFieldsMustBeMappedExplicitly() {
    List<String> violations = new ArrayList<>();
    for (String entity : List.of("aiApplication", "llmModel", "mcpServer")) {
      for (String language : LANGUAGES) {
        JsonNode mapping = allMappings.get(entity + "[" + language + "]");
        JsonNode properties = mapping == null ? null : getTopLevelProperties(mapping);
        JsonNode aiGovernance = properties == null ? null : properties.get("aiGovernance");
        if (aiGovernance == null) {
          violations.add(entity + "[" + language + "] missing aiGovernance");
          continue;
        }
        assertEquals("object", aiGovernance.path("type").asText(), entity + "[" + language + "]");
        JsonNode projection = aiGovernance.path("properties");
        for (String field :
            List.of(
                "assetSubtype",
                "registrationStatus",
                "riskLevel",
                "accessesPii",
                "accessesSensitiveData",
                "dataCategories",
                "detection",
                "complianceStatus",
                "frameworks",
                "euRiskClassification",
                "regions",
                "lastAssessedAt",
                "affectedUserCount")) {
          if (!projection.has(field)) {
            violations.add(entity + "[" + language + "] missing aiGovernance." + field);
          }
        }
      }
    }
    assertTrue(violations.isEmpty(), "AI governance projection mapping gaps: " + violations);
  }

  @Test
  void auditReportIndexFieldsMustBeMappedExplicitly() {
    List<String> violations = new ArrayList<>();
    for (String language : LANGUAGES) {
      JsonNode mapping = allMappings.get("auditReport[" + language + "]");
      JsonNode properties = mapping == null ? null : getTopLevelProperties(mapping);
      for (String field : List.of("status", "scope", "format", "requestedAt", "completedAt")) {
        if (properties == null || !properties.has(field)) {
          violations.add("auditReport[" + language + "] missing " + field);
        }
      }
    }
    assertTrue(violations.isEmpty(), "Audit report mapping gaps: " + violations);
  }

  @Test
  void resolutionStatusDetailsMappingMustMatchSchemaProperties() throws IOException {
    Set<String> schemaProperties = resolutionDetailsSchemaProperties();
    List<String> violations = new ArrayList<>();
    for (String language : LANGUAGES) {
      String entity = RESOLUTION_STATUS_ENTITY + "[" + language + "]";
      JsonNode mapping = allMappings.get(entity);
      JsonNode properties = mapping == null ? null : getTopLevelProperties(mapping);
      assertNotNull(properties, "Index mapping for '" + entity + "' was not loaded.");
      Set<String> mapped = fieldNames(properties.path(RESOLUTION_DETAILS_FIELD).path("properties"));
      if (!mapped.equals(schemaProperties)) {
        violations.add(entity + " maps " + mapped);
      }
    }
    assertTrue(
        violations.isEmpty(),
        "The '"
            + RESOLUTION_DETAILS_FIELD
            + "' mapping must declare exactly the properties its schema allows "
            + schemaProperties
            + ". testCaseResolutionStatus.json models this field as a oneOf over closed "
            + "(additionalProperties=false) branches, so a mapped subfield the schema does not "
            + "declare can never match a document — the boost/filter that targets it is dead — and "
            + "a schema property the mapping omits is left to dynamic mapping, losing its declared "
            + "type and per-language analyzer. Violations: "
            + violations);
  }

  /**
   * The union of the properties of every {@code oneOf} branch of {@code
   * testCaseResolutionStatusDetails}, read from the JSON Schema so that adding a property to
   * assigned.json / resolved.json fails this test until the mappings follow.
   */
  private static Set<String> resolutionDetailsSchemaProperties() throws IOException {
    JsonNode branches =
        readSchema(TESTS_SCHEMA_DIR + "testCaseResolutionStatus.json")
            .path("properties")
            .path(RESOLUTION_DETAILS_FIELD)
            .path("oneOf");
    assertTrue(
        branches.isArray() && !branches.isEmpty(), RESOLUTION_DETAILS_FIELD + " has no oneOf");
    Set<String> properties = new TreeSet<>();
    for (JsonNode branch : branches) {
      String fileName = branch.path("$ref").asText().replaceFirst("^\\./", "");
      properties.addAll(fieldNames(readSchema(TESTS_SCHEMA_DIR + fileName).path("properties")));
    }
    return properties;
  }

  private static JsonNode readSchema(String resource) throws IOException {
    try (InputStream in =
        IndexMappingNestedFieldConsistencyTest.class
            .getClassLoader()
            .getResourceAsStream(resource)) {
      assertNotNull(in, "Schema resource not found on the classpath: " + resource);
      return JsonUtils.readTree(new String(in.readAllBytes(), StandardCharsets.UTF_8));
    }
  }

  private static Set<String> fieldNames(JsonNode node) {
    Set<String> names = new TreeSet<>();
    node.fieldNames().forEachRemaining(names::add);
    return names;
  }

  private static void findExtensionTypeViolations(
      JsonNode properties, String currentPath, List<String> violations, String entity) {
    IndexMappingProperties.walk(
        properties,
        (path, fieldNode) -> {
          if (path.endsWith("extension")) {
            String type = fieldNode.path("type").asText("");
            boolean disabledObject =
                "object".equals(type) && !fieldNode.path("enabled").asBoolean(true);
            if (!disabledObject) {
              String detail =
                  type.isEmpty()
                      ? "missing \"type\" (implicit object)"
                      : "\"" + type + "\" enabled=" + fieldNode.path("enabled").asText("true");
              violations.add(entity + " (" + path + "): " + detail);
            }
          }
          return true;
        });
  }

  private static void findViolations(
      JsonNode properties, String fieldName, String currentPath, List<String> violations) {
    IndexMappingProperties.walk(
        properties,
        (path, fieldNode) -> {
          boolean isTarget = path.equals(fieldName) || path.endsWith("." + fieldName);
          if (isTarget
              && fieldNode.has("properties")
              && (!fieldNode.has("type") || !"nested".equals(fieldNode.path("type").asText()))) {
            violations.add(path);
          }
          return true;
        });
  }

  private static JsonNode getTopLevelProperties(JsonNode root) {
    JsonNode props = IndexMappingProperties.topLevel(root);
    return props.isMissingNode() ? null : props;
  }
}
