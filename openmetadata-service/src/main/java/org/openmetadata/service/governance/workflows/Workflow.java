package org.openmetadata.service.governance.workflows;

import lombok.Getter;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.service.governance.workflows.flowable.MainWorkflow;
import org.openmetadata.service.governance.workflows.flowable.TriggerWorkflow;

@Getter
public class Workflow {
  // Flowable Variable Constants
  public static final String INGESTION_PIPELINE_ID_VARIABLE = "ingestionPipelineId";
  public static final String RELATED_ENTITY_VARIABLE = "relatedEntity";
  public static final String RESULT_VARIABLE = "result";
  public static final String UPDATED_BY_VARIABLE = "updatedBy";
  public static final String STAGE_INSTANCE_STATE_ID_VARIABLE = "stageInstanceStateId";
  public static final String WORKFLOW_INSTANCE_EXECUTION_ID_VARIABLE =
      "workflowInstanceExecutionId";
  public static final String EXCEPTION_VARIABLE = "exception";
  public static final String FAILURE_VARIABLE = "failure";
  public static final String RETRY_LOCK_VARIABLE = "retryLock";
  public static final String STEP_TO_RETRY_VARIABLE = "stepToRetry";

  // Flowable Message Constants
  public static final String MANUAL_RETRY_MESSAGE = "ManualRetryMessage";

  // Flowable Exception Constants
  public static final String WORKFLOW_RUNTIME_EXCEPTION = "workflowRuntimeException";

  // Variable Namespace Constants
  public static final String GLOBAL_NAMESPACE = "global";

  // Other Constants
  public static final String SUCCESSFUL_RESULT = "success";
  public static final String FAILURE_RESULT = "failure";

  private final TriggerWorkflow triggerWorkflow;
  private final MainWorkflow mainWorkflow;

  public Workflow(WorkflowDefinition workflowDefinition) {
    this.triggerWorkflow = new TriggerWorkflow(workflowDefinition);
    this.mainWorkflow = new MainWorkflow(workflowDefinition);
  }

  public static String getFlowableElementId(String parentName, String elementName) {
    return String.format("%s.%s", parentName, elementName);
  }

  public static String getResultFromBoolean(boolean result) {
    return result ? SUCCESSFUL_RESULT : FAILURE_RESULT;
  }
}
