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
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.api.data.ContractSLA;
import org.openmetadata.schema.api.data.RefreshFrequency;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSQualityRule;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSQualityRuleArguments;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnConstraint;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;

class ODCSVersionedExportTest {
  private static final ObjectMapper JSON = new ObjectMapper();
  private final ODCSExportService exporter = new ODCSExportService(contract -> List.of());

  @ParameterizedTest
  @ValueSource(strings = {"v3.1.0", "v3.0.2", "v3.0.1", "v3.0.0", "v2.2.2", "v2.2.1"})
  void nativeOwnersColumnsAndCustomPropertiesFollowTheRequestedVersion(String version) {
    DataContract contract =
        contract()
            .withOwners(
                List.of(
                    new EntityReference()
                        .withType("user")
                        .withName("admin")
                        .withDisplayName("Administrator")))
            .withExtension(Map.of("costCenter", "A-42", "retentionDays", 90))
            .withSla(
                new ContractSLA()
                    .withRefreshFrequency(
                        new RefreshFrequency()
                            .withInterval(24)
                            .withUnit(RefreshFrequency.Unit.HOUR)));
    JsonNode doc = exporter.export(contract, version).requireValid();
    assertEquals(version, doc.path("apiVersion").asText());
    assertEquals(2, doc.path("customProperties").size());
    if (version.startsWith("v2")) {
      assertFalse(doc.has("schema"));
      assertEquals(contract.getId().toString(), doc.path("uuid").asText());
      assertEquals("shopify", doc.path("datasetName").asText());
      assertEquals("customers", doc.at("/dataset/0/table").asText());
      assertEquals("customer_id", doc.at("/dataset/0/columns/0/column").asText());
      assertEquals("admin", doc.at("/stakeholders/0/username").asText());
    } else {
      assertEquals("customer_id", doc.at("/schema/0/properties/0/name").asText());
      assertEquals(
          "admin",
          version.equals("v3.1.0")
              ? doc.at("/team/members/0/username").asText()
              : doc.at("/team/0/username").asText());
    }
    assertEquals(24, doc.at("/slaProperties/0/value").asInt());
  }

  @ParameterizedTest
  @ValueSource(strings = {"v3.1.0", "v3.0.2", "v3.0.1", "v3.0.0", "v2.2.2", "v2.2.1"})
  void timestampAndNestedArrayColumnsRetainPhysicalTypesAndChildIdentity(String version) {
    DataContract contract =
        contract()
            .withSchema(
                List.of(
                    new Column().withName("created_at").withDataType(ColumnDataType.TIMESTAMP),
                    new Column()
                        .withName("items")
                        .withDataType(ColumnDataType.ARRAY)
                        .withChildren(
                            List.of(
                                new Column()
                                    .withName("sku")
                                    .withDataType(ColumnDataType.VARCHAR)))));
    JsonNode doc = exporter.export(contract, version).requireValid();
    if (version.startsWith("v2")) {
      JsonNode columns = doc.at("/dataset/0/columns");
      assertEquals("TIMESTAMP", columns.get(0).path("physicalType").asText());
      assertTrue(find(columns, "column", "items.sku").isObject());
    } else {
      assertEquals("TIMESTAMP", doc.at("/schema/0/properties/0/physicalType").asText());
      assertEquals(
          version.equals("v3.1.0") ? "timestamp" : "date",
          doc.at("/schema/0/properties/0/logicalType").asText());
      assertEquals("sku", doc.at("/schema/0/properties/1/items/properties/0/name").asText());
    }
  }

