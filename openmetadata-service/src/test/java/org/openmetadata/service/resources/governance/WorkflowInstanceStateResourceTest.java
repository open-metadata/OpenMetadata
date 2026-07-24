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

package org.openmetadata.service.resources.governance;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.core.SecurityContext;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.governance.workflows.Stage;
import org.openmetadata.schema.governance.workflows.WorkflowInstanceState;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.WorkflowInstanceStateRepository;
import org.openmetadata.service.security.Authorizer;

class WorkflowInstanceStateResourceTest {

  private WorkflowInstanceStateResource createResource(
      MockedStatic<Entity> entityMock,
      WorkflowInstanceStateRepository mockRepo,
      Authorizer mockAuth) {
    entityMock
        .when(() -> Entity.getEntityClassFromType(Entity.WORKFLOW_INSTANCE_STATE))
        .thenReturn(WorkflowInstanceState.class);
    entityMock
        .when(() -> Entity.getEntityTimeSeriesRepository(Entity.WORKFLOW_INSTANCE_STATE))
        .thenReturn(mockRepo);
    entityMock
        .when(() -> Entity.registerTimeSeriesResourcePermissions(anyString()))
        .thenAnswer(inv -> null);
    return new WorkflowInstanceStateResource(mockAuth);
  }

  private static WorkflowInstanceState state(
      UUID instanceId, String stageName, Map<String, Object> variables) {
    return new WorkflowInstanceState()
        .withId(UUID.randomUUID())
        .withWorkflowInstanceId(instanceId)
        .withStage(new Stage().withName(stageName).withStartedAt(1L).withVariables(variables));
  }

  @Test
  void endpointReturnsAllStagesByDefault() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      WorkflowInstanceStateRepository mockRepo = mock(WorkflowInstanceStateRepository.class);
      Authorizer mockAuth = mock(Authorizer.class);
      WorkflowInstanceStateResource resource = createResource(entityMock, mockRepo, mockAuth);

      UUID workflowInstanceId = UUID.randomUUID();
      WorkflowInstanceState taskReview =
          state(
              workflowInstanceId,
              "TaskReview",
              Map.of("TaskReview_transitionId", "approve", "TaskReview_updatedBy", "ram.balaji"));
      WorkflowInstanceState policyAgent =
          state(workflowInstanceId, "PolicyAgent", Map.of("PolicyAgent_result", "manual"));
      WorkflowInstanceState grantedAccess =
          state(
              workflowInstanceId, "GrantedAccess", Map.of("GrantedAccess_transitionId", "revoke"));
      WorkflowInstanceState revokedEnd =
          state(workflowInstanceId, "RevokedEnd", Map.of("RevokedEnd_stageInstanceStateId", "id"));

      when(mockRepo.listAllStatesForInstance(workflowInstanceId))
          .thenReturn(List.of(taskReview, policyAgent, grantedAccess, revokedEnd));

      ResultList<WorkflowInstanceState> result =
          resource.listByWorkflowInstanceId(mock(SecurityContext.class), workflowInstanceId, false);

      assertEquals(
          4, result.getData().size(), "default must return every stage the workflow entered");
      assertEquals(4, result.getPaging().getTotal());
      verify(mockRepo).listAllStatesForInstance(workflowInstanceId);
      verify(mockAuth).authorize(any(), any(), any());
    }
  }

  @Test
  void endpointNarrowsToUserTaskStagesWhenRequested() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      WorkflowInstanceStateRepository mockRepo = mock(WorkflowInstanceStateRepository.class);
      Authorizer mockAuth = mock(Authorizer.class);
      WorkflowInstanceStateResource resource = createResource(entityMock, mockRepo, mockAuth);

      UUID workflowInstanceId = UUID.randomUUID();
      WorkflowInstanceState taskReview =
          state(
              workflowInstanceId,
              "TaskReview",
              Map.of("TaskReview_transitionId", "approve", "TaskReview_updatedBy", "ram.balaji"));
      WorkflowInstanceState policyAgent =
          state(workflowInstanceId, "PolicyAgent", Map.of("PolicyAgent_result", "manual"));
      WorkflowInstanceState grantedAccess =
          state(
              workflowInstanceId, "GrantedAccess", Map.of("GrantedAccess_transitionId", "revoke"));
      WorkflowInstanceState revokedEnd =
          state(workflowInstanceId, "RevokedEnd", Map.of("RevokedEnd_stageInstanceStateId", "id"));

      when(mockRepo.listAllStatesForInstance(workflowInstanceId))
          .thenReturn(List.of(taskReview, policyAgent, grantedAccess, revokedEnd));

      ResultList<WorkflowInstanceState> result =
          resource.listByWorkflowInstanceId(mock(SecurityContext.class), workflowInstanceId, true);

      assertEquals(
          2, result.getData().size(), "only user-task stages should be returned when filtered");
      List<String> names = result.getData().stream().map(s -> s.getStage().getName()).toList();
      assertTrue(names.contains("TaskReview"));
      assertTrue(names.contains("GrantedAccess"));
      assertEquals(2, result.getPaging().getTotal());
    }
  }

  @Test
  void filterHandlesStatesWithNullStageOrVariables() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      WorkflowInstanceStateRepository mockRepo = mock(WorkflowInstanceStateRepository.class);
      Authorizer mockAuth = mock(Authorizer.class);
      WorkflowInstanceStateResource resource = createResource(entityMock, mockRepo, mockAuth);

      UUID workflowInstanceId = UUID.randomUUID();
      WorkflowInstanceState nullStage =
          new WorkflowInstanceState()
              .withId(UUID.randomUUID())
              .withWorkflowInstanceId(workflowInstanceId);
      WorkflowInstanceState nullVariables = state(workflowInstanceId, "TaskReview", null);
      WorkflowInstanceState nullStageName =
          new WorkflowInstanceState()
              .withId(UUID.randomUUID())
              .withWorkflowInstanceId(workflowInstanceId)
              .withStage(new Stage().withVariables(Map.of("TaskReview_transitionId", "approve")));

      when(mockRepo.listAllStatesForInstance(workflowInstanceId))
          .thenReturn(List.of(nullStage, nullVariables, nullStageName));

      ResultList<WorkflowInstanceState> result =
          resource.listByWorkflowInstanceId(mock(SecurityContext.class), workflowInstanceId, true);

      assertNotNull(result);
      assertEquals(0, result.getData().size(), "malformed rows must be filtered out, not crash");
    }
  }

  @Test
  void endpointReturnsEmptyResultWhenNoStatesExist() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      WorkflowInstanceStateRepository mockRepo = mock(WorkflowInstanceStateRepository.class);
      Authorizer mockAuth = mock(Authorizer.class);
      WorkflowInstanceStateResource resource = createResource(entityMock, mockRepo, mockAuth);

      UUID workflowInstanceId = UUID.randomUUID();
      when(mockRepo.listAllStatesForInstance(workflowInstanceId)).thenReturn(List.of());

      ResultList<WorkflowInstanceState> result =
          resource.listByWorkflowInstanceId(mock(SecurityContext.class), workflowInstanceId, false);

      assertNotNull(result);
      assertEquals(0, result.getData().size());
      assertEquals(0, result.getPaging().getTotal());
    }
  }
}
