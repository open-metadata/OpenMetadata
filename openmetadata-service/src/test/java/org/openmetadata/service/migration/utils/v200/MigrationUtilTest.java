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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockConstruction;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.jdbi3.locator.ConnectionType.MYSQL;
import static org.openmetadata.service.jdbi3.locator.ConnectionType.POSTGRES;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.lang.reflect.Method;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jdbi.v3.core.Handle;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedConstruction;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.activity.ActivityEvent;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.Workflow;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.WorkflowDefinitionRepository;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.resources.feeds.MessageParser;

class MigrationUtilTest {
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private Handle handle;

  @BeforeEach
  void setUp() {
    handle = mock(Handle.class, RETURNS_DEEP_STUBS);
  }

  @Test
  void migrateThreadTasksToTaskEntitySkipsWhenThreadTableIsMissing() {
    when(handle.createQuery("SELECT 1 FROM thread_entity LIMIT 1").mapTo(Integer.class).findFirst())
        .thenThrow(new RuntimeException("missing table"));
    when(handle
            .createQuery("SELECT 1 FROM thread_entity_legacy LIMIT 1")
            .mapTo(Integer.class)
            .findFirst())
        .thenThrow(new RuntimeException("missing table"));

    assertDoesNotThrow(() -> MigrationUtil.migrateThreadTasksToTaskEntity(handle, MYSQL));

    verify(handle, never()).createUpdate(anyString());
  }

  @Test
  void migrateThreadTasksToTaskEntitySkipsWhenThreadTableIsMissingPostgres() {
    when(handle.createQuery("SELECT 1 FROM thread_entity LIMIT 1").mapTo(Integer.class).findFirst())
        .thenThrow(new RuntimeException("missing table"));
    when(handle
            .createQuery("SELECT 1 FROM thread_entity_legacy LIMIT 1")
            .mapTo(Integer.class)
            .findFirst())
        .thenThrow(new RuntimeException("missing table"));

    assertDoesNotThrow(() -> MigrationUtil.migrateThreadTasksToTaskEntity(handle, POSTGRES));

    verify(handle, never()).createUpdate(anyString());
  }

  @Test
  void migrateSuggestionsToTaskEntitySkipsWhenSuggestionsTableIsMissing() {
    when(handle.createQuery("SELECT 1 FROM suggestions LIMIT 1").mapToMap().list())
        .thenThrow(new RuntimeException("missing table"));

    assertDoesNotThrow(() -> MigrationUtil.migrateSuggestionsToTaskEntity(handle, MYSQL));

    verify(handle, never()).createUpdate(anyString());
  }

  @Test
  void migrateSuggestionsToTaskEntitySkipsWhenSuggestionsTableIsMissingPostgres() {
    when(handle.createQuery("SELECT 1 FROM suggestions LIMIT 1").mapToMap().list())
        .thenThrow(new RuntimeException("missing table"));

    assertDoesNotThrow(() -> MigrationUtil.migrateSuggestionsToTaskEntity(handle, POSTGRES));

    verify(handle, never()).createUpdate(anyString());
  }

  @Test
  void migrateLegacyActivityThreadsToActivityStreamSkipsWhenThreadTableIsMissing() {
    when(handle.createQuery("SELECT 1 FROM thread_entity LIMIT 1").mapTo(Integer.class).findFirst())
        .thenThrow(new RuntimeException("missing table"));

    assertDoesNotThrow(
        () -> MigrationUtil.migrateLegacyActivityThreadsToActivityStream(handle, MYSQL));

    verify(handle, never()).createUpdate(anyString());
  }

  @Test
  void migrateLegacyActivityThreadsToActivityStreamSkipsWhenThreadTableIsMissingPostgres() {
    when(handle.createQuery("SELECT 1 FROM thread_entity LIMIT 1").mapTo(Integer.class).findFirst())
        .thenThrow(new RuntimeException("missing table"));

    assertDoesNotThrow(
        () -> MigrationUtil.migrateLegacyActivityThreadsToActivityStream(handle, POSTGRES));

    verify(handle, never()).createUpdate(anyString());
  }

