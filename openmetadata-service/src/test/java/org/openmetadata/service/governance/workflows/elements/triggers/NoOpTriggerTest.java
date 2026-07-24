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

package org.openmetadata.service.governance.workflows.elements.triggers;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Set;
import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.CallActivity;
import org.flowable.bpmn.model.FlowElement;
import org.flowable.bpmn.model.IOParameter;
import org.flowable.bpmn.model.Process;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.governance.workflows.elements.triggers.NoOpTriggerDefinition;

class NoOpTriggerTest {

  @Test
  void testNoOpTriggerInheritsVariablesIntoCalledWorkflow() {
    NoOpTriggerDefinition triggerDefinition =
        new NoOpTriggerDefinition().withOutput(Set.of("relatedEntity", "updatedBy"));

    NoOpTrigger trigger =
        new NoOpTrigger("WorkflowManagedTask", "WorkflowManagedTaskTrigger", triggerDefinition);

    BpmnModel model = new BpmnModel();
    trigger.addToWorkflow(model);

    CallActivity callActivity = findCallActivity(model);
    assertNotNull(callActivity);
    assertTrue(
        callActivity.isInheritVariables(),
        "No-op trigger call activity should inherit all start variables into the called workflow");
    assertTrue(callActivity.getInParameters().size() > 2);
    assertTrue(
        callActivity.getInParameters().stream()
            .map(IOParameter::getTarget)
            .anyMatch("taskType"::equals));
    assertTrue(
        callActivity.getInParameters().stream()
            .map(IOParameter::getTarget)
            .anyMatch("taskCategory"::equals));
  }

  private CallActivity findCallActivity(BpmnModel model) {
    for (Process process : model.getProcesses()) {
      for (FlowElement element : process.getFlowElements()) {
        if (element instanceof CallActivity callActivity) {
          return callActivity;
        }
      }
    }
    return null;
  }
}
