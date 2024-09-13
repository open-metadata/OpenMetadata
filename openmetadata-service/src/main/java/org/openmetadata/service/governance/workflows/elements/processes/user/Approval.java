package org.openmetadata.service.governance.workflows.elements.processes.user;

import static org.openmetadata.service.governance.workflows.Workflow.getMetadataExtension;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.EndEvent;
import org.flowable.bpmn.model.MultiInstanceLoopCharacteristics;
import org.flowable.bpmn.model.Process;
import org.flowable.bpmn.model.ScriptTask;
import org.flowable.bpmn.model.SequenceFlow;
import org.flowable.bpmn.model.StartEvent;
import org.flowable.bpmn.model.SubProcess;
import org.flowable.bpmn.model.UserTask;

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

    List<String> assignees = new ArrayList<>();

    UserTask approvalTask = new UserTask();
    approvalTask.setId(String.format("%s-approvalTask", approval.getName()));
    approvalTask.setName("Approval Task");

    if (((Map<String, Object>) approval.getConfig()).get("approveType").equals("ALL")) {
      String assigneesVariable = String.format("%s-assignees", approval.getName());

      ScriptTask scriptTask = new ScriptTask();
      scriptTask.setId(String.format("%s-setUpdates", approval.getName()));
      scriptTask.setName("Set Updates as Variable");
      scriptTask.setScriptFormat("javascript");
      scriptTask.setScript(
          String.format("execution.setVariable('%s', %s);", assigneesVariable, assignees));
      subProcess.addFlowElement(scriptTask);

      MultiInstanceLoopCharacteristics loopCharacteristics = new MultiInstanceLoopCharacteristics();
      loopCharacteristics.setSequential(false);
      loopCharacteristics.setCollectionString("assignees");
      loopCharacteristics.setElementVariable("assignee");
      approvalTask.setLoopCharacteristics(loopCharacteristics);
      approvalTask.setAssignee("${assignee}");

      subProcess.addFlowElement(new SequenceFlow(scriptTask.getId(), scriptTask.getId()));
      subProcess.addFlowElement(new SequenceFlow(scriptTask.getId(), approvalTask.getId()));
    } else {
      approvalTask.setCandidateUsers(assignees);
      subProcess.addFlowElement(new SequenceFlow(startEvent.getId(), approvalTask.getId()));
    }
    subProcess.addFlowElement(approvalTask);

    EndEvent endEvent = new EndEvent();
    endEvent.setId(String.format("%s-endEvent", approval.getName()));
    endEvent.setName("End Event");
    subProcess.addFlowElement(endEvent);
    subProcess.addFlowElement(new SequenceFlow(approvalTask.getId(), endEvent.getId()));

    this.subProcess = subProcess;
  }

  public void addToWorkflow(BpmnModel model, Process process) {
    process.addFlowElement(subProcess);
  }
}
