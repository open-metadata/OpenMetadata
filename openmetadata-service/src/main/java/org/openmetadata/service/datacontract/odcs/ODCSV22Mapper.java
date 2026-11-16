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
import java.util.Comparator;
import java.util.List;
import java.util.stream.StreamSupport;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSQualityRule;
import org.openmetadata.service.util.FullyQualifiedName;

/** Maps native contracts into the v2.2 dataset/column representation and restores metadata by identity. */
public final class ODCSV22Mapper implements ODCSVersionAdapter {
  private final String version;
  private final Class<?> model;
  private final JsonNode schema;

  private record LegacyColumn(JsonNode source, List<String> path) {}

  public ODCSV22Mapper(String version) {
    this.version = version;
    this.model = ODCSExportModelWriter.model(version);
    schema = ODCSExportModelWriter.schema(version);
  }

  @Override
  public String version() {
    return version;
  }

  @Override
  public String schemaLocation() {
    return "classpath:odcs/" + version + "/schema.json";
  }

  @Override
  public JsonNode write(DataContract contract, List<ODCSQualityRule> nativeRules) {
    ObjectNode canonical = (ObjectNode) new ODCSV31Mapper().write(contract, nativeRules);
    ODCSLegacyQuality quality = new ODCSLegacyQuality(schema, contract);
    for (JsonNode table : canonical.path("schema"))
      legacyQuality((ObjectNode) table, "", (ObjectNode) table, quality);
    return ODCSExportModelWriter.write(toLegacy(canonical), model);
  }

  private static void legacyQuality(
      ObjectNode element, String path, ObjectNode table, ODCSLegacyQuality converter) {
    if (element.path("quality").isArray()) {
      ArrayNode converted = ODCSExportModelWriter.JSON.createArrayNode();
      for (JsonNode rule : element.path("quality"))
        converted.add(rule.isObject() ? converter.v22(rule, path) : rule.deepCopy());
      element.remove("quality");
      if (!converted.isEmpty() && (!table.has("quality") || table.path("quality").isArray()))
        table.withArray("quality").addAll(converted);
    }
    for (JsonNode child : element.path("properties")) {
      if (child.isObject())
        legacyQuality(
            (ObjectNode) child,
            path.isEmpty()
                ? FullyQualifiedName.quoteName(child.path("name").asText())
                : FullyQualifiedName.add(path, child.path("name").asText()),
            table,
            converter);
    }
    if (element.path("items").isObject())
      legacyQuality((ObjectNode) element.path("items"), path, table, converter);
  }

  @Override
  public ODCSNormalizationResult normalizeLegacy(JsonNode source) {
    ObjectNode compatible = ODCSImportCompatibility.normalizeCommonFields(source);
    return new ODCSNormalizationResult(compatible, compatible.deepCopy());
  }

  @Override
  public JsonNode read(JsonNode document) {
    ObjectNode canonical = (ObjectNode) preservationView(document);
    if (!canonical.has("name")) canonical.put("name", document.path("quantumName").asText());
    ODCSImportQuality.normalizeStatus(canonical);
    ODCSImportQuality.normalize(canonical, false);
    return canonical;
  }

