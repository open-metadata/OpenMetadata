package org.openmetadata.service.governance.workflows.elements;

import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.Process;
import org.flowable.bpmn.model.SequenceFlow;
import org.openmetadata.common.utils.CommonUtil;

public class Edge {
  private final SequenceFlow edge;

  public Edge(org.openmetadata.schema.api.governance.Edge edgeConfig) {
    SequenceFlow edge = new SequenceFlow(edgeConfig.getFrom(), edgeConfig.getTo());
    if (!CommonUtil.nullOrEmpty(edgeConfig.getCondition())) {
      edge.setConditionExpression(edgeConfig.getCondition());
    }
    this.edge = edge;
  }

  public void addToWorkflow(BpmnModel model, Process process) {
    process.addFlowElement(edge);
  }
}
