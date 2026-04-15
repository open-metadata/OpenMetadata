package org.openmetadata.service.governance.workflows.elements;

import java.util.Map;
import java.util.Optional;
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
    String fqnOrName = resolveWorkflowFqn(workflow);
    String triggerWorkflowId = getTriggerWorkflowId(fqnOrName);

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
          hasBatchModeNodes(workflow),
          fqnOrName);
    };
  }

  private static String resolveWorkflowFqn(WorkflowDefinition workflow) {
    return Optional.ofNullable(workflow.getFullyQualifiedName())
        .filter(s -> !s.isBlank())
        .orElse(workflow.getName());
  }


  private static boolean hasBatchModeNodes(WorkflowDefinition workflow) {
    if (workflow.getNodes() == null) {
      return false;
    }
    for (WorkflowNodeDefinitionInterface node : workflow.getNodes()) {
      if (node.getNodeSubType() == NodeSubType.SINK_TASK) {
        if (node instanceof SinkTaskDefinition sinkTask) {
          if (sinkTask.getConfig() != null) {
            Boolean batchMode = sinkTask.getConfig().getBatchMode();
            if (batchMode == null || batchMode) {
              return true;
            }
          }
        } else {
          Object config = node.getConfig();
          if (config != null) {
            Map<String, Object> configMap = JsonUtils.getMap(config);
            Object batchMode = configMap.get("batchMode");
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
