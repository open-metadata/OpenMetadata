package org.openmetadata.service.governance.workflows;

import lombok.Getter;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.service.governance.workflows.flowable.MainWorkflow;
import org.openmetadata.service.governance.workflows.flowable.TriggerWorkflow;

@Getter
public class Workflow {
  public static final String INGESTION_PIPELINE_ID_VARIABLE = "ingestionPipelineId";
  public static final String RELATED_ENTITY_VARIABLE = "relatedEntity";
  public static final String RESULT_VARIABLE = "result";
  public static final String UPDATED_BY_VARIABLE = "updatedBy";
  public static final String STAGE_INSTANCE_STATE_ID_VARIABLE = "stageInstanceStateId";
  public static final String WORKFLOW_INSTANCE_EXECUTION_ID_VARIABLE =
      "workflowInstanceExecutionId";
  public static final String WORKFLOW_RUNTIME_EXCEPTION = "workflowRuntimeException";
  public static final String EXCEPTION_VARIABLE = "exception";
  public static final String FAILURE_VARIABLE = "failure";
  public static final String GLOBAL_NAMESPACE = "global";
  public static final String SUCCESSFUL_RESULT = "success";
  public static final String FAILURE_RESULT = "failure";
  private final TriggerWorkflow triggerWorkflow;
  private final MainWorkflow mainWorkflow;

  public Workflow(WorkflowDefinition workflowDefinition) {
    this.triggerWorkflow = new TriggerWorkflow(workflowDefinition);
    this.mainWorkflow = new MainWorkflow(workflowDefinition);
  }

  public static String getFlowableElementId(String parentName, String elementName) {
    String fullId = String.format("%s.%s", parentName, elementName);
    // Flowable has a limit on ACTIVITY_ID_ column (64 chars in MySQL)
    // We need to ensure our IDs don't exceed this limit
    if (fullId.length() > 60) {
      // For long IDs, create a short but unique identifier
      String hash = Integer.toHexString(fullId.hashCode());
      String safeId = elementName.length() > 20 ? elementName.substring(0, 20) : elementName;
      return safeId + "_" + hash;
    }
    return fullId;
  }

  public static String getResultFromBoolean(boolean result) {
    return result ? SUCCESSFUL_RESULT : FAILURE_RESULT;
  }
}
