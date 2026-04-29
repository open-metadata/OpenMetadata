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
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.jdbi3.locator.ConnectionType.MYSQL;
import static org.openmetadata.service.jdbi3.locator.ConnectionType.POSTGRES;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.lang.reflect.Method;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.statement.Update;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.openmetadata.service.resources.databases.DatasourceConfig;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.openmetadata.schema.entity.activity.ActivityEvent;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.resources.feeds.MessageParser;

class MigrationUtilTest {
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

  // ── extractVersionNum ──────────────────────────────────────────────────────
  //
  // Mirrors SQL: CAST(SUBSTRING_INDEX(extension, '.version.', -1) AS DOUBLE)
  // SUBSTRING_INDEX with count=-1 returns everything after the LAST delimiter.

  @Test
  void extractVersionNumFromStandardMinorVersion() {
    assertEquals(0.1, MigrationUtil.extractVersionNum("uuid.version.0.1"), 1e-9);
  }

  @Test
  void extractVersionNumFromHigherVersion() {
    assertEquals(1.5, MigrationUtil.extractVersionNum("uuid.version.1.5"), 1e-9);
  }

  @Test
  void extractVersionNumFromLargeVersion() {
    assertEquals(10.0, MigrationUtil.extractVersionNum("uuid.version.10.0"), 1e-9);
  }

  @Test
  void extractVersionNumFromWholeNumberVersion() {
    assertEquals(1.0, MigrationUtil.extractVersionNum("uuid.version.1"), 1e-9);
  }

  @Test
  void extractVersionNumReturnsZeroWhenNoVersionSegment() {
    assertEquals(0.0, MigrationUtil.extractVersionNum("uuid.notype.something"), 1e-9);
  }

  @Test
  void extractVersionNumReturnsZeroForEmptyString() {
    assertEquals(0.0, MigrationUtil.extractVersionNum(""), 1e-9);
  }

  @Test
  void extractVersionNumReturnsZeroWhenSuffixNotParseable() {
    assertEquals(0.0, MigrationUtil.extractVersionNum("uuid.version.notanumber"), 1e-9);
  }

  @Test
  void extractVersionNumUsesLastOccurrenceMatchingSqlSubstringIndex() {
    // SQL SUBSTRING_INDEX(str, '.version.', -1) takes after the LAST occurrence.
    // "a.version.x.version.2.0" → SQL gives "2.0" → 2.0
    assertEquals(2.0, MigrationUtil.extractVersionNum("a.version.x.version.2.0"), 1e-9);
  }

  @Test
  void extractVersionNumFromRealWorldExtensionFormat() {
    String uuid = UUID.randomUUID().toString();
    assertEquals(0.2, MigrationUtil.extractVersionNum(uuid + ".version.0.2"), 1e-9);
  }

  // ── extractChangedFieldKeys ────────────────────────────────────────────────
  //
  // Mirrors SQL UNION ALL + DISTINCT across fieldsAdded/Updated/Deleted .name,
  // with NULL and empty-string filtering. Java additionally sorts alphabetically.

  @Test
  void extractChangedFieldKeysFromAllThreeArrays() {
    String json =
        """
        {
          "changeDescription": {
            "fieldsAdded":   [{"name": "tags"}],
            "fieldsUpdated": [{"name": "description"}],
            "fieldsDeleted": [{"name": "owner"}]
          }
        }
        """;
    assertEquals(
        "[\"description\",\"owner\",\"tags\"]", MigrationUtil.extractChangedFieldKeys(json));
  }

  @Test
  void extractChangedFieldKeysSortsAlphabetically() {
    String json =
        """
        {
          "changeDescription": {
            "fieldsAdded": [{"name": "z_col"}, {"name": "a_col"}, {"name": "m_col"}],
            "fieldsUpdated": [],
            "fieldsDeleted": []
          }
        }
        """;
    assertEquals("[\"a_col\",\"m_col\",\"z_col\"]", MigrationUtil.extractChangedFieldKeys(json));
  }

  @Test
  void extractChangedFieldKeysDeduplicatesSameNameAcrossAddedAndUpdated() {
    String json =
        """
        {
          "changeDescription": {
            "fieldsAdded":   [{"name": "tags"}],
            "fieldsUpdated": [{"name": "tags"}],
            "fieldsDeleted": []
          }
        }
        """;
    assertEquals("[\"tags\"]", MigrationUtil.extractChangedFieldKeys(json));
  }

  @Test
  void extractChangedFieldKeysDeduplicatesAcrossAllThreeArrays() {
    String json =
        """
        {
          "changeDescription": {
            "fieldsAdded":   [{"name": "b"}, {"name": "a"}, {"name": "c"}],
            "fieldsUpdated": [{"name": "a"}, {"name": "d"}],
            "fieldsDeleted": [{"name": "e"}, {"name": "b"}]
          }
        }
        """;
    assertEquals("[\"a\",\"b\",\"c\",\"d\",\"e\"]", MigrationUtil.extractChangedFieldKeys(json));
  }

