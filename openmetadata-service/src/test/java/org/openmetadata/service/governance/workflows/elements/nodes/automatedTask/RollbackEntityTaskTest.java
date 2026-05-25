package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.governance.workflows.Workflow.ENTITY_LIST_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.GLOBAL_NAMESPACE;

import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.FieldExtension;
import org.flowable.bpmn.model.FlowElement;
import org.flowable.bpmn.model.Process;
import org.flowable.bpmn.model.ServiceTask;
import org.flowable.bpmn.model.SubProcess;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.governance.workflows.WorkflowConfiguration;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.RollbackEntityTaskDefinition;
import org.openmetadata.schema.utils.JsonUtils;

class RollbackEntityTaskTest {

  @Test
  void testTaskCreation() {
    RollbackEntityTaskDefinition definition = createDefinition("rollback");
    WorkflowConfiguration config = createConfig(false);

    RollbackEntityTask task = new RollbackEntityTask(definition, config);

    assertNotNull(task);
    assertNotNull(task.getRuntimeExceptionBoundaryEvent());
  }

  @Test
  void testAddToWorkflow() {
    RollbackEntityTaskDefinition definition = createDefinition("rollback");
    WorkflowConfiguration config = createConfig(false);

    RollbackEntityTask task = new RollbackEntityTask(definition, config);

    BpmnModel model = new BpmnModel();
    Process process = new Process();
    process.setId("testProcess");
    model.addProcess(process);

    task.addToWorkflow(model, process);

    SubProcess subProcess = findSubProcess(process, "rollback");
    assertNotNull(subProcess, "SubProcess should be added");
    assertNotNull(subProcess.getFlowElement("rollback.startEvent"), "Should have start event");
    assertNotNull(subProcess.getFlowElement("rollback.rollbackEntity"), "Should have service task");
    assertNotNull(subProcess.getFlowElement("rollback.endEvent"), "Should have end event");
  }

  @Test
  void testEntityListDefaultsToGlobalNamespace() {
    RollbackEntityTaskDefinition definition = createDefinition("rollbackNs");
    WorkflowConfiguration config = createConfig(false);

    RollbackEntityTask task = new RollbackEntityTask(definition, config);

    BpmnModel model = new BpmnModel();
    Process process = new Process();
    process.setId("testProcess");
    model.addProcess(process);

    task.addToWorkflow(model, process);

    SubProcess subProcess = findSubProcess(process, "rollbackNs");
    ServiceTask serviceTask = (ServiceTask) subProcess.getFlowElement("rollbackNs.rollbackEntity");
    assertNotNull(serviceTask);

    FieldExtension namespaceMapExt =
        serviceTask.getFieldExtensions().stream()
            .filter(ext -> "inputNamespaceMapExpr".equals(ext.getFieldName()))
            .findFirst()
            .orElse(null);

    assertNotNull(namespaceMapExt, "inputNamespaceMapExpr field should exist");
    assertTrue(
        namespaceMapExt.getStringValue().contains(ENTITY_LIST_VARIABLE),
        "Namespace map should contain entityList");
    assertTrue(
        namespaceMapExt.getStringValue().contains(GLOBAL_NAMESPACE),
        "entityList should map to global namespace");
  }

  @Test
  void testBoundaryEventAttachment() {
    RollbackEntityTaskDefinition definition = createDefinition("rollbackBoundary");
    WorkflowConfiguration config = createConfig(false);

    RollbackEntityTask task = new RollbackEntityTask(definition, config);

    assertNotNull(task.getRuntimeExceptionBoundaryEvent());
    assertTrue(
        task.getRuntimeExceptionBoundaryEvent().getId().contains("runtimeExceptionBoundaryEvent"));
    assertEquals(
        "rollbackBoundary", task.getRuntimeExceptionBoundaryEvent().getAttachedToRef().getId());
  }

  @Test
  void testWithStageStatusTracking() {
    RollbackEntityTaskDefinition definition = createDefinition("rollbackTracked");
    WorkflowConfiguration config = createConfig(true);

    RollbackEntityTask task = new RollbackEntityTask(definition, config);

    BpmnModel model = new BpmnModel();
    Process process = new Process();
    process.setId("testProcess");
    model.addProcess(process);

    task.addToWorkflow(model, process);

    SubProcess subProcess = findSubProcess(process, "rollbackTracked");
    assertNotNull(subProcess, "SubProcess should be added with stage tracking");
  }

  private SubProcess findSubProcess(Process process, String id) {
    for (FlowElement element : process.getFlowElements()) {
      if (id.equals(element.getId()) && element instanceof SubProcess) {
        return (SubProcess) element;
      }
    }
    return null;
  }

  private RollbackEntityTaskDefinition createDefinition(String name) {
    String json =
        """
        {
          "name": "%s",
          "type": "automatedTask",
          "subType": "rollbackEntityTask",
          "config": {},
          "inputNamespaceMap": {
            "entityList": "global"
          }
        }
        """
            .formatted(name);
    return JsonUtils.readValue(json, RollbackEntityTaskDefinition.class);
  }

  private WorkflowConfiguration createConfig(boolean storeStageStatus) {
    WorkflowConfiguration config = new WorkflowConfiguration();
    config.setStoreStageStatus(storeStageStatus);
    return config;
  }
}
