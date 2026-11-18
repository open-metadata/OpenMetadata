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

package org.openmetadata.service.datacontract.odcs;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import org.openmetadata.service.datacontract.odcs.ODCSFieldCoverage.Section;

/** Stores ODCS metadata independently of the generated ODCS model. */
public final class ODCSPreservedFields {
  private static final ObjectMapper JSON =
      new ObjectMapper().enable(DeserializationFeature.USE_BIG_DECIMAL_FOR_FLOATS);
  private static final String DOCUMENT = "document";
  private static final String UNAPPLIED = "unapplied";
  private static final String NATIVE_BINDINGS = "nativeBindings";
  private static final String SCHEMA = "schema";
  private static final String NAME = "name";
  private static final String PROPERTIES = "properties";
  private static final String LOGICAL_TYPE = "logicalType";
  private static final String OBJECT = "object";
  private static final Set<String> GENERATED_FIELDS = Set.of("version", "contractCreatedTs");
  private static final Map<Section, String> IDENTITIES =
      Map.of(
          Section.SCHEMA_OBJECT,
          NAME,
          Section.PROPERTY,
          NAME,
          Section.ROLE,
          "role",
          Section.TEAM_MEMBER,
          "username",
          Section.SLA_PROPERTY,
          "property");

  private record Location(Section section, String pointer) {
    Location child(String key, Section next) {
      return new Location(next, pointer + "/" + key.replace("~", "~0").replace("/", "~1"));
    }
  }

  private ODCSPreservedFields() {}

  public static JsonNode capture(JsonNode document, JsonNode applied, String selectedObject) {
    ObjectNode source = document.deepCopy();
    ODCSShapeNormalizer.normalizePreserved(source);
    ODCSShapeNormalizer.projectRootQuality(source, applied, selectedObject);
    ArrayNode unapplied = JsonNodeFactory.instance.arrayNode();
    ObjectNode preserved =
        captureObject(source, applied, new Location(Section.ROOT, ""), unapplied);
    if (source.path(SCHEMA).isArray()) {
      preserved.set(
          SCHEMA,
          captureSchema(source.path(SCHEMA), applied.path(SCHEMA), selectedObject, unapplied));
    }
    ObjectNode payload = envelope(preserved, unapplied);
    if (source.has("apiVersion")) {
      String version = source.path("apiVersion").asText();
      payload.set("sourceVersion", source.get("apiVersion").deepCopy());
      if (ODCSProfiles.supportedVersions().contains(version))
        payload.put("sourceSchema", ODCSProfiles.adapter(version).schemaLocation());
    }
    return payload;
  }

  private static ObjectNode envelope(JsonNode document, JsonNode unapplied) {
    ObjectNode payload = JsonNodeFactory.instance.objectNode();
    // The database's general JSON mapper rounds decimal nodes; JSON text preserves their exact
    // values.
    payload.put(DOCUMENT, document.toString());
    payload.set(UNAPPLIED, unapplied);
    return payload;
  }

  private static ArrayNode captureSchema(
      JsonNode source, JsonNode applied, String selected, ArrayNode unapplied) {
    if (selected == null && !hasSchemaObjects(source) && applied.isArray() && applied.size() == 1) {
      return captureLegacyColumns(source, applied.get(0), unapplied);
    }
    ArrayNode result = JsonNodeFactory.instance.arrayNode();
    for (JsonNode item : source) {
      boolean object = item.has(PROPERTIES) || OBJECT.equals(item.path(LOGICAL_TYPE).asText());
      if (!object || selected == null || selected.equalsIgnoreCase(item.path(NAME).asText())) {
        Section section = object ? Section.SCHEMA_OBJECT : Section.PROPERTY;
        Location location = new Location(section, "/schema/" + result.size());
        result.add(captureItem(item, applied, location, unapplied));
      }
    }
    return result;
  }

  private static boolean hasSchemaObjects(JsonNode elements) {
    for (JsonNode item : elements) {
      if (item.has(PROPERTIES) || OBJECT.equals(item.path(LOGICAL_TYPE).asText())) {
        return true;
      }
    }
    return false;
  }

