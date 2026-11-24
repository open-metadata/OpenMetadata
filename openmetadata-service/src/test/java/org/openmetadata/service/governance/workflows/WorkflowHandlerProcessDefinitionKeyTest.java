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
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.lang.reflect.Field;
import org.apache.ibatis.exceptions.PersistenceException;
import org.flowable.common.engine.api.FlowableObjectNotFoundException;
import org.flowable.engine.RepositoryService;
import org.flowable.engine.impl.persistence.entity.ProcessDefinitionEntityImpl;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * Flowable embeds the key in a process-definition ID only while "key:version:generatedId" fits its
 * 64-character ID column; a longer one is a bare generated number (#36148). The lookup through a
 * running engine is covered by {@code WorkflowHandlerSchemaUpdateTest}, which can initialize one.
 */
class WorkflowHandlerProcessDefinitionKeyTest {

  private static final String LONG_TRIGGER_KEY =
      "ownerAssignedTagApproval_0b5a8e1c-6f0d-4d7e-9d55-3c1f2b7a9e10Trigger";

  private final RepositoryService repositoryService = mock(RepositoryService.class);

  @BeforeEach
  @AfterEach
  void resetWorkflowHandlerState() throws ReflectiveOperationException {
    setStaticField("initialized", false);
    setStaticField("instance", null);
  }

  @Test
  void opaqueIdOfALongWorkflowResolvesToTheDeployedKey() {
    deployed("6308", LONG_TRIGGER_KEY);

    assertEquals(
        LONG_TRIGGER_KEY, WorkflowHandler.deployedProcessDefinitionKey(repositoryService, "6308"));
  }

  @Test
  void keyContainingAColonResolvesToTheDeployedKey() {
    deployed("a:b:3:2501", "a:b");

    assertEquals(
        "a:b", WorkflowHandler.deployedProcessDefinitionKey(repositoryService, "a:b:3:2501"));
  }

  @Test
  void unreadableDefinitionFallsBackToTheEmbeddedKey() {
    when(repositoryService.getProcessDefinition("shortApproval:3:2501"))
        .thenThrow(new FlowableObjectNotFoundException("no deployed definition"));
    when(repositoryService.getProcessDefinition("6308"))
        .thenThrow(new FlowableObjectNotFoundException("no deployed definition"));

    assertEquals(
        "shortApproval",
        WorkflowHandler.deployedProcessDefinitionKey(repositoryService, "shortApproval:3:2501"));
    assertEquals("6308", WorkflowHandler.deployedProcessDefinitionKey(repositoryService, "6308"));
  }

  @Test
  void databaseErrorOutsideACommandFallsBackToTheEmbeddedKey() {
    when(repositoryService.getProcessDefinition("shortApproval:3:2501"))
        .thenThrow(new PersistenceException("connection is closed"));

    assertEquals(
        "shortApproval",
        WorkflowHandler.deployedProcessDefinitionKey(repositoryService, "shortApproval:3:2501"));
  }

  @Test
  void nullIdHasNoKey() {
    assertNull(WorkflowHandler.getProcessDefinitionKeyFromId(null));
  }

  @Test
  void uninitializedEngineReadsTheEmbeddedKey() {
    assertEquals("wf", WorkflowHandler.getProcessDefinitionKeyFromId("wf:1:1"));
  }

  private void deployed(String processDefinitionId, String key) {
    ProcessDefinitionEntityImpl definition = new ProcessDefinitionEntityImpl();
    definition.setId(processDefinitionId);
    definition.setKey(key);
    when(repositoryService.getProcessDefinition(processDefinitionId)).thenReturn(definition);
  }

  private static void setStaticField(String fieldName, Object value)
      throws ReflectiveOperationException {
    Field field = WorkflowHandler.class.getDeclaredField(fieldName);
    field.setAccessible(true);
    field.set(null, value);
  }
}
