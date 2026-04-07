package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.search.IndexMappingLoader;

class IndexMappingNestedFieldConsistencyTest {

  private static final List<String> LANGUAGES = List.of("en", "jp", "ru", "zh");
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
  void extensionFieldMustBeFlattenedInAllIndices() {
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
        "The 'extension' field must have \"type\": \"flattened\" in all index mappings. "
            + "Using 'keyword' or 'object' will cause reindex failures when custom properties "
            + "(entityExtension) contain object/map values. Violations: "
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

  private static void findExtensionTypeViolations(
      JsonNode properties, String currentPath, List<String> violations, String entity) {
    Iterator<String> fieldNames = properties.fieldNames();
    while (fieldNames.hasNext()) {
      String name = fieldNames.next();
      JsonNode fieldNode = properties.get(name);
      String path = currentPath.isEmpty() ? name : currentPath + "." + name;
      if (name.equals("extension")) {
        String type = fieldNode.path("type").asText("");
        if (!"flattened".equals(type)) {
          String detail =
              type.isEmpty() ? "missing \"type\" (implicit object)" : "\"" + type + "\"";
          violations.add(entity + " (" + path + "): " + detail);
        }
      }
      JsonNode childProps = fieldNode.path("properties");
      if (!childProps.isMissingNode()) {
        findExtensionTypeViolations(childProps, path, violations, entity);
      }
    }
  }

  private static void findViolations(
      JsonNode properties, String fieldName, String currentPath, List<String> violations) {
    Iterator<String> fieldNames = properties.fieldNames();
    while (fieldNames.hasNext()) {
      String name = fieldNames.next();
      JsonNode fieldNode = properties.get(name);
      String path = currentPath.isEmpty() ? name : currentPath + "." + name;
      if (name.equals(fieldName) && fieldNode.has("properties")) {
        if (!fieldNode.has("type") || !"nested".equals(fieldNode.path("type").asText())) {
          violations.add(path);
        }
      }
      JsonNode childProps = fieldNode.path("properties");
      if (!childProps.isMissingNode()) {
        findViolations(childProps, fieldName, path, violations);
      }
    }
  }

  private static JsonNode getTopLevelProperties(JsonNode root) {
    JsonNode props = root.path("mappings").path("properties");
    if (!props.isMissingNode()) {
      return props;
    }
    props = root.path("properties");
    return props.isMissingNode() ? null : props;
  }
}
