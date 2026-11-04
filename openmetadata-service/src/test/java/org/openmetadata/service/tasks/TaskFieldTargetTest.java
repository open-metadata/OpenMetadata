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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mockStatic;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.BadRequestException;

class TaskFieldTargetTest {
  private MockedStatic<Entity> entity;

  @BeforeEach
  void setUp() {
    Column child = new Column().withName("child");
    Table table =
        new Table()
            .withId(UUID.randomUUID())
            .withName("orders")
            .withFullyQualifiedName("svc.db.schema.orders")
            .withColumns(
                List.of(
                    new Column().withName("amount"),
                    new Column().withName("profile").withChildren(List.of(child))));
    entity = mockStatic(Entity.class);
    entity
        .when(() -> Entity.getEntity(any(EntityReference.class), anyString(), any(Include.class)))
        .thenReturn(table);
  }

  @AfterEach
  void tearDown() {
    entity.close();
  }

  @ParameterizedTest
  @ValueSource(
      strings = {"description", "columns.amount.description", "columns.profile.child.description"})
  void aDescriptionTaskOnAnExistingField_isAccepted(String fieldPath) {
    assertDoesNotThrow(() -> TaskFieldTarget.require(descriptionTask(fieldPath)));
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "columns.profile.child",
        "columns::amount::description",
        "columns.amount.tags",
        "columns.missing.description",
        "columns.child.description",
        "entity"
      })
  void aDescriptionTaskOnAnythingElse_isRefused(String fieldPath) {
    assertThrows(
        BadRequestException.class, () -> TaskFieldTarget.require(descriptionTask(fieldPath)));
  }

  @Test
  void aTaskWithoutAFieldPath_isAboutTheEntityItself() {
    Task description = task(TaskEntityType.DescriptionUpdate, Map.of("newDescription", "x"));
    Task tags = task(TaskEntityType.TagUpdate, Map.of());

    TaskFieldTarget.fillDefault(description);
    TaskFieldTarget.fillDefault(tags);

    assertEquals("description", fieldPathOf(description));
    assertEquals("tags", fieldPathOf(tags));
    assertDoesNotThrow(() -> TaskFieldTarget.require(description));
  }

  @Test
  void aWrittenFieldPathIsKept() {
    Task task = descriptionTask("columns.amount.description");

    TaskFieldTarget.fillDefault(task);

    assertEquals("columns.amount.description", fieldPathOf(task));
  }

  @Test
  void aTagTaskEndsInTags() {
    assertDoesNotThrow(() -> TaskFieldTarget.require(tagTask("columns.amount.tags")));
    assertDoesNotThrow(() -> TaskFieldTarget.require(tagTask("tags")));
    assertThrows(
        BadRequestException.class, () -> TaskFieldTarget.require(tagTask("columns.amount")));
  }

  @Test
  void aSuggestionIsCheckedForItsOwnProperty() {
    assertDoesNotThrow(
        () -> TaskFieldTarget.require(suggestion("Tag", "columns.profile.child.tags")));
    assertThrows(
        BadRequestException.class,
        () -> TaskFieldTarget.require(suggestion("Description", "columns.profile.child.tags")));
  }

  @Test
  void aSuggestionThatChangesNoField_isNotChecked() {
    assertDoesNotThrow(() -> TaskFieldTarget.require(suggestion("Owner", "anything")));
  }

  @Test
  void anEditIsCheckedOnlyWhenItChangesThePath() {
    Task original = descriptionTask("columns.gone.description");

    assertDoesNotThrow(
        () ->
            TaskFieldTarget.requireChanged(original, descriptionTask("columns.gone.description")));
    assertThrows(
        BadRequestException.class,
        () ->
            TaskFieldTarget.requireChanged(original, descriptionTask("columns.other.description")));
  }

  @Test
  void approvalChecksTheRequestPayloadOverTheTasks() {
    Task task = descriptionTask("columns.amount.description");

    assertThrows(
        BadRequestException.class,
        () ->
            TaskFieldTarget.requireToApply(
                task,
                TaskResolutionType.Approved,
                Map.of("fieldPath", "columns.missing.description")));
  }

  @ParameterizedTest
  @EnumSource(
      value = TaskResolutionType.class,
      names = {"Rejected", "Cancelled", "Revoked", "TimedOut", "Expired"})
  void decliningIsNeverBlockedByTheFieldPath(TaskResolutionType declined) {
    Task task = descriptionTask("columns.missing.description");

    assertDoesNotThrow(() -> TaskFieldTarget.requireToApply(task, declined, null));
  }

  private static String fieldPathOf(Task task) {
    return JsonUtils.valueToTree(task.getPayload()).path("fieldPath").asText(null);
  }

  private static Task descriptionTask(String fieldPath) {
    return task(
        TaskEntityType.DescriptionUpdate, Map.of("fieldPath", fieldPath, "newDescription", "x"));
  }

  private static Task tagTask(String fieldPath) {
    return task(TaskEntityType.TagUpdate, Map.of("fieldPath", fieldPath));
  }

  private static Task suggestion(String type, String fieldPath) {
    return task(
        TaskEntityType.Suggestion,
        Map.of("suggestionType", type, "fieldPath", fieldPath, "suggestedValue", "x"));
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
