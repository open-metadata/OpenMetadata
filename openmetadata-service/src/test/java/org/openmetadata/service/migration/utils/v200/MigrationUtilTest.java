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

package org.openmetadata.service.migration.utils.v200;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.lang.reflect.Method;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import org.jdbi.v3.core.Handle;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.activity.ActivityEvent;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.resources.feeds.MessageParser;

class MigrationUtilTest {

  @Nested
  class DataContractMigrationTest {
    private CollectionDAO collectionDAO;
    private CollectionDAO.DataContractDAO dataContractDAO;
    private CollectionDAO.TestCaseDAO testCaseDAO;

    @BeforeEach
    void setUp() {
      collectionDAO = mock(CollectionDAO.class);
      dataContractDAO = mock(CollectionDAO.DataContractDAO.class);
      testCaseDAO = mock(CollectionDAO.TestCaseDAO.class);
      when(collectionDAO.dataContractDAO()).thenReturn(dataContractDAO);
      when(collectionDAO.testCaseDAO()).thenReturn(testCaseDAO);
    }

    @Test
    void testMigrateTestCaseDataContractReferences_noDataContracts() {
      when(dataContractDAO.listAfterWithOffset(anyInt(), anyInt()))
          .thenReturn(Collections.emptyList());

      MigrationUtil.migrateTestCaseDataContractReferences(collectionDAO);

      verify(testCaseDAO, never()).findEntityById(any());
      verify(testCaseDAO, never()).update(any(TestCase.class));
    }

    @Test
    void testMigrateTestCaseDataContractReferences_contractWithNoQualityExpectations() {
      DataContract contract = new DataContract();
      contract.setId(UUID.randomUUID());
      contract.setFullyQualifiedName("test.contract");

      when(dataContractDAO.listAfterWithOffset(anyInt(), eq(0)))
          .thenReturn(List.of(JsonUtils.pojoToJson(contract)));
      when(dataContractDAO.listAfterWithOffset(anyInt(), eq(1000)))
          .thenReturn(Collections.emptyList());

      MigrationUtil.migrateTestCaseDataContractReferences(collectionDAO);

      verify(testCaseDAO, never()).findEntityById(any());
    }

    @Test
    void testMigrateTestCaseDataContractReferences_updatesTestCase() {
      UUID contractId = UUID.randomUUID();
      UUID testCaseId = UUID.randomUUID();

      DataContract contract = new DataContract();
      contract.setId(contractId);
      contract.setName("my-contract");
      contract.setFullyQualifiedName("test.contract");
      contract.setQualityExpectations(
          List.of(new EntityReference().withId(testCaseId).withType(Entity.TEST_CASE)));

      TestCase testCase = new TestCase();
      testCase.setId(testCaseId);
      testCase.setFullyQualifiedName("test.case.fqn");

      when(dataContractDAO.listAfterWithOffset(anyInt(), eq(0)))
          .thenReturn(List.of(JsonUtils.pojoToJson(contract)));
      when(dataContractDAO.listAfterWithOffset(anyInt(), eq(1000)))
          .thenReturn(Collections.emptyList());
      when(testCaseDAO.findEntityById(testCaseId)).thenReturn(testCase);

      MigrationUtil.migrateTestCaseDataContractReferences(collectionDAO);

      verify(testCaseDAO).update(any(TestCase.class));
      assertEquals(contractId, testCase.getDataContract().getId());
      assertEquals(Entity.DATA_CONTRACT, testCase.getDataContract().getType());
    }

    @Test
    void testMigrateTestCaseDataContractReferences_skipsAlreadySet() {
      UUID contractId = UUID.randomUUID();
      UUID testCaseId = UUID.randomUUID();

      DataContract contract = new DataContract();
      contract.setId(contractId);
      contract.setName("my-contract");
      contract.setFullyQualifiedName("test.contract");
      contract.setQualityExpectations(
          List.of(new EntityReference().withId(testCaseId).withType(Entity.TEST_CASE)));

      TestCase testCase = new TestCase();
      testCase.setId(testCaseId);
      testCase.setFullyQualifiedName("test.case.fqn");
      testCase.setDataContract(
          new EntityReference().withId(contractId).withType(Entity.DATA_CONTRACT));

      when(dataContractDAO.listAfterWithOffset(anyInt(), eq(0)))
          .thenReturn(List.of(JsonUtils.pojoToJson(contract)));
      when(dataContractDAO.listAfterWithOffset(anyInt(), eq(1000)))
          .thenReturn(Collections.emptyList());
      when(testCaseDAO.findEntityById(testCaseId)).thenReturn(testCase);

      MigrationUtil.migrateTestCaseDataContractReferences(collectionDAO);

      verify(testCaseDAO, never()).update(any(TestCase.class));
    }

