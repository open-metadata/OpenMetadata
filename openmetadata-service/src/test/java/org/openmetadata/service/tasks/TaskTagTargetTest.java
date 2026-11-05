/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.service.tasks;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mockStatic;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.BadRequestException;

class TaskTagTargetTest {
  private MockedStatic<Entity> entity;

  @BeforeEach
  void setUp() {
    Table table =
        new Table()
            .withId(UUID.randomUUID())
            .withName("orders")
            .withFullyQualifiedName("svc.db.schema.orders")
            .withColumns(
                List.of(
                    new Column().withName("id").withDataType(ColumnDataType.INT),
                    new Column().withName("amount").withDataType(ColumnDataType.DOUBLE)));
    entity = mockStatic(Entity.class);
    entity
        .when(() -> Entity.getEntity(any(EntityReference.class), anyString(), any(Include.class)))
        .thenReturn(table);
  }

  @AfterEach
  void tearDown() {
    entity.close();
  }

  @Test
  void aFieldOfTheEntityIsAccepted() {
    for (String fieldPath : List.of("columns.amount.tags", "columns::amount::tags", "columns.id")) {
      assertDoesNotThrow(() -> TaskTagTarget.requireTagField(tagTask(fieldPath)), fieldPath);
    }
  }

  @Test
  void theEntityItselfIsAccepted() {
    for (String fieldPath : List.of("tags", "entity", "")) {
      assertDoesNotThrow(() -> TaskTagTarget.requireTagField(tagTask(fieldPath)), fieldPath);
    }
  }

  @Test
  void aPathNamingNoFieldOfTheEntityIsRefused() {
    for (String fieldPath : List.of("columns.missing", "orders.amount", "charts::amount::tags")) {
      BadRequestException refused =
          assertThrows(
              BadRequestException.class,
              () -> TaskTagTarget.requireTagField(tagTask(fieldPath)),
              fieldPath);
      assertTrue(refused.getMessage().contains(fieldPath), refused.getMessage());
    }
  }

  @Test
  void theRequestsFieldPathIsTheOneJudgedOnApply() {
    Task task = tagTask("columns.amount.tags");
    Map<String, Object> request = Map.of("fieldPath", "columns.missing");
    assertThrows(
        BadRequestException.class,
        () -> TaskTagTarget.requireTagFieldToApply(task, TaskResolutionType.Approved, request));
    assertDoesNotThrow(
        () -> TaskTagTarget.requireTagFieldToApply(task, null, Map.of("fieldPath", "tags")));
  }

  @Test
  void decliningATaskIsNotJudged() {
    Task task = tagTask("columns.missing");
    for (TaskResolutionType declined :
        List.of(TaskResolutionType.Rejected, TaskResolutionType.Cancelled)) {
      assertDoesNotThrow(
          () -> TaskTagTarget.requireTagFieldToApply(task, declined, null), declined.value());
    }
  }

  @Test
  void onlyTagSuggestionsAreJudged() {
    Task description =
        task(
            TaskEntityType.Suggestion,
            Map.of("suggestionType", "Description", "fieldPath", "columns.missing"));
    Task tag =
        task(
            TaskEntityType.Suggestion,
            Map.of("suggestionType", "Tag", "fieldPath", "columns.missing"));
    assertDoesNotThrow(() -> TaskTagTarget.requireTagField(description));
    assertThrows(BadRequestException.class, () -> TaskTagTarget.requireTagField(tag));
  }

  @Test
  void aPathThroughANestedFieldListNamesItsFieldByTheRestOfThePath() {
    assertEquals(
        "requestSchema::\"default.name.last_name\"::tags",
        TaskTagTarget.locatablePath("requestSchema.schemaFields.default.name.last_name"));
    assertEquals(
        "messageSchema::\"order.id\"::tags",
        TaskTagTarget.locatablePath("messageSchema.schemaFields.\"order.id\".tags"));
    assertEquals(
        "dataModel::\"total\"::tags", TaskTagTarget.locatablePath("dataModel.columns.total"));
    for (String unchanged : List.of("columns.amount.tags", "columns::amount::tags", "tags")) {
      assertEquals(unchanged, TaskTagTarget.locatablePath(unchanged));
    }
  }

  private static Task tagTask(String fieldPath) {
    return task(TaskEntityType.TagUpdate, Map.of("fieldPath", fieldPath));
  }

  private static Task task(TaskEntityType type, Map<String, Object> payload) {
    return new Task()
        .withId(UUID.randomUUID())
        .withType(type)
        .withAbout(
            new EntityReference()
                .withId(UUID.randomUUID())
                .withType(Entity.TABLE)
                .withFullyQualifiedName("svc.db.schema.orders"))
        .withPayload(payload);
  }
}
