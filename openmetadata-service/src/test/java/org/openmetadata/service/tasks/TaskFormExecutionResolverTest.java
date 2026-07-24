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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.schema.entity.feed.FormSchema;
import org.openmetadata.schema.entity.feed.TaskFormSchema;
import org.openmetadata.schema.entity.feed.UiSchema;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.TaskCategory;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.TaskFormSchemaRepository;
import org.openmetadata.service.tasks.TaskFormExecutionResolver.HandlerType;
import org.openmetadata.service.tasks.TaskFormExecutionResolver.TaskExecutionBinding;
import org.openmetadata.service.tasks.TaskFormExecutionResolver.TaskExecutionPlan;

class TaskFormExecutionResolverTest {

  @Test
  void resolveFallsBackToDefaultDescriptionBinding() {
    Task task =
        new Task()
            .withId(UUID.randomUUID())
            .withType(TaskEntityType.DescriptionUpdate)
            .withCategory(TaskCategory.MetadataUpdate);
    TaskFormSchemaRepository repository = mock(TaskFormSchemaRepository.class);

    try (MockedStatic<Entity> entityMock = Mockito.mockStatic(Entity.class)) {
      entityMock
          .when(() -> Entity.getEntityRepository(Entity.TASK_FORM_SCHEMA))
          .thenReturn(repository);
      when(repository.resolve(
              TaskEntityType.DescriptionUpdate.value(), TaskCategory.MetadataUpdate.value(), null))
          .thenReturn(Optional.empty());

      TaskExecutionBinding binding = TaskFormExecutionResolver.resolve(task);

      assertEquals(HandlerType.DESCRIPTION_UPDATE, binding.handlerType());
      assertEquals(MetadataOperation.EDIT_DESCRIPTION, binding.permissionOperation());
      assertEquals("fieldPath", binding.fieldPathField());
      assertEquals("newDescription", binding.valueField());
    }
  }

  @Test
  void resolveUsesSchemaProvidedHandlerBinding() {
    Task task =
        new Task()
            .withId(UUID.randomUUID())
            .withType(TaskEntityType.CustomTask)
            .withCategory(TaskCategory.Custom);
    TaskFormSchemaRepository repository = mock(TaskFormSchemaRepository.class);
    TaskFormSchema schema =
        new TaskFormSchema()
            .withName("CustomDescriptionTask")
            .withTaskType(TaskEntityType.CustomTask.value())
            .withTaskCategory(TaskCategory.Custom.value())
            .withFormSchema(new FormSchema().withAdditionalProperty("type", "object"))
            .withUiSchema(
                new UiSchema()
                    .withAdditionalProperty(
                        "ui:handler",
                        Map.of(
                            "type",
                            "descriptionUpdate",
                            "permission",
                            "EDIT_DESCRIPTION",
                            "fieldPathField",
                            "targetField",
                            "valueField",
                            "proposedText")));

    try (MockedStatic<Entity> entityMock = Mockito.mockStatic(Entity.class)) {
      entityMock
          .when(() -> Entity.getEntityRepository(Entity.TASK_FORM_SCHEMA))
          .thenReturn(repository);
      when(repository.resolve(TaskEntityType.CustomTask.value(), TaskCategory.Custom.value(), null))
          .thenReturn(Optional.of(schema));

      TaskExecutionBinding binding = TaskFormExecutionResolver.resolve(task);

      assertEquals(HandlerType.DESCRIPTION_UPDATE, binding.handlerType());
      assertEquals(MetadataOperation.EDIT_DESCRIPTION, binding.permissionOperation());
      assertEquals("targetField", binding.fieldPathField());
      assertEquals("proposedText", binding.valueField());
    }
  }