    @Test
    void testMigrateTestCaseDataContractReferences_handlesTestCaseNotFound() {
      UUID testCaseId = UUID.randomUUID();

      DataContract contract = new DataContract();
      contract.setId(UUID.randomUUID());
      contract.setName("my-contract");
      contract.setFullyQualifiedName("test.contract");
      contract.setQualityExpectations(
          List.of(new EntityReference().withId(testCaseId).withType(Entity.TEST_CASE)));

      when(dataContractDAO.listAfterWithOffset(anyInt(), eq(0)))
          .thenReturn(List.of(JsonUtils.pojoToJson(contract)));
      when(dataContractDAO.listAfterWithOffset(anyInt(), eq(1000)))
          .thenReturn(Collections.emptyList());
      when(testCaseDAO.findEntityById(testCaseId))
          .thenThrow(new EntityNotFoundException("not found"));

      MigrationUtil.migrateTestCaseDataContractReferences(collectionDAO);

      verify(testCaseDAO, never()).update(any(TestCase.class));
    }

    @Test
    void testMigrateTestCaseDataContractReferences_batchProcessing() {
      UUID contractId1 = UUID.randomUUID();
      UUID contractId2 = UUID.randomUUID();
      UUID testCaseId1 = UUID.randomUUID();
      UUID testCaseId2 = UUID.randomUUID();

      DataContract contract1 = new DataContract();
      contract1.setId(contractId1);
      contract1.setName("contract1");
      contract1.setFullyQualifiedName("test.contract1");
      contract1.setQualityExpectations(
          List.of(new EntityReference().withId(testCaseId1).withType(Entity.TEST_CASE)));

      DataContract contract2 = new DataContract();
      contract2.setId(contractId2);
      contract2.setName("contract2");
      contract2.setFullyQualifiedName("test.contract2");
      contract2.setQualityExpectations(
          List.of(new EntityReference().withId(testCaseId2).withType(Entity.TEST_CASE)));

      when(dataContractDAO.listAfterWithOffset(anyInt(), eq(0)))
          .thenReturn(List.of(JsonUtils.pojoToJson(contract1), JsonUtils.pojoToJson(contract2)));
      when(dataContractDAO.listAfterWithOffset(anyInt(), eq(1000)))
          .thenReturn(Collections.emptyList());

      TestCase testCase1 = new TestCase();
      testCase1.setId(testCaseId1);
      testCase1.setFullyQualifiedName("test.case1");

      TestCase testCase2 = new TestCase();
      testCase2.setId(testCaseId2);
      testCase2.setFullyQualifiedName("test.case2");

      when(testCaseDAO.findEntityById(testCaseId1)).thenReturn(testCase1);
      when(testCaseDAO.findEntityById(testCaseId2)).thenReturn(testCase2);

      MigrationUtil.migrateTestCaseDataContractReferences(collectionDAO);

      verify(testCaseDAO, times(2)).update(any(TestCase.class));
    }

    @Test
    void testMigrateTestCaseDataContractReferences_criticalFailure() {
      when(dataContractDAO.listAfterWithOffset(anyInt(), anyInt()))
          .thenThrow(new RuntimeException("DB connection failed"));

      assertThrows(
          RuntimeException.class,
          () -> MigrationUtil.migrateTestCaseDataContractReferences(collectionDAO));
    }

