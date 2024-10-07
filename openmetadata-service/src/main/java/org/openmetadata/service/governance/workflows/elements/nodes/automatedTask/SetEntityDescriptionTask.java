package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask;

import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.EndEvent;
import org.flowable.bpmn.model.FieldExtension;
import org.flowable.bpmn.model.Process;
import org.flowable.bpmn.model.SequenceFlow;
import org.flowable.bpmn.model.ServiceTask;
import org.flowable.bpmn.model.StartEvent;
import org.flowable.bpmn.model.SubProcess;
import org.openmetadata.schema.governance.workflows.elements.WorkflowNodeDefinitionInterface;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.SetEntityDescriptionTaskDefinition;
import org.openmetadata.service.governance.workflows.elements.WorkflowNodeInterface;
import org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl.SetEntityDescriptionImpl;

import static org.openmetadata.service.governance.workflows.Workflow.getMetadataExtension;

public class SetEntityDescriptionTask implements WorkflowNodeInterface {
    private final SubProcess subProcess;

    public SetEntityDescriptionTask(WorkflowNodeDefinitionInterface nodeDefinition) {
        SetEntityDescriptionTaskDefinition node = (SetEntityDescriptionTaskDefinition) nodeDefinition;

        SubProcess subProcess = new SubProcess();
        subProcess.setId(node.getName());
        subProcess.setName(node.getDisplayName());
        subProcess.addExtensionElement(
                getMetadataExtension(
                        node.getName(), node.getDisplayName(), node.getDescription()));

        // Attach Listeners
        attachWorkflowInstanceStageUpdaterListeners(subProcess);

        StartEvent startEvent = new StartEvent();
        startEvent.setId(getFlowableElementId(node.getName(), "startEvent"));
        startEvent.setName(getFlowableElementName(node.getNodeDisplayName(), "startEvent"));
        subProcess.addFlowElement(startEvent);

        ServiceTask serviceTask = new ServiceTask();
        serviceTask.setId(getFlowableElementId(node.getName(), "setEntityDescriptionTask"));
        serviceTask.setName(getFlowableElementName(node.getDisplayName(), "setEntityDescriptionTask"));
        serviceTask.setImplementationType("class");
        serviceTask.setImplementation(SetEntityDescriptionImpl.class.getName());

        FieldExtension descriptionExpr = new FieldExtension();
        descriptionExpr.setFieldName("descriptionExpr");
        descriptionExpr.setStringValue(node.getConfig().getEntityDescription());
        serviceTask.getFieldExtensions().add(descriptionExpr);

        subProcess.addFlowElement(serviceTask);

        EndEvent endEvent = new EndEvent();
        endEvent.setId(getFlowableElementId(node.getName(), "endEvent"));
        endEvent.setName(getFlowableElementName(node.getNodeDisplayName(), "endEvent"));
        subProcess.addFlowElement(endEvent);

        subProcess.addFlowElement(new SequenceFlow(startEvent.getId(), serviceTask.getId()));
        subProcess.addFlowElement(new SequenceFlow(serviceTask.getId(), endEvent.getId()));

        this.subProcess = subProcess;
    }
    public void addToWorkflow(BpmnModel model, Process process) {
        process.addFlowElement(subProcess);
    }
}
