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
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.dataformat.yaml.YAMLMapper;
import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSCustomProperty;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSQualityRule;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSQualityRuleArguments;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnConstraint;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.service.util.ODCSConverter;

class ODCSVersionedImportTest {
  private static final ObjectMapper JSON = new ObjectMapper();
  private final ODCSExportService exporter = new ODCSExportService(contract -> List.of());

  static Stream<Arguments> unchangedLibraryNames() {
    return Stream.of("v3.0.0", "v3.0.1", "v3.0.2")
        .flatMap(
            version ->
                Stream.of(
                        "rowCount",
                        "nullValues",
                        "duplicateValues",
                        "missingValues",
                        "invalidValues")
                    .map(metric -> Arguments.of(version, metric)));
  }

  @ParameterizedTest
  @MethodSource("unchangedLibraryNames")
  void libraryNamesThatAlreadyMatchPublishedMetricsBecomeNativeMetrics(
      String version, String metric) {
    ObjectNode source = (ObjectNode) exporter.export(contract(), version).requireValid();
    ((ObjectNode) source.at("/schema/0/properties/0/quality/0")).put("rule", metric);
    DataContract imported = read(source, contract().getEntity());
    assertEquals(
        ODCSQualityRule.OdcsQualityMetric.fromValue(metric),
        imported.getOdcsQualityRules().getFirst().getMetric());
    JsonNode exported = exporter.export(imported, "v3.1.0").requireValid();
    assertEquals(metric, exported.at("/schema/0/properties/0/quality/0/metric").asText());
  }

  @ParameterizedTest
  @ValueSource(strings = {"v3.1.0", "v3.0.2", "v3.0.1", "v3.0.0", "v2.2.2", "v2.2.1"})
  void nativeExportImportsWithTheSameColumnsStatusAndQuality(String version) {
    DataContract nativeContract = contract();
    JsonNode document = exporter.export(nativeContract, version).requireValid();
    DataContract imported = read(document, nativeContract.getEntity());
    assertEquals(EntityStatus.DRAFT, imported.getEntityStatus());
    assertEquals(3, imported.getSchema().size());
    assertEquals(ColumnConstraint.NOT_NULL, imported.getSchema().getFirst().getConstraint());
    assertEquals(ColumnDataType.INT, imported.getSchema().get(1).getArrayDataType());
    assertEquals("literal.dot", imported.getSchema().get(2).getName());
    assertEquals("external-check-id", imported.getOdcsQualityRules().getFirst().getId());
    assertEquals(0.0, imported.getOdcsQualityRules().getFirst().getMustBe());
    assertTrue(exporter.export(imported, version).valid());
    assertEquals(version, imported.getOdcsPreservedFields().path("sourceVersion").asText());
  }

  @Test
  void missingDeclaredVersionIsRejectedRatherThanDefaulted() {
    ObjectNode document = (ObjectNode) exporter.export(contract(), "v3.1.0").requireValid();
    document.remove("apiVersion");
    assertThrows(IllegalArgumentException.class, () -> read(document, contract().getEntity()));
  }

  @ParameterizedTest
  @ValueSource(strings = {"v2.2.2", "v2.2.1"})
  void legacyChildrenBeforeParentsRetainNestedIdentityAndDefaultNullability(String version) {
    DataContract nativeContract =
        contract()
            .withOdcsQualityRules(null)
            .withSchema(
                List.of(
                    new Column()
                        .withName("items")
                        .withDataType(ColumnDataType.ARRAY)
                        .withChildren(
                            List.of(
                                new Column()
                                    .withName("sku.code")
                                    .withDataType(ColumnDataType.VARCHAR)))));
    ObjectNode source = (ObjectNode) exporter.export(nativeContract, version).requireValid();
    var columns = (ArrayNode) source.at("/dataset/0/columns");
    JsonNode parent = columns.remove(0);
    columns.add(parent);
    ((ObjectNode) columns.get(0)).remove("isNullable");
    DataContract imported = read(source, nativeContract.getEntity());
    assertEquals(ColumnDataType.ARRAY, imported.getSchema().getFirst().getDataType());
    Column child = imported.getSchema().getFirst().getChildren().getFirst();
    assertEquals("sku.code", child.getName());
    assertEquals(ColumnConstraint.NOT_NULL, child.getConstraint());
    assertTrue(exporter.export(imported, version).valid());
  }