  @Test
  void extractChangedFieldKeysReturnsEmptyArrayWhenChangeDescriptionAbsent() {
    assertEquals(
        "[]", MigrationUtil.extractChangedFieldKeys("{\"name\": \"some_entity\"}"));
  }

  @Test
  void extractChangedFieldKeysReturnsEmptyArrayWhenChangeDescriptionIsNull() {
    assertEquals(
        "[]", MigrationUtil.extractChangedFieldKeys("{\"changeDescription\": null}"));
  }

  @Test
  void extractChangedFieldKeysReturnsEmptyArrayWhenAllArraysEmpty() {
    String json =
        """
        {
          "changeDescription": {
            "fieldsAdded": [],
            "fieldsUpdated": [],
            "fieldsDeleted": []
          }
        }
        """;
    assertEquals("[]", MigrationUtil.extractChangedFieldKeys(json));
  }

  @Test
  void extractChangedFieldKeysFiltersOutNullNameEntries() {
    String json =
        """
        {
          "changeDescription": {
            "fieldsAdded": [{"name": null}, {"name": "description"}],
            "fieldsUpdated": [],
            "fieldsDeleted": []
          }
        }
        """;
    assertEquals("[\"description\"]", MigrationUtil.extractChangedFieldKeys(json));
  }

  @Test
  void extractChangedFieldKeysFiltersOutEmptyStringNames() {
    String json =
        """
        {
          "changeDescription": {
            "fieldsAdded": [{"name": ""}, {"name": "tags"}],
            "fieldsUpdated": [],
            "fieldsDeleted": []
          }
        }
        """;
    assertEquals("[\"tags\"]", MigrationUtil.extractChangedFieldKeys(json));
  }

  @Test
  void extractChangedFieldKeysWithOnlyFieldsAddedOthersAbsent() {
    String json =
        """
        {
          "changeDescription": {
            "fieldsAdded": [{"name": "owner"}]
          }
        }
        """;
    assertDoesNotThrow(
        () -> assertEquals("[\"owner\"]", MigrationUtil.extractChangedFieldKeys(json)));
  }

  @Test
  void extractChangedFieldKeysWithFieldEntryMissingNameKey() {
    String json =
        """
        {
          "changeDescription": {
            "fieldsAdded": [{"oldValue": "x", "newValue": "y"}],
            "fieldsUpdated": [{"name": "tags"}],
            "fieldsDeleted": []
          }
        }
        """;
    assertDoesNotThrow(
        () -> assertEquals("[\"tags\"]", MigrationUtil.extractChangedFieldKeys(json)));
  }

  // ── backfillVersionMetadata ────────────────────────────────────────────────

  @Test
  void backfillIsNoOpWhenQueryReturnsEmptyBatch() {
    Handle bHandle = mock(Handle.class, RETURNS_DEEP_STUBS);
    when(bHandle.createQuery(any(String.class)).bind(anyString(), anyInt()).mapToMap().list())
        .thenReturn(List.of());

    assertDoesNotThrow(() -> MigrationUtil.backfillVersionMetadata(bHandle));
    verify(bHandle, never()).createUpdate(any(String.class));
  }

  @Test
  void backfillSelectsMysqlSqlWhenDatasourceIsMySQL() {
    Handle bHandle = mock(Handle.class, RETURNS_DEEP_STUBS);
    when(bHandle.createQuery(any(String.class)).bind(anyString(), anyInt()).mapToMap().list())
        .thenReturn(List.of(versionRow("uuid.version.0.1", emptyChangeDescriptionJson())));

    try (MockedStatic<DatasourceConfig> ds = mockStatic(DatasourceConfig.class)) {
      DatasourceConfig cfg = mock(DatasourceConfig.class);
      ds.when(DatasourceConfig::getInstance).thenReturn(cfg);
      when(cfg.isMySQL()).thenReturn(true);

      assertDoesNotThrow(() -> MigrationUtil.backfillVersionMetadata(bHandle));

      ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
      verify(bHandle).createUpdate(sqlCaptor.capture());
      String sql = sqlCaptor.getValue();
      assertTrue(sql.contains("changedFieldKeys = :changedFieldKeys"));
      assertFalse(sql.contains("::jsonb"));
    }
  }