    @Test
    void testMigrateTestCaseDataContractReferences_multipleTestCasesPerContract() {
      UUID contractId = UUID.randomUUID();
      UUID testCaseId1 = UUID.randomUUID();
      UUID testCaseId2 = UUID.randomUUID();
      UUID testCaseId3 = UUID.randomUUID();

      DataContract contract = new DataContract();
      contract.setId(contractId);
      contract.setName("contract");
      contract.setFullyQualifiedName("test.contract");
      contract.setQualityExpectations(
          List.of(
              new EntityReference().withId(testCaseId1).withType(Entity.TEST_CASE),
              new EntityReference().withId(testCaseId2).withType(Entity.TEST_CASE),
              new EntityReference().withId(testCaseId3).withType(Entity.TEST_CASE)));

      when(dataContractDAO.listAfterWithOffset(anyInt(), eq(0)))
          .thenReturn(List.of(JsonUtils.pojoToJson(contract)));
      when(dataContractDAO.listAfterWithOffset(anyInt(), eq(1000)))
          .thenReturn(Collections.emptyList());

      TestCase tc1 = new TestCase();
      tc1.setId(testCaseId1);
      tc1.setFullyQualifiedName("tc1");

      TestCase tc2 = new TestCase();
      tc2.setId(testCaseId2);
      tc2.setFullyQualifiedName("tc2");
      tc2.setDataContract(new EntityReference().withId(contractId));

      when(testCaseDAO.findEntityById(testCaseId1)).thenReturn(tc1);
      when(testCaseDAO.findEntityById(testCaseId2)).thenReturn(tc2);
      when(testCaseDAO.findEntityById(testCaseId3))
          .thenThrow(new EntityNotFoundException("not found"));

      MigrationUtil.migrateTestCaseDataContractReferences(collectionDAO);

      verify(testCaseDAO, times(1)).update(any(TestCase.class));
    }
  }

  @Nested
  class ActivityStreamMigrationTest {
    private Handle handle;

    @BeforeEach
    void setUp() {
      handle = mock(Handle.class, RETURNS_DEEP_STUBS);
    }

    @Test
    void migrateLegacyActivityThreadsToActivityStreamSkipsWhenThreadTableIsMissing() {
      when(handle.createQuery("SELECT 1 FROM thread_entity LIMIT 1").mapTo(Integer.class).one())
          .thenThrow(new RuntimeException("missing table"));

      assertDoesNotThrow(() -> MigrationUtil.migrateLegacyActivityThreadsToActivityStream(handle));

      verify(handle, never()).createUpdate(anyString());
    }

    @Test
    void backfillAnnouncementRelationshipsSkipsWhenAnnouncementTableIsMissing() {
      when(handle
              .createQuery("SELECT 1 FROM announcement_entity LIMIT 1")
              .mapTo(Integer.class)
              .one())
          .thenThrow(new RuntimeException("missing table"));

      assertDoesNotThrow(() -> MigrationUtil.backfillAnnouncementRelationships(handle));

      verify(handle, never()).createQuery("SELECT json FROM announcement_entity");
    }

    @Test
    void buildThreadTaskPayloadMapsNestedDescriptionSuggestion() throws Exception {
      JsonNode taskDetails =
          JsonUtilsHolder.readTree(
              """
              {
                "oldValue": "existing description",
                "suggestion": "updated description"
              }
              """);
      MessageParser.EntityLink entityLink =
          MessageParser.EntityLink.parse(
              "<#E::table::sample.shop.orders::columns::customer_id::description>");

      ObjectNode payload =
          (ObjectNode)
              invokePrivateStatic(
                  "buildThreadTaskPayload",
                  new Class[] {String.class, JsonNode.class, MessageParser.EntityLink.class},
                  "RequestDescription",
                  taskDetails,
                  entityLink);

      assertNotNull(payload);
      assertEquals("columns.customer_id.description", payload.get("fieldPath").asText());
      assertEquals("existing description", payload.get("currentDescription").asText());
      assertEquals("updated description", payload.get("newDescription").asText());
      assertEquals("User", payload.get("source").asText());
    }

