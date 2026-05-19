/*
 *  Copyright 2025 Collate.
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
package org.openmetadata.codegen;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.Set;

/**
 * Applies the systematic per-language difference to a generated field mapping:
 * the analyzer/normalizer name renames (e.g. {@code om_analyzer -> om_analyzer_jp}).
 * "A normalizer is a normalizer" — the rename is declared once in
 * {@code languages/<lang>.json}, not repeated on every field.
 */
final class LanguageProfile {
  private static final Set<String> ANALYZER_KEYS =
      Set.of("analyzer", "search_analyzer", "normalizer");
  private final JsonNode renames;

  LanguageProfile(JsonNode profile) {
    this.renames = profile.path("analyzers");
  }

  ObjectNode apply(ObjectNode field) {
    ObjectNode result = field.deepCopy();
    rename(result);
    return result;
  }

  private void rename(JsonNode node) {
    if (node.isArray()) {
      node.forEach(this::rename);
      return;
    }
    if (!node.isObject()) {
      return;
    }
    ObjectNode obj = (ObjectNode) node;
    obj.properties().forEach(e -> renameEntry(obj, e.getKey(), e.getValue()));
  }

  private void renameEntry(ObjectNode obj, String key, JsonNode value) {
    if (ANALYZER_KEYS.contains(key) && value.isTextual() && renames.has(value.asText())) {
      obj.set(key, renames.get(value.asText()));
    }
    rename(value);
  }
}
