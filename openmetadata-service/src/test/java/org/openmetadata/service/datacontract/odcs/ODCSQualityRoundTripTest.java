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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSQualityRule;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.util.ODCSConverter;

class ODCSQualityRoundTripTest {
  private static final List<String> VERSIONS =
      List.of("v3.1.0", "v3.0.2", "v3.0.1", "v3.0.0", "v2.2.2", "v2.2.1");
  private static final ObjectMapper JSON =
      new ObjectMapper().enable(DeserializationFeature.USE_BIG_DECIMAL_FOR_FLOATS);
  private final ODCSExportService exporter = new ODCSExportService(contract -> List.of());

  @ParameterizedTest
  @ValueSource(strings = {"v3.1.0", "v3.0.2", "v3.0.1", "v3.0.0", "v2.2.2", "v2.2.1"})
  void importedSqlAssertionsRetainTheirJsonType(String version) throws Exception {
    ObjectNode source = source("orders");
    ObjectNode rule = sql("response", "SELECT 'OK'");
    rule.put("mustBe", "OK");
    ((ObjectNode) source.at("/schema/0")).withArray("quality").add(rule);
    assertTrue(ODCSPublishedSchema.validate(source).isEmpty());
    DataContract contract = imported(source);
    JsonNode exported = exporter.export(contract, version).requireValid();
    JsonNode actual = declaration(exported, version, "/schema/0/quality/0");
    assertEquals("OK", actual.path("mustBe").asText());
    assertTrue(actual.path("mustBe").isTextual());
  }

  @ParameterizedTest
  @ValueSource(strings = {"v3.1.0", "v3.0.2", "v3.0.1", "v3.0.0", "v2.2.2", "v2.2.1"})
  void importedColumnSqlAssertionsRemainOnTheirColumn(String version) throws Exception {
    ObjectNode source = source("orders");
    ((ObjectNode) source.at("/schema/0/properties/0"))
        .withArray("quality")
        .add(sql("column_response", "SELECT result FROM ${table}").put("mustNotBe", "ERROR"));
    JsonNode document = exporter.export(imported(source), version).requireValid();
    assertEquals(
        "ERROR",
        declaration(document, version, "/schema/0/properties/0/quality/0")
            .path("mustNotBe")
            .asText());
    if (version.startsWith("v2"))
      assertEquals("id", document.at("/dataset/0/quality/0/column").asText());
    else assertFalse(document.at("/schema/0").has("quality"));
  }

  @ParameterizedTest
  @ValueSource(strings = {"v3.1.0", "v3.0.2", "v3.0.1", "v3.0.0", "v2.2.2", "v2.2.1"})
  void preservedArrayItemSqlRulesUseAnOpaqueFallbackWhenNotNativelyMappable(String version)
      throws Exception {
    ObjectNode source = source("orders");
    ObjectNode column = (ObjectNode) source.at("/schema/0/properties/0");
    column.put("logicalType", "array");
    ObjectNode rule = sql("item_response", "SELECT 'OK'").put("mustBe", "OK");
    column.putObject("items").put("logicalType", "string").withArray("quality").add(rule);
    assertTrue(ODCSPublishedSchema.validate(source).isEmpty());
    JsonNode exported = exporter.export(imported(source), version).requireValid();
    assertEquals(rule, declaration(exported, version, "/schema/0/properties/0/items/quality/0"));
  }

  @ParameterizedTest
  @ValueSource(strings = {"v3.1.0", "v3.0.2", "v3.0.1", "v3.0.0", "v2.2.2", "v2.2.1"})
  void literalDottedColumnQualityUsesTheRealImportScope(String version) throws Exception {
    ObjectNode source = source("orders");
    ObjectNode property = (ObjectNode) source.at("/schema/0/properties/0");
    property.put("name", "customer.id");
    property
        .withArray("quality")
        .addObject()
        .put("type", "library")
        .put("name", "required_id")
        .put("metric", "nullValues")
        .put("mustBe", 0);
    DataContract contract = imported(source);
    assertEquals("\"customer.id\"", contract.getOdcsQualityRules().getFirst().getColumn());
    JsonNode exported = exporter.export(contract, version).requireValid();
    if (version.startsWith("v2")) {
      assertEquals(1, exported.at("/dataset/0/columns").size());
      assertEquals("\"customer.id\"", exported.at("/dataset/0/quality/0/column").asText());
    } else {
      assertEquals(1, exported.at("/schema/0/properties").size());
      assertEquals("customer.id", exported.at("/schema/0/properties/0/name").asText());
      assertEquals(1, exported.at("/schema/0/properties/0/quality").size());
    }
  }

