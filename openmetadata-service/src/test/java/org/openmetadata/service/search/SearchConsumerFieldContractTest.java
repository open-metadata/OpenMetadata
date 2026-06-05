/*
 *  Copyright 2024 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.service.search;

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
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.search.IndexMappingLoader;
import org.openmetadata.service.search.SearchConsumerFields.ConsumerField;

/**
 * Guards the search-index "consumer contract": the denormalized fields that RBAC, Data Quality,
 * Incidents, Lineage, and Data Insights query. A mapping change that renames, retypes, or drops one
 * of these fields breaks those features silently at runtime — this test turns that into a CI
 * failure that names the affected consumers. Source of truth: {@link SearchConsumerFields}.
 */
class SearchConsumerFieldContractTest {

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
            SearchConsumerFieldContractTest.class.getClassLoader().getResourceAsStream(filePath)) {
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
  void consumerLeafFieldsKeepTheirTypeWherePresent() {
    List<String> violations = new ArrayList<>();
    for (Map.Entry<String, JsonNode> entry : allMappings.entrySet()) {
      JsonNode properties = topLevelProperties(entry.getValue());
      if (properties == null) {
        continue;
      }
      for (ConsumerField field : SearchConsumerFields.TYPED_LEAF_FIELDS) {
        collectTypeViolation(entry.getKey(), properties, field, violations);
      }
    }
    assertTrue(
        violations.isEmpty(),
        "Search consumer fields changed type. These fields are queried by RBAC, Data Quality, "
            + "Incidents, Lineage, and Data Insights; retyping them silently breaks aggregations, "
            + "term filters, and access control. Violations:\n"
            + String.join("\n", violations));
  }

  @Test
  void coreDataAssetIndexesExposeConsumerFields() {
    List<String> violations = new ArrayList<>();
    for (Map.Entry<String, JsonNode> entry : allMappings.entrySet()) {
      String entity = entry.getKey().substring(0, entry.getKey().indexOf('['));
      if (SearchConsumerFields.CANARY_DATA_ASSET_ENTITIES.contains(entity)) {
        collectMissingFieldViolations(entry.getKey(), entry.getValue(), violations);
      }
    }
    assertTrue(
        violations.isEmpty(),
        "Core data asset indexes are missing denormalized fields that the shared doc-builder "
            + "pipeline is expected to write. Dropping these breaks Explore facets, RBAC, Data "
            + "Quality, and Data Insights at once. Violations:\n"
            + String.join("\n", violations));
  }

  private static void collectTypeViolation(
      String mappingKey, JsonNode properties, ConsumerField field, List<String> violations) {
    JsonNode node = findField(properties, field.path());
    if (node != null) {
      String type = node.path("type").asText("");
      if (!field.expectedType().equals(type)) {
        String actual = type.isEmpty() ? "missing \"type\" (implicit object)" : "\"" + type + "\"";
        violations.add(
            mappingKey
                + " "
                + field.path()
                + ": expected \""
                + field.expectedType()
                + "\" but found "
                + actual
                + " — breaks: "
                + field.consumers());
      }
    }
  }

  private static void collectMissingFieldViolations(
      String mappingKey, JsonNode root, List<String> violations) {
    JsonNode properties = topLevelProperties(root);
    assertNotNull(
        properties,
        "Index mapping for '"
            + mappingKey
            + "' has no properties — mapping file may be malformed.");
    for (String required : SearchConsumerFields.CANARY_REQUIRED_TOP_LEVEL_FIELDS) {
      if (!properties.has(required)) {
        violations.add(mappingKey + " missing top-level field \"" + required + "\"");
      }
    }
  }

  private static JsonNode findField(JsonNode rootProperties, String dottedPath) {
    String[] segments = dottedPath.split("\\.");
    JsonNode properties = rootProperties;
    JsonNode found = null;
    for (int i = 0; i < segments.length && properties != null && !properties.isMissingNode(); i++) {
      JsonNode node = properties.path(segments[i]);
      if (node.isMissingNode()) {
        properties = null;
      } else if (i == segments.length - 1) {
        found = node;
      } else {
        properties = node.path("properties");
      }
    }
    return found;
  }

  private static JsonNode topLevelProperties(JsonNode root) {
    JsonNode properties = root.path("mappings").path("properties");
    if (properties.isMissingNode()) {
      properties = root.path("properties");
    }
    return properties.isMissingNode() ? null : properties;
  }
}
