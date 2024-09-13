package org.openmetadata.service.governance.workflows;

import java.util.Map;
import lombok.Getter;
import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.ExtensionElement;
import org.flowable.bpmn.model.Process;
import org.openmetadata.schema.api.governance.EndEvent;
import org.openmetadata.schema.governanceWorkflows.WorkflowDefinition;
import org.openmetadata.service.governance.workflows.elements.Edge;
import org.openmetadata.service.governance.workflows.elements.events.start.EntityEvent;
import org.openmetadata.service.governance.workflows.elements.processes.automated.CheckEntityAttributes;
import org.openmetadata.service.governance.workflows.elements.processes.automated.UpdateEntity;
import org.openmetadata.service.governance.workflows.elements.processes.user.Approval;
import org.openmetadata.service.util.JsonUtils;

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

    // Add StartEvent
    EntityEvent entityEvent = new EntityEvent(workflowDefinition.getStartEvent());
    entityEvent.addToWorkflow(model, process);

    // Add EndEvents
    for (EndEvent endEventConfig : workflowDefinition.getEndEvents()) {
      org.openmetadata.service.governance.workflows.elements.events.end.EndEvent endEvent =
          new org.openmetadata.service.governance.workflows.elements.events.end.EndEvent(
              endEventConfig);
      endEvent.addToWorkflow(model, process);
    }

    // Add Processes
    for (Object processDef : workflowDefinition.getProcesses()) {
      Map<String, Object> processDefMap = JsonUtils.getMap(processDef);
      if (processDefMap.get("type").equals("CHECK_ENTITY_ATTRIBUTES")) {
        CheckEntityAttributes checkEntityAttributes =
            new CheckEntityAttributes(
                JsonUtils.readOrConvertValue(
                    processDefMap,
                    org.openmetadata
                        .schema
                        .governanceWorkflows
                        .elements
                        .processes
                        .automated
                        .CheckEntityAttributes
                        .class));
        checkEntityAttributes.addToWorkflow(model, process);
      } else if (processDefMap.get("type").equals("UPDATE_ENTITY")) {
        UpdateEntity updateEntity =
            new UpdateEntity(
                JsonUtils.readOrConvertValue(
                    processDefMap,
                    org.openmetadata
                        .schema
                        .governanceWorkflows
                        .elements
                        .processes
                        .automated
                        .UpdateEntity
                        .class));
        updateEntity.addToWorkflow(model, process);
      } else {
        Approval approval =
            new Approval(
                JsonUtils.readOrConvertValue(
                    processDefMap,
                    org.openmetadata
                        .schema
                        .governanceWorkflows
                        .elements
                        .processes
                        .user
                        .Approval
                        .class));
        approval.addToWorkflow(model, process);
      }
    }

    // Add Edges
    for (org.openmetadata.schema.api.governance.Edge edgeConfig : workflowDefinition.getEdges()) {
      Edge edge = new Edge(edgeConfig);
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