  @Test
  void insertTaskUsesJsonbCastForPostgres() throws Exception {
    invokePrivateStatic(
        "insertTask",
        new Class[] {Handle.class, String.class, String.class, String.class, ConnectionType.class},
        handle,
        "test-id",
        "{}",
        "test-hash",
        POSTGRES);

    verify(handle).createUpdate(contains("::jsonb"));
  }

  @Test
  void insertTaskDoesNotUseJsonbCastForMysql() throws Exception {
    invokePrivateStatic(
        "insertTask",
        new Class[] {Handle.class, String.class, String.class, String.class, ConnectionType.class},
        handle,
        "test-id",
        "{}",
        "test-hash",
        MYSQL);

    verify(handle, never()).createUpdate(contains("::jsonb"));
  }

  @Test
  void migrateThreadTaskInsertsEntityRelationshipRowsForAssigneesAndAbout() {
    String assigneeId = "aaaa-bbbb-cccc-dddd";
    String entityRefId = "5555-6666-7777-8888";

    when(handle.createQuery("SELECT 1 FROM thread_entity LIMIT 1").mapTo(Integer.class).findFirst())
        .thenReturn(java.util.Optional.of(1));

    String threadJson =
        """
        {
          "id": "dead-beef-0000-0001",
          "type": "Task",
          "about": "<#E::glossaryTerm::MyGlossary.MyTerm>",
          "message": "Approval required",
          "threadTs": 1700000000000,
          "updatedAt": 1700000000000,
          "createdBy": "system",
          "updatedBy": "system",
          "entityRef": { "id": "%s", "type": "glossaryTerm" },
          "task": {
            "id": 1,
            "type": "RequestApproval",
            "status": "Open",
            "assignees": [{ "id": "%s", "type": "user" }]
          }
        }
        """
            .formatted(entityRefId, assigneeId);

    Map<String, Object> row = Map.of("json", threadJson);
    when(handle
            .createQuery(
                "SELECT json FROM thread_entity WHERE type = 'Task' ORDER BY createdAt ASC")
            .mapToMap()
            .list())
        .thenReturn(List.of(row));

    when(handle
            .createQuery("SELECT COUNT(*) FROM task_entity WHERE id = :id")
            .bind("id", "dead-beef-0000-0001")
            .mapTo(Long.class)
            .one())
        .thenReturn(0L);

    when(handle.createQuery(anyString()).mapTo(Long.class).findOne())
        .thenReturn(java.util.Optional.of(0L));

    when(handle.createQuery(contains("entity_relationship")).mapToMap().list())
        .thenReturn(Collections.emptyList());

    assertDoesNotThrow(() -> MigrationUtil.migrateThreadTasksToTaskEntity(handle, MYSQL));

    ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
    verify(handle, atLeastOnce()).createUpdate(sqlCaptor.capture());

    List<String> allSql = sqlCaptor.getAllValues();
    long entityRelationshipInserts =
        allSql.stream().filter(s -> s.contains("entity_relationship")).count();
    assertTrue(
        entityRelationshipInserts >= 2,
        "Expected at least 2 entity_relationship inserts (ASSIGNED_TO + MENTIONED_IN), got "
            + entityRelationshipInserts);
  }

