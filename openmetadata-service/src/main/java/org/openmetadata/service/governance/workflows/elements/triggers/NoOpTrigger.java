package org.openmetadata.service.governance.workflows.elements.triggers;

import static org.openmetadata.service.governance.workflows.Workflow.getFlowableElementId;

import lombok.Getter;
import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.EndEvent;
import org.flowable.bpmn.model.Process;
import org.flowable.bpmn.model.SequenceFlow;
import org.flowable.bpmn.model.StartEvent;
import org.openmetadata.schema.governance.workflows.elements.triggers.NoOpTriggerDefinition;
import org.openmetadata.service.governance.workflows.elements.TriggerInterface;
import org.openmetadata.service.governance.workflows.flowable.builders.EndEventBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.StartEventBuilder;

public class NoOpTrigger implements TriggerInterface {
  private final Process process;

  @Getter private final String triggerWorkflowId;

  public NoOpTrigger(
      String mainWorkflowName, String triggerWorkflowId, NoOpTriggerDefinition triggerDefinition) {
    Process process = new Process();
    process.setId(triggerWorkflowId);
    process.setName(triggerWorkflowId);

    StartEvent startEvent =
        new StartEventBuilder().id(getFlowableElementId(triggerWorkflowId, "startEvent")).build();
    process.addFlowElement(startEvent);

    EndEvent endEvent =
        new EndEventBuilder().id(getFlowableElementId(triggerWorkflowId, "endEvent")).build();
    process.addFlowElement(endEvent);

    process.addFlowElement(new SequenceFlow(startEvent.getId(), endEvent.getId()));

    this.process = process;
    this.triggerWorkflowId = triggerWorkflowId;
  }

  @Override
  public void addToWorkflow(BpmnModel model) {
    model.addProcess(process);
  }
}
