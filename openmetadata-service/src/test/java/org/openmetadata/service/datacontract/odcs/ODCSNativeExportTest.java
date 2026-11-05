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

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSQualityRule;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.TestCaseParameterValue;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnConstraint;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.service.util.ODCSConverter;

class ODCSNativeExportTest {
  private static final ObjectMapper JSON = new ObjectMapper();
  private static final String TABLE = "sample_data.ecommerce_db.shopify.customers";

  @Test
  void nativeCustomerContractIsValidOdcsWithItsCustomPropertiesAndQualityRules() {
    DataContract contract = customers();
    contract.setExtension(
        Map.of(
            "costCenter",
            "ANALYTICS-042",
            "retentionDays",
            90,
            "qualityTarget",
            99.5,
            "notes",
            "**Native OM custom property**"));
    List<ODCSQualityRule> rules =
        List.of(
            rule("customer_id_not_null", "columnValuesToBeNotNull", "customer_id", List.of()),
            rule("customer_id_unique", "columnValuesToBeUnique", "customer_id", List.of()),
            rule("customer_name_not_null", "columnValuesToBeNotNull", "customer_name", List.of()),
            rule(
                "customer_row_count",
                "tableRowCountToBeBetween",
                null,
                List.of(
                    new TestCaseParameterValue().withName("minValue").withValue("1"),
                    new TestCaseParameterValue().withName("maxValue").withValue("1000000"))));

    JsonNode exported = ODCSConverter.toODCSDocument(contract, rules);

    assertEquals(List.of(), ODCSPublishedSchema.validate(exported));
    assertEquals(4, exported.path("customProperties").size());
    assertEquals("ANALYTICS-042", property(exported, "costCenter").asText());
    assertTrue(property(exported, "retentionDays").isIntegralNumber());
    assertEquals(90, property(exported, "retentionDays").asInt());
    assertEquals(99.5, property(exported, "qualityTarget").asDouble());
    assertEquals("**Native OM custom property**", property(exported, "notes").asText());
    assertEquals(2, exported.at("/schema/0/properties/0/quality").size());
    assertEquals(1, exported.at("/schema/0/properties/1/quality").size());
    assertEquals(1, exported.at("/schema/0/quality").size());
    assertEquals("customer_id", rules.getFirst().getColumn());
    assertFalse(exported.at("/schema/0/properties/0/quality/0").has("column"));
  }

  @ParameterizedTest
  @EnumSource(ColumnDataType.class)
  void everyNativeColumnTypeExportsAStandardLogicalType(ColumnDataType type) {
    DataContract contract = customers();
    contract.setSchema(
        List.of(new Column().withName("value").withDataType(type).withDataLength(20)));
    JsonNode exported = ODCSConverter.toODCSDocument(contract, List.of());
    assertEquals(List.of(), ODCSPublishedSchema.validate(exported), type.toString());
    assertEquals(type.toString(), exported.at("/schema/0/properties/0/physicalType").asText());
  }

  @Test
  void nativeValuesOverridePreservedPropertiesWithoutDroppingUnrelatedMetadata() throws Exception {
    JsonNode source =
        JSON.readTree(
            """
        {"apiVersion":"v3.1.0","kind":"DataContract","id":"source","version":"1.0.0","status":"active",
         "customProperties":[{"property":"externalOnly","value":{"nested":[1,false]}},
          {"property":"costCenter","value":"old","description":"External definition"}]}
        """);
    DataContract contract =
        ODCSConverter.fromODCS(
            ODCSLenientReader.readOrReject(JSON, source.deepCopy()),
            customers().getEntity(),
            null,
            ODCSImportIssues.discarding(),
            source);
    contract.setExtension(Map.of("costCenter", "new", "retentionDays", 90));
    JsonNode exported = ODCSConverter.toODCSDocument(contract, List.of());

    assertEquals("new", property(exported, "costCenter").asText());
    assertEquals(source.at("/customProperties/0/value"), property(exported, "externalOnly"));
    assertEquals("External definition", exported.at("/customProperties/1/description").asText());
    assertEquals(3, exported.path("customProperties").size());
    assertEquals("old", source.at("/customProperties/1/value").asText());
  }

