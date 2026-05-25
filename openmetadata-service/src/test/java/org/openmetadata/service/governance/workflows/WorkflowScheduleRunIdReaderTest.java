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

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.governance.workflows.Workflow.GLOBAL_NAMESPACE;
import static org.openmetadata.service.governance.workflows.Workflow.WORKFLOW_SCHEDULE_RUN_ID_VARIABLE;
import static org.openmetadata.service.governance.workflows.WorkflowVariableHandler.getNamespacedVariableName;

import java.util.UUID;
import org.flowable.engine.delegate.DelegateExecution;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;

class WorkflowScheduleRunIdReaderTest {

  @Mock private DelegateExecution execution;

  @BeforeEach
  void setUp() {
    MockitoAnnotations.openMocks(this);
  }

  @Test
  void readFrom_plainUuidVariable_returnsUuid() {
    UUID id = UUID.randomUUID();
    when(execution.getVariable(WORKFLOW_SCHEDULE_RUN_ID_VARIABLE)).thenReturn(id);

    assertEquals(id, WorkflowScheduleRunIdReader.readFrom(execution));
  }

  @Test
  void readFrom_uuidStoredAsString_parsesAndReturnsUuid() {
    UUID id = UUID.randomUUID();
    when(execution.getVariable(WORKFLOW_SCHEDULE_RUN_ID_VARIABLE)).thenReturn(id.toString());

    assertEquals(id, WorkflowScheduleRunIdReader.readFrom(execution));
  }

  @Test
  void readFrom_namespacedVariable_returnsUuid() {
    UUID id = UUID.randomUUID();
    String namespacedKey =
        getNamespacedVariableName(GLOBAL_NAMESPACE, WORKFLOW_SCHEDULE_RUN_ID_VARIABLE);
    when(execution.getVariable(WORKFLOW_SCHEDULE_RUN_ID_VARIABLE)).thenReturn(null);
    when(execution.getVariable(namespacedKey)).thenReturn(id);

    assertEquals(id, WorkflowScheduleRunIdReader.readFrom(execution));
  }

  @Test
  void readFrom_neitherVariablePresent_returnsNull() {
    String namespacedKey =
        getNamespacedVariableName(GLOBAL_NAMESPACE, WORKFLOW_SCHEDULE_RUN_ID_VARIABLE);
    when(execution.getVariable(WORKFLOW_SCHEDULE_RUN_ID_VARIABLE)).thenReturn(null);
    when(execution.getVariable(namespacedKey)).thenReturn(null);

    assertNull(WorkflowScheduleRunIdReader.readFrom(execution));
  }

  @Test
  void readFrom_malformedStringVariable_returnsNullWithoutThrowing() {
    when(execution.getVariable(WORKFLOW_SCHEDULE_RUN_ID_VARIABLE)).thenReturn("not-a-uuid");

    assertDoesNotThrow(() -> assertNull(WorkflowScheduleRunIdReader.readFrom(execution)));
  }

  @Test
  void readFrom_plainVariableTakesPrecedenceOverNamespaced() {
    UUID plainId = UUID.randomUUID();
    UUID namespacedId = UUID.randomUUID();
    String namespacedKey =
        getNamespacedVariableName(GLOBAL_NAMESPACE, WORKFLOW_SCHEDULE_RUN_ID_VARIABLE);
    when(execution.getVariable(WORKFLOW_SCHEDULE_RUN_ID_VARIABLE)).thenReturn(plainId);
    when(execution.getVariable(namespacedKey)).thenReturn(namespacedId);

    UUID result = WorkflowScheduleRunIdReader.readFrom(execution);
    assertEquals(plainId, result);
    assertNotEquals(namespacedId, result);
  }
}
