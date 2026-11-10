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
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.util.ODCSConverter;

class ODCSGenericPreservationTest {
  private static final ObjectMapper JSON =
      new ObjectMapper().enable(DeserializationFeature.USE_BIG_DECIMAL_FOR_FLOATS);

  @Test
  void preservesUnmappedRootAndColumnFields() throws Exception {
    JsonNode source =
        JSON.readTree(
            """
        {"apiVersion":"v3.1.0","kind":"DataContract","id":"example",
         "name":"orders_contract","version":"1.0.0","status":"active",
         "customProperties":[{"property":"enabled","value":true}],
         "futureSection":{"nested":[1,false,{"unknown":"kept"}]},
         "schema":[{"name":"orders","logicalType":"object","properties":[
           {"name":"id","logicalType":"integer","customProperties":[
             {"property":"precision","value":12.25}],"futureAttribute":{"values":[1,2]}}
         ]}]}
        """);
    DataContract contract =
        ODCSConverter.fromODCS(
            ODCSLenientReader.readOrReject(JSON, source.deepCopy()),
            new EntityReference().withType("table").withName("orders"));
    JsonNode exported = JSON.valueToTree(ODCSConverter.toODCS(contract));

    assertEquals(source.get("customProperties"), exported.get("customProperties"));
    assertEquals(source.get("futureSection"), exported.get("futureSection"));
    assertEquals(
        source.at("/schema/0/properties/0/futureAttribute"),
        exported.at("/schema/0/properties/0/futureAttribute"));
    assertEquals(
        source.at("/schema/0/properties/0/customProperties"),
        exported.at("/schema/0/properties/0/customProperties"));
  }

  @Test
  void nestedMetadataFollowsNamesAfterReorderingWithoutResurrectingRemovedColumns()
      throws Exception {
    JsonNode source =
        source(
            """
      "schema":[{"name":"orders","logicalType":"object","description":"Original object metadata",
       "properties":[
        {"name":"billing","logicalType":"object","properties":[
          {"name":"id","logicalType":"integer","futureLabel":"billing-id"}]},
        {"name":"shipping","logicalType":"object","properties":[
          {"name":"id","logicalType":"integer","futureLabel":"shipping-id"}]},
        {"name":"removed","logicalType":"string","futureLabel":"do-not-restore"}]}]
      """);
    DataContract contract = imported(source);
    List<Column> columns = new ArrayList<>(contract.getSchema().subList(0, 2));
    Collections.reverse(columns);
    contract.setSchema(columns);
    JsonNode exported = export(contract);

    assertEquals("shipping", exported.at("/schema/0/properties/0/name").asText());
    assertEquals(
        "shipping-id", exported.at("/schema/0/properties/0/properties/0/futureLabel").asText());
    assertEquals(
        "billing-id", exported.at("/schema/0/properties/1/properties/0/futureLabel").asText());
    assertEquals(2, exported.at("/schema/0/properties").size());
    assertEquals("Original object metadata", exported.at("/schema/0/description").asText());
  }

  @Test
  void liveMappedValuesWinAndClearedValuesStayCleared() throws Exception {
    JsonNode source =
        source(
            """
      "description":{"purpose":"Original","futureDescription":{"active":false}},
      "schema":[{"name":"orders","logicalType":"object","properties":[
       {"name":"id","logicalType":"integer","description":"Original column","required":true,
        "primaryKeyPosition":2,"logicalTypeOptions":{"maximum":100}}]}]
      """);
    DataContract contract = imported(source);
    contract.setDescription("Edited in Collate");
    contract.getSchema().getFirst().setDescription(null);
    contract.getSchema().getFirst().setConstraint(null);
    contract.getSchema().getFirst().setDataType(ColumnDataType.BIGINT);
    JsonNode exported = export(contract);

    assertEquals("Edited in Collate", exported.at("/description/purpose").asText());
    assertFalse(exported.at("/description/futureDescription/active").asBoolean());
    assertFalse(exported.at("/schema/0/properties/0").has("description"));
    assertFalse(exported.at("/schema/0/properties/0/required").asBoolean());
    assertEquals("BIGINT", exported.at("/schema/0/properties/0/physicalType").asText());
    assertEquals(2, exported.at("/schema/0/properties/0/primaryKeyPosition").asInt());
    assertEquals(100, exported.at("/schema/0/properties/0/logicalTypeOptions/maximum").asInt());
  }