  @ParameterizedTest
  @ValueSource(strings = {"v3.1.0", "v3.0.2", "v3.0.1", "v3.0.0", "v2.2.2", "v2.2.1"})
  void simpleLibraryRulesPreserveTheirAssertionInTheTargetRepresentation(String version) {
    DataContract contract =
        contract()
            .withOdcsQualityRules(
                List.of(
                    new ODCSQualityRule()
                        .withType(ODCSQualityRule.Type.LIBRARY)
                        .withName("id_not_null")
                        .withColumn("customer_id")
                        .withMetric(ODCSQualityRule.OdcsQualityMetric.NULL_VALUES)
                        .withMustBe(0.0)));
    JsonNode doc = exporter.export(contract, version).requireValid();
    if (version.startsWith("v2")) {
      JsonNode rule = doc.at("/dataset/0/quality/0");
      assertEquals("columnValuesToBeNotNull", rule.path("templateName").asText());
      assertEquals("openmetadata", rule.path("toolName").asText());
      assertEquals("customer_id", rule.path("column").asText());
      assertEquals(0, rule.at("/customProperties/0/value/mustBe").asInt());
    } else {
      JsonNode rule = doc.at("/schema/0/properties/0/quality/0");
      assertEquals(0, rule.path("mustBe").asInt());
      assertEquals(
          version.equals("v3.1.0") ? "nullValues" : "nullCount",
          rule.path(version.equals("v3.1.0") ? "metric" : "rule").asText());
      if (!version.equals("v3.1.0")) assertFalse(rule.has("metric"));
    }
  }

  @ParameterizedTest
  @ValueSource(strings = {"v3.0.2", "v3.0.1", "v3.0.0", "v2.2.2", "v2.2.1"})
  void richerQualityRulesKeepAllParametersInACustomRepresentation(String version) {
    ODCSQualityRule rule =
        new ODCSQualityRule()
            .withName("valid_id")
            .withColumn("customer_id")
            .withType(ODCSQualityRule.Type.LIBRARY)
            .withMetric(ODCSQualityRule.OdcsQualityMetric.INVALID_VALUES)
            .withArguments(new ODCSQualityRuleArguments().withPattern("^[0-9]+$"))
            .withMustBeLessOrEqualTo(5.0)
            .withUnit("percent");
    JsonNode doc =
        exporter.export(contract().withOdcsQualityRules(List.of(rule)), version).requireValid();
    JsonNode quality =
        version.startsWith("v2")
            ? doc.at("/dataset/0/quality/0")
            : doc.at("/schema/0/properties/0/quality/0");
    assertTrue(quality.toString().contains("^[0-9]+$"), quality.toString());
    if (version.startsWith("v3")) {
      assertEquals("custom", quality.path("type").asText());
      assertEquals("openmetadata", quality.path("engine").asText());
      assertTrue(quality.path("implementation").asText().contains("testDefinition"));
    }
  }

  @ParameterizedTest
  @ValueSource(strings = {"v3.1.0", "v3.0.2", "v3.0.1", "v3.0.0", "v2.2.2", "v2.2.1"})
  void preservedColumnMetadataFollowsNativeColumnReordering(String version) {
    DataContract contract = contract();
    ObjectNode baseline = (ObjectNode) ODCSExportService.nativeDocument(contract, List.of());
    ObjectNode source = baseline.deepCopy();
    ((ObjectNode) source.at("/schema/0/properties/0"))
        .withArray("customProperties")
        .addObject()
        .put("property", "externalMetadata")
        .put("value", "retained");
    contract.setOdcsPreservedFields(ODCSPreservedFields.capture(source, baseline, "customers"));
    contract.setSchema(List.of(contract.getSchema().getLast(), contract.getSchema().getFirst()));
    JsonNode doc = exporter.export(contract, version).requireValid();
    JsonNode property =
        version.startsWith("v2")
            ? find(doc.at("/dataset/0/columns"), "column", "customer_id")
            : find(doc.at("/schema/0/properties"), "name", "customer_id");
    assertEquals("retained", property.at("/customProperties/0/value").asText());
  }

