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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.schema.entity.feed.CreateFormSchema;
import org.openmetadata.schema.entity.feed.FormSchema;
import org.openmetadata.schema.entity.feed.TaskFormSchema;
import org.openmetadata.schema.entity.feed.TransitionForms;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.governance.workflows.elements.nodes.userTask.Config__1;
import org.openmetadata.schema.governance.workflows.elements.nodes.userTask.TransitionMetadatum;
import org.openmetadata.schema.governance.workflows.elements.nodes.userTask.UserApprovalTaskDefinition;
import org.openmetadata.schema.type.TaskAvailableTransition;
import org.openmetadata.schema.type.TaskCategory;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.TaskFormSchemaRepository;

class TaskWorkflowLifecycleResolverTest {

  @Test
  void resolveBindingUsesWorkflowBackedTaskFormSchema() {
    TaskFormSchemaRepository repository = mock(TaskFormSchemaRepository.class);
    TaskFormSchema schema =
        new TaskFormSchema()
            .withName("CustomTask")
            .withTaskType(TaskEntityType.CustomTask.value())
            .withTaskCategory(TaskCategory.Custom.value())
            .withWorkflowDefinitionRef("CustomTaskWorkflow")
            .withFormSchema(new FormSchema().withAdditionalProperty("type", "object"))
            .withCreateFormSchema(
                new CreateFormSchema()
                    .withAdditionalProperty("type", "object")
                    .withAdditionalProperty(
                        "properties", Map.of("comment", Map.of("type", "string"))))
            .withTransitionForms(
                new TransitionForms()
                    .withAdditionalProperty(
                        "resolve",
                        Map.of(
                            "formSchema",
                            Map.of(
                                "type",
                                "object",
                                "properties",
                                Map.of("resolution", Map.of("type", "string"))),
                            "uiSchema",
                            Map.of("resolution", Map.of("ui:widget", "textarea")))));

    try (MockedStatic<Entity> entityMock = Mockito.mockStatic(Entity.class)) {
      entityMock
          .when(() -> Entity.getEntityRepository(Entity.TASK_FORM_SCHEMA))
          .thenReturn(repository);
      when(repository.resolve(TaskEntityType.CustomTask.value(), TaskCategory.Custom.value(), null))
          .thenReturn(Optional.of(schema));

      TaskWorkflowLifecycleResolver.TaskWorkflowBinding binding =
          TaskWorkflowLifecycleResolver.resolveBinding(
                  TaskEntityType.CustomTask, TaskCategory.Custom, null)
              .orElseThrow();

      assertEquals("CustomTaskWorkflow", binding.workflowDefinitionRef());
      assertNotNull(binding.createFormSchema());
      assertTrue(binding.transitionForms().containsKey("resolve"));
    }
  }

  @Test
  void parseTransitionsMapsWorkflowTransitionMetadata() {
    List<TaskAvailableTransition> transitions =
        TaskWorkflowLifecycleResolver.parseTransitions(
            List.of(
                Map.of(
                    "id", "resolve",
                    "label", "Resolve",
                    "targetStageId", "resolved",
                    "targetTaskStatus", "Completed",
                    "resolutionType", "Completed",
                    "requiresComment", true)));

    assertEquals(1, transitions.size());
    TaskAvailableTransition transition = transitions.getFirst();
    assertEquals("resolve", transition.getId());
    assertEquals("Resolve", transition.getLabel());
    assertEquals("resolved", transition.getTargetStageId());
    assertEquals(TaskEntityStatus.Completed, transition.getTargetTaskStatus());
    assertEquals(TaskResolutionType.Completed, transition.getResolutionType());
    assertTrue(Boolean.TRUE.equals(transition.getRequiresComment()));
  }

