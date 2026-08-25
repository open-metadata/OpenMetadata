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

package org.openmetadata.service.formatter.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.container.ContainerResponseContext;
import jakarta.ws.rs.core.Response;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.datacontract.DataContractResult;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.ContractExecutionStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.service.Entity;
import org.openmetadata.service.formatter.decorators.MessageDecorator;
import org.openmetadata.service.formatter.entity.EntityFormatter;
import org.openmetadata.service.formatter.factory.ParserFactory;
import org.openmetadata.service.formatter.field.DefaultFieldFormatter;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.util.RestUtil;

class FormatterUtilTest {

  private final TestDecorator decorator = new TestDecorator();

  @Test
  void getEntityLinkForFieldNameParsesNestedAndExtensionPaths() {
    Thread thread = baseThread();

    MessageParser.EntityLink nestedLink =
        FormatterUtil.getEntityLinkForFieldName("columns.comment.description", thread);
    assertEquals(Entity.TABLE, nestedLink.getEntityType());
    assertEquals("service.sales.orders", nestedLink.getEntityFQN());
    assertEquals("columns", nestedLink.getFieldName());
    assertEquals("comment", nestedLink.getArrayFieldName());
    assertEquals("description", nestedLink.getArrayFieldValue());

    MessageParser.EntityLink extensionLink =
        FormatterUtil.getEntityLinkForFieldName("extension.customProperty", thread);
    assertEquals("extension", extensionLink.getFieldName());
    assertEquals("extension", extensionLink.getArrayFieldName());
    assertNull(extensionLink.getArrayFieldValue());
  }

  @Test
  void getUpdatedFieldNormalizesNestedFieldsAndExtensions() {
    ChangeDescription description =
        new ChangeDescription()
            .withFieldsAdded(List.of(new FieldChange().withName("columns.comment.description")))
            .withFieldsUpdated(List.of(new FieldChange().withName("extension.customProperty")))
            .withFieldsDeleted(List.of(new FieldChange().withName("owners")));

    Set<String> updatedFields =
        FormatterUtil.getUpdatedField(new ChangeEvent().withChangeDescription(description));

    assertEquals(Set.of("description", Entity.FIELD_EXTENSION, "owners"), updatedFields);
  }

  @Test
  void transformMessageChoosesParserKeyFromArrayFieldValueOrResolvedFieldName() {
    Thread thread = baseThread();

    DefaultFieldFormatter nestedFormatter = mock(DefaultFieldFormatter.class);
    when(nestedFormatter.getFormattedMessage(FormatterUtil.CHANGE_TYPE.UPDATE))
        .thenReturn("nested");

    DefaultFieldFormatter simpleFormatter = mock(DefaultFieldFormatter.class);
    when(simpleFormatter.getFormattedMessage(FormatterUtil.CHANGE_TYPE.ADD)).thenReturn("simple");

    FieldChange nestedField = new FieldChange().withName("columns.comment.description");
    FieldChange simpleField = new FieldChange().withName("owners");

    try (MockedStatic<ParserFactory> parserFactory = mockStatic(ParserFactory.class)) {
      parserFactory
          .when(
              () ->
                  ParserFactory.getFieldParserObject(decorator, thread, nestedField, "description"))
          .thenReturn(nestedFormatter);
      parserFactory
          .when(() -> ParserFactory.getFieldParserObject(decorator, thread, simpleField, "owners"))
          .thenReturn(simpleFormatter);

      assertEquals(
          "nested",
          FormatterUtil.transformMessage(
              decorator, thread, nestedField, FormatterUtil.CHANGE_TYPE.UPDATE));
      assertEquals(
          "simple",
          FormatterUtil.transformMessage(
              decorator, thread, simpleField, FormatterUtil.CHANGE_TYPE.ADD));
    }
  }

  @Test
  void getFormattedMessagesHandlesUpdatesAdditionsDeletesAndMergedFieldChanges() {
    Thread thread = baseThread();
    EntityFormatter entityFormatter = mock(EntityFormatter.class);
    when(entityFormatter.format(any(), any(), any(), any()))
        .thenAnswer(
            invocation -> {
              FieldChange fieldChange = invocation.getArgument(2);
              FormatterUtil.CHANGE_TYPE changeType = invocation.getArgument(3);
              return changeType.name() + ":" + fieldChange.getName();
            });

    ChangeDescription mixedChanges =
        new ChangeDescription()
            .withFieldsUpdated(List.of(new FieldChange().withName("owners")))
            .withFieldsAdded(List.of(new FieldChange().withName("tags")))
            .withFieldsDeleted(List.of());
    ChangeDescription mergedChanges =
        new ChangeDescription()
            .withFieldsUpdated(List.of())
            .withFieldsAdded(
                List.of(
                    new FieldChange().withName("description").withNewValue("new"),
                    new FieldChange().withName("displayName").withNewValue("display")))
            .withFieldsDeleted(
                List.of(new FieldChange().withName("description").withOldValue("old")));

    try (MockedStatic<ParserFactory> parserFactory = mockStatic(ParserFactory.class)) {
      parserFactory
          .when(() -> ParserFactory.getEntityParser(Entity.TABLE))
          .thenReturn(entityFormatter);

      List<Thread> mixedMessages =
          FormatterUtil.getFormattedMessages(decorator, thread, mixedChanges);
      assertEquals(2, mixedMessages.size());
      assertEquals("UPDATE:owners", mixedMessages.get(0).getMessage());
      assertEquals("ADD:tags", mixedMessages.get(1).getMessage());
      assertNotNull(mixedMessages.get(0).getId());

      List<Thread> mergedMessages =
          FormatterUtil.getFormattedMessages(decorator, thread, mergedChanges);
      assertEquals(2, mergedMessages.size());
      assertEquals("UPDATE:description", mergedMessages.get(0).getMessage());
      assertEquals("ADD:displayName", mergedMessages.get(1).getMessage());
    }
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
        FormatterUtil.getChangeEventFromResponseContext(responseContext, "alice");

    assertTrue(result.isPresent());
    assertSame(changeEvent, result.get());
  }

