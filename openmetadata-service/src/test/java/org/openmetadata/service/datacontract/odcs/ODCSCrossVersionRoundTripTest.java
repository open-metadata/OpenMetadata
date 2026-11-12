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
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import java.util.UUID;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSQualityRule;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.service.util.ODCSConverter;

class ODCSCrossVersionRoundTripTest {
  private static final ObjectMapper JSON = new ObjectMapper();
  private final ODCSExportService exporter = new ODCSExportService(contract -> List.of());

  static Stream<Arguments> versionPairs() {
    return ODCSProfiles.supportedVersions().stream()
        .flatMap(
            source ->
                ODCSProfiles.supportedVersions().stream()
                    .map(target -> Arguments.of(source, target)));
  }

  @ParameterizedTest
  @MethodSource("versionPairs")
  void everyPublishedSourceCanExportToEveryPublishedTarget(
      String sourceVersion, String targetVersion) {
    DataContract nativeContract = fixture();
    ObjectNode source = (ObjectNode) exporter.export(nativeContract, sourceVersion).requireValid();
    enrichLegacyMetadata(source, sourceVersion);
    JsonNode original = source.deepCopy();
    DataContract imported = read(source, nativeContract.getEntity());
    imported.getSchema().getFirst().setDescription("Native column edit");
    JsonNode exported = exporter.export(imported, targetVersion).requireValid();
    assertEquals(targetVersion, exported.path("apiVersion").asText());
    DataContract reimported = read(exported, nativeContract.getEntity());
    assertEquals(ColumnDataType.BIGINT, reimported.getSchema().getFirst().getDataType());
    assertEquals("Native column edit", reimported.getSchema().getFirst().getDescription());
    JsonNode returned = exporter.export(reimported, sourceVersion).requireValid();
    if (sourceVersion.startsWith("v2")) {
      assertEquals(original.path("datasetName"), returned.path("datasetName"));
      assertEquals(original.path("type"), returned.path("type"));
      assertEquals(original.path("futureVendorSection"), returned.path("futureVendorSection"));
      assertEquals(
          original.at("/dataset/0/futureTableMetadata"),
          returned.at("/dataset/0/futureTableMetadata"));
      assertEquals(
          original.at("/dataset/0/columns/0/futureColumnMetadata"),
          returned.at("/dataset/0/columns/0/futureColumnMetadata"));
      assertEquals(original.at("/dataset/0/description"), returned.at("/dataset/0/description"));
    }
    assertEquals(original, source, "Export must not mutate the uploaded document");
  }

  @ParameterizedTest
  @ValueSource(strings = {"Customer records", "First paragraph\nSecond paragraph"})
  void editedAndDeletedProjectedDescriptionsDoNotRestoreTheOldArray(String nativeDescription) {
    DataContract nativeContract = fixture();
    nativeContract.getEntity().setDescription(nativeDescription);
    ObjectNode source = (ObjectNode) exporter.export(nativeContract, "v2.2.1").requireValid();
    enrichLegacyMetadata(source, "v2.2.1");
    JsonNode converted =
        exporter.export(read(source, nativeContract.getEntity()), "v3.1.0").requireValid();
    for (boolean delete : List.of(false, true)) {
      ObjectNode edited = converted.deepCopy();
      ObjectNode table = (ObjectNode) edited.at("/schema/0");
      if (delete) table.remove("description");
      else table.put("description", "Edited description");
      JsonNode returned =
          exporter.export(read(edited, nativeContract.getEntity()), "v2.2.1").requireValid();
      String expected = delete ? nativeContract.getEntity().getDescription() : "Edited description";
      assertEquals(JSON.createArrayNode().add(expected), returned.at("/dataset/0/description"));
    }
  }

  @Test
  void metadataFollowsColumnNamesAfterReorderingWithoutResurrectingDeletedColumns() {
    DataContract nativeContract =
        fixture()
            .withSchema(
                List.of(
                    new Column().withName("id").withDataType(ColumnDataType.BIGINT),
                    new Column().withName("other").withDataType(ColumnDataType.VARCHAR)));
    ObjectNode source = (ObjectNode) exporter.export(nativeContract, "v2.2.2").requireValid();
    enrichLegacyMetadata(source, "v2.2.2");
    DataContract imported = read(source, nativeContract.getEntity());
    imported.setSchema(List.of(imported.getSchema().get(1), imported.getSchema().getFirst()));
    JsonNode converted = exporter.export(imported, "v3.1.0").requireValid();
    JsonNode returned =
        exporter.export(read(converted, nativeContract.getEntity()), "v2.2.2").requireValid();
    assertEquals("id", returned.at("/dataset/0/columns/1/column").asText());
    assertEquals(true, returned.at("/dataset/0/columns/1/futureColumnMetadata/flag").asBoolean());
    imported.setSchema(List.of(imported.getSchema().getFirst()));
    JsonNode deleted = exporter.export(imported, "v3.1.0").requireValid();
    assertEquals(1, deleted.at("/schema/0/properties").size());
    assertEquals("other", deleted.at("/schema/0/properties/0/name").asText());
  }