  @Test
  void repairedRuleMetadataFollowsIdentityAfterReorderingAndNativeEdits() throws Exception {
    ObjectNode source = source("orders");
    var rules = ((ObjectNode) source.at("/schema/0")).withArray("quality");
    rules.add(sql("first", "SELECT 'first'").put("mustBe", "first"));
    rules.add(sql("second", "SELECT 'second'").put("mustBe", "second"));
    DataContract contract = imported(source);
    List<ODCSQualityRule> current = new ArrayList<>(contract.getOdcsQualityRules());
    Collections.reverse(current);
    contract.setOdcsQualityRules(current);
    JsonNode exported = exporter.export(contract, "v3.1.0").requireValid();
    assertEquals("second", exported.at("/schema/0/quality/0/mustBe").asText());
    assertEquals("first", exported.at("/schema/0/quality/1/mustBe").asText());
    current.getFirst().setMustBe(7.0);
    contract.setOdcsQualityRules(List.of(current.getFirst()));
    exported = exporter.export(contract, "v3.1.0").requireValid();
    assertEquals(1, exported.at("/schema/0/quality").size());
    assertEquals(7, exported.at("/schema/0/quality/0/mustBe").asInt());
    assertFalse(exported.toString().contains("SELECT 'first'"));
  }

  @Test
  void importBaselineUsesTheSelectedTableBeforeEntityNamesAreResolved() throws Exception {
    ObjectNode source = source("orders");
    ((ObjectNode) source.at("/schema/0"))
        .withArray("quality")
        .add(sql("response", "SELECT 'OK'").put("mustBe", "OK"));
    var read = ODCSLenientReader.readOrReject(JSON, source.deepCopy());
    DataContract contract =
        ODCSConverter.fromODCS(
            read,
            new EntityReference().withType("table"),
            null,
            ODCSImportIssues.discarding(),
            source);
    contract.getEntity().setName("renamed_orders");
    for (String version : VERSIONS) {
      JsonNode document = exporter.export(contract, version).requireValid();
      assertEquals(
          "OK",
          declaration(document, version, "/schema/0/quality/0").path("mustBe").asText(),
          version);
    }
    contract.setOdcsQualityRules(List.of());
    for (String version : VERSIONS) {
      JsonNode document = exporter.export(contract, version).requireValid();
      assertTrue(
          document
              .at(version.startsWith("v2") ? "/dataset/0/quality" : "/schema/0/quality")
              .isEmpty(),
          version);
    }
  }

  @Test
  void emptyLegacyRootQualityDoesNotLeakIntoPublishedExports() throws Exception {
    ObjectNode source = source("orders");
    source.putArray("quality");
    DataContract contract = imported(source);
    for (String version : VERSIONS)
      assertFalse(exporter.export(contract, version).requireValid().has("quality"), version);
  }

  @Test
  void legacyRootRulesRemainScopedWhenTheBaselineAlsoContainsSchemaRules() throws Exception {
    ObjectNode source = source("orders");
    source.withArray("quality").addObject().put("name", "steward").put("type", "text");
    source
        .withArray("quality")
        .addObject()
        .put("name", "external")
        .put("type", "custom")
        .put("engine", "external")
        .put("implementation", "custom check");
    source.withArray("quality").add(sql("response", "SELECT 'OK'").put("mustBe", "OK"));
    ((ObjectNode) source.at("/schema/0"))
        .withArray("quality")
        .addObject()
        .put("name", "rows")
        .put("type", "library")
        .put("metric", "rowCount")
        .put("mustBe", 1);
    DataContract contract = imported(source);
    for (String version : VERSIONS) {
      JsonNode document = exporter.export(contract, version).requireValid();
      assertFalse(document.has("quality"), version);
      assertEquals(
          4,
          document.at(version.startsWith("v2") ? "/dataset/0/quality" : "/schema/0/quality").size(),
          version);
      assertEquals(
          "OK",
          declaration(document, version, "/schema/0/quality/2").path("mustBe").asText(),
          version);
    }
  }

