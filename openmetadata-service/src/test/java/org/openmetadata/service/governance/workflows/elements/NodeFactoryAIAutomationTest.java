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

package org.openmetadata.service.governance.workflows.elements;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Optional;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.governance.workflows.WorkflowConfiguration;
import org.openmetadata.schema.governance.workflows.elements.NodeSubType;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.CreateAndRunAIAutomationTaskDefinition;
import org.openmetadata.service.governance.workflows.elements.NodeFactoryRegistry.NodeFactoryExtension;

class NodeFactoryAIAutomationTest {

  // NodeFactoryRegistry is a process-wide singleton. Snapshot any existing handler and restore it
  // after each test so mutating it here cannot leak into other tests in the same JVM.
  private Optional<NodeFactoryExtension> savedExtension = Optional.empty();

  @BeforeEach
  void snapshotRegistry() {
    savedExtension =
        NodeFactoryRegistry.getInstance()
            .getExtension(NodeSubType.CREATE_AND_RUN_AI_AUTOMATION_TASK);
  }

  @AfterEach
  void restoreRegistry() {
    NodeFactoryRegistry registry = NodeFactoryRegistry.getInstance();
    savedExtension.ifPresentOrElse(
        ext -> registry.register(NodeSubType.CREATE_AND_RUN_AI_AUTOMATION_TASK, ext),
        () -> registry.deregister(NodeSubType.CREATE_AND_RUN_AI_AUTOMATION_TASK));
  }

  @Test
  void createNode_aiAutomation_withoutCollateHandler_throwsClearError() {
    NodeFactoryRegistry.getInstance().deregister(NodeSubType.CREATE_AND_RUN_AI_AUTOMATION_TASK);
    CreateAndRunAIAutomationTaskDefinition def = new CreateAndRunAIAutomationTaskDefinition();
    def.setSubType("createAndRunAIAutomationTask");
    def.setName("RunDescriptionAutomation");

    IllegalStateException ex =
        assertThrows(
            IllegalStateException.class,
            () -> NodeFactory.createNode(def, new WorkflowConfiguration(), "AutoPilotWorkflow"));
    assertTrue(ex.getMessage().contains("Collate-only"), ex.getMessage());
  }
}
