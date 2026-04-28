package org.openmetadata.service.governance.workflows.flowable;

import static org.openmetadata.service.governance.workflows.Workflow.GLOBAL_NAMESPACE;
import static org.openmetadata.service.governance.workflows.Workflow.HAS_FALSE_ENTITIES_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.HAS_TRUE_ENTITIES_VARIABLE;
import static org.openmetadata.service.governance.workflows.WorkflowVariableHandler.getNamespacedVariableName;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Queue;
import java.util.Set;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.flowable.bpmn.model.BoundaryEvent;
import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.InclusiveGateway;
import org.flowable.bpmn.model.Process;
import org.flowable.bpmn.model.SequenceFlow;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.governance.workflows.elements.EdgeDefinition;
import org.openmetadata.schema.governance.workflows.elements.WorkflowNodeDefinitionInterface;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.governance.workflows.WorkflowInstanceListener;
import org.openmetadata.service.governance.workflows.elements.Edge;
import org.openmetadata.service.governance.workflows.elements.NodeFactory;
import org.openmetadata.service.governance.workflows.elements.NodeInterface;
import org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl.DataCompletenessImpl;
import org.openmetadata.service.governance.workflows.elements.nodes.endEvent.EndEvent;
import org.openmetadata.service.governance.workflows.flowable.builders.FlowableListenerBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.InclusiveGatewayBuilder;

