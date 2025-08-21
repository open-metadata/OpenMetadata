package org.openmetadata.service.governance.workflows;

import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.service.governance.workflows.flowable.MainWorkflow;
import org.openmetadata.service.governance.workflows.flowable.TriggerWorkflow;

@Slf4j
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

    // After migration 1.10.0, ACTIVITY_ID_ supports up to 255 chars
    // But we still want to keep IDs reasonable for debugging
    if (fullId.length() <= 250) {
      return fullId;
    }

    // For extremely long IDs (user-defined nodes can have any name),
    // create a truncated but still meaningful ID
    String truncated =
        truncateWithMeaning(parentName, 100) + "." + truncateWithMeaning(elementName, 140);
    LOG.warn(
        "Truncated workflow element ID from {} chars to {}: {} -> {}",
        fullId.length(),
        truncated.length(),
        fullId,
        truncated);
    return truncated;
  }

  private static String truncateWithMeaning(String text, int maxLength) {
    if (text.length() <= maxLength) {
      return text;
    }

    // Keep first part and last part for context
    int keepStart = (maxLength - 3) * 2 / 3; // Keep 2/3 at start
    int keepEnd = (maxLength - 3) - keepStart; // Rest at end

    return text.substring(0, keepStart) + "..." + text.substring(text.length() - keepEnd);
  }

  public static String getResultFromBoolean(boolean result) {
    return result ? SUCCESSFUL_RESULT : FAILURE_RESULT;
  }
}
