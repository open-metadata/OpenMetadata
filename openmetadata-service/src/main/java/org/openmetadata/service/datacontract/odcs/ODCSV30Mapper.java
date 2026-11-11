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
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.HashSet;
import java.util.List;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSQualityRule;
import org.openmetadata.service.util.FullyQualifiedName;

/** Maps the shared native representation into the published v3.0 family without losing rule parameters. */
public final class ODCSV30Mapper implements ODCSVersionAdapter {
  private final String version;
  private final Class<?> model;
  private final JsonNode schema;

  public ODCSV30Mapper(String version) {
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
    ObjectNode document = canonical.deepCopy();
    document.put("apiVersion", version);
    ODCSLegacyQuality quality = new ODCSLegacyQuality(schema, contract);
    for (JsonNode table : document.path("schema")) convertElement((ObjectNode) table, "", quality);
    if (document.path("team").has("members"))
      document.set("team", document.path("team").path("members"));
    ObjectNode result = ODCSExportModelWriter.write(document, model);
    // Apply the overlay to the original declarations; decoding legacy metadata can confuse
    // user-owned custom properties with the compatibility annotations added by this adapter.
    ODCSLegacyQuality.restoreDeclarations(result, canonical);
    return result;
  }

  private static void convertElement(ObjectNode element, String path, ODCSLegacyQuality quality) {
    String logicalType = element.path("logicalType").asText();
    if (logicalType.equals("timestamp")) element.put("logicalType", "date");
    if (logicalType.equals("time")) element.put("logicalType", "string");
    if (element.path("quality").isArray()) {
      var rules = ODCSExportModelWriter.JSON.createArrayNode();
      for (JsonNode rule : element.path("quality"))
        rules.add(rule.isObject() ? quality.v30(rule, path) : rule.deepCopy());
      element.set("quality", rules);
    }
    for (JsonNode child : element.path("properties")) {
      if (child.isObject())
        convertElement(
            (ObjectNode) child,
            path.isEmpty()
                ? FullyQualifiedName.quoteName(child.path("name").asText())
                : FullyQualifiedName.add(path, child.path("name").asText()),
            quality);
    }
    if (element.path("items").isObject())
      convertElement((ObjectNode) element.path("items"), path, quality);
  }

  @Override
  public JsonNode preservationView(JsonNode document) {
    ObjectNode view = document.deepCopy();
    if (view.path("team").isArray()) {
      ObjectNode team = ODCSExportModelWriter.JSON.createObjectNode();
      team.set("members", view.get("team"));
      view.set("team", team);
    }
    return view;
  }

  @Override
  public JsonNode materialize(JsonNode view, DataContract contract) {
    ObjectNode document = view.deepCopy();
    document.put("apiVersion", version);
    ODCSLegacyQuality quality = new ODCSLegacyQuality(schema, contract);
    // Preserved rules can still use the source version after the metadata overlay.
    for (JsonNode table : document.path("schema")) {
      if (table.isObject()) convertElement((ObjectNode) table, "", quality);
    }
    JsonNode team = document.path("team");
    if (team.isObject() && team.size() == 1 && team.path("members").isArray())
      document.set("team", team.path("members"));
    if (!supportsPhysicalName()) {
      for (JsonNode table : document.path("schema")) omitRedundantPhysicalNames(table);
    }
    return document;
  }

  private boolean supportsPhysicalName() {
    JsonNode definition = schema.path("$defs").path("SchemaProperty");
    var visited = new HashSet<String>();
    while (!definition.path("properties").has("physicalName")) {
      String reference = definition.path("$ref").asText();
      if (!reference.startsWith("#/") || !visited.add(reference)) return false;
      definition = schema.at(reference.substring(1));
    }
    return true;
  }

  private static void omitRedundantPhysicalNames(JsonNode element) {
    for (JsonNode property : element.path("properties")) {
      // Older properties have one name; an identical physicalName adds no information.
      if (property.path("physicalName").equals(property.path("name")))
        ((ObjectNode) property).remove("physicalName");
      omitRedundantPhysicalNames(property);
    }
    if (element.path("items").isObject()) omitRedundantPhysicalNames(element.path("items"));
  }
}