@Getter
@Slf4j
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

    for (String event : List.of("start", "end")) {
      org.flowable.bpmn.model.FlowableListener listener =
          new FlowableListenerBuilder()
              .event(event)
              .implementation(WorkflowInstanceListener.class.getName())
              .build();
      process.getExecutionListeners().add(listener);
    }

    model.addProcess(process);

    List<EdgeDefinition> edges = workflowDefinition.getEdges();

    // Add Nodes and collect instances for gateway detection
    Map<String, NodeInterface> nodeInstanceMap = new HashMap<>();
    for (WorkflowNodeDefinitionInterface nodeDefinitionObj : workflowDefinition.getNodes()) {
      NodeInterface node =
          NodeFactory.createNode(
              nodeDefinitionObj,
              workflowDefinition.getConfig(),
              workflowDefinition.getFullyQualifiedName());
      nodeInstanceMap.put(nodeDefinitionObj.getName(), node);
      node.addToWorkflow(model, process);

      Optional.ofNullable(node.getRuntimeExceptionBoundaryEvent())
          .ifPresent(runtimeExceptionBoundaryEvents::add);
    }

    // Detect where inclusive gateways need to be injected
    Map<String, List<EdgeDefinition>> outgoingEdges = buildOutgoingEdgesMap(edges);
    Map<String, List<EdgeDefinition>> incomingEdges = buildIncomingEdgesMap(edges);
    Set<String> splitNodes = detectSplitNodes(outgoingEdges, nodeInstanceMap);
    Set<String> joinNodes = detectJoinNodes(incomingEdges, splitNodes);

    // Add split gateways and their outgoing conditional flows
    for (String splitNode : splitNodes) {
      String gatewayId = splitGatewayId(splitNode);
      InclusiveGateway gateway = new InclusiveGatewayBuilder().id(gatewayId).build();
      process.addFlowElement(gateway);
      process.addFlowElement(new SequenceFlow(splitNode, gatewayId));

      for (EdgeDefinition edge : outgoingEdges.get(splitNode)) {
        String targetId =
            joinNodes.contains(edge.getTo()) ? joinGatewayId(edge.getTo()) : edge.getTo();
        SequenceFlow flow = new SequenceFlow(gatewayId, targetId);
        flow.setConditionExpression(buildGatewayCondition(splitNode, edge.getCondition()));
        process.addFlowElement(flow);
      }
    }

    // Add join gateways and their single outgoing flow to the target node
    for (String joinNode : joinNodes) {
      String gatewayId = joinGatewayId(joinNode);
      InclusiveGateway gateway = new InclusiveGatewayBuilder().id(gatewayId).build();
      process.addFlowElement(gateway);
      process.addFlowElement(new SequenceFlow(gatewayId, joinNode));
    }

    // Add normal edges (not handled by split/join gateways)
    for (EdgeDefinition edgeDefinition : edges) {
      String from = edgeDefinition.getFrom();
      String to = edgeDefinition.getTo();
      boolean fromSplit = splitNodes.contains(from);
      boolean toJoin = joinNodes.contains(to);

      if (fromSplit) {
        // Already wired above via the split gateway
        continue;
      }

      if (toJoin) {
        // Incoming to a join node — wire to the join gateway instead
        if (edgeDefinition.getCondition() != null && !edgeDefinition.getCondition().isEmpty()) {
          LOG.warn(
              "[WorkflowEdge] Edge from='{}' to='{}' has condition='{}' but '{}' is a join node; condition is ignored",
              from,
              to,
              edgeDefinition.getCondition(),
              to);
        }
        SequenceFlow flow = new SequenceFlow(from, joinGatewayId(to));
        process.addFlowElement(flow);
      } else {
        Edge edge = new Edge(edgeDefinition);
        edge.addToWorkflow(model, process);
      }
    }

    // Configure Exception Flow
    configureRuntimeExceptionFlow(process);

    this.model = model;
    this.workflowName = workflowName;
  }

  private Map<String, List<EdgeDefinition>> buildOutgoingEdgesMap(List<EdgeDefinition> edges) {
    Map<String, List<EdgeDefinition>> map = new HashMap<>();
    for (EdgeDefinition edge : edges) {
      map.computeIfAbsent(edge.getFrom(), k -> new ArrayList<>()).add(edge);
    }
    return map;
  }

  private Map<String, List<EdgeDefinition>> buildIncomingEdgesMap(List<EdgeDefinition> edges) {
    Map<String, List<EdgeDefinition>> map = new HashMap<>();
    for (EdgeDefinition edge : edges) {
      map.computeIfAbsent(edge.getTo(), k -> new ArrayList<>()).add(edge);
    }
    return map;
  }

  /**
   * A node is a split point if it has ≥2 outgoing conditional edges AND explicitly declares
   * multiple output ports via {@link NodeInterface#getOutputPorts()}. This ensures only batch
   * check nodes (CheckEntityAttributes, CheckChangeDescription, DataCompleteness) get inclusive
   * gateways — not user approval tasks or other nodes that use result-based conditional routing.
   */
  private Set<String> detectSplitNodes(
      Map<String, List<EdgeDefinition>> outgoingEdges, Map<String, NodeInterface> nodeInstanceMap) {
    Set<String> splits = new HashSet<>();
    for (Map.Entry<String, List<EdgeDefinition>> entry : outgoingEdges.entrySet()) {
      String nodeName = entry.getKey();
      NodeInterface node = nodeInstanceMap.get(nodeName);
      if (node == null || node.getOutputPorts().size() < 2) {
        continue;
      }
      long conditionalEdgeCount =
          entry.getValue().stream()
              .filter(e -> e.getCondition() != null && !e.getCondition().isEmpty())
              .count();
      if (conditionalEdgeCount >= 2) {
        splits.add(nodeName);
      }
    }
    return splits;
  }

  /**
   * A node is a join point if it has ≥2 incoming edges whose source nodes all trace back
   * to the same split node (directly or transitively). An inclusive join gateway is needed
   * to synchronize the parallel branches before continuing.
   */
  private Set<String> detectJoinNodes(
      Map<String, List<EdgeDefinition>> incomingEdges, Set<String> splitNodes) {
    Set<String> joins = new HashSet<>();
    for (Map.Entry<String, List<EdgeDefinition>> entry : incomingEdges.entrySet()) {
      String targetNode = entry.getKey();
      List<EdgeDefinition> incoming = entry.getValue();
      if (incoming.size() < 2) {
        continue;
      }
      // Find split ancestors reachable from each source node
      List<Set<String>> splitAncestorSets = new ArrayList<>();
      for (EdgeDefinition edge : incoming) {
        splitAncestorSets.add(
            findSplitAncestors(edge.getFrom(), incomingEdges, splitNodes, new HashSet<>()));
      }
      // If any split node appears in ALL ancestor sets, this node needs a join gateway
      Set<String> common = new HashSet<>(splitAncestorSets.get(0));
      for (int i = 1; i < splitAncestorSets.size(); i++) {
        common.retainAll(splitAncestorSets.get(i));
      }
      if (!common.isEmpty()) {
        joins.add(targetNode);
      }
    }
    return joins;
  }

  private Set<String> findSplitAncestors(
      String nodeName,
      Map<String, List<EdgeDefinition>> incomingEdges,
      Set<String> splitNodes,
      Set<String> visited) {
    Set<String> ancestors = new HashSet<>();
    if (visited.contains(nodeName)) {
      return ancestors;
    }
    visited.add(nodeName);
    if (splitNodes.contains(nodeName)) {
      ancestors.add(nodeName);
    }
    List<EdgeDefinition> incoming = incomingEdges.get(nodeName);
    if (incoming != null) {
      for (EdgeDefinition edge : incoming) {
        ancestors.addAll(findSplitAncestors(edge.getFrom(), incomingEdges, splitNodes, visited));
      }
    }
    return ancestors;
  }

  /**
   * Generates the inclusive gateway condition expression for an outgoing edge from a split node.
   * Maps the edge condition value to the appropriate boolean flag variable set by the node impl.
   */
  private String buildGatewayCondition(String nodeName, String edgeCondition) {
    if (edgeCondition == null || edgeCondition.isEmpty()) {
      return null;
    }
    String flagVariable;
    if ("true".equals(edgeCondition)) {
      flagVariable = getNamespacedVariableName(nodeName, HAS_TRUE_ENTITIES_VARIABLE);
    } else if ("false".equals(edgeCondition)) {
      flagVariable = getNamespacedVariableName(nodeName, HAS_FALSE_ENTITIES_VARIABLE);
    } else {
      // DataCompleteness band name (e.g., "gold", "silver")
      flagVariable =
          getNamespacedVariableName(nodeName, DataCompletenessImpl.bandFlagVariable(edgeCondition));
    }
    return String.format("${%s}", flagVariable);
  }

  private static String splitGatewayId(String nodeName) {
    return nodeName + "_inclusiveSplit";
  }

  private static String joinGatewayId(String nodeName) {
    return nodeName + "_inclusiveJoin";
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
          if (!validateNodeIsReachable(nodeDefinition.getName(), namespace)) {
            throw new RuntimeException(
                String.format(
                    "Invalid Workflow: [%s] is expecting [%s] to be reachable, but no path exists in the workflow graph.",
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
      List<String> directInputs = incomingEdgesMap.get(nodeName);
      return directInputs != null && directInputs.contains(inputNodeName);
    }

    /**
     * Enhanced validation: Check if sourceNode can reach targetNode through the workflow graph.
     * This allows for transitive dependencies, not just direct edges.
     * For example: A -> B -> C, where C can use outputs from A even without a direct edge.
     */
    private boolean validateNodeIsReachable(String targetNode, String sourceNode) {
      if (validateNodeHasInput(targetNode, sourceNode)) {
        return true;
      }
      return canReachThroughGraph(sourceNode, targetNode);
    }

    /**
     * BFS to check if sourceNode can reach targetNode through the workflow graph.
     * This handles cases where variables are passed through intermediate nodes.
     */
    private boolean canReachThroughGraph(String sourceNode, String targetNode) {
      Set<String> visited = new HashSet<>();
      Queue<String> queue = new LinkedList<>();
      queue.offer(sourceNode);

      while (!queue.isEmpty()) {
        String current = queue.poll();

        if (current.equals(targetNode)) {
          return true;
        }

        if (visited.contains(current)) {
          continue;
        }
        visited.add(current);

        for (Map.Entry<String, List<String>> entry : incomingEdgesMap.entrySet()) {
          if (entry.getValue().contains(current)) {
            String nextNode = entry.getKey();
            if (!visited.contains(nextNode)) {
              queue.offer(nextNode);
            }
          }
        }
      }

      return false;
    }

    public void validate() {
      for (WorkflowNodeDefinitionInterface nodeDefinition : nodeMap.values()) {
        validateNode(nodeDefinition);
      }
    }
  }
}
