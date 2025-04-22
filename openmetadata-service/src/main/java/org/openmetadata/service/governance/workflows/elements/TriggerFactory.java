package org.openmetadata.service.governance.workflows.elements;

import org.openmetadata.schema.governance.workflows.TriggerType;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.governance.workflows.elements.triggers.EventBasedEntityTriggerDefinition;
import org.openmetadata.schema.governance.workflows.elements.triggers.NoOpTriggerDefinition;
import org.openmetadata.schema.governance.workflows.elements.triggers.PeriodicBatchEntityTriggerDefinition;
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
          (PeriodicBatchEntityTriggerDefinition) workflow.getTrigger());
    };
  }

  public static String getTriggerWorkflowId(String workflowFQN) {
    return String.format("%sTrigger", workflowFQN);
  }
}