    @Test
    void buildThreadTaskPayloadMapsTagSuggestionList() throws Exception {
      JsonNode taskDetails =
          JsonUtilsHolder.readTree(
              """
              {
                "suggestion": "[{\\"tagFQN\\":\\"PII.Sensitive\\"}]"
              }
              """);
      MessageParser.EntityLink entityLink =
          MessageParser.EntityLink.parse(
              "<#E::table::sample.shop.orders::columns::customer_id::tags>");

      ObjectNode payload =
          (ObjectNode)
              invokePrivateStatic(
                  "buildThreadTaskPayload",
                  new Class[] {String.class, JsonNode.class, MessageParser.EntityLink.class},
                  "UpdateTag",
                  taskDetails,
                  entityLink);

      assertNotNull(payload);
      assertEquals("columns.customer_id", payload.get("fieldPath").asText());
      assertEquals("Add", payload.get("operation").asText());
      assertEquals("PII.Sensitive", payload.get("tagsToAdd").get(0).get("tagFQN").asText());
      assertEquals("User", payload.get("source").asText());
    }

    @Test
    void buildActivityEventFromLegacyThreadMapsDescriptionUpdate() throws Exception {
      UUID threadId = UUID.randomUUID();
      UUID entityId = UUID.randomUUID();
      EntityReference entityRef =
          new EntityReference()
              .withId(entityId)
              .withType(Entity.TABLE)
              .withName("orders")
              .withFullyQualifiedName("sample.shop.orders");
      Thread legacyThread =
          new Thread()
              .withId(threadId)
              .withGeneratedBy(Thread.GeneratedBy.SYSTEM)
              .withAbout(
                  "<#E::table::sample.shop.orders::columns::customer_id::description>")
              .withEntityRef(entityRef)
              .withCreatedBy("system")
              .withUpdatedBy("system")
              .withUpdatedAt(1710000000000L)
              .withMessage("Customer id description updated");
      JsonNode legacyThreadJson =
          JsonUtilsHolder.readTree(
              """
              {
                "feedInfo": {
                  "fieldName": "description",
                  "headerMessage": "Updated customer id description",
                  "entitySpecificInfo": {
                    "previousDescription": "old description",
                    "newDescription": "new description"
                  }
                }
              }
              """);

      ActivityEvent event =
          (ActivityEvent)
              invokePrivateStatic(
                  "buildActivityEventFromLegacyThread",
                  new Class[] {Handle.class, Thread.class, JsonNode.class},
                  handle,
                  legacyThread,
                  legacyThreadJson);

      assertNotNull(event);
      assertEquals(threadId, event.getId());
      assertEquals("DescriptionUpdated", event.getEventType().value());
      assertEquals(entityId, event.getEntity().getId());
      assertEquals("description", event.getFieldName());
      assertEquals("Updated customer id description", event.getSummary());
      assertEquals("old description", event.getOldValue());
      assertEquals("new description", event.getNewValue());
      assertEquals("system", event.getActor().getName());
    }

    @Test
    void buildActivityEventFromLegacyThreadReturnsNullForNonSystemThread() throws Exception {
      Thread legacyThread =
          new Thread()
              .withId(UUID.randomUUID())
              .withGeneratedBy(Thread.GeneratedBy.USER)
              .withEntityRef(
                  new EntityReference()
                      .withId(UUID.randomUUID())
                      .withType(Entity.TABLE)
                      .withFullyQualifiedName("sample.shop.orders"));

      ActivityEvent event =
          (ActivityEvent)
              invokePrivateStatic(
                  "buildActivityEventFromLegacyThread",
                  new Class[] {Handle.class, Thread.class, JsonNode.class},
                  handle,
                  legacyThread,
                  JsonUtilsHolder.readTree("{}"));

      assertNull(event);
    }

    private Object invokePrivateStatic(
        String methodName, Class<?>[] parameterTypes, Object... args) throws Exception {
      Method method = MigrationUtil.class.getDeclaredMethod(methodName, parameterTypes);
      method.setAccessible(true);

      return method.invoke(null, args);
    }
  }

  private static final class JsonUtilsHolder {
    private static JsonNode readTree(String json) {
      try {
        return org.openmetadata.schema.utils.JsonUtils.readTree(json);
      } catch (Exception e) {
        throw new RuntimeException(e);
      }
    }

    private JsonUtilsHolder() {}
  }
}
