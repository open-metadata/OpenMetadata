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
package org.openmetadata.service.governance.workflows;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.flowable.engine.delegate.DelegateExecution;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.WorkflowInstanceRepository;

class WorkflowInstanceListenerSupersedeTest {

  @Test
  void endEventWithSupersedeReasonMarksInstanceSupersededAndSkipsUpdate() {
    UUID workflowInstanceId = UUID.fromString("11111111-1111-1111-1111-111111111111");
    DelegateExecution execution = mock(DelegateExecution.class, RETURNS_DEEP_STUBS);
    when(execution.getProcessDefinitionId()).thenReturn("SomeWorkflowTrigger:1:abc");
    when(execution.getProcessInstanceBusinessKey()).thenReturn(workflowInstanceId.toString());
    when(execution.getProcessInstanceId()).thenReturn("proc-1");
    when(execution.getEventName()).thenReturn("end");
    Map<String, Object> variables = new HashMap<>();
    variables.put(
        Workflow.TERMINATION_REASON_VARIABLE, Workflow.TERMINATION_SUPERSEDED_BY_NEWER_INSTANCE);
    when(execution.getVariables()).thenReturn(variables);

    WorkflowInstanceRepository repo = mock(WorkflowInstanceRepository.class);
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock
          .when(() -> Entity.getEntityTimeSeriesRepository(Entity.WORKFLOW_INSTANCE))
          .thenReturn(repo);

      new WorkflowInstanceListener().execute(execution);
    }

    verify(repo)
        .markInstanceAsSuperseded(
            eq(workflowInstanceId), eq(Workflow.TERMINATION_SUPERSEDED_BY_NEWER_INSTANCE));
    verify(repo, never()).updateWorkflowInstance(any(), anyLong(), any());
  }

  @Test
  void endEventWithoutSupersedeReasonFallsBackToUpdateWorkflowInstance() {
    UUID workflowInstanceId = UUID.fromString("22222222-2222-2222-2222-222222222222");
    DelegateExecution execution = mock(DelegateExecution.class, RETURNS_DEEP_STUBS);
    when(execution.getProcessDefinitionId()).thenReturn("SomeWorkflowTrigger:1:abc");
    when(execution.getProcessInstanceBusinessKey()).thenReturn(workflowInstanceId.toString());
    when(execution.getProcessInstanceId()).thenReturn("proc-2");
    when(execution.getEventName()).thenReturn("end");
    when(execution.getVariables()).thenReturn(new HashMap<>());

    WorkflowInstanceRepository repo = mock(WorkflowInstanceRepository.class);
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock
          .when(() -> Entity.getEntityTimeSeriesRepository(Entity.WORKFLOW_INSTANCE))
          .thenReturn(repo);

      new WorkflowInstanceListener().execute(execution);
    }

    verify(repo, never()).markInstanceAsSuperseded(any(), any());
    verify(repo).updateWorkflowInstance(eq(workflowInstanceId), anyLong(), any());
  }
}
