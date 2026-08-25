package org.openmetadata.service.governance.workflows.elements;

import static org.openmetadata.service.governance.workflows.Workflow.RESULT_VARIABLE;
import static org.openmetadata.service.governance.workflows.WorkflowVariableHandler.getNamespacedVariableName;

import lombok.extern.slf4j.Slf4j;
import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.Process;
import org.flowable.bpmn.model.SequenceFlow;
import org.openmetadata.common.utils.CommonUtil;

@Slf4j
public class Edge {
  private final SequenceFlow edge;

  public Edge(org.openmetadata.schema.governance.workflows.elements.EdgeDefinition edgeDefinition) {
    SequenceFlow edge = new SequenceFlow(edgeDefinition.getFrom(), edgeDefinition.getTo());
    if (!CommonUtil.nullOrEmpty(edgeDefinition.getCondition())) {
      String conditionExpression =
          getFlowableCondition(edgeDefinition.getFrom(), edgeDefinition.getCondition());
      edge.setConditionExpression(conditionExpression);
      LOG.debug(
          "[WorkflowEdge] Created conditional edge from='{}' to='{}' with condition='{}' expression='{}'",
          edgeDefinition.getFrom(),
          edgeDefinition.getTo(),
          edgeDefinition.getCondition(),
          conditionExpression);
    } else {
      LOG.debug(
          "[WorkflowEdge] Created unconditional edge from='{}' to='{}'",
          edgeDefinition.getFrom(),
          edgeDefinition.getTo());
    }
    this.edge = edge;
  }

  private String getFlowableCondition(String from, String condition) {
    String variableName = getNamespacedVariableName(from, RESULT_VARIABLE);
    String expression = String.format("${%s == '%s'}", variableName, condition);
    LOG.debug(
        "[WorkflowEdge] Condition expression: checking if variable '{}' equals '{}'",
        variableName,
        condition);
    return expression;
  }

  public void addToWorkflow(BpmnModel model, Process process) {
    process.addFlowElement(edge);
  }
}
