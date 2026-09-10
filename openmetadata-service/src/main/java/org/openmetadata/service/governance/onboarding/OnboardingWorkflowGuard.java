package org.openmetadata.service.governance.onboarding;

import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.elements.TriggerFactory;
import org.openmetadata.service.resources.feeds.MessageParser;

public final class OnboardingWorkflowGuard {
  private OnboardingWorkflowGuard() {}

  public static boolean suppressAutomaticApproval(
      MessageParser.EntityLink link, String triggerKey) {
    if (!OnboardingEvaluator.ENTITY_TYPES.contains(link.getEntityType())) return false;
    EntityInterface asset = Entity.getEntity(link, "*", Include.NON_DELETED);
    if (OnboardingStore.find(asset.getId()) == null
        && !(OnboardingService.eligible(asset)
            && OnboardingEvaluator.isEnabled(OnboardingService.configured(link.getEntityType()))))
      return false;
    String name = TriggerFactory.getMainWorkflowDefinitionNameFromTrigger(triggerKey);
    WorkflowDefinition workflow =
        Entity.findByNameOrNull(Entity.WORKFLOW_DEFINITION, name, Include.NON_DELETED);
    return workflow != null
        && workflow.getNodes().stream()
            .anyMatch(
                node ->
                    "userApprovalTask"
                        .equals(JsonUtils.valueToTree(node).path("subType").asText()));
  }
}
