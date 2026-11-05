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
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.util.FullyQualifiedName;

/** Separates native export representation from the broader, legacy-compatible ODCS reader model. */
public final class ODCSExportDocument {
  private static final ObjectMapper JSON = new ObjectMapper();
  private static final String SCHEMA = "schema";
  private static final String PROPERTIES = "properties";
  private static final String QUALITY = "quality";
  private static final String COLUMN = "column";
  private static final String NAME = "name";
  private static final String LOGICAL_TYPE = "logicalType";
  private static final String LOGICAL_OPTIONS = "logicalTypeOptions";
  private static final String CUSTOM_PROPERTIES = "customProperties";
  private static final String PROPERTY = "property";
  private static final String VALUE = "value";
  private static final String ITEMS = "items";
  private static final String OBJECT = "object";
  private static final String ARRAY = "array";
  private static final String STRING = "string";
  private static final String DEFAULT_TIMEZONE = "defaultTimezone";
  private static final String MAX_LENGTH = "maxLength";
  private static final List<String> COLUMN_ONLY_FIELDS =
      List.of(
          "primaryKey",
          "primaryKeyPosition",
          "required",
          "unique",
          "partitionKeyPosition",
          "partitioned");
  private static final Map<String, String> STANDARD_TYPES =
      Map.of(
          "long", "integer", "float", "number", "double", "number", "decimal", "number", "text",
          STRING, "bytes", STRING, "null", STRING);

  private ODCSExportDocument() {}

  public static JsonNode nativeDocument(JsonNode nativeDocument, String tableName) {
    ObjectNode document = nativeDocument.deepCopy();
    scopeTableRules(document, tableName);
    for (JsonNode table : document.path(SCHEMA)) {
      ((ObjectNode) table).remove(COLUMN_ONLY_FIELDS);
      normalizeProperties(table.path(PROPERTIES));
      normalizeRules(table.path(QUALITY));
    }
    return document;
  }

  private static void scopeTableRules(ObjectNode document, String tableName) {
    JsonNode rules = document.remove(QUALITY);
    if (rules != null && !rules.isEmpty()) {
      ObjectNode table = tableObject(document, tableName);
      for (JsonNode rule : rules) {
        String column = rule.path(COLUMN).asText();
        ObjectNode target =
            column.isEmpty() || column.equals(tableName) ? table : propertyTarget(table, column);
        target.withArray(QUALITY).add(rule);
      }
    }
  }

  private static ObjectNode tableObject(ObjectNode document, String tableName) {
    ArrayNode schema = document.withArray(SCHEMA);
    if (schema.isEmpty()) {
      schema
          .addObject()
          .put(NAME, tableName)
          .put(LOGICAL_TYPE, OBJECT)
          .put("physicalType", "table");
    }
    return (ObjectNode) schema.get(0);
  }

  private static ObjectNode propertyTarget(ObjectNode table, String column) {
    ObjectNode target = table;
    String[] path = FullyQualifiedName.split(column);
    for (int index = 0; index < path.length; index++) {
      target = namedProperty(target.withArray(PROPERTIES), path[index]);
      if (index < path.length - 1 && !target.hasNonNull(LOGICAL_TYPE)) {
        target.put(LOGICAL_TYPE, OBJECT);
      }
    }
    return target;
  }

  private static ObjectNode namedProperty(ArrayNode properties, String name) {
    for (JsonNode property : properties) {
      if (name.equals(property.path(NAME).asText())) {
        return (ObjectNode) property;
      }
    }
    return properties.addObject().put(NAME, name);
  }

  private static void normalizeProperties(JsonNode properties) {
    for (JsonNode property : properties) {
      normalizeProperty((ObjectNode) property);
    }
  }

  private static void normalizeProperty(ObjectNode property) {
    if (property.hasNonNull(LOGICAL_TYPE)) {
      String type = property.path(LOGICAL_TYPE).asText();
      property.put(LOGICAL_TYPE, STANDARD_TYPES.getOrDefault(type, type));
    }
    normalizeOptions(property);
    normalizeProperties(property.path(PROPERTIES));
    normalizeRules(property.path(QUALITY));
    if (ARRAY.equals(property.path(LOGICAL_TYPE).asText()) && property.has(PROPERTIES)) {
      property
          .withObject(ITEMS)
          .put(LOGICAL_TYPE, OBJECT)
          .set(PROPERTIES, property.remove(PROPERTIES));
    }
    if (property.path(ITEMS).isObject()) {
      normalizeProperty((ObjectNode) property.get(ITEMS));
    }
  }

  private static void normalizeOptions(ObjectNode property) {
    if (property.path(LOGICAL_OPTIONS) instanceof ObjectNode options) {
      // No native Column field supplies a timezone; this is an incidental reader-model default.
      options.remove(DEFAULT_TIMEZONE);
      if (!STRING.equals(property.path(LOGICAL_TYPE).asText())) {
        options.remove(MAX_LENGTH);
      }
      if (options.isEmpty()) {
        property.remove(LOGICAL_OPTIONS);
      }
    }
  }

  private static void normalizeRules(JsonNode rules) {
    for (JsonNode rule : rules) {
      ((ObjectNode) rule).remove(COLUMN);
    }
  }

  public static JsonNode withNativeCustomProperties(JsonNode exported, Object extension) {
    return withNativeCustomProperties(exported, extension, Set.of());
  }

  public static JsonNode withNativeCustomProperties(
      JsonNode exported, Object extension, Set<String> nativePropertyNames) {
    ObjectNode document = exported.deepCopy();
    JsonNode supplied = JsonUtils.valueToTree(extension);
    JsonNode values = supplied != null && supplied.isObject() ? supplied : JSON.createObjectNode();
    if (!values.isEmpty()
        || (!nativePropertyNames.isEmpty() && document.path(CUSTOM_PROPERTIES).isArray())) {
      ArrayNode properties =
          mergeCustomProperties(document.path(CUSTOM_PROPERTIES), values, nativePropertyNames);
      if (properties.isEmpty()) {
        document.remove(CUSTOM_PROPERTIES);
      } else {
        document.set(CUSTOM_PROPERTIES, properties);
      }
    }
    return document;
  }

  private static ArrayNode mergeCustomProperties(
      JsonNode preserved, JsonNode nativeValues, Set<String> nativePropertyNames) {
    ArrayNode result = JSON.createArrayNode();
    Set<String> seen = new HashSet<>();
    if (preserved.isArray()) {
      for (JsonNode original : preserved) {
        if (!isRemovedNativeProperty(original, nativeValues, nativePropertyNames)) {
          result.add(mergeCustomProperty(original, nativeValues, seen));
        }
      }
    }
    nativeValues
        .fields()
        .forEachRemaining(
            field -> {
              if (!seen.contains(field.getKey())) {
                result
                    .addObject()
                    .put(PROPERTY, field.getKey())
                    .set(VALUE, field.getValue().deepCopy());
              }
            });
    return result;
  }

  private static boolean isRemovedNativeProperty(
      JsonNode original, JsonNode nativeValues, Set<String> nativePropertyNames) {
    String name = original.path(PROPERTY).asText();
    return nativePropertyNames.contains(name) && !nativeValues.has(name);
  }

  private static JsonNode mergeCustomProperty(
      JsonNode original, JsonNode nativeValues, Set<String> seen) {
    if (!(original instanceof ObjectNode)) {
      return original.deepCopy();
    }
    ObjectNode property = original.deepCopy();
    String name = property.path(PROPERTY).asText();
    if (nativeValues.has(name)) {
      property.set(VALUE, nativeValues.get(name).deepCopy());
    }
    seen.add(name);
    return property;
  }
}
