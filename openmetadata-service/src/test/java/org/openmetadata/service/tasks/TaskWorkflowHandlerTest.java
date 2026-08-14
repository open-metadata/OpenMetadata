/*
 *  Copyright 2024 Collate
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

package org.openmetadata.service.tasks;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.lang.reflect.Method;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TaskEntityStatus;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.schema.type.TaskResolution;
import org.openmetadata.schema.type.TaskResolutionType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.TaskStateConflictException;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.TaskRepository;
import org.openmetadata.service.util.EntityUtil;

/**
 * Unit tests for TaskWorkflowHandler.
 *
 * <p>These tests verify the singleton pattern and basic functionality of TaskWorkflowHandler
 * without requiring the full OpenMetadata application context.
 */
class TaskWorkflowHandlerTest {

  @Test
  void testSingletonInstance() {
    TaskWorkflowHandler instance1 = TaskWorkflowHandler.getInstance();
    TaskWorkflowHandler instance2 = TaskWorkflowHandler.getInstance();

    assertNotNull(instance1);
    assertSame(instance1, instance2, "getInstance should return the same instance");
  }

  @Test
  void testInstanceNotNull() {
    TaskWorkflowHandler handler = TaskWorkflowHandler.getInstance();
    assertNotNull(handler);
  }

  @Test
  void testSupportsMultiApprovalUsesRuntimeTaskWhenWorkflowInstanceIdMissing() {
    Task task = new Task().withId(UUID.randomUUID());
    TaskWorkflowHandler handler = TaskWorkflowHandler.getInstance();

    WorkflowHandler workflowHandler = mock(WorkflowHandler.class);
    try (MockedStatic<WorkflowHandler> mocked = Mockito.mockStatic(WorkflowHandler.class)) {
      mocked.when(WorkflowHandler::getInstance).thenReturn(workflowHandler);
      when(workflowHandler.hasActiveRuntimeTask(task.getId())).thenReturn(true);
      when(workflowHandler.hasMultiApprovalSupport(task.getId())).thenReturn(true);

      assertTrue(handler.supportsMultiApproval(task));
      verify(workflowHandler).hasActiveRuntimeTask(task.getId());
      verify(workflowHandler).hasMultiApprovalSupport(task.getId());
    }
  }

  @Test
  void testSupportsMultiApprovalReturnsFalseWithoutWorkflowBinding() {
    Task task = new Task().withId(UUID.randomUUID());
    TaskWorkflowHandler handler = TaskWorkflowHandler.getInstance();

    WorkflowHandler workflowHandler = mock(WorkflowHandler.class);
    try (MockedStatic<WorkflowHandler> mocked = Mockito.mockStatic(WorkflowHandler.class)) {
      mocked.when(WorkflowHandler::getInstance).thenReturn(workflowHandler);
      when(workflowHandler.hasActiveRuntimeTask(task.getId())).thenReturn(false);

      assertFalse(handler.supportsMultiApproval(task));
      verify(workflowHandler).hasActiveRuntimeTask(task.getId());
    }
  }

  @Test
  void testResolveTaskReturnsRefreshedOpenTaskWhenWorkflowStillOpen() {
    UUID taskId = UUID.randomUUID();
    Task task =
        new Task()
            .withId(taskId)
            .withWorkflowInstanceId(UUID.randomUUID())
            .withStatus(TaskEntityStatus.Open)
            .withType(TaskEntityType.RequestApproval);
    Task refreshedTask = new Task().withId(taskId).withStatus(TaskEntityStatus.Open);

    WorkflowHandler workflowHandler = mock(WorkflowHandler.class);
    TaskRepository taskRepository = mock(TaskRepository.class);
    EntityUtil.Fields fields = new EntityUtil.Fields(Set.of("about"));

    try (MockedStatic<WorkflowHandler> workflowMock = Mockito.mockStatic(WorkflowHandler.class);
        MockedStatic<Entity> entityMock = Mockito.mockStatic(Entity.class)) {
      workflowMock.when(WorkflowHandler::getInstance).thenReturn(workflowHandler);
      when(workflowHandler.transformToNodeVariables(eq(taskId), any()))
          .thenAnswer(invocation -> invocation.getArgument(1));
      when(workflowHandler.resolveTask(eq(taskId), any())).thenReturn(true);
      when(workflowHandler.isAwaitingAdditionalVotes(taskId)).thenReturn(true);

      entityMock.when(() -> Entity.getEntityRepository(Entity.TASK)).thenReturn(taskRepository);
      when(taskRepository.getFields(anyString())).thenReturn(fields);
      when(taskRepository.get(isNull(), eq(taskId), eq(fields))).thenReturn(refreshedTask);

      Task result =
          TaskWorkflowHandler.getInstance()
              .resolveTask(task, "approve", TaskResolutionType.Approved, null, null, null, "alice");

      assertSame(refreshedTask, result);
      verify(taskRepository, never()).resolveTask(any(), any(TaskResolution.class), anyString());
      verify(workflowHandler).isAwaitingAdditionalVotes(taskId);
    }
  }

