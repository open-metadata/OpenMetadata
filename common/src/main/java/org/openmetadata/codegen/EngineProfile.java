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

/**
 * Derives an engine-specific mapping (Elasticsearch or OpenSearch) from the canonical mapping by
 * applying a declarative engine profile:
 *
 * <ul>
 *   <li>{@code typeRewrites} — rename field types (e.g. {@code flattened -> flat_object});
 *   <li>{@code keyRenames} — rename a key at a fixed path, keeping its value (e.g. the stemmer
 *       filter's {@code name -> language});
 *   <li>{@code overlay} — a deep-merge for larger structural restructuring.
 * </ul>
 */
final class EngineProfile {
  private final JsonNode profile;

  EngineProfile(JsonNode profile) {
    this.profile = profile;
  }

  ObjectNode apply(ObjectNode canonical) {
    ObjectNode result = canonical.deepCopy();
    JsonNode rewrites = profile.path("typeRewrites");
    if (rewrites.isObject()) {
      rewriteTypes(result, rewrites);
    }
    profile.path("keyRenames").forEach(rule -> applyKeyRename(result, rule));
    JsonNode overlay = profile.path("overlay");
    if (overlay.isObject()) {
      Json.deepMerge(result, (ObjectNode) overlay);
    }
    return result;
  }

  /** Renames a single key at a {@code /}-delimited path, preserving its value. */
  private void applyKeyRename(ObjectNode root, JsonNode rule) {
    JsonNode target = root;
    for (String segment : rule.get("at").asText().split("/")) {
      target = target.path(segment);
    }
    if (!target.isObject()) {
      return;
    }
    ObjectNode obj = (ObjectNode) target;
    String from = rule.get("from").asText();
    if (obj.has(from)) {
      obj.set(rule.get("to").asText(), obj.get(from));
      obj.remove(from);
    }
  }

  private void rewriteTypes(JsonNode node, JsonNode rewrites) {
    if (node.isArray()) {
      node.forEach(child -> rewriteTypes(child, rewrites));
      return;
    }
    if (!node.isObject()) {
      return;
    }
    ObjectNode obj = (ObjectNode) node;
    JsonNode type = obj.get("type");
    if (type != null && type.isTextual() && rewrites.has(type.asText())) {
      obj.set("type", rewrites.get(type.asText()));
    }
    obj.forEach(child -> rewriteTypes(child, rewrites));
  }
}
