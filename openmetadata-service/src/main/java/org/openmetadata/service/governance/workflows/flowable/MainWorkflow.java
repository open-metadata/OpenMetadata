package org.openmetadata.service.governance.workflows.flowable;

import static org.openmetadata.service.governance.workflows.Workflow.GLOBAL_NAMESPACE;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import lombok.Getter;
import org.flowable.bpmn.model.BoundaryEvent;
import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.Process;
import org.flowable.bpmn.model.SequenceFlow;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.governance.workflows.elements.EdgeDefinition;
import org.openmetadata.schema.governance.workflows.elements.WorkflowNodeDefinitionInterface;
import org.openmetadata.schema.utils.JsonUtils;
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
    new WorkflowGraph(workflowDefinition).validate();

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
      NodeInterface node =
          NodeFactory.createNode(nodeDefinitionObj, workflowDefinition.getConfig());
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

  @Getter
  public static class WorkflowGraph {
    private final Map<String, WorkflowNodeDefinitionInterface> nodeMap;
    private final Map<String, List<String>> incomingEdgesMap;
    private final Set<String> globalVariables;
    private final String workflowTriggerType;

    public WorkflowGraph(WorkflowDefinition workflowDefinition) {
      Map<String, WorkflowNodeDefinitionInterface> nodeMap = new HashMap<>();
      Map<String, List<String>> incomingEdgesMap = new HashMap<>();

      for (WorkflowNodeDefinitionInterface nodeDefinitionObj : workflowDefinition.getNodes()) {
        nodeMap.put(nodeDefinitionObj.getName(), nodeDefinitionObj);
      }

      for (EdgeDefinition edgeDefinition : workflowDefinition.getEdges()) {
        incomingEdgesMap
            .computeIfAbsent(edgeDefinition.getTo(), k -> new ArrayList<>())
            .add(edgeDefinition.getFrom());
      }

      this.nodeMap = nodeMap;
      this.incomingEdgesMap = incomingEdgesMap;
      this.globalVariables = workflowDefinition.getTrigger().getOutput();
      this.workflowTriggerType = workflowDefinition.getTrigger().getType();
    }

    private void validateNode(WorkflowNodeDefinitionInterface nodeDefinition) {
      Map<String, String> inputNamespaceMap =
          (Map<String, String>)
              JsonUtils.readOrConvertValue(nodeDefinition.getInputNamespaceMap(), Map.class);

      if (inputNamespaceMap == null) {
        return;
      }

      for (Map.Entry<String, String> entry : inputNamespaceMap.entrySet()) {
        String variable = entry.getKey();
        String namespace = entry.getValue();

        if (namespace.equals(GLOBAL_NAMESPACE)) {
          if (!(validateGlobalContainsVariable(variable) || triggerIsNoOp())) {
            throw new RuntimeException(
                String.format(
                    "Invalid Workflow: [%s] is expecting '%s' to be a global variable, but it is not present.",
                    nodeDefinition.getName(), variable));
          }
        } else {
          if (!validateNodeOutputsVariable(namespace, variable)) {
            throw new RuntimeException(
                String.format(
                    "Invalid Workflow: [%s] is expecting '%s' to be an output from [%s], which it is not.",
                    nodeDefinition.getName(), variable, namespace));
          }
          if (!validateNodeHasInput(nodeDefinition.getName(), namespace)) {
            throw new RuntimeException(
                String.format(
                    "Invalid Workflow: [%s] is expecting [%s] to be an input node, which it is not.",
                    nodeDefinition.getName(), namespace));
          }
        }
      }
    }

    private boolean validateGlobalContainsVariable(String variable) {
      return globalVariables.contains(variable);
    }

    private boolean triggerIsNoOp() {
      return workflowTriggerType.equals("noOp");
    }

    private boolean validateNodeOutputsVariable(String nodeName, String variable) {
      WorkflowNodeDefinitionInterface nodeDefinition = nodeMap.get(nodeName);

      if (nodeDefinition == null) {
        return false;
      }

      List<String> nodeOutput = nodeDefinition.getOutput();

      if (nodeOutput == null) {
        return false;
      }

      return nodeOutput.contains(variable);
    }

    private boolean validateNodeHasInput(String nodeName, String inputNodeName) {
      return incomingEdgesMap.get(nodeName).contains(inputNodeName);
    }

    public void validate() {
      for (WorkflowNodeDefinitionInterface nodeDefinition : nodeMap.values()) {
        validateNode(nodeDefinition);
      }
    }
  }
}