  @Test
  void annotationCannotOverrideNativeIdentityOrIntroduceExecutableRootRules() {
    DataContract nativeContract = fixture();
    ObjectNode source = (ObjectNode) exporter.export(nativeContract, "v3.1.0").requireValid();
    ObjectNode fields =
        source
            .withArray("customProperties")
            .addObject()
            .put("property", ODCSVersionMetadata.PROPERTY_NAME)
            .putObject("value")
            .put("formatVersion", 1)
            .putObject("fields");
    fields.putObject("name").put("value", "different_name");
    fields.putObject("uuid").put("value", UUID.randomUUID().toString());
    fields
        .putObject("quality")
        .putArray("value")
        .addObject()
        .put("metric", "rowCount")
        .put("mustBe", 0);
    DataContract imported = read(source, nativeContract.getEntity());
    JsonNode exported = exporter.export(imported, "v2.2.2").requireValid();
    assertEquals(nativeContract.getId().toString(), exported.path("uuid").asText());
    assertTrue(!exported.has("quality"));
    assertEquals(nativeContract.getName(), imported.getName());
  }

  @Test
  void sameNamedUserPropertyIsPreservedWithoutBeingInterpretedAsAnAnnotation() {
    DataContract nativeContract = fixture();
    ObjectNode source = (ObjectNode) exporter.export(nativeContract, "v2.2.1").requireValid();
    source
        .withArray("customProperties")
        .addObject()
        .put("property", ODCSVersionMetadata.PROPERTY_NAME)
        .put("value", "ordinary user metadata");
    enrichLegacyMetadata(source, "v2.2.1");
    JsonNode exported =
        exporter.export(read(source, nativeContract.getEntity()), "v3.1.0").requireValid();
    assertEquals("ordinary user metadata", exported.at("/customProperties/0/value").asText());
    assertEquals(2, exported.path("customProperties").size());
    assertEquals(
        source.path("datasetName"),
        exporter
            .export(read(exported, nativeContract.getEntity()), "v2.2.1")
            .requireValid()
            .path("datasetName"));
  }

  @Test
  void malformedSavedCustomPropertiesReportValidationErrorsInsteadOfCrashing() {
    DataContract nativeContract = fixture();
    ObjectNode source = (ObjectNode) exporter.export(nativeContract, "v3.1.0").requireValid();
    source.put("futureField", "preserved").put("customProperties", "invalid shape");
    nativeContract.setOdcsPreservedFields(
        ODCSPreservedFields.capture(
            source, ODCSExportService.nativeDocument(nativeContract, List.of()), "customers"));
    assertTrue(!exporter.export(nativeContract, "v3.1.0").valid());
  }

  private static void enrichLegacyMetadata(ObjectNode source, String version) {
    if (!version.startsWith("v2")) return;
    source.put("datasetName", "external_dataset").put("type", "Tables");
    source.putObject("futureVendorSection").putArray("values").add(true).addNull().add(17);
    ObjectNode table = (ObjectNode) source.at("/dataset/0");
    table.putObject("futureTableMetadata").put("classification", "external");
    ((ObjectNode) table.at("/columns/0")).putObject("futureColumnMetadata").put("flag", true);
    if (version.equals("v2.2.1")) {
      ArrayNode description = table.putArray("description");
      description.add("First paragraph").add("Second paragraph");
    }
  }

  private static DataContract read(JsonNode source, EntityReference entity) {
    ODCSImportService.Document document = ODCSImportService.readOrReject(JSON, source);
    return ODCSConverter.fromODCS(
        document.contract(), entity, null, ODCSImportIssues.discarding(), document.original());
  }

  private static DataContract fixture() {
    return new DataContract()
        .withId(UUID.randomUUID())
        .withName("customers_contract")
        .withEntityStatus(EntityStatus.APPROVED)
        .withEntity(
            new EntityReference()
                .withType("table")
                .withName("customers")
                .withFullyQualifiedName("sample_data.ecommerce_db.shopify.customers")
                .withDescription("Customer records"))
        .withOdcsQualityRules(
            List.of(
                new ODCSQualityRule()
                    .withName("customers_not_empty")
                    .withColumn("customers")
                    .withType(ODCSQualityRule.Type.LIBRARY)
                    .withMetric(ODCSQualityRule.OdcsQualityMetric.ROW_COUNT)
                    .withMustBeGreaterOrEqualTo(1.0)))
        .withSchema(
            List.of(
                new Column()
                    .withName("id")
                    .withDataType(ColumnDataType.BIGINT)
                    .withDescription("Identifier")));
  }
}
