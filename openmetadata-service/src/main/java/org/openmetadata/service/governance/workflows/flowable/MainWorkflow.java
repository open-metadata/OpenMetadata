package org.openmetadata.service.governance.workflows.flowable;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import lombok.Getter;
import org.flowable.bpmn.model.BoundaryEvent;
import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.Process;
import org.flowable.bpmn.model.SequenceFlow;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.governance.workflows.elements.EdgeDefinition;
import org.openmetadata.schema.governance.workflows.elements.WorkflowNodeDefinitionInterface;
import org.openmetadata.service.governance.workflows.elements.Edge;
import org.openmetadata.service.governance.workflows.elements.NodeFactory;
import org.openmetadata.service.governance.workflows.elements.NodeInterface;
import org.openmetadata.service.governance.workflows.elements.nodes.endEvent.EndEvent;

@Getter
public class MainWorkflow {
  private final BpmnModel model;
  private final String workflowName;
  private final List<BoundaryEvent> runtimeExceptionBoundaryEvents = new ArrayList<>();

  public MainWorkflow(WorkflowDefinition workflowDefinition) {
    BpmnModel model = new BpmnModel();
    model.setTargetNamespace("");
    String workflowName = workflowDefinition.getFullyQualifiedName();

    Process process = new Process();
    process.setId(workflowName);
    process.setName(
        Optional.ofNullable(workflowDefinition.getDisplayName())
            .orElse(workflowDefinition.getFullyQualifiedName()));
    model.addProcess(process);

    // Add Nodes
    for (WorkflowNodeDefinitionInterface nodeDefinitionObj : workflowDefinition.getNodes()) {
      NodeInterface node = NodeFactory.createNode(nodeDefinitionObj);
      node.addToWorkflow(model, process);

      Optional.ofNullable(node.getRuntimeExceptionBoundaryEvent())
          .ifPresent(runtimeExceptionBoundaryEvents::add);
    }

    // Add Edges
    for (EdgeDefinition edgeDefinition : workflowDefinition.getEdges()) {
      Edge edge = new Edge(edgeDefinition);
      edge.addToWorkflow(model, process);
    }

    // Configure Exception Flow
    configureRuntimeExceptionFlow(process);

    this.model = model;
    this.workflowName = workflowName;
  }

  private void configureRuntimeExceptionFlow(Process process) {
    EndEvent errorEndEvent = new EndEvent("Error");
    process.addFlowElement(errorEndEvent.getEndEvent());
    for (BoundaryEvent event : runtimeExceptionBoundaryEvents) {
      process.addFlowElement(new SequenceFlow(event.getId(), errorEndEvent.getEndEvent().getId()));
    }
  }
}
