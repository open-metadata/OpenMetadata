package org.openmetadata.service.governance.workflows.elements.nodes.userTask.manualRetry;

import static org.openmetadata.service.governance.workflows.Workflow.MANUAL_RETRY_MESSAGE;
import static org.openmetadata.service.governance.workflows.Workflow.getFlowableElementId;

import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.EndEvent;
import org.flowable.bpmn.model.FieldExtension;
import org.flowable.bpmn.model.IntermediateCatchEvent;
import org.flowable.bpmn.model.Message;
import org.flowable.bpmn.model.MessageEventDefinition;
import org.flowable.bpmn.model.Process;
import org.flowable.bpmn.model.SequenceFlow;
import org.flowable.bpmn.model.ServiceTask;
import org.flowable.bpmn.model.StartEvent;
import org.flowable.bpmn.model.SubProcess;
import org.openmetadata.schema.governance.workflows.WorkflowConfiguration;
import org.openmetadata.schema.governance.workflows.elements.nodes.userTask.ManualRetryTaskDefinition;
import org.openmetadata.service.governance.workflows.elements.NodeInterface;
import org.openmetadata.service.governance.workflows.flowable.builders.EndEventBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.FieldExtensionBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.ServiceTaskBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.StartEventBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.SubProcessBuilder;
import org.openmetadata.service.util.JsonUtils;

public class ManualRetryTask implements NodeInterface {
  private final Message message;
  private final SubProcess subProcess;

  public ManualRetryTask(ManualRetryTaskDefinition nodeDefinition, WorkflowConfiguration config) {
    String subProcessId = nodeDefinition.getName();
    SubProcess subProcess = new SubProcessBuilder().id(subProcessId).build();

    StartEvent startEvent =
        new StartEventBuilder().id(getFlowableElementId(subProcessId, "startEvent")).build();
    subProcess.addFlowElement(startEvent);

    Message message = getMessage();

    IntermediateCatchEvent intermediateCatchEvent =
        getIntermediateCatchEvent(
            getFlowableElementId(subProcessId, "intermediateCatchEvent"), message);
    subProcess.addFlowElement(intermediateCatchEvent);

    ServiceTask retryServiceTask =
        getRetryServiceTask(
            getFlowableElementId(subProcessId, "retryServiceTask"),
            JsonUtils.pojoToJson(nodeDefinition.getInputNamespaceMap()));
    subProcess.addFlowElement(retryServiceTask);

    EndEvent endEvent =
        new EndEventBuilder().id(getFlowableElementId(subProcessId, "endEvent")).build();
    subProcess.addFlowElement(endEvent);

    subProcess.addFlowElement(new SequenceFlow(startEvent.getId(), intermediateCatchEvent.getId()));
    subProcess.addFlowElement(
        new SequenceFlow(intermediateCatchEvent.getId(), retryServiceTask.getId()));
    subProcess.addFlowElement(new SequenceFlow(retryServiceTask.getId(), endEvent.getId()));

    this.message = message;
    this.subProcess = subProcess;
  }

  private Message getMessage() {
    Message message = new Message();
    message.setId(MANUAL_RETRY_MESSAGE);
    message.setName(MANUAL_RETRY_MESSAGE);

    return message;
  }

  private IntermediateCatchEvent getIntermediateCatchEvent(
      String IntermediateCatchEventId, Message message) {
    MessageEventDefinition messageEventDefinition = new MessageEventDefinition();
    messageEventDefinition.setMessageRef(message.getId());

    IntermediateCatchEvent intermediateCatchEvent = new IntermediateCatchEvent();
    intermediateCatchEvent.setId(IntermediateCatchEventId);
    intermediateCatchEvent.addEventDefinition(messageEventDefinition);

    return intermediateCatchEvent;
  }

  private ServiceTask getRetryServiceTask(String serviceTaskId, String inputNamespaceMap) {
    FieldExtension inputNamespaceMapExpr =
        new FieldExtensionBuilder()
            .fieldName("inputNamespaceMapExpr")
            .fieldValue(inputNamespaceMap)
            .build();

    return new ServiceTaskBuilder()
        .id(serviceTaskId)
        .implementationType("class")
        .implementation(ManualRetryDelegate.class.getName())
        .addFieldExtension(inputNamespaceMapExpr)
        .build();
  }

  public void addToWorkflow(BpmnModel model, Process process) {
    model.addMessage(message);
    process.addFlowElement(subProcess);
  }
}
