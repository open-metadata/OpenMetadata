package org.openmetadata.service.governance.workflows.elements.nodes.userTask;

import static org.openmetadata.service.governance.workflows.Workflow.getFlowableElementId;

import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.EndEvent;
import org.flowable.bpmn.model.FieldExtension;
import org.flowable.bpmn.model.FlowableListener;
import org.flowable.bpmn.model.IntermediateCatchEvent;
import org.flowable.bpmn.model.Message;
import org.flowable.bpmn.model.MessageEventDefinition;
import org.flowable.bpmn.model.Process;
import org.flowable.bpmn.model.SequenceFlow;
import org.flowable.bpmn.model.ServiceTask;
import org.flowable.bpmn.model.StartEvent;
import org.flowable.bpmn.model.SubProcess;
import org.flowable.bpmn.model.TerminateEventDefinition;
import org.flowable.bpmn.model.UserTask;
import org.openmetadata.schema.governance.workflows.elements.nodes.userTask.UserApprovalTaskDefinition;
import org.openmetadata.service.governance.workflows.elements.NodeInterface;
import org.openmetadata.service.governance.workflows.elements.nodes.userTask.impl.CreateApprovalTaskImpl;
import org.openmetadata.service.governance.workflows.elements.nodes.userTask.impl.SetApprovalAssigneesImpl;
import org.openmetadata.service.governance.workflows.elements.nodes.userTask.impl.SetCandidateUsersImpl;
import org.openmetadata.service.governance.workflows.flowable.builders.EndEventBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.FieldExtensionBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.FlowableListenerBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.ServiceTaskBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.StartEventBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.SubProcessBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.UserTaskBuilder;
import org.openmetadata.service.util.JsonUtils;

import java.util.ArrayList;
import java.util.List;

public class UserApprovalTask implements NodeInterface {
  private final SubProcess subProcess;
  private final List<Message> messages = new ArrayList<>();

  public UserApprovalTask(UserApprovalTaskDefinition nodeDefinition) {
    String subProcessId = nodeDefinition.getName();
    String assigneesVarName = getFlowableElementId(subProcessId, "assignees");

    FieldExtension assigneesExpr =
        new FieldExtensionBuilder()
            .fieldName("assigneesExpr")
            .fieldValue(JsonUtils.pojoToJson(nodeDefinition.getConfig().getAssignees()))
            .build();

    FieldExtension assigneesVarNameExpr =
        new FieldExtensionBuilder()
            .fieldName("assigneesVarNameExpr")
            .fieldValue(assigneesVarName)
            .build();

    SubProcess subProcess = new SubProcessBuilder().id(subProcessId).build();

    Message terminationMessage = new Message();
    terminationMessage.setId("terminateProcess");
    terminationMessage.setName("terminateProcess");
    messages.add(terminationMessage);

    MessageEventDefinition terminationMessageDefinition = new MessageEventDefinition();
    terminationMessageDefinition.setMessageRef("terminateProcess");

    IntermediateCatchEvent terminationEvent = new IntermediateCatchEvent();
    terminationEvent.setId("terminationEvent");
    terminationEvent.addEventDefinition(terminationMessageDefinition);
    subProcess.addFlowElement(terminationEvent);

    TerminateEventDefinition terminateEventDefinition = new TerminateEventDefinition();
    terminateEventDefinition.setTerminateAll(true);

    EndEvent terminatedEvent = new EndEventBuilder().id(getFlowableElementId(subProcessId, "terminatedEvent")).build();
    terminatedEvent.addEventDefinition(terminateEventDefinition);
    attachMainWorkflowTerminationListener(terminatedEvent);
    subProcess.addFlowElement(terminatedEvent);

    StartEvent startEvent =
        new StartEventBuilder().id(getFlowableElementId(subProcessId, "startEvent")).build();

    ServiceTask setAssigneesVariable =
        getSetAssigneesVariableServiceTask(subProcessId, assigneesExpr, assigneesVarNameExpr);

    UserTask userTask = getUserTask(subProcessId, assigneesVarNameExpr);

    EndEvent endEvent =
        new EndEventBuilder().id(getFlowableElementId(subProcessId, "endEvent")).build();

    subProcess.addFlowElement(startEvent);
    subProcess.addFlowElement(setAssigneesVariable);
    subProcess.addFlowElement(userTask);
    subProcess.addFlowElement(endEvent);

    subProcess.addFlowElement(new SequenceFlow(startEvent.getId(), setAssigneesVariable.getId()));
    subProcess.addFlowElement(new SequenceFlow(setAssigneesVariable.getId(), userTask.getId()));
    subProcess.addFlowElement(new SequenceFlow(userTask.getId(), endEvent.getId()));


    subProcess.addFlowElement(new SequenceFlow(startEvent.getId(), terminationEvent.getId()));
    subProcess.addFlowElement(new SequenceFlow(terminationEvent.getId(), terminatedEvent.getId()));

    attachWorkflowInstanceStageListeners(subProcess);

    this.subProcess = subProcess;
  }

  private ServiceTask getSetAssigneesVariableServiceTask(
      String subProcessId, FieldExtension assigneesExpr, FieldExtension assigneesVarNameExpr) {
    ServiceTask serviceTask =
        new ServiceTaskBuilder()
            .id(getFlowableElementId(subProcessId, "setAssigneesVariable"))
            .implementation(SetApprovalAssigneesImpl.class.getName())
            .build();
    serviceTask.getFieldExtensions().add(assigneesExpr);
    serviceTask.getFieldExtensions().add(assigneesVarNameExpr);
    return serviceTask;
  }

  private UserTask getUserTask(String subProcessId, FieldExtension assigneesVarNameExpr) {
    FlowableListener setCandidateUsersListener =
        new FlowableListenerBuilder()
            .event("create")
            .implementation(SetCandidateUsersImpl.class.getName())
            .build();
    setCandidateUsersListener.getFieldExtensions().add(assigneesVarNameExpr);

    FlowableListener createOpenMetadataTaskListener =
        new FlowableListenerBuilder()
            .event("create")
            .implementation(CreateApprovalTaskImpl.class.getName())
            .build();

    UserTask userTask =
        new UserTaskBuilder().id(getFlowableElementId(subProcessId, "approvalTask")).build();
    userTask.getTaskListeners().add(setCandidateUsersListener);
    userTask.getTaskListeners().add(createOpenMetadataTaskListener);
    return userTask;
  }

  public void addToWorkflow(BpmnModel model, Process process) {
    process.addFlowElement(subProcess);
    for (Message message : messages) {
      model.addMessage(message);
    }
  }
}