  @Test
  void testResolveWorkflowTaskDoesNotFallbackWhenWorkflowResolutionFails() {
    UUID taskId = UUID.randomUUID();
    Task task =
        new Task()
            .withId(taskId)
            .withWorkflowInstanceId(UUID.randomUUID())
            .withStatus(TaskEntityStatus.Open)
            .withType(TaskEntityType.RequestApproval);

    WorkflowHandler workflowHandler = mock(WorkflowHandler.class);
    TaskRepository taskRepository = mock(TaskRepository.class);

    try (MockedStatic<WorkflowHandler> workflowMock = Mockito.mockStatic(WorkflowHandler.class);
        MockedStatic<Entity> entityMock = Mockito.mockStatic(Entity.class)) {
      workflowMock.when(WorkflowHandler::getInstance).thenReturn(workflowHandler);
      when(workflowHandler.transformToNodeVariables(eq(taskId), any()))
          .thenAnswer(invocation -> invocation.getArgument(1));
      when(workflowHandler.resolveTask(eq(taskId), any())).thenReturn(false);
      when(workflowHandler.hasActiveRuntimeTask(taskId)).thenReturn(true);

      entityMock.when(() -> Entity.getEntityRepository(Entity.TASK)).thenReturn(taskRepository);

      TaskStateConflictException exception =
          assertThrows(
              TaskStateConflictException.class,
              () ->
                  TaskWorkflowHandler.getInstance()
                      .resolveTask(
                          task, "approve", TaskResolutionType.Approved, null, null, null, "alice"));

      assertTrue(exception.getMessage().contains(taskId.toString()));
      verify(taskRepository, never()).resolveTask(any(), any(TaskResolution.class), anyString());
    }
  }

  @Test
  void testResolveWorkflowTaskFallbackRejectsAlreadyResolvedTask() {
    UUID taskId = UUID.randomUUID();
    Task task =
        new Task()
            .withId(taskId)
            .withWorkflowInstanceId(UUID.randomUUID())
            .withStatus(TaskEntityStatus.Completed)
            .withType(TaskEntityType.RequestApproval);

    WorkflowHandler workflowHandler = mock(WorkflowHandler.class);
    TaskRepository taskRepository = mock(TaskRepository.class);

    try (MockedStatic<WorkflowHandler> workflowMock = Mockito.mockStatic(WorkflowHandler.class);
        MockedStatic<Entity> entityMock = Mockito.mockStatic(Entity.class)) {
      workflowMock.when(WorkflowHandler::getInstance).thenReturn(workflowHandler);
      when(workflowHandler.transformToNodeVariables(eq(taskId), any()))
          .thenAnswer(invocation -> invocation.getArgument(1));
      when(workflowHandler.resolveTask(eq(taskId), any())).thenReturn(false);
      when(workflowHandler.hasActiveRuntimeTask(taskId)).thenReturn(false);

      entityMock.when(() -> Entity.getEntityRepository(Entity.TASK)).thenReturn(taskRepository);

      TaskStateConflictException exception =
          assertThrows(
              TaskStateConflictException.class,
              () ->
                  TaskWorkflowHandler.getInstance()
                      .resolveTask(
                          task, "approve", TaskResolutionType.Approved, null, null, null, "alice"));

      assertTrue(exception.getMessage().contains("already in status"));
      verify(taskRepository, never()).resolveTask(any(), any(TaskResolution.class), anyString());
    }
  }