  @Test
  void backfillSelectsPostgresSqlWhenDatasourceIsPostgres() {
    Handle bHandle = mock(Handle.class, RETURNS_DEEP_STUBS);
    when(bHandle.createQuery(any(String.class)).bind(anyString(), anyInt()).mapToMap().list())
        .thenReturn(List.of(versionRow("uuid.version.1.0", emptyChangeDescriptionJson())));

    try (MockedStatic<DatasourceConfig> ds = mockStatic(DatasourceConfig.class)) {
      DatasourceConfig cfg = mock(DatasourceConfig.class);
      ds.when(DatasourceConfig::getInstance).thenReturn(cfg);
      when(cfg.isMySQL()).thenReturn(false);

      assertDoesNotThrow(() -> MigrationUtil.backfillVersionMetadata(bHandle));

      ArgumentCaptor<String> sqlCaptor = ArgumentCaptor.forClass(String.class);
      verify(bHandle).createUpdate(sqlCaptor.capture());
      assertTrue(sqlCaptor.getValue().contains("::jsonb"));
    }
  }

  @Test
  void backfillFallsBackToVersionNumOnlyUpdateWhenFullUpdateFails() {
    Handle bHandle = mock(Handle.class, RETURNS_DEEP_STUBS);
    when(bHandle.createQuery(any(String.class)).bind(anyString(), anyInt()).mapToMap().list())
        .thenReturn(List.of(versionRow("uuid.version.0.1", emptyChangeDescriptionJson())));

    when(bHandle.createUpdate(argThat(s -> s != null && s.contains("changedFieldKeys"))))
        .thenThrow(new RuntimeException("Simulated column-too-wide error"));
    Update fallbackUpdate = mock(Update.class, RETURNS_DEEP_STUBS);
    when(bHandle.createUpdate(argThat(s -> s != null && !s.contains("changedFieldKeys"))))
        .thenReturn(fallbackUpdate);

    try (MockedStatic<DatasourceConfig> ds = mockStatic(DatasourceConfig.class)) {
      DatasourceConfig cfg = mock(DatasourceConfig.class);
      ds.when(DatasourceConfig::getInstance).thenReturn(cfg);
      when(cfg.isMySQL()).thenReturn(true);

      assertDoesNotThrow(() -> MigrationUtil.backfillVersionMetadata(bHandle));

      verify(bHandle, times(1))
          .createUpdate(argThat(s -> s != null && s.contains("changedFieldKeys")));
      verify(bHandle, times(1))
          .createUpdate(argThat(s -> s != null && !s.contains("changedFieldKeys")));
    }
  }

  @Test
  void backfillHandlesNullJsonColumnWithoutException() {
    Handle bHandle = mock(Handle.class, RETURNS_DEEP_STUBS);
    Map<String, Object> row = new HashMap<>();
    row.put("id", UUID.randomUUID().toString());
    row.put("extension", "uuid.version.0.1");
    row.put("json", null);
    when(bHandle.createQuery(any(String.class)).bind(anyString(), anyInt()).mapToMap().list())
        .thenReturn(List.of(row));

    try (MockedStatic<DatasourceConfig> ds = mockStatic(DatasourceConfig.class)) {
      DatasourceConfig cfg = mock(DatasourceConfig.class);
      ds.when(DatasourceConfig::getInstance).thenReturn(cfg);
      when(cfg.isMySQL()).thenReturn(true);

      assertDoesNotThrow(() -> MigrationUtil.backfillVersionMetadata(bHandle));
      verify(bHandle).createUpdate(any(String.class));
    }
  }

  @Test
  void backfillProcessesMultipleRowsInOneBatch() {
    Handle bHandle = mock(Handle.class, RETURNS_DEEP_STUBS);
    List<Map<String, Object>> batch =
        List.of(
            versionRow("uuid1.version.0.1", emptyChangeDescriptionJson()),
            versionRow("uuid2.version.1.0", emptyChangeDescriptionJson()),
            versionRow("uuid3.version.2.0", emptyChangeDescriptionJson()));
    when(bHandle.createQuery(any(String.class)).bind(anyString(), anyInt()).mapToMap().list())
        .thenReturn(batch);

    try (MockedStatic<DatasourceConfig> ds = mockStatic(DatasourceConfig.class)) {
      DatasourceConfig cfg = mock(DatasourceConfig.class);
      ds.when(DatasourceConfig::getInstance).thenReturn(cfg);
      when(cfg.isMySQL()).thenReturn(true);

      assertDoesNotThrow(() -> MigrationUtil.backfillVersionMetadata(bHandle));
      verify(bHandle, times(3)).createUpdate(any(String.class));
    }
  }

  private static Map<String, Object> versionRow(String extension, String json) {
    Map<String, Object> row = new HashMap<>();
    row.put("id", UUID.randomUUID().toString());
    row.put("extension", extension);
    row.put("json", json);
    return row;
  }

  private static String emptyChangeDescriptionJson() {
    return
        "{\"changeDescription\":{\"fieldsAdded\":[],\"fieldsUpdated\":[],\"fieldsDeleted\":[]}}";
  }

  private Object invokePrivateStatic(String methodName, Class<?>[] parameterTypes, Object... args)
      throws Exception {
    Method method = MigrationUtil.class.getDeclaredMethod(methodName, parameterTypes);
    method.setAccessible(true);

    return method.invoke(null, args);
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
