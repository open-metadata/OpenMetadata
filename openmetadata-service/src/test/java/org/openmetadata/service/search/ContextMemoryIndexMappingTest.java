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
import static org.junit.jupiter.api.Assertions.assertNotNull;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.utils.JsonUtils;

/** Pins the memory index's security and lifecycle fields in every language. */
class ContextMemoryIndexMappingTest {

  private static final List<String> LANGUAGES = List.of("en", "jp", "ru", "zh");
  private static final List<String> INDEX_FIELDS =
      List.of("status", "statusReason", "supersededBy", "disputes", "anchorId");

  @Test
  void lifecycleFieldsAreMappedInEveryLanguage() throws IOException {
    for (String language : LANGUAGES) {
      JsonNode properties = loadProperties(language);
      assertEquals("keyword", properties.at("/anchorId/type").asText(), language);
      assertEquals("text", properties.at("/statusReason/type").asText(), language);
      assertEquals("keyword", properties.at("/supersededBy/properties/id/type").asText(), language);
      assertEquals(
          "keyword",
          properties.at("/supersededBy/properties/fullyQualifiedName/type").asText(),
          language);
      assertEquals(
          "keyword",
          properties.at("/disputes/properties/memory/properties/id/type").asText(),
          language);
      assertEquals("text", properties.at("/disputes/properties/reason/type").asText(), language);
      assertEquals(
          "date", properties.at("/disputes/properties/detectedAt/type").asText(), language);
    }
  }

  @Test
  void lifecycleFieldMappingsAreIdenticalAcrossLanguages() throws IOException {
    JsonNode english = loadProperties("en");
    for (String language : LANGUAGES) {
      JsonNode other = loadProperties(language);
      for (String field : INDEX_FIELDS) {
        assertEquals(english.get(field), other.get(field), field + " diverged in " + language);
      }
    }
  }

  private JsonNode loadProperties(String language) throws IOException {
    String path = "elasticsearch/" + language + "/context_memory_search_index.json";
    try (InputStream in = getClass().getClassLoader().getResourceAsStream(path)) {
      assertNotNull(in, "Could not locate " + path + " on the test classpath");
      String mapping = new String(in.readAllBytes(), StandardCharsets.UTF_8);
      return JsonUtils.readTree(mapping).path("mappings").path("properties");
    }
  }
}
