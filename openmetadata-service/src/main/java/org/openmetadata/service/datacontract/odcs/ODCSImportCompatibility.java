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
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSImportIssueCategory;
import org.openmetadata.service.util.FullyQualifiedName;

/** Only documented legacy OpenMetadata encodings are repaired before profile validation. */
final class ODCSImportCompatibility {
  private ODCSImportCompatibility() {}

  private static final Set<String> LEGACY_METRICS =
      Set.of(
          "freshness",
          "completeness",
          "textLength",
          "valuesBetween",
          "validValues",
          "regex",
          "pattern",
          "notNull",
          "nullCount",
          "duplicateCount",
          "missingCount",
          "invalidCount");

  record Normalized(JsonNode wire, JsonNode canonical) {}

  static Normalized normalize(
      JsonNode source, ODCSVersionAdapter adapter, ODCSImportIssues issues) {
    if (ODCSProfiles.validate(adapter.version(), source).isEmpty())
      return new Normalized(source.deepCopy(), source.deepCopy());
    ObjectNode compatible = source.deepCopy();
    ODCSShapeNormalizer.normalizePreserved(compatible);
    if (compatible.path("contractCreatedTs").isIntegralNumber())
      compatible.put(
          "contractCreatedTs",
          Instant.ofEpochMilli(compatible.path("contractCreatedTs").longValue()).toString());
    if (!adapter.version().startsWith("v2.")) {
      normalizeLegacyElements(compatible, false);
      wrapFlatSchema(compatible);
    }
    if (adapter.version().startsWith("v3.0.") && compatible.path("team").has("members"))
      compatible.set("team", compatible.path("team").path("members"));
    JsonNode canonical = compatible.deepCopy();
    if (!adapter.version().startsWith("v2.")) projectRootQuality(compatible);
    if (!source.equals(compatible))
      issues.info(
          ODCSImportIssueCategory.DOCUMENT,
          null,
          "",
          "Normalized legacy OpenMetadata field shapes before validating the declared ODCS profile.");
    return new Normalized(compatible, canonical);
  }

  private static final Set<String> QUALITY_FIELDS =
      ODCSExportModelWriter.fields(
          ODCSExportModelWriter.requiredSchema(
                  "/json/schema/entity/datacontract/odcs/odcsDataContract.json")
              .at("/definitions/odcsQualityRule"));
  private static final Set<String> QUALITY_METADATA =
      ODCSExportModelWriter.fields(
          ODCSExportModelWriter.schema(ODCSExportService.DEFAULT_VERSION).at("/$defs/DataQuality"));

  static ObjectNode qualityRule(ObjectNode source) {
    String metric = source.path("metric").asText(source.path("rule").asText());
    if (!LEGACY_METRICS.contains(metric) || !validLegacyQuality(source)) return source.deepCopy();
    ObjectNode wrapper = source.objectNode();
    source
        .fields()
        .forEachRemaining(
            field -> {
              if (QUALITY_METADATA.contains(field.getKey()) || "column".equals(field.getKey()))
                wrapper.set(field.getKey(), field.getValue().deepCopy());
            });
    wrapper.put("type", "custom").put("engine", "odcs");
    wrapper.put(
        "implementation", source.objectNode().set("odcsRule", source.deepCopy()).toString());
    return wrapper;
  }

  private static boolean validLegacyQuality(ObjectNode source) {
    if (source.has("type") && !"library".equals(source.path("type").asText())) return false;
    for (var fields = source.fieldNames(); fields.hasNext(); )
      if (!QUALITY_FIELDS.contains(fields.next())) return false;
    for (String field :
        List.of(
            "mustBeGreaterThan", "mustBeGreaterOrEqualTo", "mustBeLessThan", "mustBeLessOrEqualTo"))
      if (source.has(field) && !source.path(field).isNumber()) return false;
    if (source.has("validValues") && !source.path("validValues").isArray()) return false;
    return !source.has("pattern") || source.path("pattern").isTextual();
  }

  private static final Map<String, String> LEGACY_TYPES =
      Map.of(
          "long", "integer", "float", "number", "double", "number", "decimal", "number", "text",
          "string", "bytes", "string", "null", "string");

