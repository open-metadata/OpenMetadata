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

package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.utils.JsonUtils;

class JsonStorageUtilsTest {

  @Test
  void sanitizeNulCharactersRemovesNulFromNestedValuesAndKeys() {
    String json =
        "{\"description\":\"root\\u0000value\","
            + "\"schemaFields\":[{\"description\":\"nested >\\u0000< NUL\"}],"
            + "\"key\\u0000suffix\":\"value\"}";

    String sanitizedJson = JsonStorageUtils.sanitizeNulCharacters(json);
    JsonNode sanitized = JsonUtils.readTree(sanitizedJson);

    assertEquals("rootvalue", sanitized.get("description").asText());
    assertEquals("nested >< NUL", sanitized.at("/schemaFields/0/description").asText());
    assertEquals("value", sanitized.get("keysuffix").asText());
    assertFalse(sanitizedJson.contains("\\u0000"));
  }

  @Test
  void sanitizeNulCharactersPreservesLiteralEscapeText() {
    String literalEscapeText = "\\u0000";
    String json = JsonUtils.pojoToJson(Map.of("value", literalEscapeText));

    String sanitizedJson = JsonStorageUtils.sanitizeNulCharacters(json);

    assertEquals(literalEscapeText, JsonUtils.readTree(sanitizedJson).get("value").asText());
  }

  @Test
  void sanitizeNulCharactersRemovesRawNulBeforeParsing() {
    String json = "{\"value\":\"before" + '\u0000' + "after\"}";

    String sanitizedJson = JsonStorageUtils.sanitizeNulCharacters(json);

    assertEquals("beforeafter", JsonUtils.readTree(sanitizedJson).get("value").asText());
  }

  @Test
  void sanitizeNulCharactersFallsBackForNonJsonInput() {
    String rawNul = "before" + '\u0000' + "after";
    String literalEscapeText = "not JSON \\u0000";

    assertEquals("beforeafter", JsonStorageUtils.sanitizeNulCharacters(rawNul));
    assertEquals(literalEscapeText, JsonStorageUtils.sanitizeNulCharacters(literalEscapeText));
    assertEquals("", JsonStorageUtils.sanitizeNulCharacters(String.valueOf('\u0000')));
  }

  @Test
  void sanitizeNulCharactersLeavesOrdinaryJsonUnchanged() {
    String json = "{\"value\":\"ordinary\"}";

    assertEquals(json, JsonStorageUtils.sanitizeNulCharacters(json));
    assertNull(JsonStorageUtils.sanitizeNulCharacters(null));
  }
}