  @Override
  public JsonNode preservationView(JsonNode document) {
    ObjectNode view = document.deepCopy();
    rename(view, "uuid", "id");
    rename(view, "quantumName", "dataProduct");
    rename(view, "datasetDomain", "domain");
    rename(view, "slaDefaultColumn", "slaDefaultElement");
    if (view.path("stakeholders").isArray()) {
      ObjectNode team = ODCSExportModelWriter.JSON.createObjectNode();
      team.set("members", view.remove("stakeholders"));
      view.set("team", team);
    }
    for (JsonNode sla : view.path("slaProperties")) rename((ObjectNode) sla, "column", "element");
    ArrayNode tables = ODCSExportModelWriter.JSON.createArrayNode();
    for (JsonNode value : view.path("dataset")) {
      ObjectNode table = value.deepCopy();
      rename(table, "table", "name");
      table.put("logicalType", "object");

      rename(table, "dataGranularity", "dataGranularityDescription");
      ArrayNode columns = ODCSExportModelWriter.JSON.createArrayNode();
      for (LegacyColumn valueColumn : orderedColumns(table)) {
        ObjectNode column = valueColumn.source().deepCopy();
        rename(column, "column", "name");
        rename(column, "isPrimaryKey", "primaryKey");
        rename(column, "isUnique", "unique");
        rename(column, "partitionStatus", "partitioned");
        rename(column, "criticalDataElementStatus", "criticalDataElement");
        rename(column, "encryptedColumnName", "encryptedName");
        rename(column, "transformSourceTables", "transformSourceObjects");
        rename(column, "sampleValues", "examples");
        if (!column.has("isNullable")) column.put("isNullable", false);
        if (column.has("isNullable"))
          column.put("required", !column.remove("isNullable").asBoolean());
        insert(columns, column, valueColumn.path());
      }
      table.remove("columns");
      table.set("properties", columns);
      restoreQualityScopes(table);
      tables.add(table);
    }
    view.remove("dataset");
    view.set("schema", tables);
    return view;
  }

  private static List<LegacyColumn> orderedColumns(JsonNode table) {
    // An ARRAY declaration must exist before descendants choose between properties and items.
    return StreamSupport.stream(table.path("columns").spliterator(), false)
        .map(
            column ->
                new LegacyColumn(
                    column, List.of(FullyQualifiedName.split(column.path("column").asText()))))
        .sorted(Comparator.comparingInt(column -> column.path().size()))
        .toList();
  }

  private static void restoreQualityScopes(ObjectNode table) {
    JsonNode rules = table.remove("quality");
    if (rules == null) return;
    for (JsonNode rule : rules) {
      ObjectNode target = table;
      if (rule.hasNonNull("column")) {
        for (String segment : FullyQualifiedName.split(rule.path("column").asText())) {
          String name = FullyQualifiedName.unquoteName(segment);
          ObjectNode child = null;
          JsonNode properties = target.path("properties");
          if (!properties.isArray()) properties = target.path("items").path("properties");
          for (JsonNode property : properties)
            if (name.equals(property.path("name").asText())) child = (ObjectNode) property;
          if (child == null)
            throw new IllegalArgumentException(
                "Quality rule references an unknown ODCS column: " + name);
          target = child;
        }
      }
      target.withArray("quality").add(ODCSImportQuality.legacyDeclaration(rule));
    }
  }

  @Override
  public JsonNode materialize(JsonNode view, DataContract contract) {
    ObjectNode document = view.deepCopy();
    ODCSLegacyQuality quality = new ODCSLegacyQuality(schema, contract);
    for (JsonNode table : document.path("schema")) {
      if (table.isObject()) legacyQuality((ObjectNode) table, "", (ObjectNode) table, quality);
    }
    return toLegacy(document);
  }

  private ObjectNode toLegacy(JsonNode source) {
    ObjectNode document = source.deepCopy();
    document.put("apiVersion", version);
    rename(document, "id", "uuid");
    rename(document, "domain", "datasetDomain");
    rename(document, "dataProduct", "quantumName");
    rename(document, "slaDefaultElement", "slaDefaultColumn");
    if (!document.has("quantumName")) document.put("quantumName", document.path("name").asText(""));
    if (!document.has("datasetName")) {
      String[] parts = FullyQualifiedName.split(document.path("quantumName").asText());
      document.put(
          "datasetName",
          parts.length >= 2 ? FullyQualifiedName.unquoteName(parts[parts.length - 2]) : "");
    }
    document.remove("name");
    document.put("type", "Tables");
    String status = document.path("status").asText("draft");
    document.put(
        "status",
        switch (status) {
          case "active" -> "production";
          case "draft" -> "development";
          default -> status;
        });
    if (document.path("team").isObject()
        && document.path("team").size() == 1
        && document.path("team").path("members").isArray())
      document.set("stakeholders", document.remove("team").path("members"));
    for (JsonNode role : document.path("roles"))
      if (!role.has("access")) ((ObjectNode) role).put("access", "");
    for (JsonNode sla : document.path("slaProperties"))
      rename((ObjectNode) sla, "element", "column");
    ArrayNode datasets = ODCSExportModelWriter.JSON.createArrayNode();
    for (JsonNode entry : document.path("schema")) {
      ObjectNode table = entry.deepCopy();
      rename(table, "name", "table");
      legacyDescription(table);
      rename(table, "dataGranularityDescription", "dataGranularity");
      ArrayNode columns = ODCSExportModelWriter.JSON.createArrayNode();
      for (JsonNode column : table.path("properties")) flatten((ObjectNode) column, "", columns);
      table.remove("properties");
      table.set("columns", columns);
      datasets.add(table);
    }
    document.remove("schema");
    document.set("dataset", datasets);
    return document;
  }