  @Test
  void migrateSuggestionInsertsEntityRelationshipRowsForCreatedBy() {
    String createdById = "cccc-dddd-eeee-ffff";
    String entityId = "9999-8888-7777-6666";

    // suggestions table exists
    when(handle.createQuery("SELECT 1 FROM suggestions LIMIT 1").mapToMap().list())
        .thenReturn(List.of(Map.of("1", 1)));

    String suggestionJson =
        """
        {
          "id": "dead-beef-0000-0002",
          "type": "SuggestDescription",
          "status": "Open",
          "entityLink": "<#E::table::sample.shop.orders>",
          "entityId": "%s",
          "description": "A good table",
          "createdBy": { "id": "%s", "type": "user" },
          "createdAt": 1700000000000,
          "updatedAt": 1700000000000,
          "updatedBy": "system"
        }
        """
            .formatted(entityId, createdById);

    Map<String, Object> row = Map.of("json", suggestionJson);
    when(handle
            .createQuery("SELECT json FROM suggestions ORDER BY updatedAt ASC")
            .mapToMap()
            .list())
        .thenReturn(List.of(row));

    // taskExists returns false
    when(handle
            .createQuery("SELECT COUNT(*) FROM task_entity WHERE id = :id")
            .bind("id", "dead-beef-0000-0002")
            .mapTo(Long.class)
            .one())
        .thenReturn(0L);

    // sequence
    when(handle.createQuery(anyString()).mapTo(Long.class).findOne())
        .thenReturn(java.util.Optional.of(0L));

    // resolveDomainsForTaskAbout — empty
    when(handle.createQuery(contains("entity_relationship")).mapToMap().list())
        .thenReturn(Collections.emptyList());

    assertDoesNotThrow(() -> MigrationUtil.migrateSuggestionsToTaskEntity(handle, MYSQL));

    ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
    verify(handle, atLeastOnce()).createUpdate(sqlCaptor.capture());

    List<String> allSql = sqlCaptor.getAllValues();
    long entityRelationshipInserts =
        allSql.stream().filter(s -> s.contains("entity_relationship")).count();
    assertTrue(
        entityRelationshipInserts >= 2,
        "Expected at least 2 entity_relationship inserts (CREATED + MENTIONED_IN), got "
            + entityRelationshipInserts);
  }