  @ParameterizedTest
  @ValueSource(strings = {"v3.1.0", "v3.0.2", "v3.0.1", "v3.0.0", "v2.2.2", "v2.2.1"})
  void legacyRootColumnAssertionsFollowTheirColumnWithoutLeakingAnchors(String version)
      throws Exception {
    ObjectNode source = source("orders");
    source
        .withArray("quality")
        .add(sql("response", "SELECT value").put("mustBe", "OK").put("column", "id"));
    JsonNode document = exporter.export(imported(source), version).requireValid();
    assertFalse(document.has("quality"));
    JsonNode rule = declaration(document, version, "/schema/0/properties/0/quality/0");
    assertEquals("OK", rule.path("mustBe").asText());
    assertFalse(rule.has("column"));
    if (version.startsWith("v2"))
      assertEquals("id", document.at("/dataset/0/quality/0/column").asText());
  }

  @ParameterizedTest
  @ValueSource(strings = {"quality", "properties", "items", "schema"})
  void malformedLegacyTargetsLeaveTheWholeSourceUnchanged(String invalidField) {
    ObjectNode source = source("orders");
    if ("quality".equals(invalidField)) {
      ((ObjectNode) source.at("/schema/0")).put("quality", "unreadable");
      source
          .withArray("quality")
          .add(sql("column", "SELECT value").put("mustBe", "OK").put("column", "id"));
      source.withArray("quality").add(sql("table", "SELECT value").put("mustBe", "OK"));
    } else {
      if ("schema".equals(invalidField)) source.put("schema", "unreadable");
      else if ("items".equals(invalidField))
        ((ObjectNode) source.at("/schema/0/properties/0"))
            .put("logicalType", "array")
            .put("items", "unreadable");
      else
        ((ObjectNode) source.at("/schema/0/properties/0"))
            .put("logicalType", "object")
            .put("properties", "unreadable");
      source.withArray("quality").add(sql("table", "SELECT value").put("mustBe", "OK"));
      source
          .withArray("quality")
          .add(sql("column", "SELECT value").put("mustBe", "OK").put("column", "id.value"));
    }
    JsonNode original = source.deepCopy();
    ODCSShapeNormalizer.projectRootQuality(source, JSON.createObjectNode(), "orders");
    assertEquals(original, source);
  }

  @ParameterizedTest
  @ValueSource(strings = {"none", "flat", "array"})
  void legacyRootMetadataSupportsMissingFlatAndArraySchemas(String shape) throws Exception {
    ObjectNode source = source("orders");
    String pointer = "/schema/0/quality/0";
    ObjectNode rule = sql("response", "SELECT value").put("mustBe", "OK");
    if ("none".equals(shape)) source.remove("schema");
    else if ("flat".equals(shape)) {
      JsonNode column = source.at("/schema/0/properties/0").deepCopy();
      source.putArray("schema").add(column);
      rule.put("column", "id");
      pointer = "/schema/0/properties/0/quality/0";
    } else {
      ObjectNode column = (ObjectNode) source.at("/schema/0/properties/0");
      column
          .put("logicalType", "array")
          .putObject("items")
          .put("logicalType", "object")
          .withArray("properties")
          .addObject()
          .put("name", "value")
          .put("logicalType", "string");
      rule.put("column", "id.value");
      pointer = "/schema/0/properties/0/items/properties/0/quality/0";
    }
    source.withArray("quality").add(rule);
    DataContract contract =
        ODCSConverter.fromODCS(
            ODCSLenientReader.readOrReject(JSON, source.deepCopy()),
            new EntityReference().withType("table").withName("orders"),
            null,
            ODCSImportIssues.discarding(),
            source);
    for (String version : VERSIONS) {
      JsonNode document = exporter.export(contract, version).requireValid();
      assertFalse(document.has("quality"));
      assertEquals("OK", declaration(document, version, pointer).path("mustBe").asText(), version);
    }
  }

