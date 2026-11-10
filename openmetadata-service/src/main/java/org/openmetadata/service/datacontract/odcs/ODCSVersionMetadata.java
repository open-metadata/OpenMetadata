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

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.networknt.schema.path.NodePath;
import com.networknt.schema.path.PathType;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.function.BiConsumer;
import java.util.stream.Collectors;
import org.openmetadata.service.datacontract.odcs.ODCSFieldCoverage.Section;

/** Carries source-only fields through profiles that cannot represent their original wire shape. */
final class ODCSVersionMetadata {
  static final String PROPERTY_NAME = "https://open-metadata.org/odcs/source-metadata";
  private static final String CUSTOM_PROPERTIES = "customProperties";
  private static final String PROPERTY = "property";
  private static final String VALUE = "value";
  private static final String FIELDS = "fields";
  private static final String PROJECTION = "projection";
  private static final String DESCRIPTION = "description";
  private static final String SCHEMA = "schema";
  private static final String PROPERTIES = "properties";
  private static final String ITEMS = "items";
  private static final String DOCUMENT = "document";
  private static final String FORMAT_VERSION = "formatVersion";
  private static final Map<String, JsonNode> SCHEMAS =
      ODCSProfiles.supportedVersions().stream()
          .collect(Collectors.toUnmodifiableMap(version -> version, ODCSExportModelWriter::schema));

  private enum Scope {
    ROOT("", ""),
    TABLE("SchemaObject", "Dataset"),
    COLUMN("SchemaProperty", "Column"),
    ITEM("SchemaItemProperty", "");
    private final String modern;
    private final String legacy;

    Scope(String modern, String legacy) {
      this.modern = modern;
      this.legacy = legacy;
    }

    NodePath path(String version) {
      NodePath path = new NodePath(PathType.JSON_POINTER);
      String definition = version.startsWith("v2.") ? legacy : modern;
      return definition.isEmpty() ? path : path.append("$defs").append(definition);
    }

    boolean openItem(String version) {
      return this == ITEM && version.startsWith("v2.");
    }
  }

  private static final Map<String, Map<Scope, Map<String, NodePath>>> PROPERTY_PATHS =
      SCHEMAS.keySet().stream()
          .collect(
              Collectors.toUnmodifiableMap(
                  version -> version,
                  version ->
                      Arrays.stream(Scope.values())
                          .collect(
                              Collectors.toUnmodifiableMap(
                                  scope -> scope, scope -> collectPropertyPaths(version, scope)))));

  private ODCSVersionMetadata() {}

  static JsonNode canonicalPayload(JsonNode payload) {
    if (payload == null || !payload.isObject()) return payload;
    JsonNode canonical = ODCSPreservedFields.preservedDocument(payload).deepCopy();
    if (canonical instanceof ObjectNode document) canonicalize(document, Scope.ROOT);
    if (!payload.has(DOCUMENT)) return canonical;
    ObjectNode result = payload.deepCopy();
    result.put(DOCUMENT, canonical.toString());
    return result;
  }

  static JsonNode materialize(JsonNode document, String version) {
    ObjectNode result = document.deepCopy();
    restore(result, Scope.ROOT, version);
    return result;
  }

  private static void canonicalize(ObjectNode node, Scope scope) {
    if (node.has(CUSTOM_PROPERTIES) && !node.path(CUSTOM_PROPERTIES).isArray()) {
      visitChildren(node, scope, (child, next) -> canonicalize(child, next));
      return;
    }
    Set<String> known = propertyPaths(ODCSExportService.DEFAULT_VERSION, scope).keySet();
    List<String> names = new ArrayList<>();
    node.fieldNames().forEachRemaining(names::add);
    for (String name : names) {
      if (!known.contains(name)) remember(node, name, node.remove(name), null);
    }
    if (scope == Scope.TABLE && textArray(node.path(DESCRIPTION))) {
      JsonNode original = node.get(DESCRIPTION);
      JsonNode projection = textProjection(original);
      remember(node, DESCRIPTION, original, projection);
      node.set(DESCRIPTION, projection);
    }
    visitChildren(node, scope, (child, next) -> canonicalize(child, next));
  }

