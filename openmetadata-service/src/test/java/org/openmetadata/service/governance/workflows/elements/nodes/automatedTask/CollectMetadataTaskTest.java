package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask;

import static org.junit.jupiter.api.Assertions.assertEquals;

import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.Process;
import org.flowable.bpmn.model.ServiceTask;
import org.flowable.bpmn.model.SubProcess;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.governance.workflows.WorkflowConfiguration;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.CollectMetadataTaskDefinition;
import org.openmetadata.schema.utils.JsonUtils;

class CollectMetadataTaskTest {
  @ParameterizedTest
  @ValueSource(strings = {"", ",\"inputNamespaceMap\":{\"relatedEntity\":\"previous\"}"})
  void buildsMetadataTaskWithOptionalNamespaceMap(final String namespaceProperty) {
    final var definition =
        JsonUtils.readValue(
            """
            {"type":"automatedTask","subType":"collectMetadataTask","name":"collectDescription","config":{
              "field":"description","rules":"{\\\"!!\\\":[{\\\"var\\\":\\\"description\\\"}]}",
              "taskAssignees":"owners","stage":"Draft"
            }%s}
            """
                .formatted(namespaceProperty),
            CollectMetadataTaskDefinition.class);
    final var task =
        new CollectMetadataTask(
            definition, new WorkflowConfiguration().withStoreStageStatus(false), "lifecycle");
    final var process = new Process();
    task.addToWorkflow(new BpmnModel(), process);
    final var subProcess = (SubProcess) process.getFlowElement("collectDescription");
    final var collect =
        (ServiceTask) subProcess.getFlowElement("collectDescription.collectMetadata");

    final String namespace =
        collect.getFieldExtensions().stream()
            .filter(field -> "inputNamespaceMapExpr".equals(field.getFieldName()))
            .findFirst()
            .orElseThrow()
            .getStringValue();
    assertEquals(
        JsonUtils.readTree(namespaceProperty.isEmpty() ? "{}" : "{\"relatedEntity\":\"previous\"}"),
        JsonUtils.readTree(namespace));
  }
}
