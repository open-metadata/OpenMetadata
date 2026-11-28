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
package org.openmetadata.service.governance.workflows;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.RETURNS_SELF;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.withSettings;

import java.lang.reflect.Field;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.flowable.engine.ProcessEngine;
import org.flowable.engine.TaskService;
import org.flowable.identitylink.api.IdentityLink;
import org.flowable.identitylink.api.IdentityLinkType;
import org.flowable.task.api.Task;
import org.flowable.task.api.TaskQuery;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.service.Entity;

/**
 * Verifies {@link WorkflowHandler#updateFlowableVoteTracking} passes the stored entity-link
 * candidate identifier (not a plain user name) to Flowable when pruning a voter's candidate link.
 */
class WorkflowHandlerVoteTrackingTest {

  private TaskService taskService;
  private WorkflowHandler workflowHandler;

  @BeforeEach
  void setUp() throws ReflectiveOperationException {
    taskService = mock(TaskService.class);
    ProcessEngine processEngine = mock(ProcessEngine.class);
    when(processEngine.getTaskService()).thenReturn(taskService);

    workflowHandler = mock(WorkflowHandler.class, withSettings().defaultAnswer(CALLS_REAL_METHODS));
    Field processEngineField = WorkflowHandler.class.getDeclaredField("processEngine");
    processEngineField.setAccessible(true);
    processEngineField.set(workflowHandler, processEngine);
  }

  @Test
  void updateFlowableVoteTrackingPassesEntityLinkToDeleteCandidateUser() {
    Task flowableTask = mock(Task.class);
    when(flowableTask.getId()).thenReturn("flowable-task-1");

    workflowHandler.updateFlowableVoteTracking(flowableTask, "alice");

    verify(taskService).setVariable("flowable-task-1", "votedUsers", List.of("alice"));
    verify(taskService).deleteCandidateUser("flowable-task-1", "<#E::user::alice>");
    verify(taskService, never()).deleteCandidateUser("flowable-task-1", "alice");
    verify(taskService, never()).unclaim(anyString());
  }

  @Test
  void updateFlowableVoteTrackingQuotesAndCanonicalizesDottedMixedCaseUsers() {
    Task flowableTask = mock(Task.class);
    when(flowableTask.getId()).thenReturn("flowable-task-2");

    workflowHandler.updateFlowableVoteTracking(flowableTask, "Alice.Smith");

    verify(taskService).setVariable("flowable-task-2", "votedUsers", List.of("Alice.Smith"));
    verify(taskService).deleteCandidateUser("flowable-task-2", "<#E::user::\"alice.smith\">");
  }

  @Test
  void updateFlowableVoteTrackingUnclaimsMatchingEntityLinkOrPlainAssignee() {
    Task linkAssignedTask = mock(Task.class);
    when(linkAssignedTask.getId()).thenReturn("flowable-task-3");
    when(linkAssignedTask.getAssignee()).thenReturn("<#E::user::alice>");

    workflowHandler.updateFlowableVoteTracking(linkAssignedTask, "alice");

    verify(taskService).unclaim("flowable-task-3");
    verify(taskService).deleteCandidateUser("flowable-task-3", "<#E::user::alice>");

    Task plainAssignedTask = mock(Task.class);
    when(plainAssignedTask.getId()).thenReturn("flowable-task-4");
    when(plainAssignedTask.getAssignee()).thenReturn("alice");

    workflowHandler.updateFlowableVoteTracking(plainAssignedTask, "alice");

    verify(taskService).unclaim("flowable-task-4");
    verify(taskService).deleteCandidateUser("flowable-task-4", "<#E::user::alice>");

    Task otherAssignedTask = mock(Task.class);
    when(otherAssignedTask.getId()).thenReturn("flowable-task-5");
    when(otherAssignedTask.getAssignee()).thenReturn("<#E::user::bob>");

    workflowHandler.updateFlowableVoteTracking(otherAssignedTask, "alice");

    verify(taskService, never()).unclaim("flowable-task-5");
    verify(taskService).deleteCandidateUser("flowable-task-5", "<#E::user::alice>");
  }

  @Test
  void updateFlowableVoteTrackingIgnoresNullTaskOrBlankUser() {
    Task flowableTask = mock(Task.class);

    workflowHandler.updateFlowableVoteTracking(null, "alice");
    workflowHandler.updateFlowableVoteTracking(flowableTask, null);
    workflowHandler.updateFlowableVoteTracking(flowableTask, "   ");

    verifyNoInteractions(taskService);
  }

  @Test
  void flowableCandidateUserIdPreservesAlreadyFormattedEntityLink() {
    assertEquals("<#E::user::alice>", WorkflowHandler.flowableCandidateUserId("<#E::user::alice>"));
    assertEquals(
        "<#E::user::\"alice.smith\">", WorkflowHandler.flowableCandidateUserId("\"alice.smith\""));
  }

  @Test
  void candidateUserIdsForTaskFiltersToCandidateUserIdentityLinks() {
    UUID customTaskId = UUID.randomUUID();
    Task flowableTask = mock(Task.class);
    when(flowableTask.getId()).thenReturn("flowable-task-6");

    TaskQuery query = mock(TaskQuery.class, RETURNS_SELF);
    when(query.list()).thenReturn(List.of(flowableTask));
    when(taskService.createTaskQuery()).thenReturn(query);

    IdentityLink candidate1 = identityLink(IdentityLinkType.CANDIDATE, "<#E::user::alice>");
    IdentityLink candidateGroup = identityLink(IdentityLinkType.CANDIDATE, null);
    IdentityLink participant = identityLink(IdentityLinkType.PARTICIPANT, "<#E::user::bob>");
    when(taskService.getIdentityLinksForTask("flowable-task-6"))
        .thenReturn(List.of(candidate1, candidateGroup, participant));

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(() -> Entity.hasEntityRepository(Entity.TASK)).thenReturn(false);

      assertEquals(
          Set.of("<#E::user::alice>"), workflowHandler.candidateUserIdsForTask(customTaskId));
      verify(query).processVariableValueEquals(eq("customTaskId"), eq(customTaskId.toString()));

      when(query.list()).thenReturn(List.of());
      assertEquals(Set.of(), workflowHandler.candidateUserIdsForTask(UUID.randomUUID()));
      verify(taskService, never()).deleteCandidateUser(any(), any());
    }
  }

  private static IdentityLink identityLink(String type, String userId) {
    IdentityLink link = mock(IdentityLink.class);
    when(link.getType()).thenReturn(type);
    when(link.getUserId()).thenReturn(userId);
    return link;
  }
}