  @Test
  void resolveUsesTypeOnlyLookupWhenTaskCategoryIsMissing() {
    Task task = new Task().withId(UUID.randomUUID()).withType(TaskEntityType.CustomTask);
    TaskFormSchemaRepository repository = mock(TaskFormSchemaRepository.class);
    TaskFormSchema schema =
        new TaskFormSchema()
            .withName("CustomDescriptionTask")
            .withTaskType(TaskEntityType.CustomTask.value())
            .withTaskCategory(TaskCategory.Custom.value())
            .withFormSchema(new FormSchema().withAdditionalProperty("type", "object"))
            .withUiSchema(
                new UiSchema()
                    .withAdditionalProperty(
                        "ui:handler",
                        Map.of(
                            "type",
                            "descriptionUpdate",
                            "permission",
                            "EDIT_DESCRIPTION",
                            "fieldPathField",
                            "targetField",
                            "valueField",
                            "proposedText")));

    try (MockedStatic<Entity> entityMock = Mockito.mockStatic(Entity.class)) {
      entityMock
          .when(() -> Entity.getEntityRepository(Entity.TASK_FORM_SCHEMA))
          .thenReturn(repository);
      when(repository.resolve(TaskEntityType.CustomTask.value(), null, null))
          .thenReturn(Optional.of(schema));

      TaskExecutionBinding binding = TaskFormExecutionResolver.resolve(task);

      assertEquals(HandlerType.DESCRIPTION_UPDATE, binding.handlerType());
      assertEquals(MetadataOperation.EDIT_DESCRIPTION, binding.permissionOperation());
      assertEquals("targetField", binding.fieldPathField());
      assertEquals("proposedText", binding.valueField());
    }
  }

  @Test
  void resolveExecutionPlanUsesSchemaProvidedActions() {
    Task task =
        new Task()
            .withId(UUID.randomUUID())
            .withType(TaskEntityType.CustomTask)
            .withCategory(TaskCategory.Custom);
    TaskFormSchemaRepository repository = mock(TaskFormSchemaRepository.class);
    TaskFormSchema schema =
        new TaskFormSchema()
            .withName("CustomExecutionTask")
            .withTaskType(TaskEntityType.CustomTask.value())
            .withTaskCategory(TaskCategory.Custom.value())
            .withFormSchema(new FormSchema().withAdditionalProperty("type", "object"))
            .withUiSchema(
                new UiSchema()
                    .withAdditionalProperty(
                        "ui:execution",
                        Map.of(
                            "approve",
                            Map.of(
                                "actions",
                                java.util.List.of(
                                    Map.of(
                                        "type",
                                        "setDescription",
                                        "fieldPathField",
                                        "targetField",
                                        "valueField",
                                        "proposedText"))))));

    try (MockedStatic<Entity> entityMock = Mockito.mockStatic(Entity.class)) {
      entityMock
          .when(() -> Entity.getEntityRepository(Entity.TASK_FORM_SCHEMA))
          .thenReturn(repository);
      when(repository.resolve(TaskEntityType.CustomTask.value(), TaskCategory.Custom.value(), null))
          .thenReturn(Optional.of(schema));

      TaskExecutionPlan executionPlan = TaskFormExecutionResolver.resolveExecutionPlan(task);

      assertNotNull(executionPlan);
      assertEquals(1, executionPlan.approveActions().size());
      assertEquals(
          TaskFormExecutionResolver.ActionType.SET_DESCRIPTION,
          executionPlan.approveActions().get(0).actionType());
      assertEquals("targetField", executionPlan.approveActions().get(0).fieldPathField());
      assertEquals("proposedText", executionPlan.approveActions().get(0).valueField());
    }
  }

