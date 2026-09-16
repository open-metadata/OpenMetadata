/*
 *  Copyright 2026 Collate
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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Guards the ES mapping for {@code data_product} enum-like fields. These fields carry a fixed,
 * lowercase set of values (e.g. {@code DATASET}, {@code PRIVATE}, {@code HIGH}) and must be mapped
 * as {@code keyword} so they are stored as-is for exact-match filtering and aggregations — not as
 * {@code text} with a {@code .keyword} sub-field, which would analyze the token, waste index
 * space, and silently change search behavior.
 */
class DataProductIndexMappingTest {

  private static final List<String> LANGUAGES = List.of("en", "jp", "ru", "zh");
  private static final List<String> ENUM_FIELDS =
      List.of("dataProductType", "visibility", "portfolioPriority", "lifecycleStage");

  @Test
  void enumFieldsUseKeywordTypeInAllLanguages() {
    for (String language : LANGUAGES) {
      JsonNode properties = loadProperties(language);
      for (String field : ENUM_FIELDS) {
        JsonNode fieldNode = properties.get(field);
        assertNotNull(
            fieldNode, field + " missing from data_products_index_mapping.json for " + language);
        assertEquals(
            "keyword",
            fieldNode.path("type").asText(),
            field
                + " in "
                + language
                + " must be mapped as plain 'keyword'; enum fields should not use 'text' with a"
                + " .keyword sub-field");
        assertFalse(
            fieldNode.has("fields"),
            field
                + " in "
                + language
                + " must not define a 'fields' sub-mapping — use a top-level keyword instead");
        assertEquals(
            "lowercase_normalizer",
            fieldNode.path("normalizer").asText(),
            field + " in " + language + " should keep the lowercase_normalizer");
      }
    }
  }

  @Test
  void enumFieldsAreConsistentAcrossLanguages() {
    JsonNode enProperties = loadProperties("en");
    for (String field : ENUM_FIELDS) {
      JsonNode enField = enProperties.get(field);
      for (String language : LANGUAGES) {
        if ("en".equals(language)) continue;
        JsonNode otherField = loadProperties(language).get(field);
        assertEquals(
            enField,
            otherField,
            field
                + " mapping diverged between en and "
                + language
                + " — enum field mappings must stay in sync across locales");
      }
    }
  }

  private JsonNode loadProperties(String language) {
    String path = "elasticsearch/" + language + "/data_products_index_mapping.json";
    try (InputStream in = getClass().getClassLoader().getResourceAsStream(path)) {
      assertNotNull(in, "Could not locate " + path + " on the test classpath");
      JsonNode root = JsonUtils.readTree(new String(in.readAllBytes(), StandardCharsets.UTF_8));
      JsonNode mappings = root.path("mappings");
      JsonNode properties = mappings.path("properties");
      assertTrue(
          properties.isObject() && properties.size() > 0,
          "data_products_index_mapping.json for " + language + " has no mappings.properties block");
      return properties;
    } catch (Exception e) {
      throw new AssertionError("Failed to read " + path, e);
    }
  }
}
