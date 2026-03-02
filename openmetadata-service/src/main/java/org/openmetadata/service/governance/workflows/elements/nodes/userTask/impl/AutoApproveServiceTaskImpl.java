package org.openmetadata.service.governance.workflows.elements.nodes.userTask.impl;

import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;

import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.schema.api.feed.CloseTask;
import org.openmetadata.schema.entity.feed.Thread;
import org.openmetadata.schema.type.TaskStatus;
import org.openmetadata.schema.type.TaskType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler;
import org.openmetadata.service.jdbi3.FeedRepository;
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

    // Close any existing orphaned tasks before auto-approval and log entity info
    if (inputNamespaceMapExpr != null) {
      try {
        Map<String, String> inputNamespaceMap =
            JsonUtils.readOrConvertValue(inputNamespaceMapExpr.getValue(execution), Map.class);
        String entityInfo =
            (String)
                varHandler.getNamespacedVariable(
                    inputNamespaceMap.get(RELATED_ENTITY_VARIABLE), RELATED_ENTITY_VARIABLE);

        // Close orphaned tasks if they exist
        if (entityInfo != null) {
          MessageParser.EntityLink entityLink = MessageParser.EntityLink.parse(entityInfo);
          FeedRepository feedRepository = Entity.getFeedRepository();

          try {
            Thread existingTask =
                feedRepository.getTask(entityLink, TaskType.RequestApproval, TaskStatus.Open);
            if (existingTask != null) {
              CloseTask closeTask =
                  new CloseTask().withComment("Task auto-approved: " + autoApprovalReason);
              feedRepository.closeTaskWithoutWorkflow(existingTask, "system", closeTask);
              LOG.info(
                  "Closed orphaned task {} due to auto-approval: {}",
                  existingTask.getId(),
                  autoApprovalReason);
            }
          } catch (EntityNotFoundException e) {
            LOG.debug(
                "No existing approval task found for entity {}, proceeding with auto-approval",
                entityInfo);
          }
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