  @Test
  void backfillAnnouncementRelationshipsSkipsWhenAnnouncementTableIsMissing() {
    when(handle.createQuery("SELECT 1 FROM announcement_entity LIMIT 1").mapTo(Integer.class).one())
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
            .withAbout("<#E::table::sample.shop.orders::columns::customer_id::description>")
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

  private Object invokePrivateStatic(String methodName, Class<?>[] parameterTypes, Object... args)
      throws Exception {
    Method method = MigrationUtil.class.getDeclaredMethod(methodName, parameterTypes);
    method.setAccessible(true);

    return method.invoke(null, args);
  }

  // ─── migrateWorkflowJson ───────────────────────────────────────────────

  @Test
  void migrateWorkflowJson_returnsSameInstanceWhenTriggerAlreadyHasEntityList() throws Exception {
    String json =
        """
        {
          "id": "00000000-0000-0000-0000-000000000001",
          "fullyQualifiedName": "workflow1",
          "trigger": {
            "output": ["entityList", "updatedBy"]
          },
          "nodes": []
        }
        """;
    JsonNode root = MAPPER.readTree(json);
    JsonNode result = MigrationUtil.migrateWorkflowJson(root);
    assertSame(root, result, "Should return the same instance when output is already canonical");
  }

  @Test
  void migrateWorkflowJson_addsEntityListFirstWhenMissingFromTrigger() throws Exception {
    String json =
        """
        {
          "id": "00000000-0000-0000-0000-000000000001",
          "fullyQualifiedName": "workflow1",
          "trigger": {
            "output": ["relatedEntity", "updatedBy"]
          },
          "nodes": []
        }
        """;
    JsonNode root = MAPPER.readTree(json);
    JsonNode result = MigrationUtil.migrateWorkflowJson(root);

    assertFalse(result == root, "Should return a new instance when changes are needed");
    JsonNode output = result.get("trigger").get("output");
    assertEquals("entityList", output.get(0).asText());
    assertEquals("updatedBy", output.get(1).asText());
    assertEquals(2, output.size());
  }

  @Test
  void migrateWorkflowJson_handlesNoTriggerNode() throws Exception {
    String json =
        """
        {
          "id": "00000000-0000-0000-0000-000000000001",
          "fullyQualifiedName": "workflow1",
          "nodes": []
        }
        """;
    JsonNode root = MAPPER.readTree(json);
    assertSame(root, MigrationUtil.migrateWorkflowJson(root));
  }

  @Test
  void migrateWorkflowJson_handlesNullRoot() {
    assertNull(MigrationUtil.migrateWorkflowJson(null));
  }

  @Test
  void migrateWorkflowJson_handlesTriggerWithNoOutputArray() throws Exception {
    String json =
        """
        {
          "id": "00000000-0000-0000-0000-000000000001",
          "fullyQualifiedName": "workflow1",
          "trigger": {"type": "manual"},
          "nodes": []
        }
        """;
    JsonNode root = MAPPER.readTree(json);
    assertSame(root, MigrationUtil.migrateWorkflowJson(root));
  }

  @Test
  void migrateWorkflowJson_migratesBatchNodeNamespaceMap() throws Exception {
    String json =
        """
        {
          "id": "00000000-0000-0000-0000-000000000001",
          "fullyQualifiedName": "workflow1",
          "trigger": {"output": ["entityList"]},
          "nodes": [
            {
              "type": "automatedTask",
              "subType": "setEntityAttributeTask",
              "name": "MyTask",
              "inputNamespaceMap": {"relatedEntity": "global"}
            }
          ]
        }
        """;
    JsonNode root = MAPPER.readTree(json);
    JsonNode result = MigrationUtil.migrateWorkflowJson(root);

    assertFalse(result == root);
    JsonNode nsMap = result.get("nodes").get(0).get("inputNamespaceMap");
    assertTrue(nsMap.has("entityList"));
    assertFalse(nsMap.has("relatedEntity"));
    assertEquals("global", nsMap.get("entityList").asText());
  }

  @Test
  void migrateWorkflowJson_preservesUpdatedByWhenMigratingRelatedEntity() throws Exception {
    String json =
        """
        {
          "id": "00000000-0000-0000-0000-000000000001",
          "fullyQualifiedName": "workflow1",
          "trigger": {"output": ["entityList"]},
          "nodes": [
            {
              "type": "automatedTask",
              "subType": "setEntityAttributeTask",
              "name": "SetApproved",
              "inputNamespaceMap": {"relatedEntity": "global", "updatedBy": "ApprovalForUpdates"}
            }
          ]
        }
        """;
    JsonNode root = MAPPER.readTree(json);
    JsonNode result = MigrationUtil.migrateWorkflowJson(root);

    JsonNode nsMap = result.get("nodes").get(0).get("inputNamespaceMap");
    assertTrue(nsMap.has("entityList"));
    assertFalse(nsMap.has("relatedEntity"));
    assertEquals("global", nsMap.get("entityList").asText());
    assertEquals("ApprovalForUpdates", nsMap.get("updatedBy").asText());
  }

  @Test
  void migrateWorkflowJson_skipsNonBatchNodes() throws Exception {
    String json =
        """
        {
          "id": "00000000-0000-0000-0000-000000000001",
          "fullyQualifiedName": "workflow1",
          "trigger": {"output": ["entityList", "updatedBy"]},
          "nodes": [
            {
              "type": "userTask",
              "subType": "unknownCustomTask",
              "name": "ApproveIt",
              "inputNamespaceMap": {"relatedEntity": "global"}
            }
          ]
        }
        """;
    JsonNode root = MAPPER.readTree(json);
    JsonNode result = MigrationUtil.migrateWorkflowJson(root);

    assertSame(root, result);
    assertTrue(result.get("nodes").get(0).get("inputNamespaceMap").has("relatedEntity"));
  }

  @Test
  void migrateWorkflowJson_migratesInputArrayRelatedEntityToo() throws Exception {
    String json =
        """
        {
          "id": "00000000-0000-0000-0000-000000000001",
          "fullyQualifiedName": "workflow1",
          "trigger": {"output": ["entityList"]},
          "nodes": [
            {
              "type": "automatedTask",
              "subType": "setEntityAttributeTask",
              "name": "n1",
              "inputNamespaceMap": {"entityList": "global"},
              "input": ["relatedEntity", "updatedBy"]
            }
          ]
        }
        """;
    JsonNode root = MAPPER.readTree(json);
    JsonNode result = MigrationUtil.migrateWorkflowJson(root);

    JsonNode input = result.get("nodes").get(0).get("input");
    assertEquals("entityList", input.get(0).asText());
    assertEquals("updatedBy", input.get(1).asText());
    assertEquals(2, input.size());
  }

  @Test
  void migrateWorkflowJson_assignsTrueEntityListToNodeDownstreamOfCheckNodeOnTrueEdge()
      throws Exception {
    String json =
        """
        {
          "id": "00000000-0000-0000-0000-000000000001",
          "fullyQualifiedName": "workflow1",
          "trigger": {"output": ["entityList"]},
          "nodes": [
            {
              "type": "automatedTask",
              "subType": "checkEntityAttributesTask",
              "name": "CheckOwner",
              "inputNamespaceMap": {"entityList": "global"}
            },
            {
              "type": "automatedTask",
              "subType": "setEntityAttributeTask",
              "name": "SetGold",
              "inputNamespaceMap": {"relatedEntity": "global"}
            }
          ],
          "edges": [{"from": "CheckOwner", "to": "SetGold", "condition": "true"}]
        }
        """;
    JsonNode root = MAPPER.readTree(json);
    JsonNode result = MigrationUtil.migrateWorkflowJson(root);

    JsonNode nsMap = result.get("nodes").get(1).get("inputNamespaceMap");
    assertTrue(nsMap.has("true_entityList"));
    assertEquals("CheckOwner", nsMap.get("true_entityList").asText());
    assertFalse(nsMap.has("entityList"));
    assertFalse(nsMap.has("relatedEntity"));
  }

  @Test
  void migrateWorkflowJson_halfMigratedTriggerOutputGetsCleaned() throws Exception {
    String json =
        """
        {
          "id": "00000000-0000-0000-0000-000000000001",
          "fullyQualifiedName": "workflow1",
          "trigger": {"output": ["entityList", "relatedEntity"]},
          "nodes": []
        }
        """;
    JsonNode root = MAPPER.readTree(json);
    JsonNode result = MigrationUtil.migrateWorkflowJson(root);

    assertFalse(result == root);
    JsonNode output = result.get("trigger").get("output");
    assertEquals(2, output.size());
    assertEquals("entityList", output.get(0).asText());
    assertEquals("updatedBy", output.get(1).asText());
  }

  @Test
  void migrateWorkflowJson_setsStoreStageStatusForPeriodicBatchEntity() throws Exception {
    String json =
        """
        {
          "id": "00000000-0000-0000-0000-000000000001",
          "fullyQualifiedName": "workflow1",
          "trigger": {"type": "periodicBatchEntity", "output": ["entityList", "updatedBy"]},
          "config": {"storeStageStatus": false},
          "nodes": []
        }
        """;
    JsonNode root = MAPPER.readTree(json);
    JsonNode result = MigrationUtil.migrateWorkflowJson(root);

    assertFalse(result == root);
    assertTrue(result.get("config").get("storeStageStatus").asBoolean());
  }

  @Test
  void migrateWorkflowJson_storeStageStatusAlreadyTrueIsIdempotent() throws Exception {
    String json =
        """
        {
          "id": "00000000-0000-0000-0000-000000000001",
          "fullyQualifiedName": "workflow1",
          "trigger": {"type": "periodicBatchEntity", "output": ["entityList", "updatedBy"]},
          "config": {"storeStageStatus": true},
          "nodes": []
        }
        """;
    JsonNode root = MAPPER.readTree(json);
    assertSame(root, MigrationUtil.migrateWorkflowJson(root));
  }

  // ─── addEntityListToNamespaceMap ──────────────────────────────────────

  @Test
  void addEntityListToNamespaceMap_returnsSameWhenAlreadyHasEntityListNoRelatedEntity()
      throws Exception {
    String json =
        """
        {"name": "node", "inputNamespaceMap": {"entityList": "global", "updatedBy": "global"}}
        """;
    JsonNode node = MAPPER.readTree(json);
    assertSame(node, MigrationUtil.addEntityListToNamespaceMap(node, null, Map.of()));
  }

  @Test
  void addEntityListToNamespaceMap_replacesRelatedEntityWithEntityListGlobal() throws Exception {
    String json =
        """
        {"name": "node", "inputNamespaceMap": {"relatedEntity": "myNamespace"}}
        """;
    JsonNode node = MAPPER.readTree(json);
    JsonNode result = MigrationUtil.addEntityListToNamespaceMap(node, null, Map.of());

    JsonNode nsMap = result.get("inputNamespaceMap");
    assertTrue(nsMap.has("entityList"));
    assertFalse(nsMap.has("relatedEntity"));
    assertEquals("global", nsMap.get("entityList").asText());
  }

  @Test
  void addEntityListToNamespaceMap_setsTrueEntityListFromCheckNodeOnTrueCondition()
      throws Exception {
    String json =
        """
        {"name": "SetGold", "inputNamespaceMap": {"relatedEntity": "global"}}
        """;
    JsonNode node = MAPPER.readTree(json);
    List<String[]> incoming = Collections.singletonList(new String[] {"CheckOwner", "true"});
    Map<String, String> nodeSubType = Map.of("CheckOwner", "checkEntityAttributesTask");
    JsonNode result = MigrationUtil.addEntityListToNamespaceMap(node, incoming, nodeSubType);

    JsonNode nsMap = result.get("inputNamespaceMap");
    assertTrue(nsMap.has("true_entityList"));
    assertEquals("CheckOwner", nsMap.get("true_entityList").asText());
    assertFalse(nsMap.has("entityList"));
    assertFalse(nsMap.has("relatedEntity"));
  }

  @Test
  void addEntityListToNamespaceMap_returnsSameWhenNoInputNamespaceMap() throws Exception {
    JsonNode node = MAPPER.readTree("""
        {"name": "node"}
        """);
    assertSame(node, MigrationUtil.addEntityListToNamespaceMap(node, null, Map.of()));
  }

  // ─── migrateInputArray ────────────────────────────────────────────────

  @Test
  void migrateInputArray_replacesRelatedEntityWithEntityList() throws Exception {
    String json = """
        {"name": "node", "input": ["relatedEntity", "updatedBy"]}
        """;
    JsonNode node = MAPPER.readTree(json);
    JsonNode result = MigrationUtil.migrateInputArray(node);

    JsonNode input = result.get("input");
    assertEquals(2, input.size());
    assertEquals("entityList", input.get(0).asText());
    assertEquals("updatedBy", input.get(1).asText());
  }

  @Test
  void migrateInputArray_returnsSameWhenNoRelatedEntity() throws Exception {
    String json = """
        {"name": "node", "input": ["entityList", "updatedBy"]}
        """;
    JsonNode node = MAPPER.readTree(json);
    assertSame(node, MigrationUtil.migrateInputArray(node));
  }

  @Test
  void migrateInputArray_returnsSameWhenNoInputArray() throws Exception {
    JsonNode node = MAPPER.readTree("""
        {"name": "node"}
        """);
    assertSame(node, MigrationUtil.migrateInputArray(node));
  }

  // ─── migrateWorkflowInputNamespaceMap ────────────────────────────────

  @Test
  @SuppressWarnings("unchecked")
  void migrateWorkflowInputNamespaceMap_phase2SkippedWhenNoChangesInPhase1() throws Exception {
    WorkflowDefinitionRepository repository = mock(WorkflowDefinitionRepository.class);
    EntityDAO<WorkflowDefinition> mockDao = mock(EntityDAO.class);

    when(repository.getDao()).thenReturn(mockDao);
    when(mockDao.listAfterWithOffset(anyInt(), anyInt())).thenReturn(List.of());

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock
          .when(() -> Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION))
          .thenReturn(repository);
      MigrationUtil.migrateWorkflowInputNamespaceMap();
    }

