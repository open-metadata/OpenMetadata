package org.openmetadata.service.governance.workflows.elements.nodes.userTask.impl;

import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;

import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler;
import org.openmetadata.service.jdbi3.TaskRepository;
import org.openmetadata.service.resources.feeds.MessageParser;

@Slf4j
public class AutoApproveServiceTaskImpl implements JavaDelegate {
  private Expression inputNamespaceMapExpr;

  @Override
  public void execute(DelegateExecution execution) {
    WorkflowVariableHandler varHandler = new WorkflowVariableHandler(execution);

    Boolean submitterIsReviewer = (Boolean) execution.getVariable("submitterIsReviewer");
    String autoApprovalReason;

    if (Boolean.TRUE.equals(submitterIsReviewer)) {
      autoApprovalReason = "Submitter is a reviewer";
      LOG.info(
          "Auto-approving task in process instance {} because submitter is a reviewer.",
          execution.getProcessInstanceId());
    } else {
      autoApprovalReason = "No reviewers configured";
      LOG.info(
          "Auto-approving task in process instance {} due to no assignees/reviewers configured.",
          execution.getProcessInstanceId());
    }

    if (inputNamespaceMapExpr != null) {
      try {
        Map<String, String> inputNamespaceMap =
            JsonUtils.readOrConvertValue(inputNamespaceMapExpr.getValue(execution), Map.class);
        String entityInfo =
            (String)
                varHandler.getNamespacedVariable(
                    inputNamespaceMap.get(RELATED_ENTITY_VARIABLE), RELATED_ENTITY_VARIABLE);

        if (entityInfo != null) {
          MessageParser.EntityLink entityLink = MessageParser.EntityLink.parse(entityInfo);
          TaskRepository taskRepository = (TaskRepository) Entity.getEntityRepository(Entity.TASK);
          taskRepository.closeApprovalTaskForEntity(
              entityLink.getEntityFQN(), "system", "Task auto-approved: " + autoApprovalReason);
        }

        LOG.info("Auto-approved entity: {}", entityInfo);
      } catch (Exception e) {
        LOG.debug("Could not process entity for auto-approval: {}", e.getMessage());
      }
    }

    varHandler.setNodeVariable("result", true);
    varHandler.setNodeVariable("autoApprovalReason", autoApprovalReason);
  }
}