  @Test
  void getChangeEventFromResponseContextBuildsEntityAndThreadEvents() {
    UUID entityId = UUID.randomUUID();
    EntityReference entityRef =
        new EntityReference()
            .withId(entityId)
            .withType(Entity.TABLE)
            .withFullyQualifiedName("service.sales.orders");
    EntityInterface entity = mock(EntityInterface.class);
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
        FormatterUtil.getChangeEventFromResponseContext(entityResponse, "alice");
    assertTrue(entityEvent.isPresent());
    assertEquals(Entity.TABLE, entityEvent.get().getEntityType());
    assertEquals("service.sales.orders", entityEvent.get().getEntityFullyQualifiedName());
    assertEquals("alice", entityEvent.get().getUserName());

    Thread thread =
        new Thread()
            .withId(UUID.randomUUID())
            .withUpdatedAt(456L)
            .withDomains(List.of(UUID.randomUUID()))
            .withChangeDescription(new ChangeDescription().withPreviousVersion(1.0));
    ContainerResponseContext threadResponse = mock(ContainerResponseContext.class);
    when(threadResponse.getHeaderString(RestUtil.CHANGE_CUSTOM_HEADER)).thenReturn(null);
    when(threadResponse.getStatus()).thenReturn(Response.Status.CREATED.getStatusCode());
    when(threadResponse.hasEntity()).thenReturn(true);
    when(threadResponse.getEntity()).thenReturn(thread);

    Optional<ChangeEvent> threadEvent =
        FormatterUtil.getChangeEventFromResponseContext(threadResponse, "bob");
    assertTrue(threadEvent.isPresent());
    assertEquals(EventType.ENTITY_CREATED, threadEvent.get().getEventType());
    assertEquals(Entity.THREAD, threadEvent.get().getEntityType());
    assertEquals("bob", threadEvent.get().getUserName());
    assertEquals(thread.getDomains(), threadEvent.get().getDomains());
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

    assertTrue(FormatterUtil.getChangeEventFromResponseContext(runningResponse, "alice").isEmpty());

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
          FormatterUtil.getDataContractResultEvent(result, "alice", EventType.ENTITY_UPDATED);

      assertEquals(contractFqn, changeEvent.getEntityFullyQualifiedName());
      assertEquals("alice", changeEvent.getUserName());
      assertEquals(Entity.DATA_CONTRACT, changeEvent.getEntityType());
      assertEquals(
          Entity.DATA_CONTRACT_RESULT,
          changeEvent.getChangeDescription().getFieldsUpdated().getFirst().getName());
      assertEquals(fullEntityReference, contractSpy.getEntity());
    }
  }

  private static Thread baseThread() {
    return new Thread()
        .withId(UUID.randomUUID())
        .withAbout("<#E::table::service.sales.orders>")
        .withEntityRef(
            new EntityReference()
                .withType(Entity.TABLE)
                .withFullyQualifiedName("service.sales.orders"));
  }

  private static final class TestDecorator implements MessageDecorator<String> {
    @Override
    public String getBold() {
      return "**";
    }

    @Override
    public String getBoldWithSpace() {
      return "** ";
    }

    @Override
    public String getLineBreak() {
      return "\n";
    }

    @Override
    public String getAddMarker() {
      return "<ins>";
    }

    @Override
    public String getAddMarkerClose() {
      return "</ins>";
    }

    @Override
    public String getRemoveMarker() {
      return "<del>";
    }

    @Override
    public String getRemoveMarkerClose() {
      return "</del>";
    }

    @Override
    public String getEntityUrl(String prefix, String fqn, String additionalInput) {
      return prefix + "|" + fqn + "|" + additionalInput;
    }

    @Override
    public String buildEntityMessage(String publisherName, ChangeEvent event) {
      return null;
    }

    @Override
    public String buildThreadMessage(String publisherName, ChangeEvent event) {
      return null;
    }

    @Override
    public String buildTestMessage() {
      return "test";
    }
  }
}
