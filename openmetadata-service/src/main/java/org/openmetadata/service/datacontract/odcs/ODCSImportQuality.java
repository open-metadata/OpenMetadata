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
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSImportIssueCategory;
import org.openmetadata.schema.type.datacontract.odcs.v310.DataQuality;

/** Decodes the compatibility declarations emitted by the older published profiles. */
final class ODCSImportQuality {
  static final String LEGACY_METADATA = "odcsLegacyQuality";
  private static final Map<String, String> METRICS =
      Map.of(
          "nullCount",
          "nullValues",
          "duplicateCount",
          "duplicateValues",
          "missingCount",
          "missingValues",
          "invalidCount",
          "invalidValues");
  private static final Set<String> PUBLISHED_METRICS =
      Arrays.stream(DataQuality.Metric.values())
          .map(DataQuality.Metric::toString)
          .collect(Collectors.toUnmodifiableSet());

  private ODCSImportQuality() {}

  static void normalizeStatus(ObjectNode document) {
    String status = document.path("status").asText();
    document.put(
        "status",
        switch (status) {
          case "production" -> "active";
          case "development", "test" -> "draft";
          default -> status;
        });
  }

  static void normalize(ObjectNode element, boolean legacyIds) {
    if (element.path("quality") instanceof ArrayNode quality) {
      for (int index = 0; index < quality.size(); index++) {
        if (quality.get(index) instanceof ObjectNode rule)
          quality.set(index, declaration(rule, legacyIds));
      }
    }
    for (String collection : List.of("schema", "properties"))
      for (JsonNode child : element.path(collection))
        if (child instanceof ObjectNode object) normalize(object, legacyIds);
    if (element.path("items") instanceof ObjectNode items) normalize(items, legacyIds);
  }

  private static ObjectNode declaration(ObjectNode source, boolean legacyIds) {
    ObjectNode rule = source.deepCopy();
    if (legacyIds
        && !source.has("id")
        && !embeddedDeclaration(source).has("id")
        && rule.path("customProperties") instanceof ArrayNode properties) {
      for (int index = properties.size() - 1; index >= 0; index--) {
        JsonNode property = properties.get(index);
        if ("odcsId".equals(property.path("property").asText())
            && property.path("value").isTextual()) {
          if (!rule.has("id")) rule.set("id", property.path("value").deepCopy());
          properties.remove(index);
          break;
        }
      }
      if (properties.isEmpty()) rule.remove("customProperties");
    }
    String sourceMetric = rule.path("rule").asText();
    String metric = METRICS.getOrDefault(sourceMetric, sourceMetric);
    if (!rule.has("metric") && PUBLISHED_METRICS.contains(metric)) {
      rule.put("metric", metric);
      rule.remove("rule");
    }
    return rule;
  }

  static ObjectNode readerView(JsonNode canonical, ODCSImportIssues issues) {
    ObjectNode reader = canonical.deepCopy();
    decodeImplementations(reader, issues);
    return reader;
  }

  private static void decodeImplementations(ObjectNode element, ODCSImportIssues issues) {
    if (element.path("description").isArray()) {
      List<String> descriptions = new ArrayList<>();
      element.path("description").forEach(value -> descriptions.add(value.asText()));
      element.put("description", String.join("\n", descriptions));
    }
    if (element.path("quality") instanceof ArrayNode quality) {
      for (int index = 0; index < quality.size(); index++)
        if (quality.get(index) instanceof ObjectNode rule)
          quality.set(
              index, protectAssertions(declaration(embeddedDeclaration(rule), false), issues));
    }
    for (String collection : List.of("schema", "properties"))
      for (JsonNode child : element.path(collection))
        if (child instanceof ObjectNode object) decodeImplementations(object, issues);
    if (element.path("items") instanceof ObjectNode items) decodeImplementations(items, issues);
  }

