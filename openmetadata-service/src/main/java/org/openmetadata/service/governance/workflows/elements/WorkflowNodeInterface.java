package org.openmetadata.service.governance.workflows.elements;

import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.EndEvent;
import org.flowable.bpmn.model.FlowNode;
import org.flowable.bpmn.model.FlowableListener;
import org.flowable.bpmn.model.Process;
import org.flowable.bpmn.model.StartEvent;
import org.flowable.bpmn.model.SubProcess;
import org.openmetadata.service.governance.workflows.WorkflowInstanceStageUpdaterListener;

import java.util.ArrayList;
import java.util.List;

public interface WorkflowNodeInterface {
    void addToWorkflow(BpmnModel model, Process process);

    default String getFlowableElementId(String nodeName, String elementName) {
        return String.format("%s-%s", nodeName, elementName);
    }

    default String getFlowableElementName(String nodeDisplayName, String elementName) {
        return String.format("[%s] %s", nodeDisplayName, elementName);
    }

    default void attachWorkflowInstanceStageUpdaterListeners(FlowNode flowableNode) {
        for (FlowableListener listener : getWorkflowInstanceStageUpdaterListeners()) {
            flowableNode.getExecutionListeners().add(listener);
        }
    }

    private List<FlowableListener> getWorkflowInstanceStageUpdaterListeners() {
        List<FlowableListener> listeners = new ArrayList<>();

        List<String> events = List.of("start", "end");
        for (String event : events) {
            FlowableListener listener = new FlowableListener();
            listener.setEvent(event);
            listener.setImplementationType("class");
            listener.setImplementation(WorkflowInstanceStageUpdaterListener.class.getName());
            listeners.add(listener);
        }

        return listeners;
    }
}
