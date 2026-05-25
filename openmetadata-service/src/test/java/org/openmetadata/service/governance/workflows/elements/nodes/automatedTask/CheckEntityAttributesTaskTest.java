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
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.CheckEntityAttributesTaskDefinition;
import org.openmetadata.schema.utils.JsonUtils;

class CheckEntityAttributesTaskTest {

  @Test
  void testTaskCreation() {
    CheckEntityAttributesTaskDefinition definition = createDefinition("checkAttrs");
    WorkflowConfiguration config = createConfig(false);

    CheckEntityAttributesTask task = new CheckEntityAttributesTask(definition, config);

    assertNotNull(task);
    assertNotNull(task.getRuntimeExceptionBoundaryEvent());
  }

  @Test
  void testAddToWorkflow() {
    CheckEntityAttributesTaskDefinition definition = createDefinition("checkAttrs");
    WorkflowConfiguration config = createConfig(false);

    CheckEntityAttributesTask task = new CheckEntityAttributesTask(definition, config);

    BpmnModel model = new BpmnModel();
    Process process = new Process();
    process.setId("testProcess");
    model.addProcess(process);

    task.addToWorkflow(model, process);

    SubProcess subProcess = findSubProcess(process, "checkAttrs");
    assertNotNull(subProcess, "SubProcess should be added");
    assertNotNull(subProcess.getFlowElement("checkAttrs.startEvent"), "Should have start event");
    assertNotNull(
        subProcess.getFlowElement("checkAttrs.checkEntityAttributes"), "Should have service task");
    assertNotNull(subProcess.getFlowElement("checkAttrs.endEvent"), "Should have end event");
  }

  @Test
  void testEntityListDefaultsToGlobalNamespace() {
    CheckEntityAttributesTaskDefinition definition = createDefinition("checkAttrs2");
    WorkflowConfiguration config = createConfig(false);

    CheckEntityAttributesTask task = new CheckEntityAttributesTask(definition, config);

    BpmnModel model = new BpmnModel();
    Process process = new Process();
    process.setId("testProcess");
    model.addProcess(process);

    task.addToWorkflow(model, process);

    SubProcess subProcess = findSubProcess(process, "checkAttrs2");
    ServiceTask serviceTask =
        (ServiceTask) subProcess.getFlowElement("checkAttrs2.checkEntityAttributes");
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
  void testRulesFieldExtension() {
    CheckEntityAttributesTaskDefinition definition = createDefinition("checkAttrs3");
    WorkflowConfiguration config = createConfig(false);

    CheckEntityAttributesTask task = new CheckEntityAttributesTask(definition, config);

    BpmnModel model = new BpmnModel();
    Process process = new Process();
    process.setId("testProcess");
    model.addProcess(process);

    task.addToWorkflow(model, process);

    SubProcess subProcess = findSubProcess(process, "checkAttrs3");
    ServiceTask serviceTask =
        (ServiceTask) subProcess.getFlowElement("checkAttrs3.checkEntityAttributes");

    FieldExtension rulesExt =
        serviceTask.getFieldExtensions().stream()
            .filter(ext -> "rulesExpr".equals(ext.getFieldName()))
            .findFirst()
            .orElse(null);

    assertNotNull(rulesExt, "rulesExpr field should exist");
  }

  @Test
  void testBoundaryEventAttachment() {
    CheckEntityAttributesTaskDefinition definition = createDefinition("checkAttrsBoundary");
    WorkflowConfiguration config = createConfig(false);

    CheckEntityAttributesTask task = new CheckEntityAttributesTask(definition, config);

    assertNotNull(task.getRuntimeExceptionBoundaryEvent());
    assertTrue(
        task.getRuntimeExceptionBoundaryEvent().getId().contains("runtimeExceptionBoundaryEvent"));
    assertEquals(
        "checkAttrsBoundary", task.getRuntimeExceptionBoundaryEvent().getAttachedToRef().getId());
  }

  @Test
  void testWithStageStatusTracking() {
    CheckEntityAttributesTaskDefinition definition = createDefinition("checkAttrsTracked");
    WorkflowConfiguration config = createConfig(true);

    CheckEntityAttributesTask task = new CheckEntityAttributesTask(definition, config);

    BpmnModel model = new BpmnModel();
    Process process = new Process();
    process.setId("testProcess");
    model.addProcess(process);

    task.addToWorkflow(model, process);

    SubProcess subProcess = findSubProcess(process, "checkAttrsTracked");
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

  private CheckEntityAttributesTaskDefinition createDefinition(String name) {
    String json =
        """
        {
          "name": "%s",
          "type": "automatedTask",
          "subType": "checkEntityAttributesTask",
          "config": {
            "rules": "{\\"and\\":[{\\"==\\":[{\\"var\\":\\"owner\\"},\\"test\\"]}]}"
          },
          "inputNamespaceMap": {
            "entityList": "global"
          }
        }
        """
            .formatted(name);
    return JsonUtils.readValue(json, CheckEntityAttributesTaskDefinition.class);
  }

  private WorkflowConfiguration createConfig(boolean storeStageStatus) {
    WorkflowConfiguration config = new WorkflowConfiguration();
    config.setStoreStageStatus(storeStageStatus);
    return config;
  }
}
