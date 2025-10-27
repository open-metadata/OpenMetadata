package org.openmetadata.service.governance.workflows.elements.nodes.userTask.impl;

import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;

import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler;

@Slf4j
public class AutoApproveServiceTaskImpl implements JavaDelegate {
  private Expression inputNamespaceMapExpr;

  @Override
  public void execute(DelegateExecution execution) {
    WorkflowVariableHandler varHandler = new WorkflowVariableHandler(execution);

    LOG.info(
        "Auto-approving task in process instance {} due to no assignees/reviewers configured.",
        execution.getProcessInstanceId());

    varHandler.setNodeVariable("result", true);
    varHandler.setNodeVariable("autoApprovalReason", "No reviewers configured");

    if (inputNamespaceMapExpr != null) {
      try {
        Map<String, String> inputNamespaceMap =
            JsonUtils.readOrConvertValue(inputNamespaceMapExpr.getValue(execution), Map.class);
        String entityInfo =
            (String)
                varHandler.getNamespacedVariable(
                    inputNamespaceMap.get(RELATED_ENTITY_VARIABLE), RELATED_ENTITY_VARIABLE);
        LOG.info("Auto-approved entity: {}", entityInfo);
      } catch (Exception e) {
        LOG.debug("Could not get entity info for logging: {}", e.getMessage());
      }
    }
  }
}