  private static ArrayNode captureLegacyColumns(
      JsonNode columns, JsonNode table, ArrayNode unapplied) {
    ObjectNode preserved = JsonNodeFactory.instance.objectNode();
    preserved.set(NAME, table.path(NAME).deepCopy());
    preserved.set(
        PROPERTIES,
        captureNested(
            columns,
            table.path(PROPERTIES),
            new Location(Section.PROPERTY, "/schema/0/properties"),
            unapplied));
    return JsonNodeFactory.instance.arrayNode().add(preserved);
  }

  private static ObjectNode captureObject(
      JsonNode source, JsonNode applied, Location location, ArrayNode unapplied) {
    ObjectNode preserved = JsonNodeFactory.instance.objectNode();
    source
        .fields()
        .forEachRemaining(field -> captureField(preserved, applied, field, location, unapplied));
    return preserved;
  }

  private static void captureField(
      ObjectNode result,
      JsonNode applied,
      Map.Entry<String, JsonNode> field,
      Location location,
      ArrayNode unapplied) {
    String key = field.getKey();
    if (location.section() == Section.ROOT
        && (SCHEMA.equals(key) || GENERATED_FIELDS.contains(key))) {
      return;
    }
    Section nested = ODCSFieldCoverage.nestedSection(location.section(), key);
    if (nested != null) {
      result.set(
          key,
          captureNested(
              field.getValue(), applied.path(key), location.child(key, nested), unapplied));
    } else if ("quality".equals(key) && ODCSFieldCoverage.isMapped(location.section(), key)) {
      if (field.getValue().isArray() && field.getValue().isEmpty()) return;
      if (!ODCSQualityMetadata.isProjection(field.getValue(), applied.path(key)))
        result.set(key, ODCSQualityMetadata.capture(field.getValue(), applied.path(key)));
    } else if (retained(key, applied, location.section())) {
      result.set(key, field.getValue().deepCopy());
    }
  }

  private static boolean retained(String key, JsonNode applied, Section section) {
    // An absent baseline value was not applied; retain it even when this field can normally be
    // mapped.
    return !ODCSFieldCoverage.isMapped(section, key)
        || key.equals(IDENTITIES.get(section))
        || !applied.hasNonNull(key);
  }

  private static JsonNode captureNested(
      JsonNode source, JsonNode applied, Location location, ArrayNode unapplied) {
    if (!source.isArray()) {
      return source.isObject()
          ? captureObject(source, applied, location, unapplied)
          : source.deepCopy();
    }
    ArrayNode result = JsonNodeFactory.instance.arrayNode();
    Section section = location.section() == Section.TEAM ? Section.TEAM_MEMBER : location.section();
    for (JsonNode item : source) {
      result.add(
          captureItem(
              item, applied, location.child(Integer.toString(result.size()), section), unapplied));
    }
    return result;
  }

  private static JsonNode captureItem(
      JsonNode item, JsonNode applied, Location location, ArrayNode unapplied) {
    int index = find(applied, item, location.section());
    if (index < 0) {
      unapplied.add(location.pointer());
    }
    JsonNode baseline = index < 0 ? JsonNodeFactory.instance.objectNode() : applied.get(index);
    return captureObject(item, baseline, location, unapplied);
  }

  public static JsonNode restore(JsonNode payload, JsonNode current) {
    if (payload == null || !payload.isObject()) {
      return current.deepCopy();
    }
    JsonNode preserved = preservedDocument(payload);
    Set<String> unapplied = new HashSet<>();
    payload.path(UNAPPLIED).forEach(pointer -> unapplied.add(pointer.asText()));
    return mergeObject(preserved, current, new Location(Section.ROOT, ""), unapplied);
  }

  private static ObjectNode mergeObject(
      JsonNode saved, JsonNode current, Location location, Set<String> unapplied) {
    ObjectNode result =
        current.isObject()
            ? (ObjectNode) current.deepCopy()
            : JsonNodeFactory.instance.objectNode();
    saved.fields().forEachRemaining(field -> restoreField(result, field, location, unapplied));
    return result;
  }

