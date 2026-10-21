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

package org.openmetadata.service.config.source;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.NullNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.databind.node.TextNode;
import java.util.HashSet;
import java.util.Set;

/**
 * Compares setting values the way an operator means them, not byte for byte.
 *
 * <p>The deployment value is parsed from YAML with environment substitution, while the stored value
 * comes from JSON written by the UI, so the same setting arrives as {@code "604800"} on one side and
 * {@code 604800} on the other, as an empty string or as a missing key, with Windows or Unix line
 * endings in a PEM block. Treating those as different would report drift on every start.
 */
public final class SettingValues {
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final JsonNodeFactory NODES = JsonNodeFactory.instance;
  private static final String PEM_MARKER = "-----BEGIN";

  private SettingValues() {}

  /** Null, absent, empty text and empty containers all mean "not set". */
  public static boolean isBlank(JsonNode node) {
    return node == null
        || node.isMissingNode()
        || node.isNull()
        || (node.isTextual() && node.asText().isBlank())
        || (node.isContainerNode() && node.isEmpty());
  }

  public static boolean same(JsonNode left, JsonNode right) {
    return canonical(left).equals(canonical(right));
  }

  /** Compares arrays as sets: order and duplicates do not matter. */
  public static boolean sameElements(JsonNode left, JsonNode right) {
    return canonicalElements(left).equals(canonicalElements(right));
  }

  /** Whether every entry of {@code entries} is in {@code array}, compared as sets. */
  public static boolean containsElements(JsonNode array, JsonNode entries) {
    return canonicalElements(array).containsAll(canonicalElements(entries));
  }

  public static Set<JsonNode> canonicalElements(JsonNode array) {
    Set<JsonNode> elements = new HashSet<>();
    if (array != null && array.isArray()) {
      array.forEach(element -> elements.add(canonical(element)));
    }
    return elements;
  }

  /** A form of {@code node} in which every equivalent spelling of the same value is identical. */
  public static JsonNode canonical(JsonNode node) {
    if (isBlank(node)) {
      return NullNode.getInstance();
    }
    return switch (node.getNodeType()) {
      case OBJECT -> canonicalObject((ObjectNode) node);
      case ARRAY -> canonicalArray((ArrayNode) node);
      case NUMBER -> TextNode.valueOf(node.decimalValue().stripTrailingZeros().toPlainString());
      case STRING -> canonicalText(node.asText());
      default -> TextNode.valueOf(node.asText());
    };
  }

  private static JsonNode canonicalObject(ObjectNode node) {
    ObjectNode canonical = NODES.objectNode();
    node.fields()
        .forEachRemaining(
            field -> {
              JsonNode value = canonical(field.getValue());
              if (!value.isNull()) {
                canonical.set(field.getKey(), value);
              }
            });
    return canonical.isEmpty() ? NullNode.getInstance() : canonical;
  }

  private static JsonNode canonicalArray(ArrayNode node) {
    ArrayNode canonical = NODES.arrayNode();
    node.forEach(element -> canonical.add(canonical(element)));
    return canonical;
  }

  private static JsonNode canonicalText(String text) {
    String trimmed = text.strip();
    if (trimmed.contains(PEM_MARKER)) {
      return TextNode.valueOf(trimmed.replace("\r\n", "\n"));
    }
    return looksLikeJson(trimmed) ? parsedJsonOrText(trimmed) : TextNode.valueOf(trimmed);
  }

  private static boolean looksLikeJson(String text) {
    return text.startsWith("{") || text.startsWith("[");
  }

  /** Settings such as LDAP role mappings hold JSON in a string; compare what the JSON says. */
  private static JsonNode parsedJsonOrText(String text) {
    try {
      return canonical(MAPPER.readTree(text));
    } catch (JsonProcessingException notJson) {
      return TextNode.valueOf(text);
    }
  }
}
