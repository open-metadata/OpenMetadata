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
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.CheckChangeDescriptionTaskDefinition;
import org.openmetadata.schema.utils.JsonUtils;

class CheckChangeDescriptionTaskTest {

  @Test
  void testTaskCreation() {
    CheckChangeDescriptionTaskDefinition definition = createDefinition("checkChangeDesc", "OR");
    WorkflowConfiguration config = createConfig(false);

    CheckChangeDescriptionTask task = new CheckChangeDescriptionTask(definition, config);

    assertNotNull(task);
    assertNotNull(task.getRuntimeExceptionBoundaryEvent());
  }

  @Test
  void testAddToWorkflow() {
    CheckChangeDescriptionTaskDefinition definition = createDefinition("checkChangeDesc", "OR");
    WorkflowConfiguration config = createConfig(false);

    CheckChangeDescriptionTask task = new CheckChangeDescriptionTask(definition, config);

    BpmnModel model = new BpmnModel();
    Process process = new Process();
    process.setId("testProcess");
    model.addProcess(process);

    task.addToWorkflow(model, process);

    SubProcess subProcess = findSubProcess(process, "checkChangeDesc");
    assertNotNull(subProcess, "SubProcess should be added");
    assertNotNull(
        subProcess.getFlowElement("checkChangeDesc.startEvent"), "Should have start event");
    assertNotNull(
        subProcess.getFlowElement("checkChangeDesc.checkChangeDescriptionTask"),
        "Should have service task");
    assertNotNull(subProcess.getFlowElement("checkChangeDesc.endEvent"), "Should have end event");
  }

  @Test
  void testConditionFieldExtension() {
    CheckChangeDescriptionTaskDefinition definition =
        createDefinition("checkChangeDescCond", "AND");
    WorkflowConfiguration config = createConfig(false);

    CheckChangeDescriptionTask task = new CheckChangeDescriptionTask(definition, config);

    BpmnModel model = new BpmnModel();
    Process process = new Process();
    process.setId("testProcess");
    model.addProcess(process);

    task.addToWorkflow(model, process);

    SubProcess subProcess = findSubProcess(process, "checkChangeDescCond");
    ServiceTask serviceTask =
        (ServiceTask) subProcess.getFlowElement("checkChangeDescCond.checkChangeDescriptionTask");
    assertNotNull(serviceTask);

    FieldExtension conditionExt =
        serviceTask.getFieldExtensions().stream()
            .filter(ext -> "conditionExpr".equals(ext.getFieldName()))
            .findFirst()
            .orElse(null);

    assertNotNull(conditionExt, "conditionExpr field should exist");
    assertEquals("AND", conditionExt.getStringValue(), "condition should be AND");
  }

  @Test
  void testRulesFieldExtension() {
    CheckChangeDescriptionTaskDefinition definition =
        createDefinition("checkChangeDescRules", "OR");
    WorkflowConfiguration config = createConfig(false);

    CheckChangeDescriptionTask task = new CheckChangeDescriptionTask(definition, config);

    BpmnModel model = new BpmnModel();
    Process process = new Process();
    process.setId("testProcess");
    model.addProcess(process);

    task.addToWorkflow(model, process);

    SubProcess subProcess = findSubProcess(process, "checkChangeDescRules");
    ServiceTask serviceTask =
        (ServiceTask) subProcess.getFlowElement("checkChangeDescRules.checkChangeDescriptionTask");

    FieldExtension rulesExt =
        serviceTask.getFieldExtensions().stream()
            .filter(ext -> "rulesExpr".equals(ext.getFieldName()))
            .findFirst()
            .orElse(null);

    assertNotNull(rulesExt, "rulesExpr field should exist");
  }

  @Test
  void testEntityListDefaultsToGlobalNamespace() {
    CheckChangeDescriptionTaskDefinition definition = createDefinition("checkChangeDescNs", "OR");
    WorkflowConfiguration config = createConfig(false);

    CheckChangeDescriptionTask task = new CheckChangeDescriptionTask(definition, config);

    BpmnModel model = new BpmnModel();
    Process process = new Process();
    process.setId("testProcess");
    model.addProcess(process);

    task.addToWorkflow(model, process);

    SubProcess subProcess = findSubProcess(process, "checkChangeDescNs");
    ServiceTask serviceTask =
        (ServiceTask) subProcess.getFlowElement("checkChangeDescNs.checkChangeDescriptionTask");

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
    CheckChangeDescriptionTaskDefinition definition =
        createDefinition("checkChangeDescBoundary", "OR");
    WorkflowConfiguration config = createConfig(false);

    CheckChangeDescriptionTask task = new CheckChangeDescriptionTask(definition, config);

    assertNotNull(task.getRuntimeExceptionBoundaryEvent());
    assertTrue(
        task.getRuntimeExceptionBoundaryEvent().getId().contains("runtimeExceptionBoundaryEvent"));
    assertEquals(
        "checkChangeDescBoundary",
        task.getRuntimeExceptionBoundaryEvent().getAttachedToRef().getId());
  }

  @Test
  void testWithStageStatusTracking() {
    CheckChangeDescriptionTaskDefinition definition =
        createDefinition("checkChangeDescTracked", "OR");
    WorkflowConfiguration config = createConfig(true);

    CheckChangeDescriptionTask task = new CheckChangeDescriptionTask(definition, config);

    BpmnModel model = new BpmnModel();
    Process process = new Process();
    process.setId("testProcess");
    model.addProcess(process);

    task.addToWorkflow(model, process);

    SubProcess subProcess = findSubProcess(process, "checkChangeDescTracked");
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

  private CheckChangeDescriptionTaskDefinition createDefinition(String name, String condition) {
    String json =
        """
        {
          "name": "%s",
          "type": "automatedTask",
          "subType": "checkChangeDescriptionTask",
          "config": {
            "condition": "%s",
            "rules": {
              "owner": ["newOwner"]
            }
          },
          "inputNamespaceMap": {
            "entityList": "global"
          }
        }
        """
            .formatted(name, condition);
    return JsonUtils.readValue(json, CheckChangeDescriptionTaskDefinition.class);
  }

  private WorkflowConfiguration createConfig(boolean storeStageStatus) {
    WorkflowConfiguration config = new WorkflowConfiguration();
    config.setStoreStageStatus(storeStageStatus);
    return config;
  }
}