  @Test
  void testResolveStandaloneTaskReturnsRefreshedResolvedTask() {
    UUID taskId = UUID.randomUUID();
    Task task =
        new Task()
            .withId(taskId)
            .withStatus(TaskEntityStatus.Open)
            .withType(TaskEntityType.CustomTask);
    Task storedTask = new Task().withId(taskId).withStatus(TaskEntityStatus.Completed);
    Task refreshedTask = new Task().withId(taskId).withStatus(TaskEntityStatus.Completed);
    EntityReference resolvedBy =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.USER).withName("alice");

    WorkflowHandler workflowHandler = mock(WorkflowHandler.class);
    TaskRepository taskRepository = mock(TaskRepository.class);
    EntityUtil.Fields fields = new EntityUtil.Fields(Set.of("resolution"));

    try (MockedStatic<WorkflowHandler> workflowMock = Mockito.mockStatic(WorkflowHandler.class);
        MockedStatic<Entity> entityMock = Mockito.mockStatic(Entity.class)) {
      workflowMock.when(WorkflowHandler::getInstance).thenReturn(workflowHandler);
      when(workflowHandler.hasActiveRuntimeTask(taskId)).thenReturn(false);

      entityMock.when(() -> Entity.getEntityRepository(Entity.TASK)).thenReturn(taskRepository);
      entityMock
          .when(() -> Entity.getEntityReferenceByName(Entity.USER, "alice", Include.NON_DELETED))
          .thenReturn(resolvedBy);
      when(taskRepository.resolveTask(eq(task), any(TaskResolution.class), eq("alice")))
          .thenReturn(storedTask);
      when(taskRepository.getFields(anyString())).thenReturn(fields);
      when(taskRepository.get(isNull(), eq(taskId), eq(fields))).thenReturn(refreshedTask);

      Task result =
          TaskWorkflowHandler.getInstance()
              .resolveTask(
                  task, "complete", TaskResolutionType.Completed, null, null, null, "alice");

      assertSame(refreshedTask, result);
      verify(taskRepository).resolveTask(eq(task), any(TaskResolution.class), eq("alice"));
      verify(workflowHandler).hasActiveRuntimeTask(taskId);
    }
  }

  @Test
  void testResolveStandaloneTaskBuildsApprovedResolution() {
    UUID taskId = UUID.randomUUID();
    Task task =
        new Task()
            .withId(taskId)
            .withStatus(TaskEntityStatus.Open)
            .withType(TaskEntityType.CustomTask);
    Task storedTask = new Task().withId(taskId).withStatus(TaskEntityStatus.Completed);
    EntityReference resolvedBy =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.USER).withName("alice");

    WorkflowHandler workflowHandler = mock(WorkflowHandler.class);
    TaskRepository taskRepository = mock(TaskRepository.class);
    EntityUtil.Fields fields = new EntityUtil.Fields(Set.of("resolution"));

    try (MockedStatic<WorkflowHandler> workflowMock = Mockito.mockStatic(WorkflowHandler.class);
        MockedStatic<Entity> entityMock = Mockito.mockStatic(Entity.class)) {
      workflowMock.when(WorkflowHandler::getInstance).thenReturn(workflowHandler);
      when(workflowHandler.hasActiveRuntimeTask(taskId)).thenReturn(false);

      entityMock.when(() -> Entity.getEntityRepository(Entity.TASK)).thenReturn(taskRepository);
      entityMock
          .when(() -> Entity.getEntityReferenceByName(Entity.USER, "alice", Include.NON_DELETED))
          .thenReturn(resolvedBy);
      when(taskRepository.resolveTask(eq(task), any(TaskResolution.class), eq("alice")))
          .thenReturn(storedTask);
      when(taskRepository.getFields(anyString())).thenReturn(fields);
      when(taskRepository.get(isNull(), eq(taskId), eq(fields))).thenReturn(storedTask);

      TaskWorkflowHandler.getInstance()
          .resolveTask(task, "approve", TaskResolutionType.Approved, null, null, null, "alice");

      verify(taskRepository)
          .resolveTask(
              eq(task),
              Mockito.argThat(
                  resolution ->
                      resolution.getType() == TaskResolutionType.Approved
                          && resolution.getResolvedBy() == resolvedBy
                          && resolution.getResolvedAt() != null),
              eq("alice"));
    }
  }

  @Test
  void testApplySuggestion_nestedColumnDescription_updatesLeafOnly() throws Exception {
    Column fullName = new Column().withName("full_name").withDescription("name");
    Column personal = new Column().withName("personal").withChildren(List.of(fullName));
    Column phone = new Column().withName("phone").withDescription("Phone");
    Column contact = new Column().withName("contact").withChildren(List.of(phone));
    Column profile =
        new Column()
            .withName("profile")
            .withDescription("Customer profile block")
            .withChildren(List.of(personal, contact));
    Table table =
        new Table()
            .withId(UUID.randomUUID())
            .withName("customer_events")
            .withColumns(List.of(profile));

    Task task = new Task().withId(UUID.randomUUID());
    Map<String, String> payload =
        Map.of(
            "suggestionType", "Description",
            "fieldPath", "columns.profile.personal.full_name.description",
            "suggestedValue", "Full name of the customer");
    EntityRepository<?> repository = mock(EntityRepository.class);

    Method applySuggestion =
        TaskWorkflowHandler.class.getDeclaredMethod(
            "applySuggestion",
            Task.class,
            Object.class,
            EntityInterface.class,
            EntityRepository.class,
            String.class);
    applySuggestion.setAccessible(true);
    applySuggestion.invoke(
        TaskWorkflowHandler.getInstance(), task, payload, table, repository, "admin");

    Column resultProfile = table.getColumns().getFirst();
    Column resultLeaf = resultProfile.getChildren().getFirst().getChildren().getFirst();
    assertEquals("Full name of the customer", resultLeaf.getDescription());
    assertEquals("Customer profile block", resultProfile.getDescription());
    assertEquals(
        "Phone", resultProfile.getChildren().getLast().getChildren().getFirst().getDescription());
  }

  @Test
  void testApplySuggestion_columnTag_appliesToColumnNotParent() throws Exception {
    Column customerId = new Column().withName("customer_id");
    Table table =
        new Table()
            .withId(UUID.randomUUID())
            .withName("orders")
            .withFullyQualifiedName("svc.db.schema.orders")
            .withColumns(List.of(customerId));

    Task task = new Task().withId(UUID.randomUUID());
    Map<String, String> payload =
        Map.of(
            "suggestionType", "Tag",
            "fieldPath", "columns.customer_id.tags",
            "suggestedValue",
                "[{\"tagFQN\":\"PII.Sensitive\",\"source\":\"Classification\",\"labelType\":\"Manual\",\"state\":\"Suggested\"}]");
    EntityRepository<?> repository = mock(EntityRepository.class);

    Method applySuggestion =
        TaskWorkflowHandler.class.getDeclaredMethod(
            "applySuggestion",
            Task.class,
            Object.class,
            EntityInterface.class,
            EntityRepository.class,
            String.class);
    applySuggestion.setAccessible(true);
    applySuggestion.invoke(
        TaskWorkflowHandler.getInstance(), task, payload, table, repository, "admin");

    Column resultColumn = table.getColumns().getFirst();
    assertNotNull(resultColumn.getTags(), "Column tags should be set");
    assertEquals(1, resultColumn.getTags().size());
    assertEquals("PII.Sensitive", resultColumn.getTags().getFirst().getTagFQN());
    List<TagLabel> parentTags = table.getTags();
    assertTrue(
        parentTags == null || parentTags.isEmpty(),
        "Column tag suggestion must not tag the parent table");
  }
}
