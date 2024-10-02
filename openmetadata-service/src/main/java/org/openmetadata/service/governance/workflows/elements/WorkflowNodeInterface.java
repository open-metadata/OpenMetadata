package org.openmetadata.service.governance.workflows.elements;

import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.Process;

public interface WorkflowNodeInterface {
    void addToWorkflow(BpmnModel model, Process process);

    default String getFlowableElementId(String nodeName, String elementName) {
        return String.format("%s-%s", nodeName, elementName);
    }

    default String getFlowableElementName(String nodeDisplayName, String elementName) {
        return String.format("[%s] %s", nodeDisplayName, elementName);
    }
}
