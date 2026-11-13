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

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSQualityRule;
import org.openmetadata.schema.type.Column;
import org.openmetadata.service.datacontract.odcs.ODCSRuleOutcome.TestCaseOutcome;
import org.openmetadata.service.util.FullyQualifiedName;

/** Keeps executable OM rules and their source declarations when an older format is less expressive. */
final class ODCSLegacyQuality {
  private static final Map<String, String> LEGACY_METRICS =
      Map.of(
          "nullValues",
          "nullCount",
          "duplicateValues",
          "duplicateCount",
          "missingValues",
          "missingCount",
          "invalidValues",
          "invalidCount");
  private final JsonNode definitions;
  private final Set<String> metadata;
  private final ODCSTableTarget target;

  ODCSLegacyQuality(JsonNode schema, DataContract contract) {
    definitions = schema.path("$defs");
    metadata = ODCSExportModelWriter.fields(definitions.path("DataQuality"));
    String fqn =
        contract.getEntity() == null
            ? contract.getName()
            : contract.getEntity().getFullyQualifiedName();
    if (fqn == null) fqn = contract.getName();
    List<String> columns = new ArrayList<>();
    for (var column : listOrEmpty(contract.getSchema())) collectColumns(column, "", columns);
    target = new ODCSTableTarget(fqn == null ? "contract" : fqn, columns);
  }

  private static void collectColumns(Column column, String parent, List<String> names) {
    String path =
        parent.isEmpty()
            ? FullyQualifiedName.quoteName(column.getName())
            : FullyQualifiedName.add(parent, column.getName());
    names.add(path);
    for (var child : listOrEmpty(column.getChildren())) collectColumns(child, path, names);
  }

  ObjectNode v30(JsonNode source, String column) {
    ObjectNode rule = source.deepCopy();
    if (rule.has("id")) {
      JsonNode id = rule.remove("id");
      rule.withArray("customProperties").addObject().put("property", "odcsId").set("value", id);
    }
    String type = rule.path("type").asText(rule.has("metric") ? "library" : "text");
    rule.put("type", type);
    if (type.equals("library")) {
      if (rule.has("metric")) {
        String metric = rule.remove("metric").asText();
        rule.put("rule", LEGACY_METRICS.getOrDefault(metric, metric));
      }
      rule.put("type", "library");
    }
    String definition =
        switch (type) {
          case "library" -> "DataQualityLibrary";
          case "sql" -> "DataQualitySql";
          case "custom" -> "DataQualityCustom";
          default -> "";
        };
    Set<String> specific = ODCSExportModelWriter.fields(definitions.path(definition));
    boolean compatible = true;
    for (var fields = rule.fieldNames(); fields.hasNext(); ) {
      String field = fields.next();
      if (!metadata.contains(field) && !specific.contains(field)) compatible = false;
    }
    return compatible ? rule : custom(source, column);
  }

  ObjectNode v22(JsonNode source, String column) {
    if (source.has("templateName") && source.has("toolName") && source.has("code"))
      return source.deepCopy();
    ObjectNode canonical = source.deepCopy();
    ObjectNode legacyMetadata = removeLegacyMetadata(canonical);
    source = canonical;
    Optional<TestCaseOutcome> nativeRule = nativeRule(source, column);
    String template =
        nativeRule
            .map(outcome -> outcome.testCase().getTestDefinition())
            .orElse(
                source
                    .path("metric")
                    .asText(source.path("rule").asText(source.path("type").asText("odcsRule"))));
    ObjectNode result =
        legacyMetadata == null
            ? ODCSExportModelWriter.JSON.createObjectNode()
            : legacyMetadata.deepCopy();
    if (legacyMetadata != null && nativeRule.isEmpty())
      template = legacyMetadata.path("templateName").asText(template);
    result.put("templateName", template);
    result.put(
        "toolName", nativeRule.isPresent() ? "openmetadata" : source.path("engine").asText("odcs"));
    result.put("toolRuleName", source.path("name").asText(template));
    result.put(
        "code",
        nativeRule
            .map(ODCSLegacyQuality::implementation)
            .orElse(
                legacyMetadata != null && source.has("implementation")
                    ? source.path("implementation").asText()
                    : source.toString()));
    result.remove("column");
    if (!column.isEmpty()) result.put("column", column);
    for (String field : List.of("description", "dimension", "severity", "businessImpact", "type")) {
      if (source.has(field)) result.set(field, source.get(field).deepCopy());
    }
    if (source.has("schedule"))
      result.set("scheduleCronExpression", source.get("schedule").deepCopy());
    result.remove("customProperties");
    if (legacyMetadata != null && legacyMetadata.path("customProperties").isArray())
      result.set("customProperties", legacyMetadata.path("customProperties").deepCopy());
    result
        .withArray("customProperties")
        .addObject()
        .put("property", "odcsRule")
        .set("value", source.deepCopy());
    return result;
  }

