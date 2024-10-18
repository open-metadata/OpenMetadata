package org.openmetadata.service.governance.workflows.flowable;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import lombok.Getter;
import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.Process;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.governance.workflows.elements.EdgeDefinition;
import org.openmetadata.schema.governance.workflows.elements.WorkflowNodeDefinitionInterface;
import org.openmetadata.service.governance.workflows.elements.Edge;
import org.openmetadata.service.governance.workflows.elements.NodeFactory;
import org.openmetadata.service.util.JsonUtils;

@Getter
public class MainWorkflow {
  private final BpmnModel model;
  private final String workflowName;

  public MainWorkflow(WorkflowDefinition workflowDefinition) {
    BpmnModel model = new BpmnModel();
    String workflowName = workflowDefinition.getFullyQualifiedName();

    Process process = new Process();
    process.setId(workflowName);
    process.setName(Optional.ofNullable(workflowDefinition.getDisplayName()).orElse(workflowDefinition.getFullyQualifiedName()));
    model.addProcess(process);

    // TODO: Add Workflow Listeners (If we deem them necessary here)

    // Add Nodes
    for (Object nodeDefinitionObj :
        (List<WorkflowNodeDefinitionInterface>) workflowDefinition.getNodes()) {
      NodeFactory.createNode(JsonUtils.readOrConvertValue(nodeDefinitionObj, Map.class))
          .addToWorkflow(model, process);
    }

    // Add Edges
    for (EdgeDefinition edgeDefinition : workflowDefinition.getEdges()) {
      Edge edge = new Edge(edgeDefinition);
      edge.addToWorkflow(model, process);
    }

    this.model = model;
    this.workflowName = workflowName;
  }
}