    verify(repository, never()).listAll(any(), any());
    verify(repository, never()).getByName(any(), anyString(), any());
  }

  @Test
  @SuppressWarnings("unchecked")
  void migrateWorkflowInputNamespaceMap_updatesRawJsonWhenEntityListMissing() throws Exception {
    WorkflowDefinitionRepository repository = mock(WorkflowDefinitionRepository.class);
    EntityDAO<WorkflowDefinition> mockDao = mock(EntityDAO.class);

    UUID workflowId = UUID.fromString("00000000-0000-0000-0000-000000000001");
    String rawJson =
        String.format(
            """
            {
              "id": "%s",
              "fullyQualifiedName": "wf1",
              "trigger": {"output": ["relatedEntity", "updatedBy"]},
              "nodes": []
            }
            """,
            workflowId);

    WorkflowDefinition wf1 = buildMinimalWorkflowDefinition("wf1");

    when(repository.getDao()).thenReturn(mockDao);
    when(mockDao.listAfterWithOffset(anyInt(), eq(0))).thenReturn(List.of(rawJson));
    when(mockDao.listAfterWithOffset(anyInt(), eq(100))).thenReturn(List.of());
    doNothing().when(mockDao).update(eq(workflowId), eq("wf1"), anyString());
    when(repository.getByName(isNull(), eq("wf1"), any())).thenReturn(wf1);

    WorkflowHandler mockHandler = mock(WorkflowHandler.class);
    doNothing().when(mockHandler).deploy(any());

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedStatic<WorkflowHandler> wfhMock = mockStatic(WorkflowHandler.class);
        MockedConstruction<Workflow> ignored = mockConstruction(Workflow.class)) {
      entityMock
          .when(() -> Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION))
          .thenReturn(repository);
      wfhMock.when(WorkflowHandler::isInitialized).thenReturn(false);
      wfhMock.when(WorkflowHandler::getInstance).thenReturn(mockHandler);

      MigrationUtil.migrateWorkflowInputNamespaceMap();
    }

    verify(mockDao).update(eq(workflowId), eq("wf1"), anyString());
    verify(repository).getByName(isNull(), eq("wf1"), any());
  }

  @Test
  @SuppressWarnings("unchecked")
  void migrateWorkflowInputNamespaceMap_handlesRedeployExceptionGracefully() throws Exception {
    WorkflowDefinitionRepository repository = mock(WorkflowDefinitionRepository.class);
    EntityDAO<WorkflowDefinition> mockDao = mock(EntityDAO.class);

    UUID workflowId = UUID.fromString("00000000-0000-0000-0000-000000000002");
    String rawJson =
        String.format(
            """
            {
              "id": "%s",
              "fullyQualifiedName": "wf-fail",
              "trigger": {"output": ["relatedEntity"]},
              "nodes": []
            }
            """,
            workflowId);

    when(repository.getDao()).thenReturn(mockDao);
    when(mockDao.listAfterWithOffset(anyInt(), eq(0))).thenReturn(List.of(rawJson));
    when(mockDao.listAfterWithOffset(anyInt(), eq(100))).thenReturn(List.of());
    doNothing().when(mockDao).update(any(UUID.class), anyString(), anyString());
    when(repository.getByName(isNull(), eq("wf-fail"), any()))
        .thenThrow(new RuntimeException("Simulated redeploy failure"));

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock
          .when(() -> Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION))
          .thenReturn(repository);
      assertThrows(RuntimeException.class, () -> MigrationUtil.migrateWorkflowInputNamespaceMap());
    }
  }

  @Test
  @SuppressWarnings("unchecked")
  void migrateWorkflowInputNamespaceMap_skipsUpdateWhenJsonUnchanged() throws Exception {
    WorkflowDefinitionRepository repository = mock(WorkflowDefinitionRepository.class);
    EntityDAO<WorkflowDefinition> mockDao = mock(EntityDAO.class);

    String alreadyMigratedJson =
        """
        {
          "id": "00000000-0000-0000-0000-000000000001",
          "fullyQualifiedName": "wf1",
          "trigger": {"output": ["entityList", "updatedBy"]},
          "nodes": []
        }
        """;

    when(repository.getDao()).thenReturn(mockDao);
    when(mockDao.listAfterWithOffset(anyInt(), eq(0))).thenReturn(List.of(alreadyMigratedJson));
    when(mockDao.listAfterWithOffset(anyInt(), eq(100))).thenReturn(List.of());

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock
          .when(() -> Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION))
          .thenReturn(repository);
      MigrationUtil.migrateWorkflowInputNamespaceMap();
    }

    verify(mockDao, never()).update(any(UUID.class), anyString(), anyString());
  }

  private static WorkflowDefinition buildMinimalWorkflowDefinition(String name) {
    WorkflowDefinition wf = new WorkflowDefinition();
    wf.setName(name);
    wf.setFullyQualifiedName(name);
    return wf;
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