  @Test
  void rawValuesSurviveRepairsToTheTypedModel() throws Exception {
    JsonNode source =
        source(
            """
      "roles":[{"role":"reader","access":"future-access","secondLevelApprovers":"jane",
       "customProperties":[{"property":"settings","value":{"a":[null,false,1.25]}}]}],
      "futureSection":{"properties":[{"name":"x","nullable":null,"flag":false}]}
      """);
    DataContract contract = imported(source);
    JsonNode exported = export(contract);

    assertEquals(source.get("futureSection"), exported.get("futureSection"));
    assertEquals("future-access", exported.at("/roles/0/access").asText());
    assertEquals("jane", exported.at("/roles/0/secondLevelApprovers").asText());
    assertEquals(source.at("/roles/0/customProperties"), exported.at("/roles/0/customProperties"));
    assertEquals(
        source.get("roles"),
        JSON.readTree(contract.getOdcsPreservedFields().path("document").asText()).get("roles"));
  }

  @Test
  void unsupportedSlaAndTeamDeclarationsArePreservedWithoutBeingApplied() throws Exception {
    JsonNode source =
        source(
            """
      "team":[{"username":"external-steward","role":"steward","futureTeamFlag":true}],
      "slaProperties":[
        {"property":"availabilityTime","value":"06:00","valueExt":"UTC"},
        {"property":"futureSla","value":false,"unit":"arbitrary","future":null}]
      """);
    DataContract contract = imported(source);
    JsonNode exported = export(contract);

    assertTrue(contract.getOwners() == null || contract.getOwners().isEmpty());
    assertEquals(source.get("team"), exported.at("/team/members"));
    assertEquals("UTC", exported.at("/slaProperties/0/valueExt").asText());
    assertEquals(source.at("/slaProperties/1"), exported.at("/slaProperties/1"));
    assertEquals(null, contract.getSla().getTimezone());
  }

  @Test
  void genericJsonSurvivesSerializationMergeAndReplace() throws Exception {
    DataContract existing = imported(source("\"futureSection\":{\"kept\":true,\"updated\":1}"));
    DataContract incoming = imported(source("\"futureSection\":{\"updated\":2}"));
    DataContract merged = ODCSConverter.smartMerge(existing, incoming);
    DataContract persisted = JSON.readValue(JSON.writeValueAsString(merged), DataContract.class);
    assertTrue(export(persisted).at("/futureSection/kept").asBoolean());
    assertEquals(2, export(persisted).at("/futureSection/updated").asInt());

    DataContract replaced =
        ODCSConverter.fullReplace(
            existing, imported(source("\"description\":{\"purpose\":\"new\"}")));
    assertFalse(export(replaced).has("futureSection"));
    DataContract cleared = JSON.readValue(JSON.writeValueAsString(existing), DataContract.class);
    cleared.setOdcsPreservedFields(JSON.createObjectNode());
    assertFalse(export(cleared).has("futureSection"));
  }

  @Test
  void preservationReportsAreInformationalAndRemainUnknownToNativeMapping() throws Exception {
    JsonNode source =
        source(
            "\"customProperties\":[{\"property\":\"x\",\"value\":false}],\"futureField\":{\"x\":1}");
    ODCSImportIssues issues = new ODCSImportIssues();
    ODCSFieldCoverage.report(source, null, issues);
    assertTrue(
        issues.toList().stream()
            .filter(issue -> List.of("customProperties", "futureField").contains(issue.getField()))
            .allMatch(
                issue ->
                    issue.getSeverity().toString().equals("info")
                        && issue.getMessage().contains("kept for ODCS export")));
    JsonNode before = source.deepCopy();
    DataContract contract = imported(source);
    assertEquals(before, source);
    JsonNode saved = contract.getOdcsPreservedFields().deepCopy();
    export(contract);
    assertEquals(saved, contract.getOdcsPreservedFields());
  }

  @Test
  void missingAndNullPreservationDoNotOverrideNativeFields() throws Exception {
    DataContract contract = imported(source("\"description\":null,\"team\":null"));
    contract.setDescription("Native description");
    JsonNode exported = export(contract);
    assertEquals("Native description", exported.at("/description/purpose").asText());
    contract.setOdcsPreservedFields(
        JSON.readTree("{\"version\":\"999\",\"contractCreatedTs\":\"invalid\"}"));
    exported = export(contract);
    assertFalse(exported.path("version").asText().equals("999"));
    assertFalse(exported.has("contractCreatedTs"));
    contract.setOdcsPreservedFields(null);
    assertEquals(export(contract), ODCSPreservedFields.restore(null, export(contract)));
    assertEquals(null, ODCSPreservedFields.merge(null, null));
  }

  @Test
  void legacyCustomPropertyMapsStillExportAsStandardArrays() throws Exception {
    JsonNode source =
        source(
            """
      "schema":[{"name":"orders","logicalType":"object","properties":[
       {"name":"id","logicalType":"integer","customProperties":{"enabled":false,"threshold":1.25}}]}],
      "roles":[{"role":"reader","firstLevelApprovers":["alice","bob"],
                "customProperties":{"required":true}}]
      """);
    JsonNode exported = export(imported(source));
    assertTrue(exported.at("/schema/0/properties/0/customProperties").isArray());
    assertEquals(
        "enabled", exported.at("/schema/0/properties/0/customProperties/0/property").asText());
    assertFalse(exported.at("/schema/0/properties/0/customProperties/0/value").asBoolean());
    assertTrue(exported.at("/roles/0/customProperties").isArray());
    assertEquals("alice,bob", exported.at("/roles/0/firstLevelApprovers").asText());
    assertTrue(source.at("/schema/0/properties/0/customProperties").isObject());
  }

