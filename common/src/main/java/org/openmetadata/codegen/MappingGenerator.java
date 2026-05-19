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
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.Map;

/**
 * Composes the canonical (Elasticsearch-flavored) index mapping for an entity
 * from the field-type registry, shared fragments and the per-entity spec.
 * Engine-specific variants are derived from this by {@link EngineProfile}.
 */
final class MappingGenerator {
  private final Spec spec;
  private final JsonNode fieldTypes;

  MappingGenerator(Spec spec) {
    this.spec = spec;
    this.fieldTypes = spec.fieldTypes();
  }

  ObjectNode generate(String language, String entity) {
    JsonNode entitySpec = spec.entity(entity);
    LanguageProfile profile = new LanguageProfile(spec.language(language));
    ObjectNode mappings = Json.MAPPER.createObjectNode();
    mappings.set("properties", buildProperties(entitySpec.get("fields"), language, profile));
    ObjectNode root = Json.MAPPER.createObjectNode();
    root.set("settings", resolveSettings(language, entitySpec));
    root.set("mappings", mappings);
    return root;
  }

  /**
   * Resolves the settings block: the canonical {@code base} settings, then the per-language
   * delta from {@code languages/<lang>.json}, then the entity's own settings delta.
   */
  private JsonNode resolveSettings(String language, JsonNode entitySpec) {
    ObjectNode settings = (ObjectNode) spec.settingsBase();
    mergeDelta(settings, spec.language(language).path("settings"));
    mergeDelta(settings, entityDelta(entitySpec.get("settings"), language));
    return settings;
  }

  private JsonNode entityDelta(JsonNode settings, String language) {
    return settings.has("override")
        ? settings.get("override")
        : settings.path("byLanguage").path(language);
  }

  private void mergeDelta(ObjectNode target, JsonNode delta) {
    if (delta.isObject() && !delta.isEmpty()) {
      Json.deepMerge(target, (ObjectNode) delta);
    }
  }

  private ObjectNode buildProperties(JsonNode fields, String language, LanguageProfile profile) {
    ObjectNode properties = Json.MAPPER.createObjectNode();
    for (Map.Entry<String, JsonNode> field : fields.properties()) {
      JsonNode localized = buildLocalizedField(field.getValue(), language, profile);
      if (localized != null) {
        properties.set(field.getKey(), localized);
      }
    }
    return properties;
  }

  /**
   * Builds a field for one language: the base mapping, then the systematic analyzer rename
   * from the {@link LanguageProfile}, then the field's own {@code languages.<lang>} delta.
   * A {@code languages.<lang>} of JSON null means the field is absent in that language.
   */
  private JsonNode buildLocalizedField(
      JsonNode fieldDef, String language, LanguageProfile profile) {
    JsonNode override = fieldDef.path("languages").path(language);
    if (override.isNull()) {
      return null;
    }
    ObjectNode localized = profile.apply((ObjectNode) buildField(fieldDef));
    if (override.isObject()) {
      Json.deepMerge(localized, (ObjectNode) override);
    }
    return localized;
  }

  private JsonNode buildField(JsonNode fieldDef) {
    JsonNode result;
    if (fieldDef.has("type")) {
      result = fieldTypes.get(fieldDef.get("type").asText()).deepCopy();
    } else if (fieldDef.has("fragment")) {
      result = buildFragmentField(fieldDef);
    } else if (fieldDef.has("inline")) {
      result = resolve(fieldDef.get("inline"));
    } else {
      throw new IllegalArgumentException("field has no type/fragment/inline: " + fieldDef);
    }
    Json.stripMeta(result);
    return result;
  }

  /** Exposes a fully resolved fragment (used by {@link SpecExtractor} to match shapes). */
  ObjectNode resolvedFragment(String name) {
    return (ObjectNode) resolveFragment(name);
  }

  private JsonNode buildFragmentField(JsonNode fieldDef) {
    ObjectNode ref = Json.MAPPER.createObjectNode();
    ref.put("$fragment", fieldDef.get("fragment").asText());
    if (fieldDef.has("overrides")) {
      ref.setAll((ObjectNode) fieldDef.get("overrides"));
    }
    return resolve(ref);
  }

  private JsonNode resolveFragment(String name) {
    return resolve(spec.fragment(name));
  }

  private JsonNode resolve(JsonNode node) {
    if (node.isArray()) {
      ArrayNode out = Json.MAPPER.createArrayNode();
      node.forEach(item -> out.add(resolve(item)));
      return out;
    }
    if (!node.isObject()) {
      return node;
    }
    if (node.has("$fragment")) {
      return resolveFragmentRef((ObjectNode) node);
    }
    ObjectNode out = Json.MAPPER.createObjectNode();
    node.properties().forEach(e -> out.set(e.getKey(), resolve(e.getValue())));
    return out;
  }

  private JsonNode resolveFragmentRef(ObjectNode node) {
    ObjectNode base = (ObjectNode) resolveFragment(node.get("$fragment").asText());
    ObjectNode override = Json.MAPPER.createObjectNode();
    node.properties().stream()
        .filter(e -> !e.getKey().equals("$fragment"))
        .forEach(e -> override.set(e.getKey(), e.getValue()));
    Json.deepMerge(base, (ObjectNode) resolve(override));
    return base;
  }
}
