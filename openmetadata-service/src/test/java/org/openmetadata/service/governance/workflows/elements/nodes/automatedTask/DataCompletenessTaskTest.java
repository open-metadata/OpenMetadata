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
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.DataCompletenessTaskDefinition;
import org.openmetadata.schema.utils.JsonUtils;

class DataCompletenessTaskTest {

  @Test
  void testTaskCreation() {
    DataCompletenessTaskDefinition definition = createDefinition("dataCompleteness");
    WorkflowConfiguration config = createConfig(false);

    DataCompletenessTask task = new DataCompletenessTask(definition, config);

    assertNotNull(task);
    assertNotNull(task.getRuntimeExceptionBoundaryEvent());
  }

  @Test
  void testAddToWorkflow() {
    DataCompletenessTaskDefinition definition = createDefinition("dataCompleteness");
    WorkflowConfiguration config = createConfig(false);

    DataCompletenessTask task = new DataCompletenessTask(definition, config);

    BpmnModel model = new BpmnModel();
    Process process = new Process();
    process.setId("testProcess");
    model.addProcess(process);

    task.addToWorkflow(model, process);

    SubProcess subProcess = findSubProcess(process, "dataCompleteness");
    assertNotNull(subProcess, "SubProcess should be added");
    assertNotNull(
        subProcess.getFlowElement("dataCompleteness.startEvent"), "Should have start event");
    assertNotNull(
        subProcess.getFlowElement("dataCompleteness.dataCompletenessTask"),
        "Should have service task");
    assertNotNull(subProcess.getFlowElement("dataCompleteness.endEvent"), "Should have end event");
  }

  @Test
  void testFieldsToCheckExtension() {
    DataCompletenessTaskDefinition definition = createDefinition("dataCompletenessFields");
    WorkflowConfiguration config = createConfig(false);

    DataCompletenessTask task = new DataCompletenessTask(definition, config);

    BpmnModel model = new BpmnModel();
    Process process = new Process();
    process.setId("testProcess");
    model.addProcess(process);

    task.addToWorkflow(model, process);

    SubProcess subProcess = findSubProcess(process, "dataCompletenessFields");
    ServiceTask serviceTask =
        (ServiceTask) subProcess.getFlowElement("dataCompletenessFields.dataCompletenessTask");
    assertNotNull(serviceTask);

    FieldExtension fieldsExt =
        serviceTask.getFieldExtensions().stream()
            .filter(ext -> "fieldsToCheckExpr".equals(ext.getFieldName()))
            .findFirst()
            .orElse(null);

    assertNotNull(fieldsExt, "fieldsToCheckExpr should exist");
    assertTrue(fieldsExt.getStringValue().contains("description"), "Should contain description");
  }

  @Test
  void testQualityBandsExtension() {
    DataCompletenessTaskDefinition definition = createDefinition("dataCompletenessBands");
    WorkflowConfiguration config = createConfig(false);

    DataCompletenessTask task = new DataCompletenessTask(definition, config);

    BpmnModel model = new BpmnModel();
    Process process = new Process();
    process.setId("testProcess");
    model.addProcess(process);

    task.addToWorkflow(model, process);

    SubProcess subProcess = findSubProcess(process, "dataCompletenessBands");
    ServiceTask serviceTask =
        (ServiceTask) subProcess.getFlowElement("dataCompletenessBands.dataCompletenessTask");

    FieldExtension bandsExt =
        serviceTask.getFieldExtensions().stream()
            .filter(ext -> "qualityBandsExpr".equals(ext.getFieldName()))
            .findFirst()
            .orElse(null);

    assertNotNull(bandsExt, "qualityBandsExpr should exist");
    assertTrue(bandsExt.getStringValue().contains("gold"), "Should contain gold band");
  }

  @Test
  void testEntityListDefaultsToGlobalNamespace() {
    DataCompletenessTaskDefinition definition = createDefinition("dataCompletenessNs");
    WorkflowConfiguration config = createConfig(false);

    DataCompletenessTask task = new DataCompletenessTask(definition, config);

    BpmnModel model = new BpmnModel();
    Process process = new Process();
    process.setId("testProcess");
    model.addProcess(process);

    task.addToWorkflow(model, process);

    SubProcess subProcess = findSubProcess(process, "dataCompletenessNs");
    ServiceTask serviceTask =
        (ServiceTask) subProcess.getFlowElement("dataCompletenessNs.dataCompletenessTask");

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
    DataCompletenessTaskDefinition definition = createDefinition("dataCompletenessBoundary");
    WorkflowConfiguration config = createConfig(false);

    DataCompletenessTask task = new DataCompletenessTask(definition, config);

    assertNotNull(task.getRuntimeExceptionBoundaryEvent());
    assertTrue(
        task.getRuntimeExceptionBoundaryEvent().getId().contains("runtimeExceptionBoundaryEvent"));
    assertEquals(
        "dataCompletenessBoundary",
        task.getRuntimeExceptionBoundaryEvent().getAttachedToRef().getId());
  }

  @Test
  void testWithStageStatusTracking() {
    DataCompletenessTaskDefinition definition = createDefinition("dataCompletenessTracked");
    WorkflowConfiguration config = createConfig(true);

    DataCompletenessTask task = new DataCompletenessTask(definition, config);

    BpmnModel model = new BpmnModel();
    Process process = new Process();
    process.setId("testProcess");
    model.addProcess(process);

    task.addToWorkflow(model, process);

    SubProcess subProcess = findSubProcess(process, "dataCompletenessTracked");
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

  private DataCompletenessTaskDefinition createDefinition(String name) {
    String json =
        """
        {
          "name": "%s",
          "type": "automatedTask",
          "subType": "dataCompletenessTask",
          "config": {
            "fieldsToCheck": ["description", "owner", "tags"],
            "qualityBands": [
              {"name": "gold", "minimumScore": 90},
              {"name": "silver", "minimumScore": 70}
            ]
          },
          "inputNamespaceMap": {
            "entityList": "global"
          }
        }
        """
            .formatted(name);
    return JsonUtils.readValue(json, DataCompletenessTaskDefinition.class);
  }

  private WorkflowConfiguration createConfig(boolean storeStageStatus) {
    WorkflowConfiguration config = new WorkflowConfiguration();
    config.setStoreStageStatus(storeStageStatus);
    return config;
  }
}