  private static void remember(ObjectNode node, String name, JsonNode value, JsonNode projection) {
    ObjectNode carrier = carrier(node);
    ObjectNode entry = node.objectNode().set(VALUE, value.deepCopy());
    if (projection != null) entry.set(PROJECTION, projection.deepCopy());
    ((ObjectNode) carrier.path(VALUE).path(FIELDS)).set(name, entry);
  }

  private static ObjectNode carrier(ObjectNode node) {
    for (JsonNode property : node.path(CUSTOM_PROPERTIES))
      if (isCarrier(property)) return (ObjectNode) property;
    ObjectNode property =
        node.withArray(CUSTOM_PROPERTIES).addObject().put(PROPERTY, PROPERTY_NAME);
    property.putObject(VALUE).put(FORMAT_VERSION, 1).putObject(FIELDS);
    return property;
  }

  private static boolean isCarrier(JsonNode property) {
    return PROPERTY_NAME.equals(property.path(PROPERTY).asText())
        && property.path(VALUE).path(FORMAT_VERSION).isInt()
        && property.path(VALUE).path(FORMAT_VERSION).asInt() == 1
        && property.path(VALUE).path(FIELDS).isObject();
  }

  private static void restore(ObjectNode node, Scope scope, String version) {
    visitChildren(node, scope, (child, next) -> restore(child, next, version));
    if (!(node.path(CUSTOM_PROPERTIES) instanceof ArrayNode properties)) return;
    ArrayNode retained = node.arrayNode();
    for (JsonNode property : properties) {
      JsonNode restored =
          isCarrier(property) ? restoreCarrier(node, scope, version, property) : property;
      if (restored != null) retained.add(restored.deepCopy());
    }
    if (retained.isEmpty()) node.remove(CUSTOM_PROPERTIES);
    else node.set(CUSTOM_PROPERTIES, retained);
  }

  private static JsonNode restoreCarrier(
      ObjectNode node, Scope scope, String version, JsonNode carrier) {
    ObjectNode remaining = node.objectNode();
    carrier
        .path(VALUE)
        .path(FIELDS)
        .fields()
        .forEachRemaining(
            field -> {
              String name = field.getKey();
              JsonNode entry = field.getValue();
              if (!validEntry(name, entry, scope)) remaining.set(name, entry.deepCopy());
              else if (projectionUnchanged(node, name, entry)) {
                if (accepts(version, scope, name, entry.path(VALUE)))
                  node.set(name, entry.path(VALUE).deepCopy());
                else remaining.set(name, entry.deepCopy());
              }
            });
    if (remaining.isEmpty()) return null;
    ObjectNode result = carrier.deepCopy();
    ((ObjectNode) result.path(VALUE)).set(FIELDS, remaining);
    return result;
  }

  private static boolean validEntry(String name, JsonNode entry, Scope scope) {
    if (!entry.isObject()
        || !entry.has(VALUE)
        || nativeAlias(scope, name)
        || ODCSFieldCoverage.isMapped(section(scope), name)) return false;
    boolean known = propertyPaths(ODCSExportService.DEFAULT_VERSION, scope).containsKey(name);
    return !known
        || scope == Scope.TABLE
            && DESCRIPTION.equals(name)
            && textArray(entry.path(VALUE))
            && entry.path(PROJECTION).isTextual();
  }

  private static Section section(Scope scope) {
    return switch (scope) {
      case ROOT -> Section.ROOT;
      case TABLE -> Section.SCHEMA_OBJECT;
      case COLUMN -> Section.PROPERTY;
      case ITEM -> Section.ARRAY_ITEM;
    };
  }

