package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask;

import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.WORKFLOW_INSTANCE_EXECUTION_ID_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.WORKFLOW_RUNTIME_EXCEPTION;
import static org.openmetadata.service.governance.workflows.Workflow.getFlowableElementId;

import java.util.List;
import lombok.Getter;
import org.flowable.bpmn.model.BoundaryEvent;
import org.flowable.bpmn.model.BpmnModel;
import org.flowable.bpmn.model.FieldExtension;
import org.flowable.bpmn.model.Process;
import org.flowable.bpmn.model.ServiceTask;
import org.openmetadata.schema.governance.workflows.WorkflowConfiguration;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.RollbackEntityTaskDefinition;
import org.openmetadata.service.governance.workflows.elements.NodeInterface;
import org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl.RollbackEntityImpl;
import org.openmetadata.service.governance.workflows.flowable.builders.FieldExtensionBuilder;
import org.openmetadata.service.governance.workflows.flowable.builders.ServiceTaskBuilder;

@Getter
public class RollbackEntityTask implements NodeInterface {
  private final String nodeId;
  private final ServiceTask serviceTask;
  private BoundaryEvent runtimeExceptionBoundaryEvent;
  private final RollbackEntityTaskDefinition config;

  public RollbackEntityTask(
      RollbackEntityTaskDefinition nodeDefinition, WorkflowConfiguration workflowConfig) {
    this.config = nodeDefinition;
    this.nodeId = getFlowableElementId(nodeDefinition.getName(), "rollbackTask");

    List<FieldExtension> extensions =
        List.of(
            new FieldExtensionBuilder()
                .fieldName(RELATED_ENTITY_VARIABLE)
                .fieldValue(RELATED_ENTITY_VARIABLE)
                .build(),
            new FieldExtensionBuilder()
                .fieldName(WORKFLOW_INSTANCE_EXECUTION_ID_VARIABLE)
                .fieldValue(WORKFLOW_INSTANCE_EXECUTION_ID_VARIABLE)
                .build(),
            new FieldExtensionBuilder()
                .fieldName("rollbackToStatus")
                .fieldValue(
                    nodeDefinition.getConfig() != null
                            && nodeDefinition.getConfig().getRollbackToStatus() != null
                        ? nodeDefinition.getConfig().getRollbackToStatus()
                        : "Approved")
                .build());

    ServiceTaskBuilder builder =
        new ServiceTaskBuilder().id(this.nodeId).implementation(RollbackEntityImpl.class.getName());

    for (FieldExtension extension : extensions) {
      builder.addFieldExtension(extension);
    }

    serviceTask = builder.build();
  }

  @Override
  public void addToWorkflow(BpmnModel model, Process process) {
    process.addFlowElement(serviceTask);

    runtimeExceptionBoundaryEvent = getRuntimeExceptionBoundaryEvent(serviceTask, false);
    runtimeExceptionBoundaryEvent.setId(
        getFlowableElementId(serviceTask.getId(), WORKFLOW_RUNTIME_EXCEPTION));
    process.addFlowElement(runtimeExceptionBoundaryEvent);
  }

  @Override
  public BoundaryEvent getRuntimeExceptionBoundaryEvent() {
    return runtimeExceptionBoundaryEvent;
  }
}
