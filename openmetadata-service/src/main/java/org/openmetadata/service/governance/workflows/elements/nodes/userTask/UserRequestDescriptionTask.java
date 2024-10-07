package org.openmetadata.service.governance.workflows.elements.nodes.userTask;

import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.Process;
import org.flowable.bpmn.model.SubProcess;
import org.openmetadata.schema.governance.workflows.elements.WorkflowNodeDefinitionInterface;
import org.openmetadata.service.governance.workflows.elements.WorkflowNodeInterface;

public class UserRequestDescriptionTask implements WorkflowNodeInterface {
    private final SubProcess subProcess;
    public UserRequestDescriptionTask(WorkflowNodeDefinitionInterface nodeDefinition) {
        this.subProcess = null;
    }
    public void addToWorkflow(BpmnModel model, Process process) {
        process.addFlowElement(subProcess);
    }
}
