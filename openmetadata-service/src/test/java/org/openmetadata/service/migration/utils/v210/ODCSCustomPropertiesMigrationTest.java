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

package org.openmetadata.service.migration.utils.v210;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSCustomProperty;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSQualityRule;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityExtensionDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.ExtensionRecordWithId;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.ListFilter;

class ODCSCustomPropertiesMigrationTest {

  @Test
  void storedMappingIsRewrittenIntoAContractThatLoads() {
    ObjectNode contract = contractWithStoredMapping();
    assertThrows(RuntimeException.class, () -> JsonUtils.treeToValue(contract, DataContract.class));

    assertTrue(ODCSCustomPropertiesMigration.convertQualityRules(contract));

    DataContract loaded = JsonUtils.treeToValue(contract, DataContract.class);
    ODCSCustomProperty property =
        loaded.getOdcsQualityRules().getFirst().getCustomProperties().getFirst();
    assertEquals("severity", property.getProperty());
    assertEquals("high", property.getValue());
  }

  @Test
  void contractWithoutStoredMappingIsLeftUnchanged() {
    ObjectNode converted = contractWithStoredMapping();
    ODCSCustomPropertiesMigration.convertQualityRules(converted);
    ObjectNode noRules = contract(UUID.randomUUID());

    assertFalse(ODCSCustomPropertiesMigration.convertQualityRules(converted));
    assertFalse(ODCSCustomPropertiesMigration.convertQualityRules(noRules));
  }

  @Test
  void migrationRewritesTheContractAndItsVersionsThatHoldAMapping() {
    ObjectNode stale = contractWithStoredMapping();
    ObjectNode current = contract(UUID.randomUUID());
    UUID staleId = UUID.fromString(stale.path("id").asText());
    @SuppressWarnings("unchecked")
    EntityDAO<DataContract> contractDAO = mock(EntityDAO.class);
    EntityExtensionDAO extensionDAO = mock(EntityExtensionDAO.class);
    when(contractDAO.listAfter(any(ListFilter.class), anyInt(), eq(""), eq("")))
        .thenReturn(List.of(stale.toString(), current.toString()));
    when(contractDAO.listAfter(
            any(ListFilter.class),
            anyInt(),
            eq(current.path("name").asText()),
            eq(current.path("id").asText())))
        .thenReturn(List.of());
    when(extensionDAO.getExtensionsBatch(anyList(), eq("dataContract.version")))
        .thenReturn(
            List.of(
                new ExtensionRecordWithId(staleId, "dataContract.version.0.1", stale.toString()),
                new ExtensionRecordWithId(
                    staleId, "dataContract.version.0.2", current.toString())));

    int converted =
        ODCSCustomPropertiesMigration.convertODCSCustomPropertiesToLists(contractDAO, extensionDAO);

    ArgumentCaptor<String> versionJson = ArgumentCaptor.forClass(String.class);
    assertEquals(2, converted);
    verify(contractDAO).update(eq(staleId), anyString(), anyString());
    verify(contractDAO, never())
        .update(eq(UUID.fromString(current.path("id").asText())), anyString(), anyString());
    verify(extensionDAO)
        .insert(
            eq(staleId), eq("dataContract.version.0.1"), eq("dataContract"), versionJson.capture());
    verify(extensionDAO, never())
        .insert(any(UUID.class), eq("dataContract.version.0.2"), anyString(), anyString());
    DataContract version = JsonUtils.readValue(versionJson.getValue(), DataContract.class);
    assertEquals(
        "severity",
        version.getOdcsQualityRules().getFirst().getCustomProperties().getFirst().getProperty());
  }

  private static ObjectNode contractWithStoredMapping() {
    ObjectNode contract = contract(UUID.randomUUID());
    ObjectNode rule =
        (ObjectNode)
            JsonUtils.valueToTree(
                new ODCSQualityRule().withType(ODCSQualityRule.Type.SQL).withQuery("SELECT 1"));
    rule.putObject("customProperties").put("severity", "high");
    contract.putArray("odcsQualityRules").add(rule);
    return contract;
  }

  private static ObjectNode contract(UUID id) {
    DataContract contract =
        new DataContract()
            .withId(id)
            .withName("contract_" + id)
            .withFullyQualifiedName("svc.db.schema.orders.dataContract_" + id);
    return (ObjectNode) JsonUtils.valueToTree(contract);
  }
}