  @Test
  void parseTransitionsReadsJsonStringMetadata() {
    List<TaskAvailableTransition> transitions =
        TaskWorkflowLifecycleResolver.parseTransitions(
            """
            [
              {
                "id": "startProgress",
                "label": "Start Progress",
                "targetStageId": "inProgress",
                "targetTaskStatus": "InProgress"
              }
            ]
            """);

    assertEquals(1, transitions.size());
    TaskAvailableTransition transition = transitions.getFirst();
    assertEquals("startProgress", transition.getId());
    assertEquals("inProgress", transition.getTargetStageId());
    assertEquals(TaskEntityStatus.InProgress, transition.getTargetTaskStatus());
  }

  @Test
  void resolveTransitionsForStageUsesWorkflowDefinitionNodeConfig() {
    WorkflowDefinition workflowDefinition =
        new WorkflowDefinition()
            .withNodes(
                List.of(
                    new UserApprovalTaskDefinition()
                        .withName("TaskReview")
                        .withConfig(
                            new Config__1()
                                .withStageId("review")
                                .withTransitionMetadata(
                                    List.of(
                                        new TransitionMetadatum()
                                            .withId("approve")
                                            .withLabel("Approve")
                                            .withTargetStageId("approved")
                                            .withTargetTaskStatus(TaskEntityStatus.Approved)
                                            .withResolutionType(TaskResolutionType.Approved))))));

    List<TaskAvailableTransition> transitions =
        TaskWorkflowLifecycleResolver.resolveTransitionsForStage(workflowDefinition, "review");

    assertEquals(1, transitions.size());
    assertEquals("approve", transitions.getFirst().getId());
    assertEquals(TaskEntityStatus.Approved, transitions.getFirst().getTargetTaskStatus());
  }

  @Test
  void defaultTransitionIdFallsBackToResolutionMapping() {
    Task task =
        new Task()
            .withType(TaskEntityType.CustomTask)
            .withAvailableTransitions(
                List.of(
                    new TaskAvailableTransition()
                        .withId("approve")
                        .withResolutionType(TaskResolutionType.Approved),
                    new TaskAvailableTransition()
                        .withId("reject")
                        .withResolutionType(TaskResolutionType.Rejected)));

    assertEquals(
        "approve",
        TaskWorkflowLifecycleResolver.defaultTransitionId(task, TaskResolutionType.Approved));
    assertEquals(
        "reject",
        TaskWorkflowLifecycleResolver.defaultTransitionId(task, TaskResolutionType.Rejected));
    assertFalse(TaskWorkflowLifecycleResolver.resolveBinding((Task) null).isPresent());
  }

  @Test
  void defaultWorkflowDefinitionRefUsesPerTaskDefaults() {
    assertEquals(
        "DescriptionUpdateTaskWorkflow",
        TaskWorkflowLifecycleResolver.defaultWorkflowDefinitionRef(
            TaskEntityType.DescriptionUpdate));
    assertEquals(
        "TagUpdateTaskWorkflow",
        TaskWorkflowLifecycleResolver.defaultWorkflowDefinitionRef(TaskEntityType.TagUpdate));
    assertEquals(
        "OwnershipUpdateTaskWorkflow",
        TaskWorkflowLifecycleResolver.defaultWorkflowDefinitionRef(TaskEntityType.OwnershipUpdate));
    assertEquals(
        "TierUpdateTaskWorkflow",
        TaskWorkflowLifecycleResolver.defaultWorkflowDefinitionRef(TaskEntityType.TierUpdate));
    assertEquals(
        "DomainUpdateTaskWorkflow",
        TaskWorkflowLifecycleResolver.defaultWorkflowDefinitionRef(TaskEntityType.DomainUpdate));
    assertEquals(
        "GlossaryApprovalTaskWorkflow",
        TaskWorkflowLifecycleResolver.defaultWorkflowDefinitionRef(
            TaskEntityType.GlossaryApproval));
    assertEquals(
        "RequestApprovalTaskWorkflow",
        TaskWorkflowLifecycleResolver.defaultWorkflowDefinitionRef(TaskEntityType.RequestApproval));
    assertEquals(
        "SuggestionTaskWorkflow",
        TaskWorkflowLifecycleResolver.defaultWorkflowDefinitionRef(TaskEntityType.Suggestion));
    assertEquals(
        "TestCaseResolutionTaskWorkflow",
        TaskWorkflowLifecycleResolver.defaultWorkflowDefinitionRef(
            TaskEntityType.TestCaseResolution));
    assertEquals(
        "IncidentResolutionTaskWorkflow",
        TaskWorkflowLifecycleResolver.defaultWorkflowDefinitionRef(
            TaskEntityType.IncidentResolution));
    assertEquals(
        "RecognizerFeedbackReviewWorkflow",
        TaskWorkflowLifecycleResolver.defaultWorkflowDefinitionRef(
            TaskEntityType.DataQualityReview));
    assertEquals(
        "CustomTaskWorkflow",
        TaskWorkflowLifecycleResolver.defaultWorkflowDefinitionRef(TaskEntityType.CustomTask));
  }