  @Test
  void appliedCollectionsStayDeletedEvenWhenSomeMappedAttributesWereAbsent() throws Exception {
    JsonNode source =
        source(
            """
      "schema":[{"name":"orders","logicalType":"object","properties":[
       {"name":"id","logicalType":"integer","description":null}]}],
      "roles":[{"role":"reader","firstLevelApprovers":null,"customProperties":[
        {"property":"annotation","value":true}]}]
      """);
    DataContract contract = imported(source);
    contract.setSchema(List.of());
    contract.setSecurity(null);
    JsonNode exported = export(contract);
    assertFalse(exported.has("schema"));
    assertFalse(exported.has("roles"));
  }

  @Test
  void mergePreservesUnappliedEntriesOnlyForCollectionsOmittedByTheImport() throws Exception {
    DataContract existing =
        imported(source("""
      "team":[{"username":"external","role":"steward"}]
      """));
    DataContract merged = ODCSConverter.smartMerge(existing, imported(source("\"future\":true")));
    assertEquals("external", export(merged).at("/team/members/0/username").asText());
    merged = ODCSConverter.smartMerge(existing, imported(source("\"team\":{\"members\":[]}")));
    assertFalse(export(merged).path("team").has("members"));
  }

  @Test
  void legacyFlatColumnMetadataStaysOnTheColumn() throws Exception {
    JsonNode source =
        source(
            """
      "schema":[{"name":"id","logicalType":"integer","physicalType":"INT",
                 "futureLabel":"column-only"}]
      """);
    JsonNode exported = export(imported(source));
    assertEquals("table", exported.at("/schema/0/physicalType").asText());
    assertFalse(exported.at("/schema/0").has("futureLabel"));
    assertEquals("column-only", exported.at("/schema/0/properties/0/futureLabel").asText());
  }

  @Test
  void genericObjectMetadataFollowsRenamesAndClearingWithoutDuplicatingLegacyStorage()
      throws Exception {
    JsonNode source =
        source(
            """
      "schema":[{"name":"orders","logicalType":"object",
        "authoritativeDefinitions":[{"url":"https://example.test/definition","type":"businessDefinition"}],
        "properties":[{"name":"id","logicalType":"integer"}]}]
      """);
    DataContract contract = imported(source);
    contract.getEntity().setName("renamed_orders");
    JsonNode exported = export(contract);
    assertEquals("renamed_orders", exported.at("/schema/0/name").asText());
    assertEquals(
        source.at("/schema/0/authoritativeDefinitions"),
        exported.at("/schema/0/authoritativeDefinitions"));
    assertFalse(exported.has("authoritativeDefinitions"));

    contract.setOdcsPreservedFields(JSON.createObjectNode());
    exported = export(contract);
    assertFalse(exported.has("authoritativeDefinitions"));
    assertFalse(exported.at("/schema/0").has("authoritativeDefinitions"));

    contract.setOdcsPreservedFields(null);
    assertEquals(
        source.at("/schema/0/authoritativeDefinitions"),
        export(contract).get("authoritativeDefinitions"));
  }

  @Test
  void decimalMetadataKeepsPrecisionThroughTheDatabaseJsonMapper() throws Exception {
    JsonNode source = source("\"futureSection\":{}");
    BigDecimal amount = new BigDecimal("1234567890.1234567890123456789");
    ((ObjectNode) source.path("futureSection")).put("amount", amount);
    DataContract imported = imported(source);
    DataContract refetched =
        JsonUtils.readValue(JsonUtils.pojoToJson(imported), DataContract.class);
    assertEquals(0, amount.compareTo(export(refetched).at("/futureSection/amount").decimalValue()));
  }

  private static JsonNode source(String extra) throws Exception {
    return JSON.readTree(
        "{\"apiVersion\":\"v3.1.0\",\"kind\":\"DataContract\",\"id\":\"example\","
            + "\"name\":\"orders_contract\",\"version\":\"1.0.0\",\"status\":\"active\","
            + extra
            + "}");
  }

  private static DataContract imported(JsonNode source) {
    return ODCSConverter.fromODCS(
        ODCSLenientReader.readOrReject(JSON, source.deepCopy()),
        new EntityReference().withType("table").withName("orders"),
        null,
        ODCSImportIssues.discarding(),
        source);
  }

  private static JsonNode export(DataContract contract) {
    return ODCSConverter.toODCSDocument(contract, List.of());
  }
}
