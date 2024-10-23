package org.openmetadata.service.governance.workflows;

import lombok.Getter;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.service.governance.workflows.flowable.MainWorkflow;
import org.openmetadata.service.governance.workflows.flowable.TriggerWorkflow;

@Getter
public class Workflow {
  public final static String STAGE_INSTANCE_STATE_ID_VARIABLE = "stageInstanceStateId";
  public final static String WORKFLOW_INSTANCE_EXECUTION_ID_VARIABLE = "workflowInstanceExecutionId";
  private final TriggerWorkflow triggerWorkflow;
  private final MainWorkflow mainWorkflow;

  public Workflow(WorkflowDefinition workflowDefinition) {
    this.triggerWorkflow = new TriggerWorkflow(workflowDefinition);
    this.mainWorkflow = new MainWorkflow(workflowDefinition);
  }

  public static String getFlowableElementId(String parentName, String elementName) {
    return String.format("%s.%s", parentName, elementName);
  }
}
