package org.openmetadata.service.governance.workflows.elements.nodes.automatedTasks;

import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.EndEvent;
import org.flowable.bpmn.model.FlowableListener;
import org.flowable.bpmn.model.Process;
import org.flowable.bpmn.model.SequenceFlow;
import org.flowable.bpmn.model.ServiceTask;
import org.flowable.bpmn.model.StartEvent;
import org.flowable.bpmn.model.SubProcess;
import org.openmetadata.schema.governance.workflows.elements.WorkflowNodeDefinitionInterface;
import org.openmetadata.service.governance.workflows.WorkflowInstanceStageUpdaterListener;
import org.openmetadata.service.governance.workflows.elements.WorkflowNodeInterface;
import org.openmetadata.service.governance.workflows.elements.nodes.automatedTasks.impl.CheckEntityHasReviewersImpl;

import static org.openmetadata.service.governance.workflows.Workflow.getMetadataExtension;

public class CheckEntityHasReviewersTask implements WorkflowNodeInterface {
    private final SubProcess subProcess;

    public CheckEntityHasReviewersTask(WorkflowNodeDefinitionInterface nodeDefinition) {
        SubProcess subProcess = new SubProcess();
        subProcess.setId(nodeDefinition.getName());
        subProcess.setName(nodeDefinition.getDisplayName());
        subProcess.addExtensionElement(
                getMetadataExtension(
                        nodeDefinition.getName(),
                        nodeDefinition.getDisplayName(),
                        nodeDefinition.getDescription()));

        // Attach Listeners
        attachWorkflowInstanceStageUpdaterListeners(subProcess);

        StartEvent startEvent = new StartEvent();
        startEvent.setId(getFlowableElementId(nodeDefinition.getName(), "startEvent"));
        startEvent.setName(getFlowableElementName(nodeDefinition.getNodeDisplayName(), "startEvent"));
        subProcess.addFlowElement(startEvent);

        ServiceTask serviceTask = new ServiceTask();
        serviceTask.setId(getFlowableElementId(nodeDefinition.getName(), "checkEntityHasReviewers"));
        serviceTask.setName(getFlowableElementName(nodeDefinition.getDisplayName(), "checkEntityHasReviewers"));
        serviceTask.setImplementationType("class");
        serviceTask.setImplementation(CheckEntityHasReviewersImpl.class.getName());
        subProcess.addFlowElement(serviceTask);

        EndEvent endEvent = new EndEvent();
        endEvent.setId(getFlowableElementId(nodeDefinition.getName(), "endEvent"));
        endEvent.setName(getFlowableElementName(nodeDefinition.getNodeDisplayName(), "endEvent"));
        subProcess.addFlowElement(endEvent);

        subProcess.addFlowElement(new SequenceFlow(startEvent.getId(), serviceTask.getId()));
        subProcess.addFlowElement(new SequenceFlow(serviceTask.getId(), endEvent.getId()));

        this.subProcess = subProcess;
    }
    public void addToWorkflow(BpmnModel model, Process process) {
        process.addFlowElement(subProcess);
    }
}