  @ParameterizedTest
  @ValueSource(strings = {"v2.2.2", "v2.2.1"})
  void literalDotsInColumnNamesDoNotStealMetadataFromNestedPaths(String version) {
    DataContract contract =
        contract()
            .withSchema(
                List.of(
                    new Column().withName("customer.id").withDataType(ColumnDataType.VARCHAR),
                    new Column()
                        .withName("address")
                        .withDataType(ColumnDataType.STRUCT)
                        .withChildren(
                            List.of(
                                new Column()
                                    .withName("line.one")
                                    .withDataType(ColumnDataType.VARCHAR)))));
    ObjectNode baseline = (ObjectNode) ODCSExportService.nativeDocument(contract, List.of());
    ObjectNode source = baseline.deepCopy();
    ((ObjectNode) source.at("/schema/0/properties/0"))
        .withArray("customProperties")
        .addObject()
        .put("property", "identity")
        .put("value", "literal");
    ((ObjectNode) source.at("/schema/0/properties/1/properties/0"))
        .withArray("customProperties")
        .addObject()
        .put("property", "identity")
        .put("value", "nested");
    contract.setOdcsPreservedFields(ODCSPreservedFields.capture(source, baseline, "customers"));
    JsonNode doc = exporter.export(contract, version).requireValid();
    assertEquals(
        "literal",
        find(doc.at("/dataset/0/columns"), "column", "\"customer.id\"")
            .at("/customProperties/0/value")
            .asText());
    assertEquals(
        "nested",
        find(doc.at("/dataset/0/columns"), "column", "address.\"line.one\"")
            .at("/customProperties/0/value")
            .asText());
  }

  @ParameterizedTest
  @ValueSource(strings = {"v3.0.1", "v3.0.0"})
  void aDistinctPreservedPhysicalNameIsReportedRatherThanSilentlyDiscarded(String version) {
    DataContract contract = contract();
    ObjectNode baseline = (ObjectNode) ODCSExportService.nativeDocument(contract, List.of());
    ObjectNode source = baseline.deepCopy();
    ((ObjectNode) source.at("/schema/0/properties/0")).put("physicalName", "source_id");
    contract.setOdcsPreservedFields(ODCSPreservedFields.capture(source, baseline, "customers"));
    ODCSExportService.Result result = exporter.export(contract, version);
    assertFalse(result.valid());
    assertTrue(result.issues().stream().anyMatch(issue -> issue.contains("physicalName")));
    assertTrue(contract.getOdcsPreservedFields().path("document").asText().contains("source_id"));
  }

  @ParameterizedTest
  @ValueSource(strings = {"v2.2.2", "v2.2.1"})
  void primitiveArrayElementTypesSurviveTheLegacyOpenExtensionFields(String version) {
    DataContract contract =
        contract()
            .withSchema(
                List.of(
                    new Column()
                        .withName("quantities")
                        .withDataType(ColumnDataType.ARRAY)
                        .withArrayDataType(ColumnDataType.INT)));
    JsonNode doc = exporter.export(contract, version).requireValid();
    assertEquals("INT", doc.at("/dataset/0/columns/0/items/physicalType").asText());
    assertEquals("integer", doc.at("/dataset/0/columns/0/items/logicalType").asText());
  }

  @ParameterizedTest
  @ValueSource(strings = {"v3.0.2", "v3.0.1", "v3.0.0"})
  void nativeTestIdsRemainMetadataInsteadOfChangingLibraryExecution(String version) {
    String id = UUID.randomUUID().toString();
    ODCSQualityRule rule =
        new ODCSQualityRule()
            .withId(id)
            .withName("id_not_null")
            .withColumn("customer_id")
            .withType(ODCSQualityRule.Type.LIBRARY)
            .withMetric(ODCSQualityRule.OdcsQualityMetric.NULL_VALUES)
            .withMustBe(0.0);
    JsonNode doc =
        exporter.export(contract().withOdcsQualityRules(List.of(rule)), version).requireValid();
    JsonNode quality = doc.at("/schema/0/properties/0/quality/0");
    assertEquals("library", quality.path("type").asText());
    assertEquals("nullCount", quality.path("rule").asText());
    assertEquals(
        id, find(quality.path("customProperties"), "property", "odcsId").path("value").asText());
  }

