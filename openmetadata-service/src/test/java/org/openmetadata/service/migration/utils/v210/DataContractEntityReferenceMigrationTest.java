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
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import java.util.UUID;
import java.util.function.UnaryOperator;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.ListFilter;

class DataContractEntityReferenceMigrationTest {

  private static final UUID ORDERS_ID = UUID.randomUUID();
  private static final EntityReference ORDERS =
      new EntityReference()
          .withId(ORDERS_ID)
          .withType("table")
          .withName("orders")
          .withFullyQualifiedName("svc.db.schema.orders")
          .withDisplayName("orders")
          .withDeleted(false);
  private static final UnaryOperator<EntityReference> FIND_ORDERS = ref -> ORDERS;

  @Test
  void referenceWithOnlyIdAndType_isRebuiltFromTheEntity() {
    ObjectNode contract = contractWith(new EntityReference().withId(ORDERS_ID).withType("table"));

    assertTrue(DataContractEntityReferenceMigration.rebuildEntityReference(contract, FIND_ORDERS));
    assertEquals(
        "svc.db.schema.orders", contract.path("entity").path("fullyQualifiedName").asText());
    assertEquals("orders", contract.path("entity").path("name").asText());
  }

  @Test
  void referenceThatAlreadyMatchesTheEntity_isLeftUntouched() {
    ObjectNode contract = contractWith(ORDERS);

    assertFalse(DataContractEntityReferenceMigration.rebuildEntityReference(contract, FIND_ORDERS));
  }

  @Test
  void referenceNamingAnotherEntity_isCorrected() {
    EntityReference misnamed =
        new EntityReference()
            .withId(ORDERS_ID)
            .withType("table")
            .withName("customers")
            .withFullyQualifiedName("svc.db.schema.customers");
    ObjectNode contract = contractWith(misnamed);

    assertTrue(DataContractEntityReferenceMigration.rebuildEntityReference(contract, FIND_ORDERS));
    assertEquals(
        "svc.db.schema.orders", contract.path("entity").path("fullyQualifiedName").asText());
  }

  @Test
  void referenceToAMissingEntity_isLeftUnchanged() {
    ObjectNode contract = contractWith(new EntityReference().withId(ORDERS_ID).withType("table"));
    JsonNode before = contract.get("entity").deepCopy();
    UnaryOperator<EntityReference> missing =
        ref -> {
          throw EntityNotFoundException.byId(ref.getId().toString());
        };

    assertFalse(DataContractEntityReferenceMigration.rebuildEntityReference(contract, missing));
    assertEquals(before, contract.get("entity"));
  }

  @Test
  void migration_storesOnlyTheContractsWhoseReferenceChanged() {
    ObjectNode bare = contractWith(new EntityReference().withId(ORDERS_ID).withType("table"));
    ObjectNode complete = contractWith(ORDERS);
    @SuppressWarnings("unchecked")
    EntityDAO<DataContract> dao = mock(EntityDAO.class);
    when(dao.listAfter(any(ListFilter.class), anyInt(), eq(""), eq("")))
        .thenReturn(List.of(bare.toString(), complete.toString()));
    when(dao.listAfter(
            any(ListFilter.class),
            anyInt(),
            eq(complete.path("name").asText()),
            eq(complete.path("id").asText())))
        .thenReturn(List.of());

    int rebuilt =
        DataContractEntityReferenceMigration.rebuildDataContractEntityReferences(dao, FIND_ORDERS);

    assertEquals(1, rebuilt);
    verify(dao, times(1)).update(any(UUID.class), anyString(), anyString());
    verify(dao).update(eq(UUID.fromString(bare.path("id").asText())), anyString(), anyString());
  }

  private static ObjectNode contractWith(EntityReference entity) {
    UUID id = UUID.randomUUID();
    DataContract contract =
        new DataContract()
            .withId(id)
            .withName("contract_" + id)
            .withFullyQualifiedName("svc.db.schema.orders.dataContract_" + id)
            .withEntity(entity);
    return (ObjectNode) JsonUtils.valueToTree(contract);
  }
}