  @Test
  void nativeCustomPropertyValuesKeepNullsBooleansAndNestedCollections() throws Exception {
    Map<String, Object> values = new LinkedHashMap<>();
    values.put("unset", null);
    values.put("enabled", false);
    values.put("limits", List.of(1, 2, 3));
    values.put("configuration", Map.of("mode", "native", "ratio", 0.5));
    DataContract contract = customers();
    contract.setExtension(values);
    JsonNode exported = ODCSConverter.toODCSDocument(contract, List.of());

    assertEquals(4, exported.path("customProperties").size());
    assertTrue(property(exported, "unset").isNull());
    assertTrue(property(exported, "enabled").isBoolean());
    assertFalse(property(exported, "enabled").asBoolean());
    assertEquals(JSON.valueToTree(values.get("limits")), property(exported, "limits"));
    assertEquals(
        JSON.valueToTree(values.get("configuration")), property(exported, "configuration"));
    assertEquals(List.of(), ODCSPublishedSchema.validate(exported));
  }

  @Test
  void clearedNativePropertiesAreNotReintroducedIntoExport() {
    DataContract contract = customers();
    contract.setExtension(Map.of("costCenter", "native"));
    assertEquals(
        "native",
        property(ODCSConverter.toODCSDocument(contract, List.of()), "costCenter").asText());
    contract.setExtension(Map.of());
    assertFalse(ODCSConverter.toODCSDocument(contract, List.of()).has("customProperties"));
    contract.setExtension(null);
    assertFalse(ODCSConverter.toODCSDocument(contract, List.of()).has("customProperties"));
  }

  @Test
  void qualityOnlyContractsExportRulesWithinTheirTableAndColumnScopes() {
    DataContract contract = customers();
    contract.setSchema(null);
    JsonNode exported =
        ODCSConverter.toODCSDocument(
            contract,
            List.of(
                rule("id_not_null", "columnValuesToBeNotNull", "customer_id", List.of()),
                rule(
                    "rows",
                    "tableRowCountToBeBetween",
                    null,
                    List.of(new TestCaseParameterValue().withName("minValue").withValue("1")))));
    assertFalse(exported.has("quality"));
    assertEquals(1, exported.at("/schema/0/quality").size());
    assertEquals("customer_id", exported.at("/schema/0/properties/0/name").asText());
    assertEquals(1, exported.at("/schema/0/properties/0/quality").size());
    assertEquals(List.of(), ODCSPublishedSchema.validate(exported));
  }

  @Test
  void arrayChildrenAndNestedQualityScopesFollowThePublishedShape() {
    DataContract contract = customers();
    contract.setSchema(
        List.of(
            new Column()
                .withName("orders")
                .withDataType(ColumnDataType.ARRAY)
                .withChildren(
                    List.of(new Column().withName("id").withDataType(ColumnDataType.BIGINT)))));
    JsonNode exported = ODCSConverter.toODCSDocument(contract, List.of());
    assertFalse(exported.at("/schema/0/properties/0").has("properties"));
    assertEquals("id", exported.at("/schema/0/properties/0/items/properties/0/name").asText());
    assertEquals(List.of(), ODCSPublishedSchema.validate(exported));

    contract.setSchema(null);
    exported =
        ODCSConverter.toODCSDocument(
            contract,
            List.of(rule("nested_not_null", "columnValuesToBeNotNull", "address.city", List.of())));
    assertEquals("address", exported.at("/schema/0/properties/0/name").asText());
    assertEquals("city", exported.at("/schema/0/properties/0/properties/0/name").asText());
    assertEquals(List.of(), ODCSPublishedSchema.validate(exported));
  }

