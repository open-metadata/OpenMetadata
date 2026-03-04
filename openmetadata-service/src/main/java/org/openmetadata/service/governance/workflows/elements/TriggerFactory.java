package org.openmetadata.service.governance.workflows.elements;

import java.util.Map;
import org.openmetadata.schema.governance.workflows.TriggerType;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.governance.workflows.elements.NodeSubType;
import org.openmetadata.schema.governance.workflows.elements.WorkflowNodeDefinitionInterface;
import org.openmetadata.schema.governance.workflows.elements.nodes.automatedTask.SinkTaskDefinition;
import org.openmetadata.schema.governance.workflows.elements.triggers.EventBasedEntityTriggerDefinition;
import org.openmetadata.schema.governance.workflows.elements.triggers.NoOpTriggerDefinition;
import org.openmetadata.schema.governance.workflows.elements.triggers.PeriodicBatchEntityTriggerDefinition;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.governance.workflows.elements.triggers.EventBasedEntityTrigger;
import org.openmetadata.service.governance.workflows.elements.triggers.NoOpTrigger;
import org.openmetadata.service.governance.workflows.elements.triggers.PeriodicBatchEntityTrigger;

public class TriggerFactory {
  public static TriggerInterface createTrigger(WorkflowDefinition workflow) {
    String triggerWorkflowId = getTriggerWorkflowId(workflow.getFullyQualifiedName());

    return switch (TriggerType.fromValue(workflow.getTrigger().getType())) {
      case EVENT_BASED_ENTITY -> new EventBasedEntityTrigger(
          workflow.getName(),
          triggerWorkflowId,
          (EventBasedEntityTriggerDefinition) workflow.getTrigger());
      case NO_OP -> new NoOpTrigger(
          workflow.getName(), triggerWorkflowId, (NoOpTriggerDefinition) workflow.getTrigger());
      case PERIODIC_BATCH_ENTITY -> new PeriodicBatchEntityTrigger(
          workflow.getName(),
          triggerWorkflowId,
          (PeriodicBatchEntityTriggerDefinition) workflow.getTrigger(),
          hasBatchModeNodes(workflow));
    };
  }

  /**
   * Check if the workflow contains any nodes with batchMode enabled. When batch mode is detected,
   * the trigger should create a single workflow execution per batch instead of N parallel
   * executions (one per entity).
   *
   * <p>Note: Per the schema, batchMode defaults to true when not explicitly set. This ensures Git
   * sinks use single execution mode by default, preventing race conditions from parallel commits.
   */
  private static boolean hasBatchModeNodes(WorkflowDefinition workflow) {
    if (workflow.getNodes() == null) {
      return false;
    }
    for (WorkflowNodeDefinitionInterface node : workflow.getNodes()) {
      if (node.getNodeSubType() == NodeSubType.SINK_TASK) {
        // Handle typed SinkTaskDefinition
        if (node instanceof SinkTaskDefinition sinkTask) {
          if (sinkTask.getConfig() != null) {
            // Schema default is true, so treat null as true
            Boolean batchMode = sinkTask.getConfig().getBatchMode();
            if (batchMode == null || batchMode) {
              return true;
            }
          }
        } else {
          // Fallback for Map-based config (e.g., from JSON deserialization)
          Object config = node.getConfig();
          if (config != null) {
            Map<String, Object> configMap = JsonUtils.getMap(config);
            Object batchMode = configMap.get("batchMode");
            // Schema default is true, so treat null/absent as true
            if (batchMode == null || Boolean.TRUE.equals(batchMode)) {
              return true;
            }
          }
        }
      }
    }
    return false;
  }

  public static String getTriggerWorkflowId(String workflowFQN) {
    return String.format("%sTrigger", workflowFQN);
  }

  public static String getMainWorkflowDefinitionNameFromTrigger(
      String triggerWorkflowDefinitionName) {
    return triggerWorkflowDefinitionName.replaceFirst("Trigger$", "");
  }
}
