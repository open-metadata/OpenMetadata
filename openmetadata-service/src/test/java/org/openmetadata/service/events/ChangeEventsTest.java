/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.events;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.container.ContainerResponseContext;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.datacontract.DataContractResult;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.ContractExecutionStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.RestUtil;

class ChangeEventsTest {

  @Test
  void getUpdatedFieldNormalizesNestedFieldsAndExtensions() {
    ChangeDescription description =
        new ChangeDescription()
            .withFieldsAdded(List.of(new FieldChange().withName("columns.comment.description")))
            .withFieldsUpdated(List.of(new FieldChange().withName("extension.customProperty")))
            .withFieldsDeleted(List.of(new FieldChange().withName("owners")));

    Set<String> updatedFields =
        ChangeEvents.getUpdatedField(new ChangeEvent().withChangeDescription(description));

    assertEquals(Set.of("description", Entity.FIELD_EXTENSION, "owners"), updatedFields);
  }

  @Test
  void getChangeEventFromResponseContextPassesThroughExistingChangeEvents() {
    ChangeEvent changeEvent =
        new ChangeEvent().withEntityType(Entity.TABLE).withEventType(EventType.ENTITY_UPDATED);
    ContainerResponseContext responseContext = mock(ContainerResponseContext.class);
    when(responseContext.getHeaderString(RestUtil.CHANGE_CUSTOM_HEADER))
        .thenReturn(EventType.ENTITY_UPDATED.value());
    when(responseContext.hasEntity()).thenReturn(true);
    when(responseContext.getEntity()).thenReturn(changeEvent);

    Optional<ChangeEvent> result =
        ChangeEvents.getChangeEventFromResponseContext(responseContext, "alice");

    assertTrue(result.isPresent());
    assertSame(changeEvent, result.get());
  }

  @Test
  void getChangeEventFromResponseContextBuildsEntityEvents() {
    UUID entityId = UUID.randomUUID();
    EntityReference entityRef =
        new EntityReference()
            .withId(entityId)
            .withType(Entity.TABLE)
            .withFullyQualifiedName("service.sales.orders");
    EntityInterface<?> entity = mock(EntityInterface.class);
    when(entity.getId()).thenReturn(entityId);
    when(entity.getEntityReference()).thenReturn(entityRef);
    when(entity.getDomains()).thenReturn(List.of(new EntityReference().withId(UUID.randomUUID())));
    when(entity.getImpersonatedBy()).thenReturn("proxy");
    when(entity.getUpdatedAt()).thenReturn(123L);
    when(entity.getVersion()).thenReturn(2.0);
    when(entity.getChangeDescription())
        .thenReturn(new ChangeDescription().withPreviousVersion(1.0));

    ContainerResponseContext entityResponse = mock(ContainerResponseContext.class);
    when(entityResponse.getHeaderString(RestUtil.CHANGE_CUSTOM_HEADER))
        .thenReturn(EventType.ENTITY_UPDATED.value());
    when(entityResponse.hasEntity()).thenReturn(true);
    when(entityResponse.getEntity()).thenReturn(entity);

    Optional<ChangeEvent> entityEvent =
        ChangeEvents.getChangeEventFromResponseContext(entityResponse, "alice");
    assertTrue(entityEvent.isPresent());
    assertEquals(Entity.TABLE, entityEvent.get().getEntityType());
    assertEquals("service.sales.orders", entityEvent.get().getEntityFullyQualifiedName());
    assertEquals("alice", entityEvent.get().getUserName());
  }

  @Test
  void getChangeEventFromResponseContextSkipsRunningDataContractResultsAndBuildsFinalEvents() {
    ContainerResponseContext runningResponse = mock(ContainerResponseContext.class);
    when(runningResponse.getHeaderString(RestUtil.CHANGE_CUSTOM_HEADER))
        .thenReturn(EventType.ENTITY_UPDATED.value());
    when(runningResponse.hasEntity()).thenReturn(true);
    when(runningResponse.getEntity())
        .thenReturn(
            new DataContractResult()
                .withDataContractFQN("service.sales.orders.contract")
                .withContractExecutionStatus(ContractExecutionStatus.Running));

    assertTrue(ChangeEvents.getChangeEventFromResponseContext(runningResponse, "alice").isEmpty());

    UUID tableId = UUID.randomUUID();
    String contractFqn = "service.sales.orders.contract";
    DataContract contract =
        new DataContract()
            .withId(UUID.randomUUID())
            .withName("orders_contract")
            .withFullyQualifiedName(contractFqn)
            .withEntity(new EntityReference().withType(Entity.TABLE).withId(tableId));
    DataContract contractSpy = spy(contract);
    doReturn(new EntityReference().withType(Entity.DATA_CONTRACT))
        .when(contractSpy)
        .getEntityReference();

    EntityReference fullEntityReference =
        new EntityReference()
            .withId(tableId)
            .withType(Entity.TABLE)
            .withFullyQualifiedName("service.sales.orders");
    DataContractResult result =
        new DataContractResult()
            .withDataContractFQN(contractFqn)
            .withContractExecutionStatus(ContractExecutionStatus.Failed)
            .withTimestamp(789L);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock
          .when(
              () ->
                  Entity.getEntityByName(
                      Entity.DATA_CONTRACT,
                      contractFqn,
                      "*",
                      org.openmetadata.schema.type.Include.ALL))
          .thenReturn(contractSpy);
      entityMock
          .when(
              () ->
                  Entity.getEntityReferenceById(
                      Entity.TABLE, tableId, org.openmetadata.schema.type.Include.NON_DELETED))
          .thenReturn(fullEntityReference);

      ChangeEvent changeEvent =
          ChangeEvents.getDataContractResultEvent(result, "alice", EventType.ENTITY_UPDATED);

      assertEquals(contractFqn, changeEvent.getEntityFullyQualifiedName());
      assertEquals("alice", changeEvent.getUserName());
      assertEquals(Entity.DATA_CONTRACT, changeEvent.getEntityType());
      assertEquals(
          Entity.DATA_CONTRACT_RESULT,
          changeEvent.getChangeDescription().getFieldsUpdated().getFirst().getName());
      assertEquals(fullEntityReference, contractSpy.getEntity());
    }
  }
}
