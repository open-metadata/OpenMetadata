package org.openmetadata.service.governance.workflows.elements;

import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.governance.workflows.elements.nodes.trigger.PeriodicBatchEntityTriggerDefinition;
import org.openmetadata.schema.governance.workflows.elements.triggers.EventBasedEntityTriggerDefinition;
import org.openmetadata.service.governance.workflows.elements.triggers.EventBasedEntityTrigger;
import org.openmetadata.service.governance.workflows.elements.triggers.PeriodicBatchEntityTrigger;
import org.openmetadata.service.util.JsonUtils;

public class TriggerFactory {
  public static TriggerInterface createTrigger(WorkflowDefinition workflowDefinition) {
    String mainWorkflowName = workflowDefinition.getFullyQualifiedName();
    String triggerWorkflowId = getTriggerWorkflowId(mainWorkflowName);

    return switch (workflowDefinition.getType()) {
      case EVENT_BASED_ENTITY_WORKFLOW -> new EventBasedEntityTrigger(
          mainWorkflowName,
          triggerWorkflowId,
          JsonUtils.readOrConvertValue(
              workflowDefinition.getTrigger(), EventBasedEntityTriggerDefinition.class));
      case PERIODIC_BATCH_ENTITY_WORKFLOW -> new PeriodicBatchEntityTrigger(
          mainWorkflowName,
          triggerWorkflowId,
          JsonUtils.readOrConvertValue(
              workflowDefinition.getTrigger(), PeriodicBatchEntityTriggerDefinition.class));
    };
  }

  public static String getTriggerWorkflowId(String workflowFQN) {
    return String.format("%sTrigger", workflowFQN);
  }
}