  @ParameterizedTest
  @ValueSource(strings = {"v2.2.2", "v2.2.1"})
  void externalLegacyQualityCodeAndUnknownMetadataSurviveWithoutBecomingANativeCheck(
      String version) {
    ObjectNode source =
        (ObjectNode) exporter.export(contract().withOdcsQualityRules(null), version).requireValid();
    ObjectNode table = (ObjectNode) source.at("/dataset/0");
    table
        .withArray("quality")
        .addObject()
        .put("templateName", "customer_check")
        .put("toolName", "soda")
        .put("code", "checks for customers: []")
        .put("column", "id")
        .putObject("vendorOptions")
        .put("retry", 3);
    DataContract imported = read(source, contract().getEntity());
    assertEquals("soda", imported.getOdcsQualityRules().getFirst().getEngine());
    JsonNode roundTrip =
        exporter.export(imported, version).requireValid().at("/dataset/0/quality/0");
    assertEquals("checks for customers: []", roundTrip.path("code").asText());
    assertEquals(3, roundTrip.at("/vendorOptions/retry").asInt());
    assertTrue(
        ODCSQualityRuleMapper.map(
                    imported.getOdcsQualityRules(), new ODCSTableTarget("customers", List.of("id")))
                .getFirst()
            instanceof ODCSRuleOutcome.UnsupportedOutcome);
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "\"42\"",
        "true",
        "null",
        "{\"result\":\"ok\"}",
        "9007199254740993",
        "[1,2]",
        "[]",
        "[true]"
      })
  void arbitraryJsonAssertionsArePreservedWithoutNumericCoercion(String assertion)
      throws Exception {
    ObjectNode source =
        (ObjectNode)
            exporter.export(contract().withOdcsQualityRules(null), "v3.1.0").requireValid();
    ObjectNode rule =
        ((ObjectNode) source.at("/schema/0/properties/0"))
            .withArray("quality")
            .addObject()
            .put("name", "external_assertion")
            .put("type", "sql")
            .put("query", "SELECT 1");
    rule.set("mustBe", JSON.readTree(assertion));
    DataContract imported = read(source, contract().getEntity());
    assertTrue(
        ODCSQualityRuleMapper.map(
                    imported.getOdcsQualityRules(), new ODCSTableTarget("customers", List.of("id")))
                .getFirst()
            instanceof ODCSRuleOutcome.UnsupportedOutcome);
    assertEquals(
        JSON.readTree(assertion),
        exporter
            .export(imported, "v3.1.0")
            .requireValid()
            .at("/schema/0/properties/0/quality/0/mustBe"));
  }

  @Test
  void invalidProfileAndVersionDiagnosticsDoNotMutateTheCallerDocument() {
    ObjectNode source = (ObjectNode) exporter.export(contract(), "v3.1.0").requireValid();
    ((ObjectNode) source.at("/schema/0/properties/0")).put("logicalType", "not-a-type");
    JsonNode before = source.deepCopy();
    String invalid =
        assertThrows(IllegalArgumentException.class, () -> read(source, contract().getEntity()))
            .getMessage();
    assertTrue(invalid.contains("Invalid ODCS v3.1.0"));
    assertTrue(invalid.contains("logicalType"));
    assertEquals(before, source);
    for (String version : List.of("3.1.0", "v2.2.0", "v3.2.0")) {
      source.put("apiVersion", version);
      String error =
          assertThrows(IllegalArgumentException.class, () -> read(source, contract().getEntity()))
              .getMessage();
      assertTrue(error.contains(version.equals("3.1.0") ? "Malformed" : "Unsupported"));
    }
  }

  @Test
  void selectingAnObjectDoesNotImportTheQualityRulesOfAnotherObject() {
    ObjectNode source = (ObjectNode) exporter.export(contract(), "v3.1.0").requireValid();
    ObjectNode other = source.at("/schema/0").deepCopy();
    other.put("name", "other_table");
    ((ObjectNode) other.at("/properties/0/quality/0")).put("name", "other_check");
    ((ArrayNode) source.path("schema")).add(other);
    DataContract imported = read(source, contract().getEntity());
    assertEquals(
        List.of("id_not_null"),
        imported.getOdcsQualityRules().stream().map(ODCSQualityRule::getName).toList());
  }

  @Test
  void priorOpenMetadataQualityAliasesRemainReadableWithUnmappedServers() throws Exception {
    var yaml = new YAMLMapper();
    JsonNode source =
        yaml.readTree(getClass().getResourceAsStream("/odcs/legacy-openmetadata-quality.yaml"));
    ODCSImportService.Document prepared = ODCSImportService.readOrReject(yaml, source);
    DataContract imported =
        ODCSConverter.fromODCS(
            prepared.contract(),
            contract().getEntity(),
            null,
            ODCSImportIssues.discarding(),
            prepared.original());
    assertEquals(9, imported.getOdcsQualityRules().size());
  }

  @ParameterizedTest
  @ValueSource(strings = {"v3.1.0", "v3.0.2", "v3.0.1", "v3.0.0", "v2.2.2", "v2.2.1"})
  void nativeArrayTypeEditsAndDeletionDoNotRestoreTheImportedItemType(String version) {
    DataContract imported =
        read(exporter.export(contract(), version).requireValid(), contract().getEntity());
    imported.getSchema().get(1).setArrayDataType(ColumnDataType.BOOLEAN);
    String path =
        version.startsWith("v2") ? "/dataset/0/columns/1/items" : "/schema/0/properties/1/items";
    JsonNode edited = exporter.export(imported, version).requireValid().at(path);
    assertEquals("boolean", edited.path("logicalType").asText());
    assertEquals("BOOLEAN", edited.path("physicalType").asText());
    imported.getSchema().get(1).setArrayDataType(null);
    assertTrue(exporter.export(imported, version).requireValid().at(path).isMissingNode());
  }

  @Test
  void editingANativelyPreservedAssertionSupersedesItsOldWireRepresentation() throws Exception {
    ObjectNode source =
        (ObjectNode)
            exporter.export(contract().withOdcsQualityRules(null), "v3.1.0").requireValid();
    ((ObjectNode) source.at("/schema/0/properties/0"))
        .withArray("quality")
        .addObject()
        .put("name", "assertion")
        .put("type", "sql")
        .put("query", "SELECT 1")
        .put("mustBe", "PASS");
    DataContract imported = read(source, contract().getEntity());
    imported.getOdcsQualityRules().getFirst().setImplementation("native edit");
    JsonNode edited =
        exporter.export(imported, "v3.1.0").requireValid().at("/schema/0/properties/0/quality/0");
    assertEquals("custom", edited.path("type").asText());
    assertEquals("native edit", edited.path("implementation").asText());
    assertTrue(edited.path("mustBe").isMissingNode());
  }

  @Test
  void invalidServerConfigurationIsNotDiscardedToPassValidation() throws Exception {
    var yaml = new YAMLMapper();
    ObjectNode source =
        (ObjectNode)
            yaml.readTree(getClass().getResourceAsStream("/odcs/legacy-openmetadata-quality.yaml"));
    ((ObjectNode) source.at("/servers/0")).remove("account");
    String error =
        assertThrows(IllegalArgumentException.class, () -> read(source, contract().getEntity()))
            .getMessage();
    assertTrue(error.contains("account"));
  }

  @Test
  void legacyRootQualityCannotInventAColumnToSatisfyItsReference() {
    ObjectNode source =
        (ObjectNode)
            exporter.export(contract().withOdcsQualityRules(null), "v3.1.0").requireValid();
    source
        .withArray("quality")
        .addObject()
        .put("name", "missing")
        .put("column", "unknown_column")
        .put("metric", "nullValues")
        .put("mustBe", 0);
    String error =
        assertThrows(IllegalArgumentException.class, () -> read(source, contract().getEntity()))
            .getMessage();
    assertTrue(error.contains("unknown_column"));
    assertEquals(3, source.at("/schema/0/properties").size());
  }

  @ParameterizedTest
  @ValueSource(strings = {"v3.1.0", "v3.0.2", "v3.0.1", "v3.0.0", "v2.2.2", "v2.2.1"})
  void sparseNativeDocumentsAreAcceptedWithoutInventingColumnsOrRules(String version) {
    DataContract fixture = contract().withSchema(List.of()).withOdcsQualityRules(null);
    DataContract imported =
        read(exporter.export(fixture, version).requireValid(), fixture.getEntity());
    assertTrue(imported.getSchema() == null || imported.getSchema().isEmpty());
    assertTrue(imported.getOdcsQualityRules() == null || imported.getOdcsQualityRules().isEmpty());
    assertTrue(exporter.export(imported, version).valid());
  }

  @Test
  void legacyQualityNormalizationDoesNotHideOtherInvalidQualityFields() {
    for (String field : List.of("unexpectedField", "type", "mustBeGreaterThan", "dimension")) {
      ObjectNode source =
          (ObjectNode)
              exporter.export(contract().withOdcsQualityRules(null), "v3.1.0").requireValid();
      ObjectNode rule =
          ((ObjectNode) source.at("/schema/0"))
              .withArray("quality")
              .addObject()
              .put("metric", "freshness")
              .put("mustBeLessOrEqualTo", 2)
              .put("unit", "hours");
      rule.put(field, "invalid");
      assertThrows(
          IllegalArgumentException.class, () -> read(source, contract().getEntity()), field);
    }
  }

  @Test
  void legacyDescriptionArraysArePreservedAsArraysRatherThanJoinedInStorage() {
    ObjectNode source = (ObjectNode) exporter.export(contract(), "v2.2.1").requireValid();
    ((ObjectNode) source.at("/dataset/0"))
        .putArray("description")
        .add("First paragraph")
        .add("Second paragraph");
    DataContract imported = read(source, contract().getEntity());
    assertEquals(
        source.at("/dataset/0/description"),
        exporter.export(imported, "v2.2.1").requireValid().at("/dataset/0/description"));
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "{\"arguments\":\"invalid\"}",
        "{\"mustBeBetween\":[1]}",
        "{\"engine\":42}",
        "{\"query\":42}",
        "{\"validValues\":[{}]}"
      })
  void legacyCompatibilityCannotLaunderMalformedRulePayloads(String fields) throws Exception {
    ObjectNode source =
        (ObjectNode)
            exporter.export(contract().withOdcsQualityRules(null), "v3.1.0").requireValid();
    ObjectNode rule =
        ((ObjectNode) source.at("/schema/0"))
            .withArray("quality")
            .addObject()
            .put("metric", "freshness");
    rule.setAll((ObjectNode) JSON.readTree(fields));
    assertThrows(IllegalArgumentException.class, () -> read(source, contract().getEntity()));
  }

  @Test
  void oldSharedPojoDefaultsAreNormalizedOnlyWhenTheyMatchTheDeclaredDefaults() {
    ObjectNode source = (ObjectNode) exporter.export(contract(), "v3.1.0").requireValid();
    ObjectNode table = (ObjectNode) source.at("/schema/0");
    table.put("primaryKeyPosition", -1).put("partitionKeyPosition", -1).put("required", false);
    assertEquals(3, read(source, contract().getEntity()).getSchema().size());
    table.put("primaryKeyPosition", 4294967296L);
    assertThrows(IllegalArgumentException.class, () -> read(source, contract().getEntity()));
  }

  @ParameterizedTest
  @ValueSource(strings = {"v3.0.2", "v3.0.1", "v3.0.0"})
  void editingNativeArgumentsAndThresholdsSupersedesTheLegacyCustomWrapper(String version) {
    DataContract fixture =
        contract()
            .withOdcsQualityRules(
                List.of(
                    new ODCSQualityRule()
                        .withName("validate_id")
                        .withColumn("id")
                        .withType(ODCSQualityRule.Type.LIBRARY)
                        .withMetric(ODCSQualityRule.OdcsQualityMetric.INVALID_VALUES)
                        .withArguments(new ODCSQualityRuleArguments().withPattern("^[0-9]+$"))
                        .withMustBe(0.0)));
    DataContract imported =
        read(exporter.export(fixture, version).requireValid(), fixture.getEntity());
    ODCSQualityRule rule = imported.getOdcsQualityRules().getFirst();
    assertEquals(ODCSQualityRule.Type.LIBRARY, rule.getType());
    rule.getArguments().setPattern("^[A-Z]+$");
    rule.setMustBe(7.0);
    JsonNode edited =
        exporter.export(imported, "v3.1.0").requireValid().at("/schema/0/properties/0/quality/0");
    assertEquals("library", edited.path("type").asText());
    assertEquals("^[A-Z]+$", edited.at("/arguments/pattern").asText());
    assertEquals(7, edited.path("mustBe").asInt());
    assertTrue(edited.path("implementation").isMissingNode());
  }

  @Test
  void v31CustomPropertiesNamedOdcsIdAreNotReinterpretedAsRuleIdentity() {
    ObjectNode source = (ObjectNode) exporter.export(contract(), "v3.1.0").requireValid();
    ObjectNode rule = (ObjectNode) source.at("/schema/0/properties/0/quality/0");
    rule.remove("id");
    rule.withArray("customProperties")
        .addObject()
        .put("property", "odcsId")
        .put("value", "user-owned");
    DataContract imported = read(source, contract().getEntity());
    assertEquals(null, imported.getOdcsQualityRules().getFirst().getId());
    assertEquals(
        "user-owned",
        exporter
            .export(imported, "v3.1.0")
            .requireValid()
            .at("/schema/0/properties/0/quality/0/customProperties/0/value")
            .asText());
  }

  @ParameterizedTest
  @ValueSource(strings = {"v3.0.2", "v3.0.1", "v3.0.0"})
  void legacyIdentityIsDecodedOnceWithoutRemovingAnEarlierUserProperty(String version) {
    ObjectNode source = (ObjectNode) exporter.export(contract(), version).requireValid();
    ObjectNode rule = (ObjectNode) source.at("/schema/0/properties/0/quality/0");
    ((ArrayNode) rule.path("customProperties"))
        .insertObject(0)
        .put("property", "odcsId")
        .put("value", "user-owned");
    DataContract imported = read(source, contract().getEntity());
    assertEquals("external-check-id", imported.getOdcsQualityRules().getFirst().getId());
    assertEquals(1, imported.getOdcsQualityRules().getFirst().getCustomProperties().size());
    assertEquals(
        "user-owned",
        exporter
            .export(imported, "v3.1.0")
            .requireValid()
            .at("/schema/0/properties/0/quality/0/customProperties/0/value")
            .asText());
  }

  @Test
  void legacyFlatColumnsAndTypeAliasesKeepTheirNativeTypes() {
    DataContract fixture =
        contract()
            .withOdcsQualityRules(null)
            .withSchema(
                List.of(
                    new Column().withName("count").withDataType(ColumnDataType.BIGINT),
                    new Column().withName("text").withDataType(ColumnDataType.TEXT),
                    new Column().withName("bytes").withDataType(ColumnDataType.BINARY),
                    new Column().withName("value").withDataType(ColumnDataType.DOUBLE)));
    ObjectNode source = (ObjectNode) exporter.export(fixture, "v3.1.0").requireValid();
    ArrayNode columns = (ArrayNode) source.at("/schema/0/properties");
    List<String> aliases = List.of("long", "text", "bytes", "double");
    for (int index = 0; index < aliases.size(); index++) {
      ObjectNode column = (ObjectNode) columns.get(index);
      column.put("logicalType", aliases.get(index));
      column.remove("physicalType");
    }
    ((ObjectNode) columns.get(1))
        .putObject("logicalTypeOptions")
        .put("maxLength", 20)
        .put("defaultTimezone", "UTC");
    source.set("schema", columns);
    source.put("contractCreatedTs", 1700000000000L);
    ODCSImportService.Document prepared = ODCSImportService.readOrReject(JSON, source);
    assertEquals("2023-11-14T22:13:20Z", prepared.original().path("contractCreatedTs").asText());
    DataContract imported = read(source, fixture.getEntity());
    assertEquals(
        List.of(
            ColumnDataType.BIGINT,
            ColumnDataType.TEXT,
            ColumnDataType.BINARY,
            ColumnDataType.DOUBLE),
        imported.getSchema().stream().map(Column::getDataType).toList());
    assertEquals(20, imported.getSchema().get(1).getDataLength());
    assertTrue(exporter.export(imported, "v3.1.0").valid());
  }

  @Test
  void legacyRulesWithoutSchemaRetainTheirScopeWithoutInventingNativeColumns() {
    ObjectNode source =
        (ObjectNode)
            exporter
                .export(contract().withSchema(List.of()).withOdcsQualityRules(null), "v3.1.0")
                .requireValid();
    source
        .withArray("quality")
        .addObject()
        .put("type", "sql")
        .put("name", "external_sql")
        .put("query", "SELECT 1");
    source
        .withArray("quality")
        .addObject()
        .put("type", "library")
        .put("metric", "nullValues")
        .put("column", "id");
    DataContract imported = read(source, contract().getEntity());
    assertTrue(imported.getSchema() == null || imported.getSchema().isEmpty());
    assertEquals("id", imported.getOdcsQualityRules().get(1).getColumn());
    assertEquals(0.0, imported.getOdcsQualityRules().get(1).getMustBe());
    var outcomes =
        ODCSQualityRuleMapper.map(
            imported.getOdcsQualityRules(), new ODCSTableTarget("customers", List.of("id")));
    assertTrue(outcomes.getFirst() instanceof ODCSRuleOutcome.UnsupportedOutcome);
    assertTrue(outcomes.getLast() instanceof ODCSRuleOutcome.TestCaseOutcome);
    assertTrue(exporter.export(imported, "v3.1.0").valid());
  }

  @Test
  void rootQualityCanReferenceAnExistingNestedArrayChildWithALiteralDot() {
    DataContract fixture =
        contract()
            .withOdcsQualityRules(null)
            .withSchema(
                List.of(
                    new Column()
                        .withName("items")
                        .withDataType(ColumnDataType.ARRAY)
                        .withChildren(
                            List.of(
                                new Column()
                                    .withName("sku.code")
                                    .withDataType(ColumnDataType.VARCHAR)))));
    ObjectNode source = (ObjectNode) exporter.export(fixture, "v3.1.0").requireValid();
    source
        .withArray("quality")
        .addObject()
        .put("name", "required_sku")
        .put("column", "items.\"sku.code\"")
        .put("metric", "nullValues")
        .put("mustBe", 0);
    DataContract imported = read(source, fixture.getEntity());
    assertEquals("items.\"sku.code\"", imported.getOdcsQualityRules().getFirst().getColumn());
    assertEquals("sku.code", imported.getSchema().getFirst().getChildren().getFirst().getName());
    assertEquals(
        1,
        exporter
            .export(imported, "v3.1.0")
            .requireValid()
            .at("/schema/0/properties/0/items/properties/0/quality")
            .size());
  }

  @Test
  void malformedRootQualityProducesAnActionableImportError() {
    ObjectNode source = (ObjectNode) exporter.export(contract(), "v3.1.0").requireValid();
    source.withArray("quality").add("not a rule");
    String error =
        assertThrows(IllegalArgumentException.class, () -> read(source, contract().getEntity()))
            .getMessage();
    assertTrue(error.contains("must be objects"));
  }

  @ParameterizedTest
  @ValueSource(strings = {"v3.0.2", "v3.0.1", "v3.0.0"})
  void editingOnlyTheNativeUnitCannotRestoreTheOldUnitFromALegacyWrapper(String version) {
    DataContract fixture =
        contract()
            .withOdcsQualityRules(
                List.of(
                    new ODCSQualityRule()
                        .withName("validate_id")
                        .withColumn("id")
                        .withType(ODCSQualityRule.Type.LIBRARY)
                        .withMetric(ODCSQualityRule.OdcsQualityMetric.INVALID_VALUES)
                        .withArguments(new ODCSQualityRuleArguments().withPattern("^[0-9]+$"))
                        .withMustBeLessOrEqualTo(5.0)
                        .withUnit("rows")));
    DataContract imported =
        read(exporter.export(fixture, version).requireValid(), fixture.getEntity());
    imported.getOdcsQualityRules().getFirst().setUnit("percent");
    JsonNode edited = exporter.export(imported, "v3.1.0").requireValid();
    assertEquals("library", edited.at("/schema/0/properties/0/quality/0/type").asText());
    assertEquals("percent", edited.at("/schema/0/properties/0/quality/0/unit").asText());
    assertEquals(
        "percent", read(edited, fixture.getEntity()).getOdcsQualityRules().getFirst().getUnit());
  }

  @ParameterizedTest
  @ValueSource(strings = {"v3.0.2", "v3.0.1", "v3.0.0"})
  void nativeQualityMetadataEditsAndDeletionsSurviveDecodedWrappers(String sourceVersion) {
    DataContract fixture =
        contract()
            .withOdcsQualityRules(
                List.of(
                    new ODCSQualityRule()
                        .withId("stable-check")
                        .withName("validate_id")
                        .withDescription("old description")
                        .withColumn("id")
                        .withType(ODCSQualityRule.Type.LIBRARY)
                        .withMetric(ODCSQualityRule.OdcsQualityMetric.INVALID_VALUES)
                        .withArguments(new ODCSQualityRuleArguments().withPattern("^[0-9]+$"))
                        .withMustBe(0.0)
                        .withCustomProperties(
                            List.of(
                                new ODCSCustomProperty()
                                    .withProperty("detail")
                                    .withValue("old")))));
    JsonNode source = exporter.export(fixture, sourceVersion).requireValid();
    DataContract edited = read(source, fixture.getEntity());
    ODCSQualityRule rule = edited.getOdcsQualityRules().getFirst();
    rule.setName("renamed_check");
    rule.setDescription("new description");
    rule.setCustomProperties(
        List.of(new ODCSCustomProperty().withProperty("detail").withValue("new")));
    DataContract deleted = read(source, fixture.getEntity());
    deleted.getOdcsQualityRules().getFirst().setId(null);
    deleted.getOdcsQualityRules().getFirst().setDescription(null);
    deleted.getOdcsQualityRules().getFirst().setCustomProperties(null);
    for (String targetVersion : ODCSProfiles.supportedVersions()) {
      ODCSQualityRule restored =
          read(exporter.export(edited, targetVersion).requireValid(), fixture.getEntity())
              .getOdcsQualityRules()
              .getFirst();
      assertEquals("renamed_check", restored.getName(), targetVersion);
      assertEquals("new description", restored.getDescription(), targetVersion);
      assertEquals(
          "new",
          JSON.valueToTree(restored.getCustomProperties().getFirst().getValue()).asText(),
          targetVersion);
      ODCSQualityRule removed =
          read(exporter.export(deleted, targetVersion).requireValid(), fixture.getEntity())
              .getOdcsQualityRules()
              .getFirst();
      assertEquals(null, removed.getId(), targetVersion);
      assertEquals(null, removed.getDescription(), targetVersion);
      assertTrue(
          removed.getCustomProperties() == null || removed.getCustomProperties().isEmpty(),
          targetVersion);
    }
  }

  @Test
  void selectedObjectDoesNotIncludeRulesFromAnObjectDifferingOnlyByCase() {
    ObjectNode source = (ObjectNode) exporter.export(contract(), "v3.1.0").requireValid();
    ObjectNode other = source.at("/schema/0").deepCopy();
    other.put("name", "CUSTOMERS");
    ((ObjectNode) other.at("/properties/0/quality/0")).put("name", "other_check");
    ((ArrayNode) source.path("schema")).add(other);
    DataContract imported = read(source, contract().getEntity());
    assertEquals(
        List.of("id_not_null"),
        imported.getOdcsQualityRules().stream().map(ODCSQualityRule::getName).toList());
  }

  @ParameterizedTest
  @ValueSource(
      strings = {"arguments", "mustBeGreaterThan", "column", "dimension", "unexpectedField"})
  void schemaLessLegacyRulesCannotHideInvalidFields(String field) {
    ObjectNode source =
        (ObjectNode)
            exporter
                .export(contract().withSchema(List.of()).withOdcsQualityRules(null), "v3.1.0")
                .requireValid();
    ObjectNode rule =
        source
            .withArray("quality")
            .addObject()
            .put("type", "library")
            .put("metric", "nullValues")
            .put("column", "id")
            .put("mustBe", 0);
    if (field.equals("column")) rule.put(field, 42);
    else rule.put(field, "invalid");
    assertThrows(IllegalArgumentException.class, () -> read(source, contract().getEntity()));
  }

  private static DataContract read(JsonNode source, EntityReference target) {
    ODCSImportService.Document document = ODCSImportService.readOrReject(JSON, source);
    return ODCSConverter.fromODCS(
        document.contract(), target, null, ODCSImportIssues.discarding(), document.original());
  }

  private static DataContract contract() {
    return new DataContract()
        .withId(UUID.randomUUID())
        .withName("customers_contract")
        .withEntityStatus(EntityStatus.DRAFT)
        .withEntity(
            new EntityReference()
                .withType("table")
                .withName("customers")
                .withFullyQualifiedName("sample_data.ecommerce_db.shopify.customers"))
        .withSchema(
            List.of(
                new Column()
                    .withName("id")
                    .withDataType(ColumnDataType.BIGINT)
                    .withConstraint(ColumnConstraint.NOT_NULL),
                new Column()
                    .withName("quantities")
                    .withDataType(ColumnDataType.ARRAY)
                    .withArrayDataType(ColumnDataType.INT),
                new Column().withName("literal.dot").withDataType(ColumnDataType.VARCHAR)))
        .withOdcsQualityRules(
            List.of(
                new ODCSQualityRule()
                    .withId("external-check-id")
                    .withName("id_not_null")
                    .withColumn("id")
                    .withType(ODCSQualityRule.Type.LIBRARY)
                    .withMetric(ODCSQualityRule.OdcsQualityMetric.NULL_VALUES)
                    .withMustBe(0.0)));
  }
}
