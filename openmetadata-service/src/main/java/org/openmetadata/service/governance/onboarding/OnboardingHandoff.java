package org.openmetadata.service.governance.onboarding;

import static org.openmetadata.service.governance.workflows.Workflow.GLOBAL_NAMESPACE;
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_ID_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.UPDATED_BY_VARIABLE;
import static org.openmetadata.service.governance.workflows.WorkflowVariableHandler.getNamespacedVariableName;

import java.util.HashMap;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.governance.onboarding.OnboardingGate;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.resources.feeds.MessageParser;

/**
 * Hands a passed gate over to the workflow that owns the decision.
 *
 * <p>Onboarding decides <em>when</em> a transition may be attempted; it does not perform one. The
 * gate's workflow runs the approval and sets the resulting status through its own
 * {@code setEntityAttributeTask}, the same way {@code GlossaryTermApprovalWorkflow} already does.
 * That keeps one state machine in the product instead of two.
 */
@Slf4j
public final class OnboardingHandoff {
  private OnboardingHandoff() {}

  /**
   * Start the gate's workflow for this asset.
   *
   * @return the process instance id, or null when the gate names no workflow or it is not deployed.
   */
  public static String start(OnboardingGate gate, EntityInterface entity, String user) {
    EntityReference workflow = gate == null ? null : gate.getHandoffWorkflow();
    if (workflow == null || CommonUtil.nullOrEmpty(workflow.getFullyQualifiedName())) {
      LOG.debug(
          "Gate '{}' names no handoff workflow; nothing to start for {}",
          gate == null ? null : gate.getStage(),
          entity.getId());
      return null;
    }
    return WorkflowHandler.getInstance()
        .startWorkflowForEntity(workflow.getFullyQualifiedName(), variables(entity, user));
  }

  /**
   * The same variable contract {@code WorkflowEventConsumer} passes, so a workflow started by a
   * playbook gate is indistinguishable from one started by an entity event.
   */
  private static Map<String, Object> variables(EntityInterface entity, String user) {
    EntityReference reference = entity.getEntityReference();
    MessageParser.EntityLink link =
        new MessageParser.EntityLink(reference.getType(), reference.getFullyQualifiedName());
    Map<String, Object> variables = new HashMap<>();
    variables.put(
        getNamespacedVariableName(GLOBAL_NAMESPACE, RELATED_ENTITY_VARIABLE), link.getLinkString());
    variables.put(
        getNamespacedVariableName(GLOBAL_NAMESPACE, RELATED_ENTITY_ID_VARIABLE),
        entity.getId().toString());
    variables.put(
        getNamespacedVariableName(GLOBAL_NAMESPACE, UPDATED_BY_VARIABLE),
        user == null ? entity.getUpdatedBy() : user);
    return variables;
  }
}
