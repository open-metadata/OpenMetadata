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
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.SetEntityAttributeTaskDefinition;
import org.openmetadata.schema.utils.JsonUtils;

class SetEntityAttributeTaskTest {

  @Test
  void testTaskCreation() {
    SetEntityAttributeTaskDefinition definition = createDefinition("setAttr", "tier", "Gold");
    WorkflowConfiguration config = createConfig(false);

    SetEntityAttributeTask task = new SetEntityAttributeTask(definition, config);

    assertNotNull(task);
    assertNotNull(task.getRuntimeExceptionBoundaryEvent());
  }

  @Test
  void testAddToWorkflow() {
    SetEntityAttributeTaskDefinition definition = createDefinition("setAttr", "tier", "Gold");
    WorkflowConfiguration config = createConfig(false);

    SetEntityAttributeTask task = new SetEntityAttributeTask(definition, config);

    BpmnModel model = new BpmnModel();
    Process process = new Process();
    process.setId("testProcess");
    model.addProcess(process);

    task.addToWorkflow(model, process);

    SubProcess subProcess = findSubProcess(process, "setAttr");
    assertNotNull(subProcess, "SubProcess should be added");
    assertNotNull(subProcess.getFlowElement("setAttr.startEvent"), "Should have start event");
    assertNotNull(
        subProcess.getFlowElement("setAttr.setEntityAttribute"), "Should have service task");
    assertNotNull(subProcess.getFlowElement("setAttr.endEvent"), "Should have end event");
  }

  @Test
  void testFieldNameAndValueExtensions() {
    SetEntityAttributeTaskDefinition definition =
        createDefinition("setAttrFields", "certification", "Bronze");
    WorkflowConfiguration config = createConfig(false);

    SetEntityAttributeTask task = new SetEntityAttributeTask(definition, config);

    BpmnModel model = new BpmnModel();
    Process process = new Process();
    process.setId("testProcess");
    model.addProcess(process);

    task.addToWorkflow(model, process);

    SubProcess subProcess = findSubProcess(process, "setAttrFields");
    ServiceTask serviceTask =
        (ServiceTask) subProcess.getFlowElement("setAttrFields.setEntityAttribute");
    assertNotNull(serviceTask);

    FieldExtension fieldNameExt =
        serviceTask.getFieldExtensions().stream()
            .filter(ext -> "fieldNameExpr".equals(ext.getFieldName()))
            .findFirst()
            .orElse(null);
    assertNotNull(fieldNameExt, "fieldNameExpr should exist");
    assertEquals("certification", fieldNameExt.getStringValue());

    FieldExtension fieldValueExt =
        serviceTask.getFieldExtensions().stream()
            .filter(ext -> "fieldValueExpr".equals(ext.getFieldName()))
            .findFirst()
            .orElse(null);
    assertNotNull(fieldValueExt, "fieldValueExpr should exist");
    assertEquals("Bronze", fieldValueExt.getStringValue());
  }

  @Test
  void testEntityListDefaultsToGlobalNamespace() {
    SetEntityAttributeTaskDefinition definition = createDefinition("setAttrNs", "owner", "user1");
    WorkflowConfiguration config = createConfig(false);

    SetEntityAttributeTask task = new SetEntityAttributeTask(definition, config);

    BpmnModel model = new BpmnModel();
    Process process = new Process();
    process.setId("testProcess");
    model.addProcess(process);

    task.addToWorkflow(model, process);

    SubProcess subProcess = findSubProcess(process, "setAttrNs");
    ServiceTask serviceTask =
        (ServiceTask) subProcess.getFlowElement("setAttrNs.setEntityAttribute");

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
    SetEntityAttributeTaskDefinition definition =
        createDefinition("setAttrBoundary", "tier", "Gold");
    WorkflowConfiguration config = createConfig(false);

    SetEntityAttributeTask task = new SetEntityAttributeTask(definition, config);

    assertNotNull(task.getRuntimeExceptionBoundaryEvent());
    assertTrue(
        task.getRuntimeExceptionBoundaryEvent().getId().contains("runtimeExceptionBoundaryEvent"));
    assertEquals(
        "setAttrBoundary", task.getRuntimeExceptionBoundaryEvent().getAttachedToRef().getId());
  }

  @Test
  void testWithStageStatusTracking() {
    SetEntityAttributeTaskDefinition definition =
        createDefinition("setAttrTracked", "tier", "Silver");
    WorkflowConfiguration config = createConfig(true);

    SetEntityAttributeTask task = new SetEntityAttributeTask(definition, config);

    BpmnModel model = new BpmnModel();
    Process process = new Process();
    process.setId("testProcess");
    model.addProcess(process);

    task.addToWorkflow(model, process);

    SubProcess subProcess = findSubProcess(process, "setAttrTracked");
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

  private SetEntityAttributeTaskDefinition createDefinition(
      String name, String fieldName, String fieldValue) {
    String json =
        """
        {
          "name": "%s",
          "type": "automatedTask",
          "subType": "setEntityAttributeTask",
          "config": {
            "fieldName": "%s",
            "fieldValue": "%s"
          },
          "inputNamespaceMap": {
            "entityList": "global"
          }
        }
        """
            .formatted(name, fieldName, fieldValue);
    return JsonUtils.readValue(json, SetEntityAttributeTaskDefinition.class);
  }

  private WorkflowConfiguration createConfig(boolean storeStageStatus) {
    WorkflowConfiguration config = new WorkflowConfiguration();
    config.setStoreStageStatus(storeStageStatus);
    return config;
  }
}
