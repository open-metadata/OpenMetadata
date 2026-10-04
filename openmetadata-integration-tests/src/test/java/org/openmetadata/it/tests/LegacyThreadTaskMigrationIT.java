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

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.node.ObjectNode;
import java.time.Duration;
import java.util.Map;
import java.util.UUID;
import org.awaitility.Awaitility;
import org.jdbi.v3.core.Handle;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.fluent.DatabaseSchemas;
import org.openmetadata.sdk.fluent.Databases;
import org.openmetadata.service.migration.utils.v200.MigrationUtil.TaskWorkflow;

@Isolated("sweeps legacy task tables and backfills task workflows")
@ExtendWith(TestNamespaceExtension.class)
class LegacyThreadTaskMigrationIT {
  @ParameterizedTest
  @CsvSource({
    "thread_entity, UpdateDescription, DescriptionUpdate, Completed",
    "thread_entity_legacy, UpdateDescription, DescriptionUpdate, Completed",
    "thread_entity_archived, UpdateDescription, DescriptionUpdate, Completed",
    "thread_entity, RequestApproval, RequestApproval, Approved"
  })
  void migratesLateTasksOnceAndPreservesTheirHistory(
      String source,
      String oldType,
      TaskEntityType type,
      TaskEntityStatus status,
      TestNamespace ns) {
    Table table = createTestTable(ns);
    User admin = SdkClients.adminClient().users().getByName("admin");
    UUID taskId = UUID.randomUUID();
    UUID postId = UUID.randomUUID();
    String legacyJson = legacyTask(taskId, postId, table, admin, oldType);

    TestSuiteBootstrap.getJdbi()
        .useHandle(
            handle -> {
              boolean createdTable = createLegacyTableIfMissing(handle, source);
              try {
                insertLegacyTask(handle, source, legacyJson);
                TaskWorkflow migration = new TaskWorkflow(handle);
                migration.migrateRemainingThreadTasks();

                Task task =
                    SdkClients.adminClient()
                        .tasks()
                        .get(taskId.toString(), "about,assignees,createdBy,comments");
                assertEquals(taskId, task.getId());
                assertEquals(type, task.getType());
                assertEquals(status, task.getStatus());
                assertEquals(table.getId(), task.getAbout().getId());
                assertEquals(admin.getId(), task.getCreatedBy().getId());
                assertEquals(admin.getId(), task.getAssignees().getFirst().getId());
                assertEquals(1000L, task.getCreatedAt());
                assertEquals(2000L, task.getUpdatedAt());
                assertNull(task.getWorkflowInstanceId());
                if (type == TaskEntityType.DescriptionUpdate) {
                  assertEquals(
                      "accepted",
                      JsonUtils.valueToTree(task.getPayload()).path("newDescription").asText());
                }
                assertEquals(postId, task.getComments().getFirst().getId());
                assertEquals("Please review", task.getComments().getFirst().getMessage());
                assertEquals("accepted", task.getResolution().getNewValue());
                assertEquals(admin.getId(), task.getResolution().getResolvedBy().getId());
                assertEquals(2000L, task.getResolution().getResolvedAt());

                String stored = storedTask(handle, taskId);
                migration.migrateRemainingThreadTasks();
                assertEquals(stored, storedTask(handle, taskId));
                assertEquals(
                    1,
                    handle
                        .createQuery(
                            "SELECT COUNT(*) FROM task_migration_mapping WHERE old_thread_id = :id")
                        .bind("id", taskId.toString())
                        .mapTo(Integer.class)
                        .one());
              } finally {
                removeLegacyTask(handle, source, taskId, createdTable);
              }
            });
  }

  @Test
  void startsAWorkflowForAnOpenMigratedTask(TestNamespace ns) {
    Table table = createTestTable(ns);
    User admin = SdkClients.adminClient().users().getByName("admin");
    UUID taskId = UUID.randomUUID();
    ObjectNode json =
        (ObjectNode)
            JsonUtils.readTree(
                legacyTask(taskId, UUID.randomUUID(), table, admin, "UpdateDescription"));
    ObjectNode details = (ObjectNode) json.get("task");
    details.put("status", "Open");
    details.remove("closedBy");
    details.remove("closedAt");
    details.remove("newValue");

    TestSuiteBootstrap.getJdbi()
        .useHandle(
            handle -> {
              String source = "thread_entity";
              boolean createdTable = createLegacyTableIfMissing(handle, source);
              try {
                insertLegacyTask(handle, source, json.toString());
                new TaskWorkflow(handle).migrateRemainingThreadTasks();
                Awaitility.await("migrated task becomes actionable")
                    .atMost(Duration.ofSeconds(30))
                    .untilAsserted(
                        () -> {
                          Task task = SdkClients.adminClient().tasks().get(taskId.toString());
                          assertEquals(TaskEntityStatus.Open, task.getStatus());
                          assertNotNull(task.getWorkflowInstanceId());
                          assertNotNull(task.getAvailableTransitions());
                          assertFalse(task.getAvailableTransitions().isEmpty());
                        });
              } finally {
                removeLegacyTask(handle, source, taskId, createdTable);
              }
            });
  }

