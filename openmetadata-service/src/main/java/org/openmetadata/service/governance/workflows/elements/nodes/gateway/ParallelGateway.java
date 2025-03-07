package org.openmetadata.service.governance.workflows.elements.nodes.gateway;

import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.Process;
import org.openmetadata.schema.governance.workflows.WorkflowConfiguration;
import org.openmetadata.schema.governance.workflows.elements.nodes.gateway.ParallelGatewayDefinition;
import org.openmetadata.service.governance.workflows.elements.NodeInterface;
import org.openmetadata.service.governance.workflows.flowable.builders.ParallelGatewayBuilder;

public class ParallelGateway implements NodeInterface {
  private final org.flowable.bpmn.model.ParallelGateway parallelGateway;

  public ParallelGateway(ParallelGatewayDefinition nodeDefinition, WorkflowConfiguration config) {
    this.parallelGateway = new ParallelGatewayBuilder().id(nodeDefinition.getName()).build();
  }

  public void addToWorkflow(BpmnModel model, Process process) {
    process.addFlowElement(parallelGateway);
  }
}
