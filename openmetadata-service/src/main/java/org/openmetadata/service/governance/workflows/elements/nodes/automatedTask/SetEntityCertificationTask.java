package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask;

import static org.openmetadata.service.governance.workflows.Workflow.getFlowableElementId;

import java.util.Optional;
import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.EndEvent;
import org.flowable.bpmn.model.FieldExtension;
import org.flowable.bpmn.model.Process;
import org.flowable.bpmn.model.SequenceFlow;
import org.flowable.bpmn.model.ServiceTask;
import org.flowable.bpmn.model.StartEvent;
import org.flowable.bpmn.model.SubProcess;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.SetEntityCertificationTaskDefinition;
import org.openmetadata.service.governance.workflows.elements.NodeInterface;
import org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl.SetEntityCertificationImpl;
import org.openmetadata.service.governance.workflows.flowable.builders.EndEventBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.FieldExtensionBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.ServiceTaskBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.StartEventBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.SubProcessBuilder;

public class SetEntityCertificationTask implements NodeInterface {
  private final SubProcess subProcess;

  public SetEntityCertificationTask(SetEntityCertificationTaskDefinition nodeDefinition) {
    String subProcessId = nodeDefinition.getName();

    SubProcess subProcess = new SubProcessBuilder().id(subProcessId).build();

    StartEvent startEvent =
        new StartEventBuilder().id(getFlowableElementId(subProcessId, "startEvent")).build();

    ServiceTask setEntityCertification =
        getSetEntityCertificationServiceTask(
            subProcessId, nodeDefinition.getConfig().getCertification());

    EndEvent endEvent =
        new EndEventBuilder().id(getFlowableElementId(subProcessId, "endEvent")).build();

    subProcess.addFlowElement(startEvent);
    subProcess.addFlowElement(setEntityCertification);
    subProcess.addFlowElement(endEvent);

    subProcess.addFlowElement(new SequenceFlow(startEvent.getId(), setEntityCertification.getId()));
    subProcess.addFlowElement(new SequenceFlow(setEntityCertification.getId(), endEvent.getId()));

    attachWorkflowInstanceStageListeners(subProcess);

    this.subProcess = subProcess;
  }

  private ServiceTask getSetEntityCertificationServiceTask(
      String subProcessId, String certification) {
    FieldExtension certificationExpr =
        new FieldExtensionBuilder()
            .fieldName("certificationExpr")
            .fieldValue(Optional.ofNullable(certification).orElse(""))
            .build();

    ServiceTask serviceTask =
        new ServiceTaskBuilder()
            .id(getFlowableElementId(subProcessId, "setGlossaryTermStatus"))
            .implementation(SetEntityCertificationImpl.class.getName())
            .build();
    serviceTask.getFieldExtensions().add(certificationExpr);
    return serviceTask;
  }

  public void addToWorkflow(BpmnModel model, Process process) {
    process.addFlowElement(subProcess);
  }
}
