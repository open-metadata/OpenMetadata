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

import java.util.LinkedHashMap;
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
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TaskAvailableTransition;
import org.openmetadata.schema.type.TaskCategory;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.schema.type.TaskPriority;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.TaskFormSchemaRepository;
import org.openmetadata.service.tasks.TaskWorkflowLifecycleResolver.WorkflowStartVariables;

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
  void resolveTransitionsForStageFallsBackToDefaultsWhenTransitionMetadataEmpty() {
    WorkflowDefinition workflowDefinition =
        userApprovalTaskWorkflow(UUID.randomUUID(), "review", List.of());

    List<TaskAvailableTransition> transitions =
        TaskWorkflowLifecycleResolver.resolveTransitionsForStage(workflowDefinition, "review");

    assertEquals(2, transitions.size());
    assertEquals("approve", transitions.get(0).getId());
    assertEquals(TaskEntityStatus.Approved, transitions.get(0).getTargetTaskStatus());
    assertEquals(TaskResolutionType.Approved, transitions.get(0).getResolutionType());
    assertEquals("reject", transitions.get(1).getId());
    assertEquals(TaskEntityStatus.Rejected, transitions.get(1).getTargetTaskStatus());
    assertEquals(TaskResolutionType.Rejected, transitions.get(1).getResolutionType());
  }

  @Test
  void findTransitionFallsBackToDefaultsWhenTaskHasEmptyAvailableTransitions() {
    UUID workflowDefinitionId = UUID.randomUUID();
    WorkflowDefinition workflowDefinition =
        userApprovalTaskWorkflow(workflowDefinitionId, "review", List.of());
    Task task =
        new Task()
            .withType(TaskEntityType.RequestApproval)
            .withStatus(TaskEntityStatus.Open)
            .withWorkflowDefinitionId(workflowDefinitionId)
            .withAvailableTransitions(List.of());

    try (MockedStatic<Entity> entityMock = Mockito.mockStatic(Entity.class)) {
      entityMock
          .when(
              () ->
                  Entity.getEntity(
                      Mockito.eq(Entity.WORKFLOW_DEFINITION),
                      Mockito.eq(workflowDefinitionId),
                      Mockito.eq("nodes"),
                      Mockito.any()))
          .thenReturn(workflowDefinition);

      TaskAvailableTransition approve =
          TaskWorkflowLifecycleResolver.findTransition(task, "approve");
      TaskAvailableTransition reject = TaskWorkflowLifecycleResolver.findTransition(task, "reject");
      TaskAvailableTransition unknown =
          TaskWorkflowLifecycleResolver.findTransition(task, "revoke");

      assertNotNull(approve);
      assertEquals("approve", approve.getId());
      assertEquals("approved", approve.getTargetStageId());
      assertEquals(TaskResolutionType.Approved, approve.getResolutionType());
      assertNotNull(reject);
      assertEquals("reject", reject.getId());
      assertEquals("rejected", reject.getTargetStageId());
      assertEquals(TaskResolutionType.Rejected, reject.getResolutionType());
      assertEquals(null, unknown);
    }
  }

  @Test
  void findTransitionReturnsNullWhenWorkflowHasNoUserApprovalTaskNode() {
    UUID workflowDefinitionId = UUID.randomUUID();
    WorkflowDefinition workflowDefinition =
        new WorkflowDefinition().withId(workflowDefinitionId).withNodes(List.of());
    Task task =
        new Task()
            .withType(TaskEntityType.RequestApproval)
            .withStatus(TaskEntityStatus.Open)
            .withWorkflowDefinitionId(workflowDefinitionId)
            .withAvailableTransitions(List.of());

    try (MockedStatic<Entity> entityMock = Mockito.mockStatic(Entity.class)) {
      entityMock
          .when(
              () ->
                  Entity.getEntity(
                      Mockito.eq(Entity.WORKFLOW_DEFINITION),
                      Mockito.eq(workflowDefinitionId),
                      Mockito.eq("nodes"),
                      Mockito.any()))
          .thenReturn(workflowDefinition);

      assertEquals(null, TaskWorkflowLifecycleResolver.findTransition(task, "approve"));
    }
  }

  @Test
  void findTransitionReturnsNullForNonWorkflowManagedTasks() {
    Task task =
        new Task()
            .withType(TaskEntityType.DescriptionUpdate)
            .withStatus(TaskEntityStatus.Open)
            .withWorkflowDefinitionId(null)
            .withAvailableTransitions(List.of());

    assertEquals(null, TaskWorkflowLifecycleResolver.findTransition(task, "approve"));
  }

  /**
   * Build a userApprovalTask WorkflowDefinition without leaning on the jsonschema2pojo-generated
   * numbered config class name — that generated symbol can rename on any future userApprovalTask
   * schema edit. Uses a plain map that Jackson deserializes into the generated config.
   */
  private static WorkflowDefinition userApprovalTaskWorkflow(
      UUID workflowDefinitionId, String stageId, List<Map<String, Object>> transitionMetadata) {
    Map<String, Object> config = new LinkedHashMap<>();
    config.put("stageId", stageId);
    config.put("transitionMetadata", transitionMetadata);
    UserApprovalTaskDefinition node =
        JsonUtils.convertValue(
            Map.of(
                "type", "userTask",
                "subType", "userApprovalTask",
                "name", "TaskReview",
                "config", config),
            UserApprovalTaskDefinition.class);
    return new WorkflowDefinition().withId(workflowDefinitionId).withNodes(List.of(node));
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
        "DataQualityReviewTaskWorkflow",
        TaskWorkflowLifecycleResolver.defaultWorkflowDefinitionRef(
            TaskEntityType.DataQualityReview));
    assertEquals(
        "RecognizerFeedbackReviewWorkflow",
        TaskWorkflowLifecycleResolver.defaultWorkflowDefinitionRef(
            TaskEntityType.RecognizerFeedbackApproval));
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
        TaskEntityType.RecognizerFeedbackApproval,
        TaskWorkflowLifecycleResolver.defaultTaskTypeForWorkflowDefinitionRef(
            "RecognizerFeedbackReviewWorkflow"));
    assertEquals(
        TaskEntityType.DataQualityReview,
        TaskWorkflowLifecycleResolver.defaultTaskTypeForWorkflowDefinitionRef(
            "DataQualityReviewTaskWorkflow"));
    assertEquals(
        TaskCategory.Review,
        TaskWorkflowLifecycleResolver.defaultTaskCategoryForWorkflowDefinitionRef(
            "RecognizerFeedbackReviewWorkflow"));
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
  void builtInDataAccessRequestSchemaAcceptsNumericExpirationDate() {
    TaskFormSchemaRepository repository = mock(TaskFormSchemaRepository.class);

    try (MockedStatic<Entity> entityMock = Mockito.mockStatic(Entity.class)) {
      entityMock
          .when(() -> Entity.getEntityRepository(Entity.TASK_FORM_SCHEMA))
          .thenReturn(repository);
      when(repository.resolve(
              TaskEntityType.DataAccessRequest.value(), TaskCategory.DataAccess.value(), null))
          .thenReturn(Optional.empty());

      TaskFormSchema schema =
          TaskWorkflowLifecycleResolver.resolveSchema(
                  TaskEntityType.DataAccessRequest, TaskCategory.DataAccess, null)
              .orElseThrow();

      Map<?, ?> properties =
          assertInstanceOf(
              Map.class, schema.getFormSchema().getAdditionalProperties().get("properties"));
      Map<?, ?> expirationDate = assertInstanceOf(Map.class, properties.get("expirationDate"));

      assertEquals("number", expirationDate.get("type"));
      assertFalse(properties.containsKey("duration"));
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

  @Test
  void workflowStartVariablesCarryEveryKeyForAPopulatedTask() {
    UUID id = UUID.randomUUID();
    Task task =
        new Task()
            .withId(id)
            .withName("TASK-1")
            .withDisplayName("Grant access")
            .withDescription("please review")
            .withType(TaskEntityType.DescriptionUpdate)
            .withCategory(TaskCategory.MetadataUpdate)
            .withPriority(TaskPriority.High)
            .withPayload("payload-json")
            .withCreatedBy(new EntityReference().withId(UUID.randomUUID()).withName("alice"))
            .withUpdatedBy("bob")
            .withAssignees(
                List.of(new EntityReference().withId(UUID.randomUUID()).withName("team")));

    Map<String, Object> v = WorkflowStartVariables.of(task).toVariables();

    // Every documented key must be present — a dropped/renamed key silently breaks downstream
    // reads.
    assertTrue(
        v.keySet()
            .containsAll(
                List.of(
                    WorkflowStartVariables.TASK_ENTITY_ID,
                    WorkflowStartVariables.TASK_WORKFLOW_MANAGED,
                    WorkflowStartVariables.TASK_NAME,
                    WorkflowStartVariables.TASK_DISPLAY_NAME,
                    WorkflowStartVariables.TASK_DESCRIPTION,
                    WorkflowStartVariables.TASK_TYPE,
                    WorkflowStartVariables.TASK_CATEGORY,
                    WorkflowStartVariables.TASK_PRIORITY,
                    WorkflowStartVariables.TASK_PAYLOAD,
                    WorkflowStartVariables.TASK_DUE_DATE,
                    WorkflowStartVariables.TASK_EXTERNAL_REFERENCE,
                    WorkflowStartVariables.TASK_TAGS,
                    WorkflowStartVariables.TASK_CREATED_BY,
                    WorkflowStartVariables.TASK_UPDATED_BY,
                    WorkflowStartVariables.TASK_REVIEWERS,
                    WorkflowStartVariables.TASK_ASSIGNEES)));
    assertEquals(id.toString(), v.get(WorkflowStartVariables.TASK_ENTITY_ID));
    assertEquals(true, v.get(WorkflowStartVariables.TASK_WORKFLOW_MANAGED));
    assertEquals("TASK-1", v.get(WorkflowStartVariables.TASK_NAME));
    assertEquals(TaskEntityType.DescriptionUpdate.value(), v.get(WorkflowStartVariables.TASK_TYPE));
    assertEquals(TaskPriority.High.value(), v.get(WorkflowStartVariables.TASK_PRIORITY));
    assertEquals(
        "payload-json", v.get(WorkflowStartVariables.TASK_PAYLOAD)); // String passes through
    assertEquals("bob", v.get(WorkflowStartVariables.TASK_UPDATED_BY));
    assertNotNull(v.get(WorkflowStartVariables.TASK_CREATED_BY)); // serialized to JSON
    assertNotNull(v.get(WorkflowStartVariables.TASK_ASSIGNEES));
    // The public builder delegates to the record — same map.
    assertEquals(v, TaskWorkflowLifecycleResolver.buildWorkflowStartVariables(task));
  }

  @Test
  void workflowStartVariablesTolerateNullOptionalFields() {
    // Only id set — every optional field null. Keys must still be present (null values), never NPE.
    Task task = new Task().withId(UUID.randomUUID());
    Map<String, Object> v = WorkflowStartVariables.of(task).toVariables();

    assertEquals(true, v.get(WorkflowStartVariables.TASK_WORKFLOW_MANAGED));
    // Priority carries the schema default (Medium) even on a bare task.
    assertEquals(TaskPriority.Medium.value(), v.get(WorkflowStartVariables.TASK_PRIORITY));
    for (String key :
        List.of(
            WorkflowStartVariables.TASK_NAME,
            WorkflowStartVariables.TASK_TYPE,
            WorkflowStartVariables.TASK_CATEGORY,
            WorkflowStartVariables.TASK_PAYLOAD,
            WorkflowStartVariables.TASK_CREATED_BY,
            WorkflowStartVariables.TASK_ASSIGNEES)) {
      assertTrue(v.containsKey(key), "missing key: " + key);
      assertEquals(null, v.get(key), "expected null for: " + key);
    }
    // A payload without an expirationDate must not surface the derived variable — the boundary
    // timer only arms when a real date is known.
    assertFalse(v.containsKey(WorkflowStartVariables.TASK_PAYLOAD_EXPIRATION_DATE));
  }

  @Test
  void workflowStartVariablesSurfacePayloadExpirationDateWhenPresent() {
    // Regression: TaskReview needed a boundary timer that fires while a DAR sits awaiting
    // approval past its expiration. That timer reads ${taskPayloadExpirationDate}, which must be
    // seeded at workflow start (before any PolicyAgent promote step runs). Any payload shaped
    // like {"expirationDate": <epoch-millis>, ...} — DAR is the current caller, but the
    // extraction is intentionally generic — surfaces the ISO instant here.
    long expiration = 1_800_000_000_000L; // ~2027
    Task task =
        new Task()
            .withId(UUID.randomUUID())
            .withPayload(
                java.util.Map.of("expirationDate", expiration, "accessType", "FullAccess"));

    Map<String, Object> v = WorkflowStartVariables.of(task).toVariables();

    assertEquals(
        java.time.Instant.ofEpochMilli(expiration).toString(),
        v.get(WorkflowStartVariables.TASK_PAYLOAD_EXPIRATION_DATE));
  }

  @Test
  void workflowStartVariablesSurfacePayloadExpirationDateFromJsonString() {
    // Payload arrives as a raw JSON string when the caller hasn't Jackson-typed it (e.g. the
    // request came through the generic /tasks endpoint before entity-specific hydration). The
    // extractor round-trips through JsonUtils so both shapes work.
    long expiration = 1_900_000_000_000L;
    String payload = "{\"expirationDate\":" + expiration + ",\"accessType\":\"FullAccess\"}";
    Task task = new Task().withId(UUID.randomUUID()).withPayload(payload);

    Map<String, Object> v = WorkflowStartVariables.of(task).toVariables();

    assertEquals(
        java.time.Instant.ofEpochMilli(expiration).toString(),
        v.get(WorkflowStartVariables.TASK_PAYLOAD_EXPIRATION_DATE));
  }

  @Test
  void workflowStartVariablesTolerateNonMapPayload() {
    // A payload that's a bare string / list / number must not blow up start — extractor is
    // best-effort. Absence of the derived variable is the correct signal to downstream timers.
    Task task = new Task().withId(UUID.randomUUID()).withPayload("plain string payload");

    Map<String, Object> v = WorkflowStartVariables.of(task).toVariables();

    assertFalse(v.containsKey(WorkflowStartVariables.TASK_PAYLOAD_EXPIRATION_DATE));
  }

  @Test
  void workflowStartVariablesSkipPayloadExpirationWhenNotANumber() {
    // Defensive: an expirationDate that's a string ("2027-01-01") or otherwise not a Number is
    // not something Flowable's timeDate can consume. Skip rather than propagate garbage.
    Task task =
        new Task()
            .withId(UUID.randomUUID())
            .withPayload(java.util.Map.of("expirationDate", "not-a-number"));

    Map<String, Object> v = WorkflowStartVariables.of(task).toVariables();

    assertFalse(v.containsKey(WorkflowStartVariables.TASK_PAYLOAD_EXPIRATION_DATE));
  }

  @Test
  void workflowStartVariablesSurfacePastExpirationDate() {
    // The extractor is data-only; timer semantics decide what "past" means. A DAR that was
    // created and never approved before its expiration must still surface the date so the
    // TaskReview boundary timer can arm and fire immediately (closing the never-approved task).
    long pastExpiration = 1_500_000_000_000L; // ~2017
    Task task =
        new Task()
            .withId(UUID.randomUUID())
            .withPayload(java.util.Map.of("expirationDate", pastExpiration));

    Map<String, Object> v = WorkflowStartVariables.of(task).toVariables();

    assertEquals(
        java.time.Instant.ofEpochMilli(pastExpiration).toString(),
        v.get(WorkflowStartVariables.TASK_PAYLOAD_EXPIRATION_DATE));
  }

  @Test
  void workflowStartVariablesAcceptIntegerExpirationDate() {
    // Jackson deserializes numeric JSON without a schema hint to Integer when the value fits.
    // Extractor reads via Number.longValue() so Integer / Long / Double all convert cleanly.
    int expirationInt = 1_600_000_000; // ~2020 in seconds; irrelevant unit — extractor doesn't
    Task task =
        new Task()
            .withId(UUID.randomUUID())
            .withPayload(java.util.Map.of("expirationDate", expirationInt));

    Map<String, Object> v = WorkflowStartVariables.of(task).toVariables();

    assertEquals(
        java.time.Instant.ofEpochMilli(expirationInt).toString(),
        v.get(WorkflowStartVariables.TASK_PAYLOAD_EXPIRATION_DATE));
  }

  @Test
  void workflowStartVariablesAcceptLongMaxExpirationDate() {
    // Upper edge: schema-bound clamp is ~year 2200, but the extractor itself must not overflow.
    long farFuture = 7_258_118_400_000L; // ~2200 (H7 schema cap)
    Task task =
        new Task()
            .withId(UUID.randomUUID())
            .withPayload(java.util.Map.of("expirationDate", farFuture));

    Map<String, Object> v = WorkflowStartVariables.of(task).toVariables();

    assertEquals(
        java.time.Instant.ofEpochMilli(farFuture).toString(),
        v.get(WorkflowStartVariables.TASK_PAYLOAD_EXPIRATION_DATE));
  }

  @Test
  void workflowStartVariablesSkipPayloadExpirationWhenValueIsNull() {
    // A Map with expirationDate=null (e.g. a caller cleared it) must be treated as absent, not
    // NPE. Map.of rejects null values, so build via HashMap to allow the explicit null.
    java.util.Map<String, Object> payload = new java.util.HashMap<>();
    payload.put("expirationDate", null);
    payload.put("accessType", "FullAccess");
    Task task = new Task().withId(UUID.randomUUID()).withPayload(payload);

    Map<String, Object> v = WorkflowStartVariables.of(task).toVariables();

    assertFalse(v.containsKey(WorkflowStartVariables.TASK_PAYLOAD_EXPIRATION_DATE));
  }

  @Test
  void workflowStartVariablesSkipPayloadExpirationWhenValueIsBoolean() {
    // Any non-Number Object (Boolean, List, nested Map, ...) is nonsensical for a timer date.
    // Skip rather than propagate as-is.
    Task task =
        new Task().withId(UUID.randomUUID()).withPayload(java.util.Map.of("expirationDate", true));

    Map<String, Object> v = WorkflowStartVariables.of(task).toVariables();

    assertFalse(v.containsKey(WorkflowStartVariables.TASK_PAYLOAD_EXPIRATION_DATE));
  }

  @Test
  void workflowStartVariablesSkipPayloadExpirationOnListPayload() {
    // Payload shaped as a list, not a map — JsonUtils.convertValue throws
    // IllegalArgumentException that the extractor swallows to a null result.
    Task task =
        new Task().withId(UUID.randomUUID()).withPayload(List.of("not-a-map", "still-not-a-map"));

    Map<String, Object> v = WorkflowStartVariables.of(task).toVariables();

    assertFalse(v.containsKey(WorkflowStartVariables.TASK_PAYLOAD_EXPIRATION_DATE));
  }

  @Test
  void workflowStartVariablesSurfacePayloadExpirationEvenWithOnlyThatKey() {
    // Minimal payload — only expirationDate present. Verifies the extractor doesn't require
    // sibling keys (accessType etc.) to be sane. Boundary-timer semantics don't care about the
    // rest of the payload.
    long expiration = 1_950_000_000_000L;
    Task task =
        new Task()
            .withId(UUID.randomUUID())
            .withPayload(java.util.Map.of("expirationDate", expiration));

    Map<String, Object> v = WorkflowStartVariables.of(task).toVariables();

    assertEquals(
        java.time.Instant.ofEpochMilli(expiration).toString(),
        v.get(WorkflowStartVariables.TASK_PAYLOAD_EXPIRATION_DATE));
  }

  @Test
  void workflowStartVariablesSurfacePayloadExpirationFromNestedShapes() {
    // Extractor only looks at the top-level "expirationDate" key. A nested {inner:{expirationDate}}
    // shape must NOT be pulled up — that would surface an unrelated value as the top-level date.
    Task task =
        new Task()
            .withId(UUID.randomUUID())
            .withPayload(
                java.util.Map.of(
                    "accessType",
                    "FullAccess",
                    "inner",
                    java.util.Map.of("expirationDate", 1_800_000_000_000L)));

    Map<String, Object> v = WorkflowStartVariables.of(task).toVariables();

    assertFalse(v.containsKey(WorkflowStartVariables.TASK_PAYLOAD_EXPIRATION_DATE));
  }
}