  @Test
  void nativePropertiesCanBeExportedAlongsideOpaquePreservedEntries() throws Exception {
    DataContract contract = customers();
    contract.setOdcsPreservedFields(
        JSON.readTree(
            "{\"customProperties\":[null,\"opaque\",{\"property\":\"external\",\"value\":1}]}"));
    contract.setExtension(Map.of("native", "current"));
    JsonNode exported = ODCSConverter.toODCSDocument(contract, List.of());
    assertTrue(exported.at("/customProperties/0").isNull());
    assertEquals("opaque", exported.at("/customProperties/1").asText());
    assertEquals(1, property(exported, "external").asInt());
    assertEquals("current", property(exported, "native").asText());
  }

  @Test
  void nestedQualityRulesKeepNativeArrayTypes() {
    DataContract contract = customers();
    contract.setSchema(
        List.of(
            new Column()
                .withName("orders")
                .withDataType(ColumnDataType.ARRAY)
                .withChildren(
                    List.of(new Column().withName("id").withDataType(ColumnDataType.BIGINT)))));
    JsonNode exported =
        ODCSConverter.toODCSDocument(
            contract,
            List.of(rule("order_id_not_null", "columnValuesToBeNotNull", "orders.id", List.of())));
    assertEquals("array", exported.at("/schema/0/properties/0/logicalType").asText());
    assertEquals(1, exported.at("/schema/0/properties/0/items/properties/0/quality").size());
    assertEquals(List.of(), ODCSPublishedSchema.validate(exported));
  }

  @Test
  void nativeArrayEditsOverridePreservedItemsAndKeepTheirMetadata() throws Exception {
    JsonNode source =
        JSON.readTree(
            """
        {"apiVersion":"v3.1.0","kind":"DataContract","id":"array-source","version":"1.0.0","status":"active",
         "schema":[{"name":"customers","logicalType":"object","properties":[
           {"name":"orders","logicalType":"array","physicalType":"ARRAY","items":{
             "logicalType":"object","properties":[{"name":"id","logicalType":"integer",
               "physicalType":"INT","description":"old","customProperties":[{"property":"origin","value":"source"}]}]}}
         ]}]}
        """);
    DataContract contract =
        ODCSConverter.fromODCS(
            ODCSLenientReader.readOrReject(JSON, source.deepCopy()),
            customers().getEntity(),
            null,
            ODCSImportIssues.discarding(),
            source);
    contract.setSchema(
        List.of(
            new Column()
                .withName("orders")
                .withDataType(ColumnDataType.ARRAY)
                .withChildren(
                    List.of(
                        new Column()
                            .withName("id")
                            .withDataType(ColumnDataType.BIGINT)
                            .withDescription("updated")))));
    JsonNode exported = ODCSConverter.toODCSDocument(contract, List.of());
    JsonNode item = exported.at("/schema/0/properties/0/items/properties/0");
    assertEquals("updated", item.path("description").asText());
    assertEquals("BIGINT", item.path("physicalType").asText());
    assertEquals("source", item.at("/customProperties/0/value").asText());
    assertEquals(List.of(), ODCSPublishedSchema.validate(exported));
  }

  @Test
  void clearedRegisteredPropertiesStayAbsentAfterAnExportImportRoundTrip() throws Exception {
    DataContract original = customers();
    original.setExtension(Map.of("costCenter", "ANALYTICS-042"));
    JsonNode source = ODCSConverter.toODCSDocument(original, List.of());
    ((ObjectNode) source)
        .withArray("customProperties")
        .addObject()
        .put("property", "externalOnly")
        .put("value", "preserve me");
    DataContract imported =
        ODCSConverter.fromODCS(
            ODCSLenientReader.readOrReject(JSON, source.deepCopy()),
            original.getEntity(),
            null,
            ODCSImportIssues.discarding(),
            source);

    for (Object cleared : Arrays.asList(null, Map.of(), Map.of("other", 90))) {
      imported.setExtension(cleared);
      JsonNode exported = ODCSConverter.toODCSDocument(imported, List.of(), Set.of("costCenter"));
      assertFalse(exported.path("customProperties").toString().contains("costCenter"));
      assertEquals("preserve me", property(exported, "externalOnly").asText());
      assertEquals(List.of(), ODCSPublishedSchema.validate(exported));
    }
    imported.setExtension(Map.of("costCenter", "UPDATED"));
    assertEquals(
        "UPDATED",
        property(
                ODCSConverter.toODCSDocument(imported, List.of(), Set.of("costCenter")),
                "costCenter")
            .asText());
    assertEquals("ANALYTICS-042", source.at("/customProperties/0/value").asText());
  }