  @Test
  void resolveExecutionPlanUsesTypeOnlyLookupWhenTaskCategoryIsMissing() {
    Task task = new Task().withId(UUID.randomUUID()).withType(TaskEntityType.CustomTask);
    TaskFormSchemaRepository repository = mock(TaskFormSchemaRepository.class);
    TaskFormSchema schema =
        new TaskFormSchema()
            .withName("CustomExecutionTask")
            .withTaskType(TaskEntityType.CustomTask.value())
            .withTaskCategory(TaskCategory.Custom.value())
            .withFormSchema(new FormSchema().withAdditionalProperty("type", "object"))
            .withUiSchema(
                new UiSchema()
                    .withAdditionalProperty(
                        "ui:execution",
                        Map.of(
                            "approve",
                            Map.of(
                                "actions",
                                java.util.List.of(
                                    Map.of(
                                        "type",
                                        "setDescription",
                                        "fieldPathField",
                                        "targetField",
                                        "valueField",
                                        "proposedText"))))));

    try (MockedStatic<Entity> entityMock = Mockito.mockStatic(Entity.class)) {
      entityMock
          .when(() -> Entity.getEntityRepository(Entity.TASK_FORM_SCHEMA))
          .thenReturn(repository);
      when(repository.resolve(TaskEntityType.CustomTask.value(), null, null))
          .thenReturn(Optional.of(schema));

      TaskExecutionPlan executionPlan = TaskFormExecutionResolver.resolveExecutionPlan(task);

      assertNotNull(executionPlan);
      assertEquals(1, executionPlan.approveActions().size());
      assertEquals(
          TaskFormExecutionResolver.ActionType.SET_DESCRIPTION,
          executionPlan.approveActions().get(0).actionType());
      assertEquals("targetField", executionPlan.approveActions().get(0).fieldPathField());
      assertEquals("proposedText", executionPlan.approveActions().get(0).valueField());
    }
  }

  @Test
  void resolveTreatsReviewFeedbackTasksAsFeedbackApproval() {
    Task task =
        new Task()
            .withId(UUID.randomUUID())
            .withType(TaskEntityType.TagUpdate)
            .withCategory(TaskCategory.Review)
            .withPayload(Map.of("feedback", Map.of("feedbackType", "FalsePositive")));
    TaskFormSchemaRepository repository = mock(TaskFormSchemaRepository.class);

    try (MockedStatic<Entity> entityMock = Mockito.mockStatic(Entity.class)) {
      entityMock
          .when(() -> Entity.getEntityRepository(Entity.TASK_FORM_SCHEMA))
          .thenReturn(repository);
      when(repository.resolve(
              TaskEntityType.TagUpdate.value(), TaskCategory.Review.value(), task.getPayload()))
          .thenReturn(Optional.empty());

      TaskExecutionBinding binding = TaskFormExecutionResolver.resolve(task);

      assertEquals(HandlerType.FEEDBACK_APPROVAL, binding.handlerType());
      assertEquals(MetadataOperation.EDIT_ALL, binding.permissionOperation());
      assertNull(binding.fieldPathField());
    }
  }

  @Test
  void resolveDisambiguatesSuggestionSchemasUsingPayloadType() {
    Task task =
        new Task()
            .withId(UUID.randomUUID())
            .withType(TaskEntityType.Suggestion)
            .withCategory(TaskCategory.MetadataUpdate)
            .withPayload(Map.of("suggestionType", "Tag", "suggestedValue", "[]"));
    TaskFormSchemaRepository repository = mock(TaskFormSchemaRepository.class);
    TaskFormSchema schema =
        new TaskFormSchema()
            .withName("TagSuggestion")
            .withTaskType(TaskEntityType.Suggestion.value())
            .withTaskCategory(TaskCategory.MetadataUpdate.value())
            .withFormSchema(new FormSchema().withAdditionalProperty("type", "object"))
            .withUiSchema(
                new UiSchema()
                    .withAdditionalProperty(
                        "ui:handler", Map.of("type", "suggestion", "permission", "EDIT_TAGS")));

    try (MockedStatic<Entity> entityMock = Mockito.mockStatic(Entity.class)) {
      entityMock
          .when(() -> Entity.getEntityRepository(Entity.TASK_FORM_SCHEMA))
          .thenReturn(repository);
      when(repository.resolve(
              TaskEntityType.Suggestion.value(),
              TaskCategory.MetadataUpdate.value(),
              task.getPayload()))
          .thenReturn(Optional.of(schema));

      TaskExecutionBinding binding = TaskFormExecutionResolver.resolve(task);

      assertEquals(HandlerType.SUGGESTION, binding.handlerType());
      assertEquals(MetadataOperation.EDIT_TAGS, binding.permissionOperation());
    }
  }
}