  @ParameterizedTest
  @ValueSource(strings = {"v2.2.2", "v2.2.1"})
  void unconstrainedNativeColumnsRemainNullableInTheLegacySchema(String version) {
    JsonNode doc = exporter.export(contract(), version).requireValid();
    assertFalse(
        find(doc.at("/dataset/0/columns"), "column", "customer_id").path("isNullable").asBoolean());
    assertTrue(
        find(doc.at("/dataset/0/columns"), "column", "customer_name")
            .path("isNullable")
            .asBoolean());
  }

  @ParameterizedTest
  @ValueSource(strings = {"v3.1.0", "v3.0.2", "v3.0.1", "v3.0.0", "v2.2.2", "v2.2.1"})
  void qualityOnALiteralDottedColumnDoesNotCreateAnotherColumn(String version) {
    DataContract contract =
        contract()
            .withSchema(
                List.of(new Column().withName("customer.id").withDataType(ColumnDataType.VARCHAR)))
            .withOdcsQualityRules(
                List.of(
                    new ODCSQualityRule()
                        .withName("id_not_null")
                        .withColumn("\"customer.id\"")
                        .withType(ODCSQualityRule.Type.LIBRARY)
                        .withMetric(ODCSQualityRule.OdcsQualityMetric.NULL_VALUES)
                        .withMustBe(0.0)));
    JsonNode doc = exporter.export(contract, version).requireValid();
    if (version.startsWith("v2")) {
      assertEquals(1, doc.at("/dataset/0/columns").size());
      assertEquals("VARCHAR", doc.at("/dataset/0/columns/0/physicalType").asText());
      assertEquals("\"customer.id\"", doc.at("/dataset/0/quality/0/column").asText());
    } else {
      assertEquals(1, doc.at("/schema/0/properties").size());
      assertEquals("customer.id", doc.at("/schema/0/properties/0/name").asText());
      assertEquals(1, doc.at("/schema/0/properties/0/quality").size());
    }
  }

  @ParameterizedTest
  @ValueSource(strings = {"v3.1.0", "v3.0.2", "v3.0.1", "v3.0.0", "v2.2.2", "v2.2.1"})
  void incompatibleSavedContainerShapesCannotReplaceNativeColumns(String version) {
    DataContract contract = contract();
    ObjectNode baseline = (ObjectNode) ODCSExportService.nativeDocument(contract, List.of());
    ObjectNode source = baseline.deepCopy();
    ((ObjectNode) source.at("/schema/0"))
        .set("properties", JSON.createObjectNode().put("futurePropertyMap", "retained"));
    contract.setOdcsPreservedFields(ODCSPreservedFields.capture(source, baseline, "customers"));
    JsonNode document = exporter.export(contract, version).requireValid();
    assertEquals(
        2,
        document
            .at(version.startsWith("v2") ? "/dataset/0/columns" : "/schema/0/properties")
            .size());
    assertTrue(
        contract.getOdcsPreservedFields().path("document").asText().contains("futurePropertyMap"));
  }

  @ParameterizedTest
  @ValueSource(strings = {"v3.0.2", "v3.0.1", "v3.0.0", "v2.2.2", "v2.2.1"})
  void malformedUnappliedNodesProduceValidationIssuesInsteadOfCastErrors(String version) {
    DataContract contract = contract();
    ObjectNode baseline = (ObjectNode) ODCSExportService.nativeDocument(contract, List.of());
    ObjectNode source = baseline.deepCopy();
    ((ObjectNode) source.at("/schema/0")).withArray("properties").add("bad column");
    source.withArray("schema").add("bad table");
    source.withArray("roles").add("bad role");
    source.withArray("slaProperties").add("bad SLA");
    contract.setOdcsPreservedFields(ODCSPreservedFields.capture(source, baseline, "customers"));
    ODCSExportService.Result result = exporter.export(contract, version);
    assertFalse(result.valid());
    assertFalse(result.issues().isEmpty());
  }

  @ParameterizedTest
  @ValueSource(strings = {"v3.0.2", "v3.0.1", "v3.0.0"})
  void implicitTextRulesGetAnExplicitTypeForLegacyConditionalSchemas(String version) {
    ODCSQualityRule rule =
        new ODCSQualityRule()
            .withName("steward_review")
            .withDescription("Review with the steward")
            .withType(null);
    JsonNode doc =
        exporter.export(contract().withOdcsQualityRules(List.of(rule)), version).requireValid();
    assertEquals("text", doc.at("/schema/0/quality/0/type").asText());
  }

