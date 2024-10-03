package org.openmetadata.service.governance.workflows.elements;

import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.FlowableListener;
import org.flowable.bpmn.model.Process;
import org.flowable.bpmn.model.SubProcess;
import org.openmetadata.service.governance.workflows.WorkflowInstanceStageUpdaterListener;

public interface WorkflowNodeInterface {
    void addToWorkflow(BpmnModel model, Process process);

    default String getFlowableElementId(String nodeName, String elementName) {
        return String.format("%s-%s", nodeName, elementName);
    }

    default String getFlowableElementName(String nodeDisplayName, String elementName) {
        return String.format("[%s] %s", nodeDisplayName, elementName);
    }

    default void attachSubProcessListeners(SubProcess subProcess) {
        // Add Workflow Start Listener
        FlowableListener startListener = new FlowableListener();
        startListener.setEvent("start");
        startListener.setImplementationType("class");
        startListener.setImplementation(WorkflowInstanceStageUpdaterListener.class.getName());
        subProcess.getExecutionListeners().add(startListener);


        // Add Workflow Start Listener
        FlowableListener endListener = new FlowableListener();
        endListener.setEvent("end");
        endListener.setImplementationType("class");
        endListener.setImplementation(WorkflowInstanceStageUpdaterListener.class.getName());
        subProcess.getExecutionListeners().add(endListener);
    }
}