  @Test
  void defaultTaskTypeAndCategoryResolveFromWorkflowDefinitionRef() {
    assertEquals(
        TaskEntityType.Suggestion,
        TaskWorkflowLifecycleResolver.defaultTaskTypeForWorkflowDefinitionRef(
            "SuggestionTaskWorkflow"));
    assertEquals(
        TaskCategory.MetadataUpdate,
        TaskWorkflowLifecycleResolver.defaultTaskCategoryForWorkflowDefinitionRef(
            "SuggestionTaskWorkflow"));
    assertEquals(
        TaskEntityType.GlossaryApproval,
        TaskWorkflowLifecycleResolver.defaultTaskTypeForWorkflowDefinitionRef(
            "GlossaryApprovalTaskWorkflow"));
    assertEquals(
        TaskCategory.Approval,
        TaskWorkflowLifecycleResolver.defaultTaskCategoryForWorkflowDefinitionRef(
            "GlossaryApprovalTaskWorkflow"));
    assertEquals(
        TaskEntityType.CustomTask,
        TaskWorkflowLifecycleResolver.defaultTaskTypeForWorkflowDefinitionRef("UnknownWorkflow"));
    assertEquals(
        TaskCategory.Custom,
        TaskWorkflowLifecycleResolver.defaultTaskCategoryForWorkflowDefinitionRef(
            "UnknownWorkflow"));
  }

  @Test
  void resolveBindingFallsBackToBuiltInSchemaWhenNoPersistedSchemaExists() {
    TaskFormSchemaRepository repository = mock(TaskFormSchemaRepository.class);

    try (MockedStatic<Entity> entityMock = Mockito.mockStatic(Entity.class)) {
      entityMock
          .when(() -> Entity.getEntityRepository(Entity.TASK_FORM_SCHEMA))
          .thenReturn(repository);
      when(repository.resolve(
              TaskEntityType.OwnershipUpdate.value(), TaskCategory.MetadataUpdate.value(), null))
          .thenReturn(Optional.empty());

      TaskWorkflowLifecycleResolver.TaskWorkflowBinding binding =
          TaskWorkflowLifecycleResolver.resolveBinding(
                  TaskEntityType.OwnershipUpdate, TaskCategory.MetadataUpdate, null)
              .orElseThrow();

      assertEquals("OwnershipUpdateTaskWorkflow", binding.workflowDefinitionRef());
      assertNotNull(binding.schema());
      assertNotNull(binding.createFormSchema());
    }
  }

  @Test
  void builtInDomainUpdateSchemaUsesSingleEntityReferences() {
    TaskFormSchemaRepository repository = mock(TaskFormSchemaRepository.class);

    try (MockedStatic<Entity> entityMock = Mockito.mockStatic(Entity.class)) {
      entityMock
          .when(() -> Entity.getEntityRepository(Entity.TASK_FORM_SCHEMA))
          .thenReturn(repository);
      when(repository.resolve(
              TaskEntityType.DomainUpdate.value(), TaskCategory.MetadataUpdate.value(), null))
          .thenReturn(Optional.empty());

      TaskFormSchema schema =
          TaskWorkflowLifecycleResolver.resolveSchema(
                  TaskEntityType.DomainUpdate, TaskCategory.MetadataUpdate, null)
              .orElseThrow();

      assertNotNull(schema.getFormSchema());
      Map<?, ?> properties =
          assertInstanceOf(
              Map.class, schema.getFormSchema().getAdditionalProperties().get("properties"));
      Map<?, ?> currentDomain = assertInstanceOf(Map.class, properties.get("currentDomain"));
      Map<?, ?> newDomain = assertInstanceOf(Map.class, properties.get("newDomain"));

      assertEquals(
          "object",
          assertInstanceOf(Map.class, ((List<?>) currentDomain.get("oneOf")).getFirst())
              .get("type"));
      assertEquals("object", newDomain.get("type"));
    }
  }

