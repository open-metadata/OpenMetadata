package org.openmetadata.service.governance.workflows;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
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
import org.openmetadata.service.governance.workflows.elements.TriggerFactory;
import org.openmetadata.service.governance.workflows.elements.TriggerInterface;
import org.openmetadata.service.governance.workflows.elements.nodes.endEvent.EndEvent;

@Slf4j
@Getter
public class Workflow {
  public static final String INGESTION_PIPELINE_ID_VARIABLE = "ingestionPipelineId";
  public static final String RELATED_ENTITY_VARIABLE = "relatedEntity";
  public static final String RESULT_VARIABLE = "result";
  public static final String UPDATED_BY_VARIABLE = "updatedBy";
  public static final String STAGE_INSTANCE_STATE_ID_VARIABLE = "stageInstanceStateId";
  public static final String WORKFLOW_INSTANCE_EXECUTION_ID_VARIABLE =
      "workflowInstanceExecutionId";
  public static final String WORKFLOW_RUNTIME_EXCEPTION = "workflowRuntimeException";
  public static final String EXCEPTION_VARIABLE = "exception";
  public static final String FAILURE_VARIABLE = "failure";
  public static final String SUCCESSFUL_RESULT = "success";
  public static final String FAILURE_RESULT = "failure";
  private final BpmnModel triggerModel;
  private final String triggerWorkflowName;
  private final BpmnModel mainModel;
  private final String mainWorkflowName;
  public static final String GLOBAL_NAMESPACE = "global";

  public Workflow(WorkflowDefinition workflowDefinition) {
    LOG.info(
        "[WorkflowBuild] START: Creating workflow '{}' with {} nodes, {} edges",
        workflowDefinition.getFullyQualifiedName(),
        workflowDefinition.getNodes() != null ? workflowDefinition.getNodes().size() : 0,
        workflowDefinition.getEdges() != null ? workflowDefinition.getEdges().size() : 0);

    // Build Trigger
    LOG.debug(
        "[WorkflowBuild] Creating trigger: type='{}'",
        workflowDefinition.getTrigger() != null
            ? workflowDefinition.getTrigger().getType()
            : "none");
    this.triggerModel = new BpmnModel();
    triggerModel.setTargetNamespace("");
    TriggerInterface trigger = TriggerFactory.createTrigger(workflowDefinition);
    trigger.addToWorkflow(triggerModel);
    this.triggerWorkflowName = trigger.getTriggerWorkflowId();
    LOG.debug("[WorkflowBuild] Trigger created: id='{}'", triggerWorkflowName);

    // Build Main Workflow
    LOG.debug("[WorkflowBuild] Validating workflow graph");
    new WorkflowGraph(workflowDefinition).validate();

    this.mainModel = new BpmnModel();
    mainModel.setTargetNamespace("");
    this.mainWorkflowName = workflowDefinition.getFullyQualifiedName();

    Process process = new Process();
    process.setId(mainWorkflowName);
    process.setName(
        Optional.ofNullable(workflowDefinition.getDisplayName()).orElse(mainWorkflowName));
    mainModel.addProcess(process);

    List<BoundaryEvent> runtimeExceptionBoundaryEvents = new ArrayList<>();

    // Add Nodes
    for (WorkflowNodeDefinitionInterface nodeDefinitionObj : workflowDefinition.getNodes()) {
      LOG.debug(
          "[WorkflowBuild] Adding node: name='{}' type='{}' outputs={}",
          nodeDefinitionObj.getName(),
          nodeDefinitionObj.getType(),
          nodeDefinitionObj.getOutput());
      NodeInterface node =
          NodeFactory.createNode(nodeDefinitionObj, workflowDefinition.getConfig());
      node.addToWorkflow(mainModel, process);

      Optional.ofNullable(node.getRuntimeExceptionBoundaryEvent())
          .ifPresent(
              event -> {
                LOG.debug(
                    "[WorkflowBuild] Added boundary event for node '{}'",
                    nodeDefinitionObj.getName());
                runtimeExceptionBoundaryEvents.add(event);
              });
    }

    // Add Edges
    for (EdgeDefinition edgeDefinition : workflowDefinition.getEdges()) {
      LOG.debug(
          "[WorkflowBuild] Processing edge: from='{}' to='{}' condition='{}'",
          edgeDefinition.getFrom(),
          edgeDefinition.getTo(),
          edgeDefinition.getCondition());
      Edge edge = new Edge(edgeDefinition);
      edge.addToWorkflow(mainModel, process);
    }

    // Configure Exception Flow
    configureRuntimeExceptionFlow(process, runtimeExceptionBoundaryEvents);

    LOG.info(
        "[WorkflowBuild] SUCCESS: Workflow '{}' built with trigger '{}'",
        mainWorkflowName,
        triggerWorkflowName);
  }

  private void configureRuntimeExceptionFlow(
      Process process, List<BoundaryEvent> runtimeExceptionBoundaryEvents) {
    EndEvent errorEndEvent = new EndEvent("Error");
    process.addFlowElement(errorEndEvent.getEndEvent());
    LOG.debug(
        "[WorkflowBuild] Configuring error flow for {} boundary events",
        runtimeExceptionBoundaryEvents.size());
    for (BoundaryEvent event : runtimeExceptionBoundaryEvents) {
      process.addFlowElement(new SequenceFlow(event.getId(), errorEndEvent.getEndEvent().getId()));
      LOG.debug("[WorkflowBuild] Added error flow: boundaryEvent='{}' -> errorEnd", event.getId());
    }
  }

  public static String getFlowableElementId(String parentName, String elementName) {
    return String.format("%s.%s", parentName, elementName);
  }

  public static String getResultFromBoolean(boolean result) {
    return result ? SUCCESSFUL_RESULT : FAILURE_RESULT;
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
