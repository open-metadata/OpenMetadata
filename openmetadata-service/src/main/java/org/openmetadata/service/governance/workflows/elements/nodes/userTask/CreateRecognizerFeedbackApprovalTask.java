package org.openmetadata.service.governance.workflows.elements.nodes.userTask;

import static org.openmetadata.service.governance.workflows.Workflow.getFlowableElementId;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import org.flowable.bpmn.model.BoundaryEvent;
import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.EndEvent;
import org.flowable.bpmn.model.ExclusiveGateway;
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
import org.openmetadata.schema.governance.workflows.WorkflowConfiguration;
import org.openmetadata.schema.governance.workflows.elements.nodes.userTask.CreateRecognizerFeedbackApprovalTaskDefinition;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.governance.workflows.elements.NodeInterface;
import org.openmetadata.service.governance.workflows.elements.nodes.userTask.impl.ApprovalTaskCompletionValidator;
import org.openmetadata.service.governance.workflows.elements.nodes.userTask.impl.AutoApproveServiceTaskImpl;
import org.openmetadata.service.governance.workflows.elements.nodes.userTask.impl.CreateRecognizerFeedbackApprovalTaskImpl;
import org.openmetadata.service.governance.workflows.elements.nodes.userTask.impl.SetApprovalAssigneesImpl;
import org.openmetadata.service.governance.workflows.elements.nodes.userTask.impl.SetCandidateUsersImpl;
import org.openmetadata.service.governance.workflows.flowable.builders.EndEventBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.ExclusiveGatewayBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.FieldExtensionBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.FlowableListenerBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.ServiceTaskBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.StartEventBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.SubProcessBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.UserTaskBuilder;

public class CreateRecognizerFeedbackApprovalTask implements NodeInterface {
  private final SubProcess subProcess;
  private final BoundaryEvent runtimeExceptionBoundaryEvent;
  private final List<Message> messages = new ArrayList<>();

  public CreateRecognizerFeedbackApprovalTask(
      CreateRecognizerFeedbackApprovalTaskDefinition nodeDefinition, WorkflowConfiguration config) {
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
            .fieldValue(
                JsonUtils.pojoToJson(
                    nodeDefinition.getInputNamespaceMap() != null
                        ? nodeDefinition.getInputNamespaceMap()
                        : new HashMap<>()))
            .build();

    FieldExtension approvalThresholdExpr =
        new FieldExtensionBuilder()
            .fieldName("approvalThresholdExpr")
            .fieldValue(String.valueOf(nodeDefinition.getConfig().getApprovalThreshold()))
            .build();

    FieldExtension rejectionThresholdExpr =
        new FieldExtensionBuilder()
            .fieldName("rejectionThresholdExpr")
            .fieldValue(String.valueOf(nodeDefinition.getConfig().getRejectionThreshold()))
            .build();

    SubProcess subProcess = new SubProcessBuilder().id(subProcessId).build();

    StartEvent startEvent =
        new StartEventBuilder().id(getFlowableElementId(subProcessId, "startEvent")).build();

    ServiceTask setAssigneesVariable =
        getSetAssigneesVariableServiceTask(
            subProcessId,
            assigneesExpr,
            assigneesVarNameExpr,
            inputNamespaceMapExpr,
            approvalThresholdExpr,
            rejectionThresholdExpr);

    ExclusiveGateway hasAssigneesGateway =
        new ExclusiveGatewayBuilder()
            .id(getFlowableElementId(subProcessId, "hasAssigneesGateway"))
            .name("Check if has assignees")
            .build();

    UserTask userTask =
        getUserTask(
            subProcessId,
            assigneesVarNameExpr,
            inputNamespaceMapExpr,
            approvalThresholdExpr,
            rejectionThresholdExpr);

    ServiceTask autoApproveTask =
        new ServiceTaskBuilder()
            .id(getFlowableElementId(subProcessId, "autoApproveUserTask"))
            .implementation(AutoApproveServiceTaskImpl.class.getName())
            .addFieldExtension(inputNamespaceMapExpr)
            .build();

    EndEvent endEvent =
        new EndEventBuilder().id(getFlowableElementId(subProcessId, "endEvent")).build();

    BoundaryEvent terminationEvent = getTerminationEvent(subProcessId);
    terminationEvent.setAttachedToRef(userTask);

    TerminateEventDefinition terminateEventDefinition = new TerminateEventDefinition();
    terminateEventDefinition.setTerminateAll(true);

    EndEvent terminatedEvent =
        new EndEventBuilder().id(getFlowableElementId(subProcessId, "terminatedEvent")).build();
    terminatedEvent.addEventDefinition(terminateEventDefinition);
    attachMainWorkflowTerminationListener(terminatedEvent);

    subProcess.addFlowElement(startEvent);
    subProcess.addFlowElement(setAssigneesVariable);
    subProcess.addFlowElement(hasAssigneesGateway);
    subProcess.addFlowElement(userTask);
    subProcess.addFlowElement(autoApproveTask);
    subProcess.addFlowElement(endEvent);

    subProcess.addFlowElement(terminationEvent);
    subProcess.addFlowElement(terminatedEvent);

    subProcess.addFlowElement(new SequenceFlow(startEvent.getId(), setAssigneesVariable.getId()));

    subProcess.addFlowElement(
        new SequenceFlow(setAssigneesVariable.getId(), hasAssigneesGateway.getId()));

    SequenceFlow toUserTask = new SequenceFlow(hasAssigneesGateway.getId(), userTask.getId());
    toUserTask.setConditionExpression("${hasAssignees}");
    toUserTask.setName("Has assignees");
    subProcess.addFlowElement(toUserTask);

    SequenceFlow toAutoApprove =
        new SequenceFlow(hasAssigneesGateway.getId(), autoApproveTask.getId());
    toAutoApprove.setConditionExpression("${!hasAssignees}");
    toAutoApprove.setName("No assignees");
    subProcess.addFlowElement(toAutoApprove);

    hasAssigneesGateway.setDefaultFlow(toAutoApprove.getId());

    subProcess.addFlowElement(new SequenceFlow(userTask.getId(), endEvent.getId()));

    subProcess.addFlowElement(new SequenceFlow(autoApproveTask.getId(), endEvent.getId()));

    subProcess.addFlowElement(new SequenceFlow(terminationEvent.getId(), terminatedEvent.getId()));

    if (config.getStoreStageStatus()) {
      attachWorkflowInstanceStageListeners(subProcess);
    }

    this.runtimeExceptionBoundaryEvent =
        getRuntimeExceptionBoundaryEvent(subProcess, config.getStoreStageStatus());
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
      FieldExtension inputNamespaceMapExpr,
      FieldExtension approvalThresholdExpr,
      FieldExtension rejectionThresholdExpr) {
    return new ServiceTaskBuilder()
        .id(getFlowableElementId(subProcessId, "setAssigneesVariable"))
        .implementation(SetApprovalAssigneesImpl.class.getName())
        .addFieldExtension(assigneesExpr)
        .addFieldExtension(assigneesVarNameExpr)
        .addFieldExtension(inputNamespaceMapExpr)
        .build();
  }