  @Test
  void exportedArrayChildrenAndRulesAreNativeAfterReimportAndStayDeletedWhenRemoved() {
    DataContract original = customers();
    original.setSchema(
        List.of(
            new Column()
                .withName("orders")
                .withDataType(ColumnDataType.ARRAY)
                .withChildren(
                    List.of(new Column().withName("id").withDataType(ColumnDataType.BIGINT)))));
    JsonNode source =
        ODCSConverter.toODCSDocument(
            original,
            List.of(rule("order_id_not_null", "columnValuesToBeNotNull", "orders.id", List.of())));
    DataContract imported =
        ODCSConverter.fromODCS(
            ODCSLenientReader.readOrReject(JSON, source.deepCopy()),
            original.getEntity(),
            null,
            ODCSImportIssues.discarding(),
            source);
    assertEquals("id", imported.getSchema().getFirst().getChildren().getFirst().getName());
    assertEquals("orders.id", imported.getOdcsQualityRules().getFirst().getColumn());
    JsonNode roundTrip = ODCSConverter.toODCSDocument(imported, List.of());
    assertEquals(1, roundTrip.at("/schema/0/properties/0/items/properties/0/quality").size());
    assertFalse(roundTrip.at("/schema/0/properties/0").has("properties"));
    assertEquals(List.of(), ODCSPublishedSchema.validate(roundTrip));
    imported.getSchema().getFirst().setChildren(List.of());
    imported.setOdcsQualityRules(List.of());
    JsonNode removed = ODCSConverter.toODCSDocument(imported, List.of());
    assertEquals(0, removed.at("/schema/0/properties/0/items/properties").size());
    assertEquals(List.of(), ODCSPublishedSchema.validate(removed));
  }

  private static JsonNode property(JsonNode exported, String name) {
    for (JsonNode property : exported.path("customProperties")) {
      if (name.equals(property.path("property").asText())) {
        return property.path("value");
      }
    }
    throw new AssertionError("Missing exported custom property: " + name);
  }

  private static DataContract customers() {
    return new DataContract()
        .withId(UUID.fromString("ec73009a-5eba-49d7-b674-a3b6119f7da3"))
        .withName("customers_native_export_validation")
        .withEntityStatus(EntityStatus.APPROVED)
        .withEntity(
            new EntityReference()
                .withType("table")
                .withName("customers")
                .withFullyQualifiedName(TABLE))
        .withSchema(
            List.of(
                new Column()
                    .withName("customer_id")
                    .withDataType(ColumnDataType.NUMERIC)
                    .withConstraint(ColumnConstraint.PRIMARY_KEY),
                new Column()
                    .withName("customer_name")
                    .withDataType(ColumnDataType.VARCHAR)
                    .withDataLength(200),
                new Column()
                    .withName("preferred_channel")
                    .withDataType(ColumnDataType.VARCHAR)
                    .withDataLength(100),
                new Column()
                    .withName("lifecycle_status")
                    .withDataType(ColumnDataType.VARCHAR)
                    .withDataLength(50)));
  }

  private static ODCSQualityRule rule(
      String name, String definition, String column, List<TestCaseParameterValue> parameters) {
    TestCase test =
        new TestCase()
            .withName(name)
            .withTestDefinition(
                new EntityReference().withName(definition).withFullyQualifiedName(definition))
            .withEntityLink(
                "<#E::table::" + TABLE + (column == null ? "" : "::columns::" + column) + ">")
            .withParameterValues(parameters);
    return ODCSTestCaseExporter.toRule(test, "customers");
  }
}