  @ParameterizedTest
  @ValueSource(strings = {"v3.1.0", "v3.0.2", "v3.0.1", "v3.0.0", "v2.2.2", "v2.2.1"})
  void importedTableRulesFollowTheTargetTableAfterARename(String version) {
    DataContract contract = contract();
    ObjectNode source = (ObjectNode) ODCSExportService.nativeDocument(contract, List.of());
    ((ObjectNode) source.at("/schema/0"))
        .withArray("quality")
        .add(JSON.valueToTree(rowCountRule()));
    contract.setOdcsQualityRules(List.of(rowCountRule().withColumn("customers")));
    contract.getEntity().setName("customer");
    contract.getEntity().setFullyQualifiedName("sample_data.ecommerce_db.shopify.customer");
    contract.setOdcsPreservedFields(
        ODCSPreservedFields.capture(
            source, ODCSExportService.nativeDocument(contract, List.of()), "customers"));

    JsonNode doc = exporter.export(contract, version).requireValid();
    String table = version.startsWith("v2") ? "/dataset/0" : "/schema/0";
    assertEquals(2, doc.at(table + (version.startsWith("v2") ? "/columns" : "/properties")).size());
    assertEquals(1, doc.at(table + "/quality").size());
    assertEquals("customers", contract.getOdcsQualityRules().getFirst().getColumn());
    assertTrue(contract.getOdcsPreservedFields().path("document").asText().contains("rowCount"));
  }

  @ParameterizedTest
  @ValueSource(strings = {"v3.0.2", "v3.0.1", "v3.0.0"})
  void preservedOnlyLegacyRowCountRulesBecomeMetricsAfterMetadataRestoration(String sourceVersion) {
    DataContract contract = contract();
    ObjectNode source =
        (ObjectNode)
            exporter
                .export(contract.withOdcsQualityRules(List.of(rowCountRule())), sourceVersion)
                .requireValid();
    contract.setOdcsQualityRules(null);
    ObjectNode baseline = (ObjectNode) ODCSExportService.nativeDocument(contract, List.of());
    contract.setOdcsPreservedFields(
        ODCSPreservedFields.capture(
            ODCSProfiles.adapter(sourceVersion).preservationView(source), baseline, "customers"));
    JsonNode exported = exporter.export(contract, "v3.1.0").requireValid();
    assertEquals("rowCount", exported.at("/schema/0/quality/0/metric").asText());
    assertEquals(1, exported.at("/schema/0/quality/0/mustBeGreaterOrEqualTo").asInt());
  }

  @ParameterizedTest
  @ValueSource(strings = {"v3.0.2", "v3.0.1", "v3.0.0", "v2.2.2", "v2.2.1"})
  void preservedOnlyLibraryRulesAreConvertedAfterMetadataRestoration(String version) {
    DataContract contract = contract();
    ObjectNode baseline = (ObjectNode) ODCSExportService.nativeDocument(contract, List.of());
    ObjectNode source = baseline.deepCopy();
    ((ObjectNode) source.at("/schema/0"))
        .withArray("quality")
        .add(JSON.valueToTree(rowCountRule()));
    contract.setOdcsPreservedFields(ODCSPreservedFields.capture(source, baseline, "customers"));

    JsonNode doc = exporter.export(contract, version).requireValid();
    JsonNode quality =
        doc.at(version.startsWith("v2") ? "/dataset/0/quality" : "/schema/0/quality");
    assertEquals(1, quality.size());
    JsonNode rule = quality.get(0);
    if (version.startsWith("v2")) {
      assertEquals("tableRowCountToBeBetween", rule.path("templateName").asText());
      assertEquals("rowCount", rule.at("/customProperties/0/value/metric").asText());
    } else {
      assertEquals("rowCount", rule.path("rule").asText());
      assertEquals(1, rule.path("mustBeGreaterOrEqualTo").asInt());
      assertFalse(rule.has("metric"));
    }
  }