  @Test
  void resolveBindingDefaultsCategoryForBuiltInTaskTypes() {
    TaskFormSchemaRepository repository = mock(TaskFormSchemaRepository.class);

    try (MockedStatic<Entity> entityMock = Mockito.mockStatic(Entity.class)) {
      entityMock
          .when(() -> Entity.getEntityRepository(Entity.TASK_FORM_SCHEMA))
          .thenReturn(repository);
      when(repository.resolve(
              TaskEntityType.DescriptionUpdate.value(), TaskCategory.MetadataUpdate.value(), null))
          .thenReturn(Optional.empty());

      TaskWorkflowLifecycleResolver.TaskWorkflowBinding binding =
          TaskWorkflowLifecycleResolver.resolveBinding(TaskEntityType.DescriptionUpdate, null, null)
              .orElseThrow();

      assertEquals("DescriptionUpdateTaskWorkflow", binding.workflowDefinitionRef());
      assertNotNull(binding.schema());
      assertNotNull(binding.createFormSchema());
      verify(repository)
          .resolve(
              TaskEntityType.DescriptionUpdate.value(), TaskCategory.MetadataUpdate.value(), null);
    }
  }

  @Test
  void resolveBindingFallsBackToTypeDefaultWhenProvidedCategoryHasNoBuiltInSchema() {
    TaskFormSchemaRepository repository = mock(TaskFormSchemaRepository.class);

    try (MockedStatic<Entity> entityMock = Mockito.mockStatic(Entity.class)) {
      entityMock
          .when(() -> Entity.getEntityRepository(Entity.TASK_FORM_SCHEMA))
          .thenReturn(repository);
      when(repository.resolve(
              TaskEntityType.DescriptionUpdate.value(), TaskCategory.Approval.value(), null))
          .thenReturn(Optional.empty());
      when(repository.resolve(
              TaskEntityType.DescriptionUpdate.value(), TaskCategory.MetadataUpdate.value(), null))
          .thenReturn(Optional.empty());

      TaskWorkflowLifecycleResolver.TaskWorkflowBinding binding =
          TaskWorkflowLifecycleResolver.resolveBinding(
                  TaskEntityType.DescriptionUpdate, TaskCategory.Approval, null)
              .orElseThrow();

      assertEquals("DescriptionUpdateTaskWorkflow", binding.workflowDefinitionRef());
      assertNotNull(binding.schema());
      assertNotNull(binding.createFormSchema());
      verify(repository)
          .resolve(TaskEntityType.DescriptionUpdate.value(), TaskCategory.Approval.value(), null);
      verify(repository)
          .resolve(
              TaskEntityType.DescriptionUpdate.value(), TaskCategory.MetadataUpdate.value(), null);
    }
  }

  @Test
  void buildWorkflowStartVariablesIncludesTaskTypeAndCategory() {
    Task draftTask =
        new Task()
            .withId(UUID.randomUUID())
            .withType(TaskEntityType.DescriptionUpdate)
            .withCategory(TaskCategory.MetadataUpdate);

    Map<String, Object> variables =
        TaskWorkflowLifecycleResolver.buildWorkflowStartVariables(draftTask);

    assertEquals(TaskEntityType.DescriptionUpdate.value(), variables.get("taskType"));
    assertEquals(TaskCategory.MetadataUpdate.value(), variables.get("taskCategory"));
  }
}
