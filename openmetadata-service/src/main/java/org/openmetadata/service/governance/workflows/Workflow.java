package org.openmetadata.service.governance.workflows;

import lombok.Getter;
import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.ExtensionElement;
import org.flowable.bpmn.model.FlowableListener;
import org.flowable.bpmn.model.Process;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.governance.workflows.elements.EdgeDefinition;
import org.openmetadata.service.governance.workflows.elements.Edge;
import org.openmetadata.service.governance.workflows.elements.WorkflowNodeFactory;
import org.openmetadata.service.util.JsonUtils;

import java.util.Map;

@Getter
public class Workflow {
  private final BpmnModel model;
  private final String modelId;

  public Workflow(WorkflowDefinition workflowDefinition) {
    BpmnModel model = new BpmnModel();
    model.setTargetNamespace("http://openmetadata.org");
    model.getNamespaces().put("custom", "http://openmetadata.org");

    Process process = new Process();
    process.setId(workflowDefinition.getFullyQualifiedName());
    process.setName(workflowDefinition.getDisplayName());
    process.addExtensionElement(
        getMetadataExtension(
            workflowDefinition.getFullyQualifiedName(),
            workflowDefinition.getDisplayName(),
            workflowDefinition.getDescription()));
    model.addProcess(process);

    // Add Workflow Listeners
    FlowableListener startListener = new FlowableListener();
    startListener.setEvent("start");
    startListener.setImplementationType("class");
    startListener.setImplementation(WorkflowInstanceUpdaterListener.class.getName());
    process.getExecutionListeners().add(startListener);

    FlowableListener endListener = new FlowableListener();
    endListener.setEvent("end");
    endListener.setImplementationType("class");
    endListener.setImplementation(WorkflowInstanceUpdaterListener.class.getName());
    process.getExecutionListeners().add(endListener);

    // Add Nodes
    for (Object nodeDefinitionObj : workflowDefinition.getNodes()) {
      WorkflowNodeFactory.createNode(JsonUtils.readOrConvertValue(nodeDefinitionObj, Map.class)).addToWorkflow(model, process);
    }

    // Add Edges
    for (EdgeDefinition edgeDefinition : workflowDefinition.getEdges()) {
        Edge edge = new Edge(edgeDefinition);
        edge.addToWorkflow(model, process);
    }

    this.model = model;
    this.modelId = workflowDefinition.getFullyQualifiedName();
  }

  public static ExtensionElement getMetadataExtension(
      String name, String displayName, String description) {
    ExtensionElement metadataExtension = new ExtensionElement();
    metadataExtension.setName("metadata");
    metadataExtension.setNamespace("http://openmetadata.org");
    metadataExtension.setNamespacePrefix("custom");

    ExtensionElement metadataNameExtension = new ExtensionElement();
    metadataNameExtension.setName("name");
    metadataNameExtension.setNamespace("http://openmetadata.org");
    metadataExtension.setNamespacePrefix("custom");
    metadataNameExtension.setElementText(name);

    ExtensionElement metadataDisplayNameExtension = new ExtensionElement();
    metadataDisplayNameExtension.setName("displayName");
    metadataDisplayNameExtension.setNamespace("http://openmetadata.org");
    metadataExtension.setNamespacePrefix("custom");
    metadataNameExtension.setElementText(displayName);

    ExtensionElement metadataDescriptionExtension = new ExtensionElement();
    metadataDescriptionExtension.setName("description");
    metadataDescriptionExtension.setNamespace("http://openmetadata.org");
    metadataExtension.setNamespacePrefix("custom");
    metadataNameExtension.setElementText(description);

    metadataExtension.addChildElement(metadataNameExtension);
    metadataExtension.addChildElement(metadataDisplayNameExtension);
    metadataExtension.addChildElement(metadataDescriptionExtension);

    return metadataExtension;
  }
}