  private static ObjectNode protectAssertions(ObjectNode rule, ODCSImportIssues issues) {
    boolean lossless = true;
    for (String field :
        List.of(
            "mustBe",
            "mustNotBe",
            "mustBeGreaterThan",
            "mustBeGreaterOrEqualTo",
            "mustBeLessThan",
            "mustBeLessOrEqualTo",
            "mustBeBetween",
            "mustNotBeBetween")) {
      if (rule.has(field) && !numericAssertion(field, rule.path(field))) lossless = false;
    }
    if (lossless) return rule;
    issues.info(
        ODCSImportIssueCategory.QUALITY,
        "quality",
        "quality",
        "This rule's JSON assertion cannot be represented by native numeric assertions; it is preserved without creating a test case.");
    ObjectNode preserved = rule.objectNode().put("type", "custom").put("engine", "odcs");
    for (String field : List.of("id", "name", "description", "column"))
      if (rule.has(field)) preserved.set(field, rule.path(field).deepCopy());
    preserved.put("implementation", rule.toString());
    return preserved;
  }

  private static boolean numericAssertion(String operator, JsonNode value) {
    if (List.of("mustBeBetween", "mustNotBeBetween").contains(operator))
      return value.isArray()
          && value.size() == 2
          && numericProjection(value.get(0))
          && numericProjection(value.get(1));
    return numericProjection(value);
  }

  private static boolean numericProjection(JsonNode value) {
    return value.isNumber()
        && Double.isFinite(value.doubleValue())
        && value.decimalValue().compareTo(BigDecimal.valueOf(value.doubleValue())) == 0;
  }

  static ObjectNode embeddedDeclaration(ObjectNode rule) {
    String engine = rule.path("engine").asText();
    if (!List.of("openmetadata", "odcs").contains(engine)) return rule.deepCopy();
    JsonNode implementation = rule.path("implementation");
    try {
      JsonNode parsed =
          implementation.isTextual()
              ? ODCSExportModelWriter.JSON.readTree(implementation.asText())
              : implementation;
      if (parsed != null && parsed.path("odcsRule").isObject())
        return (ObjectNode) parsed.path("odcsRule").deepCopy();
    } catch (JsonProcessingException exception) {
      // External implementations can be executable text rather than JSON annotations.
      return rule.deepCopy();
    }
    return rule.deepCopy();
  }

  static ObjectNode legacyDeclaration(JsonNode legacy) {
    ObjectNode source = ODCSLegacyQuality.sourceDeclaration(legacy);
    if (!source.has("templateName")) {
      if (hasExternalLegacyMetadata(legacy)) addLegacyMetadata(source, legacy);
      return source;
    }
    ObjectNode rule = ODCSExportModelWriter.JSON.createObjectNode();
    rule.put("type", "custom");
    rule.put("name", legacy.path("toolRuleName").asText(legacy.path("templateName").asText()));
    rule.put("engine", legacy.path("toolName").asText());
    if (legacy.has("code")) rule.set("implementation", legacy.path("code").deepCopy());
    for (String field : List.of("description", "dimension", "severity", "businessImpact"))
      if (legacy.has(field)) rule.set(field, legacy.path(field).deepCopy());
    if (legacy.has("scheduleCronExpression"))
      rule.set("schedule", legacy.path("scheduleCronExpression"));
    if (legacy.path("customProperties").isArray())
      rule.set("customProperties", legacy.path("customProperties").deepCopy());
    addLegacyMetadata(rule, legacy);
    return rule;
  }

  private static boolean hasExternalLegacyMetadata(JsonNode legacy) {
    Set<String> mapped =
        Set.of(
            "templateName",
            "toolName",
            "toolRuleName",
            "code",
            "column",
            "description",
            "dimension",
            "severity",
            "businessImpact",
            "type",
            "scheduleCronExpression",
            "customProperties");
    for (var fields = legacy.fieldNames(); fields.hasNext(); )
      if (!mapped.contains(fields.next())) return true;
    for (JsonNode property : legacy.path("customProperties"))
      if (!"odcsRule".equals(property.path("property").asText())) return true;
    return false;
  }

  private static void addLegacyMetadata(ObjectNode rule, JsonNode legacy) {
    ObjectNode metadata = legacy.deepCopy();
    if (metadata.path("customProperties") instanceof ArrayNode properties) {
      for (int index = properties.size() - 1; index >= 0; index--)
        if ("odcsRule".equals(properties.get(index).path("property").asText()))
          properties.remove(index);
      if (properties.isEmpty()) metadata.remove("customProperties");
    }
    rule.withArray("customProperties")
        .addObject()
        .put("property", LEGACY_METADATA)
        .set("value", metadata);
  }
}
