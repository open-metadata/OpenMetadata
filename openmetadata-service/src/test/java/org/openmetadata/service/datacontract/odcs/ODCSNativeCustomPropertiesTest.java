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
import static org.junit.jupiter.api.Assertions.assertNull;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.service.util.ODCSConverter;

class ODCSNativeCustomPropertiesTest {
  private static final ObjectMapper JSON = new ObjectMapper();
  private static final String SOURCE =
      """
      {"apiVersion":"v3.1.0","kind":"DataContract","id":"source","name":"imported_customers","version":"1.0.0","status":"active",
       "customProperties":[{"property":"costCenter","value":"old","description":"External metadata"},
       {"property":"unknown","value":{"nested":[1,false]}}]}
      """;

  @Test
  void registeredValuesBecomeNativeAndKeepTheirExternalMetadata() throws Exception {
    DataContract contract = imported();
    handler().apply(contract, JSON.readTree(SOURCE), new ODCSImportIssues());
    assertEquals("old", JSON.valueToTree(contract.getExtension()).path("costCenter").asText());
    contract.setExtension(Map.of("costCenter", "edited"));
    JsonNode exported =
        new ODCSExportService(c -> List.of()).export(contract, "v3.1.0").requireValid();
    assertEquals("edited", exported.at("/customProperties/0/value").asText());
    assertEquals("External metadata", exported.at("/customProperties/0/description").asText());
    assertEquals(2, exported.path("customProperties").size());
  }

  @Test
  void clearingAnAppliedPropertyCannotResurrectItsImportedValue() throws Exception {
    DataContract contract = imported();
    handler().apply(contract, JSON.readTree(SOURCE), new ODCSImportIssues());
    contract.setExtension(Map.of());
    JsonNode exported =
        new ODCSExportService(c -> List.of()).export(contract, "v3.1.0").requireValid();
    assertEquals(1, exported.path("customProperties").size());
    assertEquals("unknown", exported.at("/customProperties/0/property").asText());
  }

  @Test
  void aRegisteredButRejectedValueRemainsPreservedWithoutBeingTreatedAsDeleted() throws Exception {
    DataContract contract = imported();
    ODCSNativeCustomProperties rejecting =
        new ODCSNativeCustomProperties(
            name -> true,
            value -> {
              throw new IllegalArgumentException("Wrong native type");
            });
    ODCSImportIssues issues = new ODCSImportIssues();
    rejecting.apply(contract, JSON.readTree(SOURCE), issues);
    assertNull(contract.getExtension());
    JsonNode exported =
        new ODCSExportService(c -> List.of()).export(contract, "v3.1.0").requireValid();
    assertEquals("old", exported.at("/customProperties/0/value").asText());
    assertEquals(2, exported.path("customProperties").size());
    assertFalse(issues.toList().isEmpty());
  }

  @Test
  void nativeEditOfPreviouslyUnappliedValueEstablishesOwnershipBeforeItIsCleared()
      throws Exception {
    DataContract contract = imported();
    contract.setExtension(Map.of("costCenter", "edited"));
    contract.setOdcsPreservedFields(
        ODCSPreservedFields.bindNativeCustomProperties(
            contract.getOdcsPreservedFields(), contract.getExtension()));
    contract.setExtension(Map.of());
    JsonNode exported =
        new ODCSExportService(c -> List.of()).export(contract, "v3.1.0").requireValid();
    assertEquals(1, exported.path("customProperties").size());
    assertEquals("unknown", exported.at("/customProperties/0/property").asText());
  }

  @Test
  void mergesKeepOwnershipUnlessThatSourceCollectionIsReimported() throws Exception {
    DataContract original = imported();
    handler().apply(original, JSON.readTree(SOURCE), new ODCSImportIssues());
    JsonNode metadataOnly =
        ODCSPreservedFields.capture(
            JSON.readTree("{\"future\":true}"), JSON.createObjectNode(), null);
    JsonNode merged = ODCSPreservedFields.merge(original.getOdcsPreservedFields(), metadataOnly);
    assertEquals(Set.of("costCenter"), ODCSPreservedFields.nativeCustomPropertyNames(merged));
    JsonNode reimported = ODCSPreservedFields.merge(merged, imported().getOdcsPreservedFields());
    assertEquals(Set.of(), ODCSPreservedFields.nativeCustomPropertyNames(reimported));
  }

  private static DataContract imported() throws Exception {
    JsonNode source = JSON.readTree(SOURCE);
    return ODCSConverter.fromODCS(
        ODCSLenientReader.readOrReject(JSON, source.deepCopy()),
        null,
        null,
        ODCSImportIssues.discarding(),
        source);
  }

  private static ODCSNativeCustomProperties handler() {
    return new ODCSNativeCustomProperties("costCenter"::equals, value -> value);
  }
}
