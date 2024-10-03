package org.openmetadata.service.governance.workflows.elements.nodes.automatedTasks;

import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.EndEvent;
import org.flowable.bpmn.model.FieldExtension;
import org.flowable.bpmn.model.Process;
import org.flowable.bpmn.model.SequenceFlow;
import org.flowable.bpmn.model.ServiceTask;
import org.flowable.bpmn.model.StartEvent;
import org.flowable.bpmn.model.SubProcess;
import org.openmetadata.schema.governance.workflows.elements.WorkflowNodeDefinitionInterface;
import org.openmetadata.service.governance.workflows.elements.WorkflowNodeInterface;
import org.openmetadata.service.governance.workflows.elements.nodes.automatedTasks.impl.SetGlossaryTermStatusImpl;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTasks.SetGlossaryTermStatusTaskDefinition;

import static org.openmetadata.service.governance.workflows.Workflow.getMetadataExtension;

public class SetGlossaryTermStatusTask implements WorkflowNodeInterface {
    private final SubProcess subProcess;

    public SetGlossaryTermStatusTask(WorkflowNodeDefinitionInterface nodeDefinition) {
        SetGlossaryTermStatusTaskDefinition node = (SetGlossaryTermStatusTaskDefinition) nodeDefinition;

        SubProcess subProcess = new SubProcess();
        subProcess.setId(node.getName());
        subProcess.setName(node.getDisplayName());
        subProcess.addExtensionElement(
                getMetadataExtension(
                        node.getName(), node.getDisplayName(), node.getDescription()));

        // Attach Listeners
        attachSubProcessListeners(subProcess);

        StartEvent startEvent = new StartEvent();
        startEvent.setId(getFlowableElementId(node.getName(), "startEvent"));
        startEvent.setName(getFlowableElementName(node.getNodeDisplayName(), "startEvent"));
        subProcess.addFlowElement(startEvent);

        ServiceTask serviceTask = new ServiceTask();
        serviceTask.setId(getFlowableElementId(node.getName(), "setGlossaryTermStatus"));
        serviceTask.setName(getFlowableElementName(node.getDisplayName(), "setGlossaryTermStatus"));
        serviceTask.setImplementationType("class");
        serviceTask.setImplementation(SetGlossaryTermStatusImpl.class.getName());

        FieldExtension statusExpr = new FieldExtension();
        statusExpr.setFieldName("statusExpr");
        statusExpr.setStringValue(node.getConfig().getGlossaryTermStatus().toString());
        serviceTask.getFieldExtensions().add(statusExpr);

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
