package org.openmetadata.service.governance.workflows.elements;

import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.Process;
import org.flowable.bpmn.model.SequenceFlow;
import org.openmetadata.common.utils.CommonUtil;

public class Edge {
  private final SequenceFlow edge;

  public Edge(org.openmetadata.schema.governance.workflows.elements.EdgeDefinition edgeDefinition) {
    SequenceFlow edge = new SequenceFlow(edgeDefinition.getFrom(), edgeDefinition.getTo());
    if (!CommonUtil.nullOrEmpty(edgeDefinition.getCondition())) {
      edge.setConditionExpression(edgeDefinition.getCondition());
    }
    this.edge = edge;
  }

  public void addToWorkflow(BpmnModel model, Process process) {
    process.addFlowElement(edge);
  }
}