  private static boolean nativeAlias(Scope scope, String name) {
    return switch (scope) {
      case ROOT -> Set.of(
              "uuid", "quantumName", "datasetDomain", "slaDefaultColumn", "stakeholders", "dataset")
          .contains(name);
      case TABLE -> Set.of("table", "columns").contains(name);
      case COLUMN -> Set.of("column", "isPrimaryKey", "isUnique", "isNullable").contains(name);
      case ITEM -> false;
    };
  }

  private static boolean projectionUnchanged(ObjectNode node, String name, JsonNode entry) {
    return !entry.has(PROJECTION) || entry.path(PROJECTION).equals(textProjection(node.path(name)));
  }

  private static JsonNode textProjection(JsonNode value) {
    if (!textArray(value)) return value;
    List<String> parts = new ArrayList<>();
    value.forEach(part -> parts.add(part.asText()));
    return ODCSExportModelWriter.JSON.getNodeFactory().textNode(String.join("\n", parts));
  }

  private static boolean textArray(JsonNode value) {
    if (!value.isArray()) return false;
    for (JsonNode item : value) if (!item.isTextual()) return false;
    return true;
  }

  private static boolean accepts(String version, Scope scope, String name, JsonNode value) {
    if (scope.openItem(version)) return true;
    NodePath path = propertyPaths(version, scope).get(name);
    if (path != null) return ODCSProfiles.validFragment(version, path, value);
    JsonNode definition = definition(version, scope);
    return !definition.path("additionalProperties").isObject()
        && definition.path("additionalProperties").asBoolean(true)
        && definition.path("unevaluatedProperties").asBoolean(true);
  }

  private static JsonNode definition(String version, Scope scope) {
    JsonNode schema = SCHEMAS.get(version);
    String path = scope.path(version).toString();
    return path.isEmpty() ? schema : schema.at(path);
  }

  private static Map<String, NodePath> propertyPaths(String version, Scope scope) {
    return PROPERTY_PATHS.get(version).get(scope);
  }

  private static Map<String, NodePath> collectPropertyPaths(String version, Scope scope) {
    Map<String, NodePath> fields = new HashMap<>();
    if (!scope.openItem(version))
      collectProperties(SCHEMAS.get(version), scope.path(version), fields, new HashSet<>());
    return Map.copyOf(fields);
  }

  private static void collectProperties(
      JsonNode schema, NodePath path, Map<String, NodePath> fields, Set<String> visited) {
    JsonNode node = path.toString().isEmpty() ? schema : schema.at(path.toString());
    node.path(PROPERTIES)
        .fieldNames()
        .forEachRemaining(name -> fields.putIfAbsent(name, path.append(PROPERTIES).append(name)));
    String reference = node.path("$ref").asText();
    if (reference.startsWith("#/") && visited.add(reference))
      collectProperties(schema, pointerPath(reference.substring(1)), fields, visited);
    for (int index = 0; index < node.path("allOf").size(); index++)
      collectProperties(schema, path.append("allOf").append(index), fields, visited);
    for (String conditional : List.of("then", "else"))
      if (node.has(conditional))
        collectProperties(schema, path.append(conditional), fields, visited);
  }

  private static NodePath pointerPath(String pointer) {
    NodePath result = new NodePath(PathType.JSON_POINTER);
    for (String segment : pointer.substring(1).split("/"))
      result = result.append(segment.replace("~1", "/").replace("~0", "~"));
    return result;
  }

  private static void visitChildren(
      ObjectNode node, Scope scope, BiConsumer<ObjectNode, Scope> visitor) {
    for (String key :
        scope == Scope.ROOT ? List.of(SCHEMA, "dataset") : List.of(PROPERTIES, "columns"))
      for (JsonNode child : node.path(key))
        if (child instanceof ObjectNode object)
          visitor.accept(object, scope == Scope.ROOT ? Scope.TABLE : Scope.COLUMN);
    if (node.path(ITEMS) instanceof ObjectNode items) visitor.accept(items, Scope.ITEM);
  }
}
