package org.openmetadata.service.governance.workflows.elements.processes.automated;

import static org.openmetadata.service.governance.workflows.Workflow.getMetadataExtension;

import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.EndEvent;
import org.flowable.bpmn.model.Process;
import org.flowable.bpmn.model.ScriptTask;
import org.flowable.bpmn.model.SequenceFlow;
import org.flowable.bpmn.model.ServiceTask;
import org.flowable.bpmn.model.StartEvent;
import org.flowable.bpmn.model.SubProcess;
import org.openmetadata.service.governance.workflows.elements.processes.automated.impl.UpdateEntityImpl;

public class UpdateEntity {
  private final SubProcess subProcess;

  public UpdateEntity(
      org.openmetadata.schema.governanceWorkflows.elements.processes.automated.UpdateEntity
          updateEntity) {
    SubProcess subProcess = new SubProcess();
    subProcess.setId(updateEntity.getName());
    subProcess.setName(updateEntity.getDisplayName());
    subProcess.addExtensionElement(
        getMetadataExtension(
            updateEntity.getName(), updateEntity.getDisplayName(), updateEntity.getDescription()));

    StartEvent startEvent = new StartEvent();
    startEvent.setId(String.format("%s-startEvent", updateEntity.getName()));
    startEvent.setName("Start Event");
    subProcess.addFlowElement(startEvent);

    ScriptTask scriptTask = new ScriptTask();
    scriptTask.setId(String.format("%s-setUpdates", updateEntity.getName()));
    scriptTask.setName("Set Updates as Variable");
    scriptTask.setScriptFormat("javascript");
    scriptTask.setScript(
        String.format(
            "execution.setVariableLocal('updates', '%s');", updateEntity.getConfig().getUpdates()));
    subProcess.addFlowElement(scriptTask);

    ServiceTask serviceTask = new ServiceTask();
    serviceTask.setId(String.format("%s-updateEntity", updateEntity.getName()));
    serviceTask.setName(String.format("[%s] Update Entity", updateEntity.getDisplayName()));
    serviceTask.setImplementationType("class");
    serviceTask.setImplementation(UpdateEntityImpl.class.getName());
    subProcess.addFlowElement(serviceTask);

    EndEvent endEvent = new EndEvent();
    endEvent.setId(String.format("%s-endEvent", updateEntity.getName()));
    endEvent.setName("End Event");
    subProcess.addFlowElement(endEvent);

    subProcess.addFlowElement(new SequenceFlow(startEvent.getId(), scriptTask.getId()));
    subProcess.addFlowElement(new SequenceFlow(scriptTask.getId(), serviceTask.getId()));
    subProcess.addFlowElement(new SequenceFlow(serviceTask.getId(), endEvent.getId()));

    this.subProcess = subProcess;
  }

  public void addToWorkflow(BpmnModel model, Process process) {
    process.addFlowElement(subProcess);
  }
}
