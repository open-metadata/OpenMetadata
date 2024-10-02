package org.openmetadata.service.governance.workflows.elements.nodes.userTasks;

import static org.openmetadata.service.governance.workflows.Workflow.getMetadataExtension;

import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.EndEvent;
import org.flowable.bpmn.model.FieldExtension;
import org.flowable.bpmn.model.FlowableListener;
import org.flowable.bpmn.model.Process;
import org.flowable.bpmn.model.SequenceFlow;
import org.flowable.bpmn.model.ServiceTask;
import org.flowable.bpmn.model.StartEvent;
import org.flowable.bpmn.model.SubProcess;
import org.flowable.bpmn.model.UserTask;
import org.openmetadata.schema.governance.workflows.elements.WorkflowNodeDefinitionInterface;
import org.openmetadata.schema.governance.workflows.elements.nodes.userTasks.UserApprovalTaskDefinition;
import org.openmetadata.service.governance.workflows.elements.WorkflowNodeInterface;
import org.openmetadata.service.governance.workflows.elements.nodes.userTasks.impl.CreateApprovalTaskImpl;
import org.openmetadata.service.governance.workflows.elements.nodes.userTasks.impl.SetApprovalAssigneesImpl;
import org.openmetadata.service.governance.workflows.elements.nodes.userTasks.impl.SetCandidateUsersImpl;
import org.openmetadata.service.util.JsonUtils;

public class UserApprovalTask implements WorkflowNodeInterface {
  private final SubProcess subProcess;

  public UserApprovalTask(WorkflowNodeDefinitionInterface nodeDefinition) {
    UserApprovalTaskDefinition userApprovalTaskDefinition = (UserApprovalTaskDefinition) nodeDefinition;

    SubProcess subProcess = new SubProcess();
    subProcess.setId(userApprovalTaskDefinition.getName());
    subProcess.setName(userApprovalTaskDefinition.getDisplayName());
    subProcess.addExtensionElement(
        getMetadataExtension(
                userApprovalTaskDefinition.getName(), userApprovalTaskDefinition.getDisplayName(), userApprovalTaskDefinition.getDescription()));

    StartEvent startEvent = new StartEvent();
    startEvent.setId(getFlowableElementId(userApprovalTaskDefinition.getName(), "startEvent"));
    startEvent.setName(getFlowableElementName(userApprovalTaskDefinition.getNodeDisplayName(), "startEvent"));
    subProcess.addFlowElement(startEvent);

    String assigneesVarName = getFlowableElementId(userApprovalTaskDefinition.getName(), "assignees");

    ServiceTask setAssigneesVariable = new ServiceTask();
    setAssigneesVariable.setId(getFlowableElementId(userApprovalTaskDefinition.getName(), "setAssigneesVariable"));
    setAssigneesVariable.setName(getFlowableElementName(userApprovalTaskDefinition.getNodeDisplayName(), "setAssigneesVariable"));
    setAssigneesVariable.setImplementationType("class");
    setAssigneesVariable.setImplementation(SetApprovalAssigneesImpl.class.getName());

    FieldExtension assigneesExpr = new FieldExtension();
    assigneesExpr.setFieldName("assigneesExpr");
    assigneesExpr.setStringValue(JsonUtils.pojoToJson(userApprovalTaskDefinition.getConfig().getAssignees()));
    setAssigneesVariable.getFieldExtensions().add(assigneesExpr);

    FieldExtension assigneesVarNameExpr = new FieldExtension();
    assigneesVarNameExpr.setFieldName("assigneesVarNameExpr");
    assigneesVarNameExpr.setStringValue(assigneesVarName);
    setAssigneesVariable.getFieldExtensions().add(assigneesVarNameExpr);

    subProcess.addFlowElement(setAssigneesVariable);

    UserTask approvalTask = new UserTask();
    approvalTask.setId(getFlowableElementId(userApprovalTaskDefinition.getName(), "approvalTask"));
    approvalTask.setName(getFlowableElementName(userApprovalTaskDefinition.getNodeDisplayName(), "approvalTask"));

    FlowableListener setCandidateUsersListener = new FlowableListener();
    setCandidateUsersListener.setEvent("create");
    setCandidateUsersListener.setImplementationType("class");
    setCandidateUsersListener.setImplementation(SetCandidateUsersImpl.class.getName());
    setCandidateUsersListener.getFieldExtensions().add(assigneesVarNameExpr);
    approvalTask.getTaskListeners().add(setCandidateUsersListener);

    FlowableListener taskListener = new FlowableListener();
    taskListener.setEvent("create");
    taskListener.setImplementationType("class");
    taskListener.setImplementation(CreateApprovalTaskImpl.class.getName());
    approvalTask.getTaskListeners().add(taskListener);

    subProcess.addFlowElement(approvalTask);

    EndEvent endEvent = new EndEvent();
    endEvent.setId(getFlowableElementId(userApprovalTaskDefinition.getName(), "endEvent"));
    endEvent.setName(getFlowableElementName(userApprovalTaskDefinition.getNodeDisplayName(), "endEvent"));
    subProcess.addFlowElement(endEvent);

    subProcess.addFlowElement(new SequenceFlow(startEvent.getId(), setAssigneesVariable.getId()));
    subProcess.addFlowElement(new SequenceFlow(setAssigneesVariable.getId(), approvalTask.getId()));
    subProcess.addFlowElement(new SequenceFlow(approvalTask.getId(), endEvent.getId()));

    this.subProcess = subProcess;
  }

  public void addToWorkflow(BpmnModel model, Process process) {
    process.addFlowElement(subProcess);
  }
}
