package org.openmetadata.service.governance.workflows.elements;

import java.util.Optional;
import java.util.Set;
import org.openmetadata.schema.governance.workflows.TriggerType;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.governance.workflows.elements.NodeSubType;
import org.openmetadata.schema.governance.workflows.elements.WorkflowNodeDefinitionInterface;
import org.openmetadata.schema.governance.workflows.elements.triggers.EventBasedEntityTriggerDefinition;
import org.openmetadata.schema.governance.workflows.elements.triggers.NoOpTriggerDefinition;
import org.openmetadata.schema.governance.workflows.elements.triggers.PeriodicBatchEntityTriggerDefinition;
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

  private static final Set<NodeSubType> BATCH_CAPABLE_TASK_TYPES =
      Set.of(
          NodeSubType.CHECK_ENTITY_ATTRIBUTES_TASK,
          NodeSubType.CHECK_CHANGE_DESCRIPTION_TASK,
          NodeSubType.SET_ENTITY_ATTRIBUTE_TASK,
          NodeSubType.ROLLBACK_ENTITY_TASK,
          NodeSubType.DATA_COMPLETENESS_TASK,
          NodeSubType.SINK_TASK);

  private static boolean hasBatchModeNodes(WorkflowDefinition workflow) {
    if (workflow.getNodes() == null) {
      return false;
    }
    return workflow.getNodes().stream()
        .map(WorkflowNodeDefinitionInterface::getNodeSubType)
        .anyMatch(BATCH_CAPABLE_TASK_TYPES::contains);
  }

  public static String getTriggerWorkflowId(String workflowFQN) {
    return String.format("%sTrigger", workflowFQN);
  }

  public static String getMainWorkflowDefinitionNameFromTrigger(
      String triggerWorkflowDefinitionName) {
    return triggerWorkflowDefinitionName.replaceFirst("Trigger$", "");
  }
}
