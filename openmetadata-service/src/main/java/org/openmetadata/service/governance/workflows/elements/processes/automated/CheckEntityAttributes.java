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
import org.openmetadata.service.governance.workflows.elements.processes.automated.impl.CheckEntityAttributesImpl;

public class CheckEntityAttributes {
  private final SubProcess subProcess;

  public CheckEntityAttributes(
      org.openmetadata.schema.governanceWorkflows.elements.processes.automated.CheckEntityAttributes
          checkEntityAttributes) {
    SubProcess subProcess = new SubProcess();
    subProcess.setId(checkEntityAttributes.getName());
    subProcess.setName(checkEntityAttributes.getDisplayName());
    subProcess.addExtensionElement(
        getMetadataExtension(
            checkEntityAttributes.getName(),
            checkEntityAttributes.getDisplayName(),
            checkEntityAttributes.getDescription()));

    StartEvent startEvent = new StartEvent();
    startEvent.setId(String.format("%s-startEvent", checkEntityAttributes.getName()));
    startEvent.setName("Start Event");
    subProcess.addFlowElement(startEvent);

    ScriptTask scriptTask = new ScriptTask();
    scriptTask.setId(String.format("%s-setConditionsAsVariable", checkEntityAttributes.getName()));
    scriptTask.setName("Set Conditions as Variable");
    scriptTask.setScriptFormat("javascript");
    scriptTask.setScript(
        String.format(
            "execution.setVariableLocal('conditions', '%s');",
            checkEntityAttributes.getConfig().getConditions()));
    subProcess.addFlowElement(scriptTask);

    ServiceTask serviceTask = new ServiceTask();
    serviceTask.setId(String.format("%s-checkEntityAttributes", checkEntityAttributes.getName()));
    serviceTask.setName(
        String.format("[%s] Check Entity Attributes", checkEntityAttributes.getDisplayName()));
    serviceTask.setImplementationType("class");
    serviceTask.setImplementation(CheckEntityAttributesImpl.class.getName());
    subProcess.addFlowElement(serviceTask);

    EndEvent endEvent = new EndEvent();
    endEvent.setId(String.format("%s-endEvent", checkEntityAttributes.getName()));
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
