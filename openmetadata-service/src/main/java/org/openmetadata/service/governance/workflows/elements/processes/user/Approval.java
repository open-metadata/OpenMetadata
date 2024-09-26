package org.openmetadata.service.governance.workflows.elements.processes.user;

import static org.openmetadata.service.governance.workflows.Workflow.getMetadataExtension;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import com.google.api.gax.httpjson.FieldsExtractor;
import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.EndEvent;
import org.flowable.bpmn.model.FieldExtension;
import org.flowable.bpmn.model.FlowableListener;
import org.flowable.bpmn.model.MultiInstanceLoopCharacteristics;
import org.flowable.bpmn.model.Process;
import org.flowable.bpmn.model.SequenceFlow;
import org.flowable.bpmn.model.ServiceTask;
import org.flowable.bpmn.model.StartEvent;
import org.flowable.bpmn.model.SubProcess;
import org.flowable.bpmn.model.UserTask;
import org.openmetadata.service.governance.workflows.elements.processes.user.impl.CreateApprovalTaskImpl;
import org.openmetadata.service.governance.workflows.elements.processes.user.impl.SetApprovalAssigneesImpl;
import org.openmetadata.service.governance.workflows.elements.processes.user.impl.SetCandidateUsersImpl;
import org.openmetadata.service.util.JsonUtils;

public class Approval {
  private final SubProcess subProcess;

  public Approval(
      org.openmetadata.schema.governanceWorkflows.elements.processes.user.Approval approval) {
    SubProcess subProcess = new SubProcess();
    subProcess.setId(approval.getName());
    subProcess.setName(approval.getDisplayName());
    subProcess.addExtensionElement(
        getMetadataExtension(
            approval.getName(), approval.getDisplayName(), approval.getDescription()));

    StartEvent startEvent = new StartEvent();
    startEvent.setId(String.format("%s-startEvent", approval.getName()));
    startEvent.setName("Start Event");
    subProcess.addFlowElement(startEvent);

    String assigneesVarName = String.format("%s-assignees", approval.getName());

    ServiceTask setAssigneesVariable = new ServiceTask();
    setAssigneesVariable.setId(String.format("%s-setAssigneesVariable", approval.getName()));
    setAssigneesVariable.setName(String.format("[%s] Set Assignees Variable", approval.getDisplayName()));
    setAssigneesVariable.setImplementationType("class");
    setAssigneesVariable.setImplementation(SetApprovalAssigneesImpl.class.getName());

    FieldExtension assigneesExpr = new FieldExtension();
    assigneesExpr.setFieldName("assigneesExpr");
    assigneesExpr.setStringValue(JsonUtils.pojoToJson(((Map<String, Object>) approval.getConfig()).get("assignees")));
    setAssigneesVariable.getFieldExtensions().add(assigneesExpr);

    FieldExtension assigneesVarNameExpr = new FieldExtension();
    assigneesVarNameExpr.setFieldName("assigneesVarNameExpr");
    assigneesVarNameExpr.setStringValue(assigneesVarName);
    setAssigneesVariable.getFieldExtensions().add(assigneesVarNameExpr);

    subProcess.addFlowElement(setAssigneesVariable);

    UserTask approvalTask = new UserTask();
    approvalTask.setId(String.format("%s-approvalTask", approval.getName()));
    approvalTask.setName("Approval Task");

    if (((Map<String, Object>) approval.getConfig()).get("approveType").equals("ALL")) {
      MultiInstanceLoopCharacteristics loopCharacteristics = new MultiInstanceLoopCharacteristics();
      loopCharacteristics.setSequential(false);
      loopCharacteristics.setCollectionString(assigneesVarName);
      loopCharacteristics.setElementVariable("assignee");
      approvalTask.setLoopCharacteristics(loopCharacteristics);
      approvalTask.setAssignee("${assignee}");
    } else {
      FlowableListener setCandidateUsersListener = new FlowableListener();
      setCandidateUsersListener.setEvent("create");
      setCandidateUsersListener.setImplementationType("class");
      setCandidateUsersListener.setImplementation(SetCandidateUsersImpl.class.getName());
      setCandidateUsersListener.getFieldExtensions().add(assigneesVarNameExpr);
      approvalTask.getTaskListeners().add(setCandidateUsersListener);
    }

    FlowableListener taskListener = new FlowableListener();
    taskListener.setEvent("create");
    taskListener.setImplementationType("class");
    taskListener.setImplementation(CreateApprovalTaskImpl.class.getName());
    approvalTask.getTaskListeners().add(taskListener);

    subProcess.addFlowElement(approvalTask);

    EndEvent endEvent = new EndEvent();
    endEvent.setId(String.format("%s-endEvent", approval.getName()));
    endEvent.setName("End Event");
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