  private static ObjectNode removeLegacyMetadata(ObjectNode rule) {
    ObjectNode metadata = null;
    if (rule.path("customProperties") instanceof ArrayNode properties) {
      for (int index = properties.size() - 1; index >= 0; index--) {
        JsonNode property = properties.get(index);
        if (ODCSImportQuality.LEGACY_METADATA.equals(property.path("property").asText())
            && property.path("value").isObject()) {
          metadata = property.path("value").deepCopy();
          properties.remove(index);
        }
      }
      if (properties.isEmpty()) rule.remove("customProperties");
    }
    return metadata;
  }

  private ObjectNode custom(JsonNode source, String column) {
    ObjectNode result = ODCSExportModelWriter.JSON.createObjectNode();
    source
        .fields()
        .forEachRemaining(
            field -> {
              if (metadata.contains(field.getKey()))
                result.set(field.getKey(), field.getValue().deepCopy());
            });
    Optional<TestCaseOutcome> nativeRule = nativeRule(source, column);
    result.put("type", "custom");
    result.put("engine", nativeRule.isPresent() ? "openmetadata" : "odcs");
    ObjectNode implementation = ODCSExportModelWriter.JSON.createObjectNode();
    if (nativeRule.isPresent()) implementation = readImplementation(nativeRule.get());
    implementation.set("odcsRule", source.deepCopy());
    result.put("implementation", implementation.toString());
    return result;
  }

  private Optional<TestCaseOutcome> nativeRule(JsonNode source, String column) {
    try {
      ODCSQualityRule rule = ODCSExportModelWriter.JSON.convertValue(source, ODCSQualityRule.class);
      if (!ODCSQualityMetadata.isProjection(source, ODCSExportModelWriter.JSON.valueToTree(rule)))
        return Optional.empty();
      rule.setColumn(column.isEmpty() ? null : column);
      return ODCSQualityRuleMapper.map(List.of(rule), target).stream()
          .filter(TestCaseOutcome.class::isInstance)
          .map(TestCaseOutcome.class::cast)
          .findFirst();
    } catch (IllegalArgumentException exception) {
      // Published SQL assertions accept JSON values beyond the legacy reader's numeric model.
      return Optional.empty();
    }
  }

  static ObjectNode sourceDeclaration(JsonNode rule) {
    for (JsonNode property : rule.path("customProperties")) {
      if ("odcsRule".equals(property.path("property").asText())
          && property.path("value").isObject()) return property.path("value").deepCopy();
    }
    return rule.deepCopy();
  }

  static void restoreDeclarations(JsonNode element, JsonNode canonical) {
    if (canonical.has("quality"))
      ((ObjectNode) element).set("quality", canonical.path("quality").deepCopy());
    else ((ObjectNode) element).remove("quality");
    for (String collection : List.of("schema", "properties")) {
      Map<String, JsonNode> properties = new HashMap<>();
      for (JsonNode child : canonical.path(collection))
        properties.put(child.path("name").asText(), child);
      for (JsonNode child : element.path(collection)) {
        JsonNode source = properties.get(child.path("name").asText());
        if (source != null) restoreDeclarations(child, source);
      }
    }
    if (element.path("items").isObject() && canonical.path("items").isObject())
      restoreDeclarations(element.path("items"), canonical.path("items"));
  }

  private static ObjectNode readImplementation(TestCaseOutcome outcome) {
    try {
      return (ObjectNode) ODCSExportModelWriter.JSON.readTree(implementation(outcome));
    } catch (IOException exception) {
      throw new IllegalStateException("Cannot serialize an OpenMetadata quality rule", exception);
    }
  }

  private static String implementation(TestCaseOutcome outcome) {
    var test = outcome.testCase();
    return ODCSOpenMetadataRules.implementation(
        test.getName(), test.getTestDefinition(), test.getParameterValues());
  }
}