  @Test
  void numericStringSqlAssertionsAreNotChangedIntoNumbers() throws Exception {
    ObjectNode source = source("orders");
    ((ObjectNode) source.at("/schema/0"))
        .withArray("quality")
        .add(sql(null, "SELECT '42'").put("mustBe", "42"));
    JsonNode exported = exporter.export(imported(source), "v3.1.0").requireValid();
    assertTrue(exported.at("/schema/0/quality/0/mustBe").isTextual());
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "\"OK\"",
        "\"42\"",
        "true",
        "null",
        "{\"state\":\"ok\"}",
        "[1,\"x\"]",
        "0.12345678901234567890123456789",
        "1e400"
      })
  void anonymousSqlAssertionsRetainArbitraryJsonValuesAcrossEveryVersion(String assertion)
      throws Exception {
    ObjectNode source = source("orders");
    JsonNode value = JSON.readTree(assertion);
    ObjectNode rule = sql(null, "SELECT result");
    rule.set("mustBe", value);
    ((ObjectNode) source.at("/schema/0")).withArray("quality").add(rule);
    assertTrue(ODCSPublishedSchema.validate(source).isEmpty());
    DataContract contract = imported(source);
    for (String version : VERSIONS) {
      JsonNode document = exporter.export(contract, version).requireValid();
      assertEquals(
          1,
          document
              .at(version.startsWith("v2") ? "/dataset/0/quality" : "/schema/0/quality")
              .size());
      JsonNode actual = declaration(document, version, "/schema/0/quality/0").path("mustBe");
      assertEquals(value, actual, version);
    }
  }

  @ParameterizedTest
  @ValueSource(strings = {"v3.1.0", "v3.0.2", "v3.0.1", "v3.0.0", "v2.2.2", "v2.2.1"})
  void currentComparisonOperatorReplacesThePreservedAlternative(String version) throws Exception {
    ObjectNode source = source("orders");
    ((ObjectNode) source.at("/schema/0"))
        .withArray("quality")
        .add(sql("response", "SELECT result").put("mustBe", "OK"));
    DataContract contract = imported(source);
    contract.getOdcsQualityRules().getFirst().setMustBeGreaterThan(5.0);
    JsonNode document = exporter.export(contract, version).requireValid();
    JsonNode rule = declaration(document, version, "/schema/0/quality/0");
    assertFalse(rule.has("mustBe"));
    assertEquals(5, rule.path("mustBeGreaterThan").asInt());
  }

  @Test
  void aLiteralDottedTableDoesNotBecomeAColumnScope() throws Exception {
    ObjectNode source = source("orders.live");
    ((ObjectNode) source.at("/schema/0"))
        .withArray("quality")
        .add(sql("table_count", "SELECT COUNT(*) FROM ${table}").put("mustBe", 1));
    DataContract contract = imported(source);
    assertEquals("orders.live", contract.getOdcsQualityRules().getFirst().getColumn());
    for (String version : VERSIONS) {
      JsonNode document = exporter.export(contract, version).requireValid();
      JsonNode table = document.at(version.startsWith("v2") ? "/dataset/0" : "/schema/0");
      assertEquals(1, table.path("quality").size());
      assertEquals(1, table.path(version.startsWith("v2") ? "columns" : "properties").size());
    }
  }

  @ParameterizedTest
  @ValueSource(booleans = {true, false})
  void structuredCustomImplementationsRetainTheirJsonTypeAcrossEveryVersion(boolean named)
      throws Exception {
    ObjectNode source = source("orders");
    JsonNode implementation =
        JSON.readTree("{\"checks\":[true,null,{\"ratio\":0.123456789012345678901}]}");
    ObjectNode custom =
        ((ObjectNode) source.at("/schema/0"))
            .withArray("quality")
            .addObject()
            .put("type", "custom")
            .put("engine", "external");
    custom.set("implementation", implementation);
    if (named) custom.put("name", "custom_response");
    assertTrue(ODCSPublishedSchema.validate(source).isEmpty());
    DataContract contract = imported(source);
    for (String version : VERSIONS) {
      JsonNode document = exporter.export(contract, version).requireValid();
      assertEquals(
          1,
          document
              .at(version.startsWith("v2") ? "/dataset/0/quality" : "/schema/0/quality")
              .size());
      JsonNode rule =
          version.startsWith("v2")
              ? declaration(document, version, "")
              : document.at("/schema/0/quality/0");
      assertEquals(implementation, rule.path("implementation"), version);
    }
  }

  @ParameterizedTest
  @ValueSource(strings = {"0.12345678901234567890123456789", "1e400"})
  void anonymousLibraryAssertionsKeepTheirExactPrecisionWithoutAddingRules(String value)
      throws Exception {
    ObjectNode source = source("orders");
    JsonNode expected = JSON.readTree(value);
    ((ObjectNode) source.at("/schema/0"))
        .withArray("quality")
        .addObject()
        .put("type", "library")
        .put("metric", "rowCount")
        .set("mustBe", expected);
    assertTrue(ODCSPublishedSchema.validate(source).isEmpty());
    DataContract contract = imported(source);
    for (String version : VERSIONS) {
      JsonNode document = exporter.export(contract, version).requireValid();
      assertEquals(
          1,
          document
              .at(version.startsWith("v2") ? "/dataset/0/quality" : "/schema/0/quality")
              .size());
      assertEquals(
          expected, declaration(document, version, "/schema/0/quality/0").path("mustBe"), version);
    }
  }

  @ParameterizedTest
  @ValueSource(booleans = {true, false})
  void distinctSourceBoundsReplaceTheirUnchangedRoundedNativeOperator(boolean named)
      throws Exception {
    ObjectNode source = source("orders");
    JsonNode expected = JSON.readTree("[1.00000000000000000001,1.00000000000000000002]");
    ObjectNode rule =
        ((ObjectNode) source.at("/schema/0"))
            .withArray("quality")
            .addObject()
            .put("type", "library")
            .put("metric", "rowCount");
    rule.set("mustBeBetween", expected);
    if (named) rule.put("name", "precise_bounds");
    assertTrue(ODCSPublishedSchema.validate(source).isEmpty());
    DataContract contract = imported(source);
    for (String version : VERSIONS) {
      JsonNode document = exporter.export(contract, version).requireValid();
      assertEquals(
          1,
          document
              .at(version.startsWith("v2") ? "/dataset/0/quality" : "/schema/0/quality")
              .size());
      JsonNode actual = declaration(document, version, "/schema/0/quality/0");
      assertEquals(expected, actual.path("mustBeBetween"), version);
      assertFalse(actual.has("mustBe"), version);
    }
    contract.getOdcsQualityRules().getFirst().setMustBeBetween(null);
    contract.getOdcsQualityRules().getFirst().setMustBe(7.0);
    for (String version : VERSIONS) {
      JsonNode document = exporter.export(contract, version).requireValid();
      JsonNode actual = declaration(document, version, "/schema/0/quality/0");
      assertEquals(7, actual.path("mustBe").asInt(), version);
      assertFalse(actual.has("mustBeBetween"), version);
    }
  }

  @Test
  void nestedArgumentsDoNotAcquireQualityOperatorSemantics() throws Exception {
    ObjectNode source = source("orders");
    ObjectNode rule =
        ((ObjectNode) source.at("/schema/0"))
            .withArray("quality")
            .addObject()
            .put("name", "row_count")
            .put("type", "library")
            .put("metric", "rowCount")
            .put("mustBe", "0");
    rule.set("arguments", JSON.readTree("{\"mustBe\":\"external\",\"mustBeBetween\":[1,2]}"));
    assertTrue(ODCSPublishedSchema.validate(source).isEmpty());
    DataContract contract = imported(source);
    contract
        .getOdcsQualityRules()
        .getFirst()
        .getArguments()
        .setAdditionalProperty("mustBeGreaterThan", 3);
    for (String version : VERSIONS) {
      JsonNode arguments =
          declaration(
                  exporter.export(contract, version).requireValid(), version, "/schema/0/quality/0")
              .path("arguments");
      assertEquals("external", arguments.path("mustBe").asText(), version);
      assertEquals(JSON.readTree("[1,2]"), arguments.path("mustBeBetween"), version);
      assertEquals(3, arguments.path("mustBeGreaterThan").asInt(), version);
    }
  }

  @Test
  void legacyIdentifierAnnotationsDoNotConsumeUserCustomProperties() throws Exception {
    for (String id : new String[] {null, "source-rule-id"}) {
      ObjectNode source = source("orders");
      ObjectNode rule =
          ((ObjectNode) source.at("/schema/0"))
              .withArray("quality")
              .addObject()
              .put("type", "library")
              .put("name", "rows")
              .put("metric", "rowCount")
              .put("mustBe", 1);
      if (id != null) rule.put("id", id);
      rule.withArray("customProperties")
          .addObject()
          .put("property", "odcsId")
          .put("value", "external");
      DataContract contract = imported(source);
      for (String version : List.of("v3.0.0", "v3.0.1", "v3.0.2")) {
        JsonNode properties =
            exporter
                .export(contract, version)
                .requireValid()
                .at("/schema/0/quality/0/customProperties");
        assertEquals(id == null ? 1 : 2, properties.size());
        assertEquals("external", properties.get(0).path("value").asText());
        if (id != null) assertEquals(id, properties.get(1).path("value").asText());
      }
    }
  }

  @Test
  void physicalNamesAreOnlyOmittedInVersionsThatDoNotSupportThem() throws Exception {
    ObjectNode source = source("orders");
    ((ObjectNode) source.at("/schema/0/properties/0")).put("physicalName", "id");
    DataContract contract = imported(source);
    for (String version : List.of("v3.1.0", "v3.0.2", "v3.0.1", "v3.0.0")) {
      JsonNode property =
          exporter.export(contract, version).requireValid().at("/schema/0/properties/0");
      assertEquals(
          List.of("v3.1.0", "v3.0.2").contains(version), property.has("physicalName"), version);
    }
  }

  private static JsonNode declaration(JsonNode document, String version, String pointer)
      throws Exception {
    String index = pointer.isEmpty() ? "0" : pointer.substring(pointer.lastIndexOf('/') + 1);
    JsonNode rule = document.at(version.startsWith("v2") ? "/dataset/0/quality/" + index : pointer);
    if (version.startsWith("v2")) {
      for (JsonNode property : rule.path("customProperties"))
        if ("odcsRule".equals(property.path("property").asText())) return property.path("value");
    }
    if ("custom".equals(rule.path("type").asText()))
      return JSON.readTree(rule.path("implementation").asText()).path("odcsRule");
    return rule;
  }

  private static ObjectNode sql(String name, String query) {
    ObjectNode rule = JSON.createObjectNode().put("type", "sql").put("query", query);
    if (name != null) rule.put("name", name);
    return rule;
  }

  private static ObjectNode source(String table) {
    ObjectNode source =
        JSON.createObjectNode()
            .put("apiVersion", "v3.1.0")
            .put("kind", "DataContract")
            .put("id", UUID.randomUUID().toString())
            .put("name", "orders_contract")
            .put("version", "1.0.0")
            .put("status", "active");
    source
        .withArray("schema")
        .addObject()
        .put("name", table)
        .put("logicalType", "object")
        .withArray("properties")
        .addObject()
        .put("name", "id")
        .put("logicalType", "string");
    return source;
  }

  private static DataContract imported(JsonNode source) {
    return ODCSConverter.fromODCS(
        ODCSLenientReader.readOrReject(JSON, source.deepCopy()),
        new EntityReference()
            .withType("table")
            .withName(source.at("/schema/0/name").asText())
            .withFullyQualifiedName("sample.db.shop.orders"),
        null,
        ODCSImportIssues.discarding(),
        source);
  }
}