  private static void restoreField(
      ObjectNode result,
      Map.Entry<String, JsonNode> field,
      Location location,
      Set<String> unapplied) {
    String key = field.getKey();
    if (location.section() == Section.ROOT && GENERATED_FIELDS.contains(key)) {
      return;
    }
    Section nested =
        SCHEMA.equals(key) && location.section() == Section.ROOT
            ? Section.SCHEMA_OBJECT
            : ODCSFieldCoverage.nestedSection(location.section(), key);
    restoreValue(result, field, location.child(key, nested), location.section(), unapplied);
  }

  private static void restoreValue(
      ObjectNode result,
      Map.Entry<String, JsonNode> field,
      Location location,
      Section parent,
      Set<String> unapplied) {
    JsonNode saved = field.getValue();
    JsonNode current = result.path(field.getKey());
    if ("quality".equals(field.getKey()) && ODCSQualityMetadata.isCapture(saved)) {
      JsonNode merged = ODCSQualityMetadata.restore(saved, current);
      if (!merged.isEmpty() || current.isArray()) result.set(field.getKey(), merged);
    } else if (location.section() != null && (saved.isArray() || saved.isObject())) {
      // Incompatible saved containers cannot replace a native collection that now exists.
      if ((saved.isArray() && current.isObject()) || (saved.isObject() && current.isArray())) {
        return;
      }
      JsonNode merged =
          saved.isArray()
              ? mergeArray(saved, current, location, unapplied)
              : mergeObject(saved, current, location, unapplied);
      if (!merged.isEmpty() || current.isArray()) {
        result.set(field.getKey(), merged);
      }
    } else if ((!ODCSFieldCoverage.isMapped(parent, field.getKey())
            && location.section() == null
            && !field.getKey().equals(IDENTITIES.get(parent)))
        || !result.hasNonNull(field.getKey())) {
      result.set(field.getKey(), saved.deepCopy());
    }
  }

  private static ArrayNode mergeArray(
      JsonNode saved, JsonNode current, Location location, Set<String> unapplied) {
    ArrayNode result = JsonNodeFactory.instance.arrayNode();
    Section section = location.section() == Section.TEAM ? Section.TEAM_MEMBER : location.section();
    for (JsonNode item : current) {
      int index = find(saved, item, section);
      result.add(
          index < 0
              ? item.deepCopy()
              : mergeObject(
                  saved.get(index),
                  item,
                  location.child(Integer.toString(index), section),
                  unapplied));
    }
    appendUnapplied(result, saved, current, new Location(section, location.pointer()), unapplied);
    return result;
  }

  private static void appendUnapplied(
      ArrayNode result,
      JsonNode saved,
      JsonNode current,
      Location location,
      Set<String> unapplied) {
    for (int index = 0; index < saved.size(); index++) {
      if (unapplied.contains(location.pointer() + "/" + index)
          && find(current, saved.get(index), location.section()) < 0) {
        result.add(saved.get(index).deepCopy());
      }
    }
  }

  private static int find(JsonNode candidates, JsonNode item, Section section) {
    String identity = IDENTITIES.get(section);
    for (int index = 0; candidates.isArray() && index < candidates.size(); index++) {
      if (identity != null
          && item.hasNonNull(identity)
          && item.path(identity).equals(candidates.get(index).path(identity))) {
        return index;
      }
    }
    // A selected table's exported name follows the target entity, including after a rename.
    return section == Section.SCHEMA_OBJECT && candidates.isArray() && candidates.size() == 1
        ? 0
        : -1;
  }

