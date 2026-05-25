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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.governance.workflows.Workflow.WORKFLOW_SCHEDULE_RUN_ID_VARIABLE;

import java.util.UUID;
import org.flowable.engine.delegate.DelegateExecution;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

class WorkflowScheduleRunIdSetterListenerTest {

  @Mock private DelegateExecution execution;

  private WorkflowScheduleRunIdSetterListener listener;

  @BeforeEach
  void setUp() {
    MockitoAnnotations.openMocks(this);
    listener = new WorkflowScheduleRunIdSetterListener();
  }

  @Test
  void testSetsScheduleRunIdWhenAbsent() {
    when(execution.getVariable(WORKFLOW_SCHEDULE_RUN_ID_VARIABLE)).thenReturn(null);
    when(execution.getProcessInstanceId()).thenReturn("proc-123");

    listener.execute(execution);

    ArgumentCaptor<UUID> captor = ArgumentCaptor.forClass(UUID.class);
    verify(execution).setVariable(eq(WORKFLOW_SCHEDULE_RUN_ID_VARIABLE), captor.capture());
    assertNotNull(captor.getValue(), "scheduleRunId should be set to a non-null UUID");
  }

  @Test
  void testIsIdempotent_DoesNotOverwriteExistingId() {
    UUID existingId = UUID.randomUUID();
    when(execution.getVariable(WORKFLOW_SCHEDULE_RUN_ID_VARIABLE)).thenReturn(existingId);

    listener.execute(execution);

    verify(execution, never()).setVariable(eq(WORKFLOW_SCHEDULE_RUN_ID_VARIABLE), any());
  }

  @Test
  void testGeneratesUniqueIdPerCall() {
    when(execution.getVariable(WORKFLOW_SCHEDULE_RUN_ID_VARIABLE)).thenReturn(null);
    when(execution.getProcessInstanceId()).thenReturn("proc-1");

    ArgumentCaptor<UUID> captor1 = ArgumentCaptor.forClass(UUID.class);
    listener.execute(execution);
    verify(execution).setVariable(eq(WORKFLOW_SCHEDULE_RUN_ID_VARIABLE), captor1.capture());

    DelegateExecution execution2 = org.mockito.Mockito.mock(DelegateExecution.class);
    when(execution2.getVariable(WORKFLOW_SCHEDULE_RUN_ID_VARIABLE)).thenReturn(null);
    when(execution2.getProcessInstanceId()).thenReturn("proc-2");

    ArgumentCaptor<UUID> captor2 = ArgumentCaptor.forClass(UUID.class);
    listener.execute(execution2);
    verify(execution2).setVariable(eq(WORKFLOW_SCHEDULE_RUN_ID_VARIABLE), captor2.capture());

    assertNotNull(captor1.getValue());
    assertNotNull(captor2.getValue());
    assertEquals(
        false,
        captor1.getValue().equals(captor2.getValue()),
        "Different trigger fires should get different scheduleRunIds");
  }
}