  private void legacyDescription(ObjectNode table) {
    JsonNode descriptionSchema =
        schema.path("$defs").path("Dataset").path("properties").path("description");
    if ("array".equals(descriptionSchema.path("type").asText())
        && table.path("description").isTextual()) {
      table.set(
          "description",
          ODCSExportModelWriter.JSON.createArrayNode().add(table.get("description")));
    }
  }

  private static void flatten(ObjectNode value, String parent, ArrayNode output) {
    ObjectNode column = value.deepCopy();
    String path =
        parent.isEmpty()
            ? FullyQualifiedName.quoteName(column.path("name").asText())
            : FullyQualifiedName.add(parent, column.path("name").asText());
    JsonNode children = column.remove("properties");
    JsonNode items = column.remove("items");
    rename(column, "name", "column");
    column.put("column", path);
    rename(column, "primaryKey", "isPrimaryKey");
    rename(column, "unique", "isUnique");
    rename(column, "partitioned", "partitionStatus");
    rename(column, "criticalDataElement", "criticalDataElementStatus");
    rename(column, "encryptedName", "encryptedColumnName");
    rename(column, "transformSourceObjects", "transformSourceTables");
    rename(column, "examples", "sampleValues");
    // ODCS 2.2 defaults isNullable to false; the newer required flag defaults to false instead.
    column.put("isNullable", !column.path("required").asBoolean(false));
    column.remove("required");
    if (!column.has("logicalType")) column.put("logicalType", "string");
    if (!column.has("physicalType")) column.put("physicalType", "UNKNOWN");
    output.add(column);
    if (children != null) for (JsonNode child : children) flatten((ObjectNode) child, path, output);
    if (items != null) {
      for (JsonNode child : items.path("properties")) flatten((ObjectNode) child, path, output);
      ObjectNode metadata = items.deepCopy();
      metadata.remove("properties");
      if (items.path("properties").isArray()) metadata.remove("logicalType");
      if (!metadata.isEmpty()) column.set("items", metadata);
    }
  }

  private static void insert(ArrayNode siblings, ObjectNode value, List<String> path) {
    String name = FullyQualifiedName.unquoteName(path.getFirst());
    ObjectNode target = null;
    for (JsonNode sibling : siblings)
      if (name.equals(sibling.path("name").asText())) target = (ObjectNode) sibling;
    if (path.size() == 1) {
      value.put("name", name);
      if (target == null) siblings.add(value);
      else target.setAll(value);
    } else {
      if (target == null) {
        target = siblings.addObject().put("name", name).put("logicalType", "object");
      }
      ObjectNode parent =
          "array".equals(target.path("logicalType").asText()) ? objectItems(target) : target;
      insert(parent.withArray("properties"), value, path.subList(1, path.size()));
    }
  }

  private static ObjectNode objectItems(ObjectNode array) {
    if (!array.path("items").isObject()) {
      array.set("items", ODCSExportModelWriter.JSON.createObjectNode());
    }
    ObjectNode items = (ObjectNode) array.path("items");
    if (!items.hasNonNull("logicalType")) {
      items.put("logicalType", "object");
    }
    return items;
  }

  private static void rename(ObjectNode object, String from, String to) {
    if (object.has(from)) object.set(to, object.remove(from));
  }
}