  @Test
  void failsTheSweepWhenATaskCannotBeRead() {
    UUID taskId = UUID.randomUUID();
    String json =
        "{\"id\":\"%s\",\"type\":\"Task\",\"threadTs\":1000,\"task\":{\"type\":\"UnknownTask\"}}"
            .formatted(taskId);

    TestSuiteBootstrap.getJdbi()
        .useHandle(
            handle -> {
              String source = "thread_entity";
              boolean createdTable = createLegacyTableIfMissing(handle, source);
              try {
                insertLegacyTask(handle, source, json);
                TaskWorkflow migration = new TaskWorkflow(handle);
                IllegalStateException error =
                    assertThrows(
                        IllegalStateException.class, migration::migrateRemainingThreadTasks);
                assertTrue(error.getMessage().contains("failed=1"));
                assertEquals(
                    1,
                    handle
                        .createQuery("SELECT COUNT(*) FROM thread_entity WHERE id = :id")
                        .bind("id", taskId.toString())
                        .mapTo(Integer.class)
                        .one());
              } finally {
                removeLegacyTask(handle, source, taskId, createdTable);
              }
            });
  }

  private String legacyTask(UUID taskId, UUID postId, Table table, User admin, String oldType) {
    return """
        {
          "id":"%s", "type":"Task", "about":"<#E::table::%s>",
          "entityRef":%s, "createdBy":"admin", "updatedBy":"admin",
          "threadTs":1000, "updatedAt":2000, "message":"Update description",
          "task":{
            "id":42, "type":"%s", "status":"Closed",
            "assignees":[%s], "closedBy":"admin", "closedAt":2000,
            "oldValue":"old", "suggestion":"suggested", "newValue":"accepted"
          },
          "posts":[{"id":"%s", "from":"admin", "message":"Please review", "postTs":1500}]
        }
        """
        .formatted(
            taskId,
            table.getFullyQualifiedName(),
            JsonUtils.pojoToJson(table.getEntityReference()),
            oldType,
            JsonUtils.pojoToJson(admin.getEntityReference()),
            postId);
  }

  private boolean createLegacyTableIfMissing(Handle handle, String source) {
    String scope = isPostgres() ? "table_schema = current_schema()" : "table_schema = DATABASE()";
    boolean exists =
        handle
                .createQuery(
                    "SELECT COUNT(*) FROM information_schema.tables WHERE "
                        + scope
                        + " AND table_name = :name")
                .bind("name", source)
                .mapTo(Integer.class)
                .one()
            > 0;
    if (!exists) {
      String columns =
          isPostgres()
              ? "json JSONB NOT NULL, id VARCHAR(36) GENERATED ALWAYS AS (json ->> 'id') STORED PRIMARY KEY, type VARCHAR(64) GENERATED ALWAYS AS (json ->> 'type') STORED, createdAt BIGINT GENERATED ALWAYS AS ((json ->> 'threadTs')::bigint) STORED"
              : "json JSON NOT NULL, id VARCHAR(36) GENERATED ALWAYS AS (json ->> '$.id') STORED PRIMARY KEY, type VARCHAR(64) GENERATED ALWAYS AS (json ->> '$.type') STORED, createdAt BIGINT GENERATED ALWAYS AS (json ->> '$.threadTs') STORED";
      handle.execute("CREATE TABLE " + source + " (" + columns + ")");
    }
    return !exists;
  }

  private void insertLegacyTask(Handle handle, String source, String json) {
    String value = isPostgres() ? "CAST(:json AS jsonb)" : ":json";
    handle
        .createUpdate("INSERT INTO " + source + " (json) VALUES (" + value + ")")
        .bind("json", json)
        .execute();
  }

  private String storedTask(Handle handle, UUID id) {
    return handle
        .createQuery("SELECT json FROM task_entity WHERE id = :id")
        .bind("id", id.toString())
        .mapTo(String.class)
        .one();
  }

  private Table createTestTable(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    Database database =
        Databases.create()
            .name(ns.prefix("task-migration-db"))
            .in(service.getFullyQualifiedName())
            .execute();
    DatabaseSchema schema =
        DatabaseSchemas.create()
            .name(ns.prefix("task-migration-schema"))
            .in(database.getFullyQualifiedName())
            .execute();
    return TableTestFactory.createSimple(ns, schema.getFullyQualifiedName());
  }

  private void removeLegacyTask(Handle handle, String source, UUID id, boolean createdTable) {
    int tasks =
        handle
            .createQuery("SELECT COUNT(*) FROM task_entity WHERE id = :id")
            .bind("id", id.toString())
            .mapTo(Integer.class)
            .one();
    if (tasks > 0) {
      SdkClients.adminClient().tasks().delete(id.toString(), Map.of("hardDelete", "true"));
    }
    handle
        .createUpdate("DELETE FROM " + source + " WHERE id = :id")
        .bind("id", id.toString())
        .execute();
    handle
        .createUpdate("DELETE FROM task_migration_mapping WHERE old_thread_id = :id")
        .bind("id", id.toString())
        .execute();
    if (createdTable) {
      handle.execute("DROP TABLE " + source);
    }
  }

  private boolean isPostgres() {
    return !"mysql".equalsIgnoreCase(System.getProperty("databaseType", "postgres"));
  }
}
