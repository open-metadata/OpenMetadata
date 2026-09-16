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

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.openmetadata.schema.exception.JsonParsingException;
import org.openmetadata.schema.utils.JsonUtils;

/** Normalizes JSON documents to the character set supported by database JSON columns. */
public final class JsonStorageUtils {
  private static final char NUL_CHARACTER = '\u0000';
  private static final String JSON_NUL_ESCAPE = "\\u0000";

  private JsonStorageUtils() {}

  /**
   * PostgreSQL JSONB cannot store U+0000, even though escaped NUL is valid JSON. Non-JSON values
   * fall back to raw NUL removal.
   */
  public static String sanitizeNulCharacters(String json) {
    String sanitizedJson = json;
    if (containsNulCandidate(json)) {
      String parseableJson = removeNulCharacters(json);
      try {
        JsonNode jsonNode = JsonUtils.readTree(parseableJson);
        sanitizedJson = jsonNode == null ? parseableJson : sanitizeNode(jsonNode).toString();
      } catch (JsonParsingException ignored) {
        sanitizedJson = parseableJson;
      }
    }
    return sanitizedJson;
  }

  /** Removes U+0000 from database-bound text while preserving null inputs. */
  public static String removeNulCharacters(String value) {
    String sanitizedValue = value;
    if (value != null && value.indexOf(NUL_CHARACTER) >= 0) {
      sanitizedValue = value.replace(String.valueOf(NUL_CHARACTER), "");
    }
    return sanitizedValue;
  }

  private static boolean containsNulCandidate(String json) {
    return json != null && (json.indexOf(NUL_CHARACTER) >= 0 || json.contains(JSON_NUL_ESCAPE));
  }

  private static JsonNode sanitizeNode(JsonNode node) {
    JsonNode sanitizedNode = node;
    if (node.isObject()) {
      sanitizedNode = sanitizeObject((ObjectNode) node);
    } else if (node.isArray()) {
      sanitizedNode = sanitizeArray((ArrayNode) node);
    } else if (node.isTextual()) {
      sanitizedNode =
          JsonUtils.getObjectMapper()
              .getNodeFactory()
              .textNode(removeNulCharacters(node.textValue()));
    }
    return sanitizedNode;
  }

  private static ObjectNode sanitizeObject(ObjectNode node) {
    ObjectNode sanitizedNode = JsonUtils.getObjectMapper().createObjectNode();
    node.fields()
        .forEachRemaining(
            entry ->
                sanitizedNode.set(
                    removeNulCharacters(entry.getKey()), sanitizeNode(entry.getValue())));
    return sanitizedNode;
  }

  private static ArrayNode sanitizeArray(ArrayNode node) {
    ArrayNode sanitizedNode = JsonUtils.getObjectMapper().createArrayNode();
    node.forEach(value -> sanitizedNode.add(sanitizeNode(value)));
    return sanitizedNode;
  }
}