  private static void normalizeLegacyElements(ObjectNode element, boolean table) {
    if (table) removeLegacyTableDefaults(element);
    String logicalType = element.path("logicalType").asText();
    if (!List.of("timestamp", "date", "time").contains(logicalType)
        && element.path("logicalTypeOptions") instanceof ObjectNode options
        && List.of("UTC", "Etc/UTC").contains(options.path("defaultTimezone").asText()))
      options.remove("defaultTimezone");
    if (LEGACY_TYPES.containsKey(logicalType)) {
      element.put("logicalType", LEGACY_TYPES.get(logicalType));
      if (!element.has("physicalType"))
        element.put(
            "physicalType",
            switch (logicalType) {
              case "long" -> "BIGINT";
              case "bytes" -> "BINARY";
              default -> logicalType.toUpperCase(Locale.ROOT);
            });
    }
    if (element.path("quality") instanceof ArrayNode quality) {
      for (int index = 0; index < quality.size(); index++)
        if (quality.get(index) instanceof ObjectNode rule) quality.set(index, qualityRule(rule));
    }
    for (String collection : List.of("schema", "properties"))
      for (JsonNode child : element.path(collection))
        if (child instanceof ObjectNode object)
          normalizeLegacyElements(object, "schema".equals(collection));
    if (element.path("items") instanceof ObjectNode items) normalizeLegacyElements(items, false);
  }

  private static void removeLegacyTableDefaults(ObjectNode element) {
    if (!element.has("properties") && !"object".equals(element.path("logicalType").asText()))
      return;
    for (String field : List.of("primaryKey", "required", "unique", "partitioned"))
      if (element.path(field).isBoolean() && !element.path(field).asBoolean())
        element.remove(field);
    for (String field : List.of("primaryKeyPosition", "partitionKeyPosition"))
      if (element.path(field).isIntegralNumber() && element.path(field).asInt() == 0)
        element.remove(field);
  }

  private static void wrapFlatSchema(ObjectNode root) {
    JsonNode schema = root.path("schema");
    if (!schema.isArray() || schema.isEmpty()) return;
    for (JsonNode element : schema)
      if (element.has("properties") || "object".equals(element.path("logicalType").asText()))
        return;
    ObjectNode table =
        root.objectNode()
            .put("name", root.path("name").asText("contract"))
            .put("logicalType", "object");
    table.set("properties", schema);
    root.set("schema", root.arrayNode().add(table));
  }

  private static void projectRootQuality(ObjectNode root) {
    if (!(root.path("quality") instanceof ArrayNode rules)) return;
    boolean schemaAbsent = !root.has("schema");
    if (schemaAbsent)
      root.withArray("schema")
          .addObject()
          .put("name", root.path("name").asText("contract"))
          .put("logicalType", "object");
    for (JsonNode rule : rules) {
      if (schemaAbsent && rule.has("column")) {
        if (!(rule instanceof ObjectNode object))
          throw new IllegalArgumentException("Legacy quality rules must be objects.");
        ObjectNode wrapper = object.objectNode().put("type", "custom").put("engine", "odcs");
        if (object.has("name")) wrapper.set("name", object.path("name"));
        wrapper.put(
            "implementation", object.objectNode().set("odcsRule", object.deepCopy()).toString());
        ((ObjectNode) root.at("/schema/0")).withArray("quality").add(wrapper);
      } else projectRule(root, rule);
    }
    root.remove("quality");
  }

  private static void projectRule(ObjectNode root, JsonNode rule) {
    if (!(rule instanceof ObjectNode) || rule.has("column") && !rule.path("column").isTextual())
      throw new IllegalArgumentException(
          "Legacy root quality rules must be objects with textual column references.");
    boolean projected = false;
    String column = rule.path("column").asText("");
    for (JsonNode table : root.path("schema")) {
      ObjectNode target = qualityTarget(table, column);
      if (target != null) {
        ObjectNode declaration = rule.deepCopy();
        declaration.remove("column");
        target.withArray("quality").add(declaration);
        projected = true;
      }
    }
    if (!projected)
      throw new IllegalArgumentException(
          "Legacy root quality rule `"
              + rule.path("name").asText()
              + "` references an unknown schema element `"
              + column
              + "`.");
  }

  private static ObjectNode qualityTarget(JsonNode table, String column) {
    if (!(table instanceof ObjectNode target)) return null;
    if (column.isEmpty() || column.equals(table.path("name").asText())) return target;
    for (String segment : FullyQualifiedName.split(column)) {
      JsonNode properties = target.path("properties");
      if (!properties.isArray()) properties = target.path("items").path("properties");
      ObjectNode child = null;
      for (JsonNode property : properties)
        if (property instanceof ObjectNode object
            && FullyQualifiedName.unquoteName(segment).equals(property.path("name").asText()))
          child = object;
      if (child == null) return null;
      target = child;
    }
    return target;
  }
}