  public static JsonNode merge(JsonNode existing, JsonNode imported) {
    if (existing == null
        || imported == null
        || !existing.has(DOCUMENT)
        || !imported.has(DOCUMENT)) {
      return mergeJson(existing, imported);
    }
    JsonNode incomingDocument = preservedDocument(imported);
    ArrayNode unapplied = JsonNodeFactory.instance.arrayNode();
    for (JsonNode pointer : existing.path(UNAPPLIED)) {
      if (pointer.isTextual()
          && pointer.asText().startsWith("/")
          && pointer.asText().lastIndexOf('/') > 0) {
        String collection = pointer.asText().substring(0, pointer.asText().lastIndexOf('/'));
        if (!incomingDocument.at(collection).isArray()) {
          unapplied.add(pointer.deepCopy());
        }
      }
    }
    imported.path(UNAPPLIED).forEach(pointer -> unapplied.add(pointer.deepCopy()));
    ObjectNode merged = (ObjectNode) mergeJson(existing, imported);
    merged.put(DOCUMENT, mergeJson(preservedDocument(existing), incomingDocument).toString());
    merged.set(UNAPPLIED, unapplied);
    ArrayNode bindings = JSON.createArrayNode();
    for (JsonNode binding : existing.path(NATIVE_BINDINGS)) {
      if (incomingDocument.at(binding.path("sourceCollection").asText()).isMissingNode())
        bindings.add(binding.deepCopy());
    }
    for (JsonNode binding : imported.path(NATIVE_BINDINGS)) {
      if (!contains(bindings, binding)) bindings.add(binding.deepCopy());
    }
    if (bindings.isEmpty()) merged.remove(NATIVE_BINDINGS);
    else merged.set(NATIVE_BINDINGS, bindings);
    return merged;
  }

  /** Records ownership only after a source value exists in the current native extension. */
  public static JsonNode bindNativeCustomProperties(JsonNode payload, Object extension) {
    if (payload == null || !payload.isObject()) return payload;
    JsonNode values = JSON.valueToTree(extension);
    if (values == null || !values.isObject()) return payload;
    ObjectNode result = payload.deepCopy();
    ArrayNode bindings = JSON.createArrayNode();
    for (JsonNode binding : result.path(NATIVE_BINDINGS)) bindings.add(binding.deepCopy());
    for (JsonNode property : preservedDocument(payload).path("customProperties")) {
      String name = property.path("property").asText();
      if (values.has(name)) {
        ObjectNode binding = JSON.createObjectNode();
        binding.put("nativePath", "/extension/" + name.replace("~", "~0").replace("/", "~1"));
        binding.put("sourceCollection", "/customProperties");
        binding.put("keyField", "property");
        binding.put("keyValue", name);
        binding.put("valueField", "value");
        if (!contains(bindings, binding)) bindings.add(binding);
      }
    }
    if (!bindings.isEmpty()) result.set(NATIVE_BINDINGS, bindings);
    return result;
  }

  public static Set<String> nativeCustomPropertyNames(JsonNode payload) {
    Set<String> result = new HashSet<>();
    if (payload != null) {
      for (JsonNode binding : payload.path(NATIVE_BINDINGS)) {
        if ("/customProperties".equals(binding.path("sourceCollection").asText())
            && "property".equals(binding.path("keyField").asText())
            && "value".equals(binding.path("valueField").asText())
            && binding.path("nativePath").asText().startsWith("/extension/")) {
          result.add(binding.path("keyValue").asText());
        }
      }
    }
    return Set.copyOf(result);
  }

  private static boolean contains(ArrayNode values, JsonNode candidate) {
    for (JsonNode value : values) if (value.equals(candidate)) return true;
    return false;
  }

  static String sourceSchemaName(JsonNode payload) {
    JsonNode tables =
        payload == null ? JSON.missingNode() : preservedDocument(payload).path(SCHEMA);
    return tables.isArray() && tables.size() == 1 ? tables.get(0).path(NAME).asText(null) : null;
  }

  static JsonNode preservedDocument(JsonNode payload) {
    JsonNode document = payload.has(DOCUMENT) ? payload.path(DOCUMENT) : payload;
    if (!document.isTextual()) {
      return document;
    }
    try {
      return JSON.readTree(document.textValue());
    } catch (JsonProcessingException e) {
      throw new IllegalArgumentException("Invalid preserved ODCS JSON", e);
    }
  }

  private static JsonNode mergeJson(JsonNode existing, JsonNode imported) {
    if (existing == null || !existing.isObject()) {
      return imported == null ? null : imported.deepCopy();
    }
    ObjectNode merged = existing.deepCopy();
    if (imported != null && imported.isObject()) {
      imported
          .fields()
          .forEachRemaining(
              field ->
                  merged.set(
                      field.getKey(),
                      field.getValue().isObject()
                          ? mergeJson(merged.get(field.getKey()), field.getValue())
                          : field.getValue().deepCopy()));
    }
    return merged;
  }
}
