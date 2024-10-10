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
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.CheckEntityAttributesTaskDefinition;
import org.openmetadata.service.governance.workflows.elements.WorkflowNodeInterface;
import org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl.CheckEntityAttributesImpl;
import org.openmetadata.service.util.JsonUtils;

import static org.openmetadata.service.governance.workflows.Workflow.getMetadataExtension;

public class CheckEntityAttributesTask implements WorkflowNodeInterface {
    private final SubProcess subProcess;

    public CheckEntityAttributesTask(WorkflowNodeDefinitionInterface nodeDefinition) {
        CheckEntityAttributesTaskDefinition checkEntityAttributesTaskDefinition = (CheckEntityAttributesTaskDefinition) nodeDefinition;

        SubProcess subProcess = new SubProcess();
        subProcess.setId(checkEntityAttributesTaskDefinition.getName());
        subProcess.setName(checkEntityAttributesTaskDefinition.getDisplayName());
        subProcess.addExtensionElement(
                getMetadataExtension(
                        checkEntityAttributesTaskDefinition.getName(),
                        checkEntityAttributesTaskDefinition.getDisplayName(),
                        checkEntityAttributesTaskDefinition.getDescription()));

        // Attach Listeners
        attachWorkflowInstanceStageUpdaterListeners(subProcess);

        StartEvent startEvent = new StartEvent();
        startEvent.setId(getFlowableElementId(checkEntityAttributesTaskDefinition.getName(), "startEvent"));
        startEvent.setName(getFlowableElementName(checkEntityAttributesTaskDefinition.getNodeDisplayName(), "startEvent"));
        subProcess.addFlowElement(startEvent);

        ServiceTask serviceTask = new ServiceTask();
        serviceTask.setId(getFlowableElementId(checkEntityAttributesTaskDefinition.getName(), "checkEntityAttributes"));
        serviceTask.setName(getFlowableElementName(checkEntityAttributesTaskDefinition.getDisplayName(), "checkEntityAttributes"));
        serviceTask.setImplementationType("class");
        serviceTask.setImplementation(CheckEntityAttributesImpl.class.getName());

        FieldExtension rulesExpr = new FieldExtension();
        rulesExpr.setFieldName("rulesExpr");
        rulesExpr.setStringValue(checkEntityAttributesTaskDefinition.getConfig().getRules());
        serviceTask.getFieldExtensions().add(rulesExpr);

        subProcess.addFlowElement(serviceTask);

        EndEvent endEvent = new EndEvent();
        endEvent.setId(getFlowableElementId(checkEntityAttributesTaskDefinition.getName(), "endEvent"));
        endEvent.setName(getFlowableElementName(checkEntityAttributesTaskDefinition.getNodeDisplayName(), "endEvent"));
        subProcess.addFlowElement(endEvent);

        subProcess.addFlowElement(new SequenceFlow(startEvent.getId(), serviceTask.getId()));
        subProcess.addFlowElement(new SequenceFlow(serviceTask.getId(), endEvent.getId()));

        this.subProcess = subProcess;
    }
    public void addToWorkflow(BpmnModel model, Process process) {
        process.addFlowElement(subProcess);
    }
}
