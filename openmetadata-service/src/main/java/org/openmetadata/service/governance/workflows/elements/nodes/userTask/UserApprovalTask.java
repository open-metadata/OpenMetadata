package org.openmetadata.service.governance.workflows.elements.nodes.userTask;

import static org.openmetadata.service.governance.workflows.Workflow.getFlowableElementId;

import java.util.ArrayList;
import java.util.List;
import org.flowable.bpmn.model.BoundaryEvent;
import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.EndEvent;
import org.flowable.bpmn.model.FieldExtension;
import org.flowable.bpmn.model.FlowableListener;
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

public class UserApprovalTask implements NodeInterface {
  private final SubProcess subProcess;
  private final BoundaryEvent runtimeExceptionBoundaryEvent;
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

    FieldExtension inputNamespaceMapExpr =
        new FieldExtensionBuilder()
            .fieldName("inputNamespaceMapExpr")
            .fieldValue(JsonUtils.pojoToJson(nodeDefinition.getInputNamespaceMap()))
            .build();

    SubProcess subProcess = new SubProcessBuilder().id(subProcessId).build();

    StartEvent startEvent =
        new StartEventBuilder().id(getFlowableElementId(subProcessId, "startEvent")).build();

    ServiceTask setAssigneesVariable =
        getSetAssigneesVariableServiceTask(
            subProcessId, assigneesExpr, assigneesVarNameExpr, inputNamespaceMapExpr);

    UserTask userTask = getUserTask(subProcessId, assigneesVarNameExpr, inputNamespaceMapExpr);

    EndEvent endEvent =
        new EndEventBuilder().id(getFlowableElementId(subProcessId, "endEvent")).build();

    // NOTE: If the Task is killed instead of Resolved, the Workflow is Finished.
    BoundaryEvent terminationEvent = getTerminationEvent();
    terminationEvent.setAttachedToRef(userTask);

    TerminateEventDefinition terminateEventDefinition = new TerminateEventDefinition();
    terminateEventDefinition.setTerminateAll(true);

    EndEvent terminatedEvent =
        new EndEventBuilder().id(getFlowableElementId(subProcessId, "terminatedEvent")).build();
    terminatedEvent.addEventDefinition(terminateEventDefinition);
    attachMainWorkflowTerminationListener(terminatedEvent);

    subProcess.addFlowElement(startEvent);
    subProcess.addFlowElement(setAssigneesVariable);
    subProcess.addFlowElement(userTask);
    subProcess.addFlowElement(endEvent);

    subProcess.addFlowElement(terminationEvent);
    subProcess.addFlowElement(terminatedEvent);

    subProcess.addFlowElement(new SequenceFlow(startEvent.getId(), setAssigneesVariable.getId()));
    subProcess.addFlowElement(new SequenceFlow(setAssigneesVariable.getId(), userTask.getId()));
    subProcess.addFlowElement(new SequenceFlow(userTask.getId(), endEvent.getId()));
    subProcess.addFlowElement(new SequenceFlow(terminationEvent.getId(), terminatedEvent.getId()));

    this.runtimeExceptionBoundaryEvent = getRuntimeExceptionBoundaryEvent(subProcess);
    this.subProcess = subProcess;
  }

  @Override
  public BoundaryEvent getRuntimeExceptionBoundaryEvent() {
    return runtimeExceptionBoundaryEvent;
  }

  private ServiceTask getSetAssigneesVariableServiceTask(
      String subProcessId,
      FieldExtension assigneesExpr,
      FieldExtension assigneesVarNameExpr,
      FieldExtension inputNamespaceMapExpr) {
    ServiceTask serviceTask =
        new ServiceTaskBuilder()
            .id(getFlowableElementId(subProcessId, "setAssigneesVariable"))
            .implementation(SetApprovalAssigneesImpl.class.getName())
            .build();
    serviceTask.getFieldExtensions().add(assigneesExpr);
    serviceTask.getFieldExtensions().add(assigneesVarNameExpr);
    serviceTask.getFieldExtensions().add(inputNamespaceMapExpr);
    return serviceTask;
  }

  private UserTask getUserTask(
      String subProcessId,
      FieldExtension assigneesVarNameExpr,
      FieldExtension inputNamespaceMapExpr) {
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
    createOpenMetadataTaskListener.getFieldExtensions().add(inputNamespaceMapExpr);

    UserTask userTask =
        new UserTaskBuilder().id(getFlowableElementId(subProcessId, "approvalTask")).build();
    userTask.getTaskListeners().add(setCandidateUsersListener);
    userTask.getTaskListeners().add(createOpenMetadataTaskListener);

    return userTask;
  }

  private BoundaryEvent getTerminationEvent() {
    Message terminationMessage = new Message();
    terminationMessage.setId("terminateProcess");
    terminationMessage.setName("terminateProcess");
    messages.add(terminationMessage);

    MessageEventDefinition terminationMessageDefinition = new MessageEventDefinition();
    terminationMessageDefinition.setMessageRef("terminateProcess");

    BoundaryEvent terminationEvent = new BoundaryEvent();
    terminationEvent.setId("terminationEvent");
    terminationEvent.addEventDefinition(terminationMessageDefinition);
    return terminationEvent;
  }

  public void addToWorkflow(BpmnModel model, Process process) {
    process.addFlowElement(subProcess);
    process.addFlowElement(runtimeExceptionBoundaryEvent);
    for (Message message : messages) {
      model.addMessage(message);
    }
  }
}