  private UserTask getUserTask(
      String subProcessId,
      FieldExtension assigneesVarNameExpr,
      FieldExtension inputNamespaceMapExpr,
      FieldExtension approvalThresholdExpr,
      FieldExtension rejectionThresholdExpr) {
    FlowableListener setCandidateUsersListener =
        new FlowableListenerBuilder()
            .event("create")
            .implementation(SetCandidateUsersImpl.class.getName())
            .addFieldExtension(assigneesVarNameExpr)
            .build();

    FlowableListener createRecognizerFeedbackTaskListener =
        new FlowableListenerBuilder()
            .event("create")
            .implementation(CreateRecognizerFeedbackApprovalTaskImpl.class.getName())
            .addFieldExtension(inputNamespaceMapExpr)
            .addFieldExtension(approvalThresholdExpr)
            .addFieldExtension(rejectionThresholdExpr)
            .build();

    FlowableListener completionValidatorListener =
        new FlowableListenerBuilder()
            .event("complete")
            .implementation(ApprovalTaskCompletionValidator.class.getName())
            .build();

    return new UserTaskBuilder()
        .id(getFlowableElementId(subProcessId, "approvalTask"))
        .addListener(setCandidateUsersListener)
        .addListener(createRecognizerFeedbackTaskListener)
        .addListener(completionValidatorListener)
        .build();
  }

  private BoundaryEvent getTerminationEvent(String subProcessId) {
    String uniqueMessageName = getFlowableElementId(subProcessId, "terminateProcess");

    Message terminationMessage = new Message();
    terminationMessage.setId(uniqueMessageName);
    terminationMessage.setName(uniqueMessageName);
    messages.add(terminationMessage);

    MessageEventDefinition terminationMessageDefinition = new MessageEventDefinition();
    terminationMessageDefinition.setMessageRef(uniqueMessageName);

    BoundaryEvent terminationEvent = new BoundaryEvent();
    terminationEvent.setId(getFlowableElementId(subProcessId, "terminationEvent"));
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