  @ParameterizedTest
  @ValueSource(strings = {"v2.2.2", "v2.2.1"})
  void datasetDescriptionsUseTheShapeOfTheirPublishedPatchVersion(String version) {
    DataContract contract = contract();
    contract.getEntity().setDescription("Native table description");
    JsonNode nativeDocument = exporter.export(contract, version).requireValid();
    JsonNode nativeDescription = nativeDocument.at("/dataset/0/description");
    assertEquals(version.equals("v2.2.1"), nativeDescription.isArray());
    assertEquals(
        "Native table description",
        nativeDescription.isArray()
            ? nativeDescription.get(0).asText()
            : nativeDescription.asText());

    ObjectNode baseline = (ObjectNode) ODCSExportService.nativeDocument(contract, List.of());
    ObjectNode source = baseline.deepCopy();
    ((ObjectNode) source.at("/schema/0")).put("description", "Imported table description");
    contract.setOdcsPreservedFields(ODCSPreservedFields.capture(source, baseline, "customers"));
    JsonNode preservedDescription =
        exporter.export(contract, version).requireValid().at("/dataset/0/description");
    assertEquals(version.equals("v2.2.1"), preservedDescription.isArray());
    assertEquals(
        "Imported table description",
        preservedDescription.isArray()
            ? preservedDescription.get(0).asText()
            : preservedDescription.asText());
  }

  private static ODCSQualityRule rowCountRule() {
    return new ODCSQualityRule()
        .withName("customers_table_not_empty")
        .withType(ODCSQualityRule.Type.LIBRARY)
        .withMetric(ODCSQualityRule.OdcsQualityMetric.ROW_COUNT)
        .withMustBeGreaterOrEqualTo(1.0);
  }

  @Test
  void malformedRequiredSchemaRetainsItsResourcePathAndOriginalCause() {
    IllegalArgumentException error =
        assertThrows(
            IllegalArgumentException.class,
            () -> ODCSExportModelWriter.requiredSchema("/odcs/malformed-schema.txt"));
    assertTrue(error.getMessage().contains("/odcs/malformed-schema.txt"));
    assertTrue(error.getCause() instanceof IOException);
  }

  @Test
  void unavailableSchemaAndGeneratedModelsFailWithTheirProfileNames() {
    IllegalArgumentException model =
        assertThrows(IllegalArgumentException.class, () -> ODCSExportModelWriter.model("v9.9.9"));
    IllegalArgumentException schema =
        assertThrows(IllegalArgumentException.class, () -> ODCSExportModelWriter.schema("v9.9.9"));
    assertTrue(model.getMessage().contains("v9.9.9"));
    assertTrue(schema.getMessage().contains("v9.9.9"));
  }

  @Test
  void unpublishedAndUnknownProfilesAreNotAdvertisedAsSupported() {
    assertThrows(IllegalArgumentException.class, () -> exporter.export(contract(), "v2.2.0"));
    assertThrows(IllegalArgumentException.class, () -> exporter.export(contract(), "v3.2.0"));
  }

  private static JsonNode find(JsonNode entries, String key, String name) {
    for (JsonNode entry : entries) if (name.equals(entry.path(key).asText())) return entry;
    return JSON.missingNode();
  }

  private static DataContract contract() {
    return new DataContract()
        .withId(UUID.randomUUID())
        .withName("customers_contract")
        .withEntityStatus(EntityStatus.APPROVED)
        .withEntity(
            new EntityReference()
                .withType("table")
                .withName("customers")
                .withFullyQualifiedName("sample_data.ecommerce_db.shopify.customers"))
        .withSchema(
            List.of(
                new Column()
                    .withName("customer_id")
                    .withDataType(ColumnDataType.BIGINT)
                    .withConstraint(ColumnConstraint.NOT_NULL),
                new Column()
                    .withName("customer_name")
                    .withDataType(ColumnDataType.VARCHAR)
                    .withDataLength(200)));
  }
}
