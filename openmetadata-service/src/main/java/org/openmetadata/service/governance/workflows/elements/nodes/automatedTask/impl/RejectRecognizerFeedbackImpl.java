package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl;

import static org.openmetadata.service.governance.workflows.Workflow.EXCEPTION_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.GLOBAL_NAMESPACE;
import static org.openmetadata.service.governance.workflows.Workflow.TRIGGERING_OBJECT_ID_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.UPDATED_BY_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.WORKFLOW_RUNTIME_EXCEPTION;
import static org.openmetadata.service.governance.workflows.WorkflowHandler.getProcessDefinitionKeyFromId;

import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.exception.ExceptionUtils;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.BpmnError;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.schema.type.RecognizerFeedback;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler;
import org.openmetadata.service.jdbi3.RecognizerFeedbackRepository;

@Slf4j
public class RejectRecognizerFeedbackImpl implements JavaDelegate {
  private Expression inputNamespaceMapExpr;

  @Override
  public void execute(DelegateExecution execution) {
    WorkflowVariableHandler varHandler = new WorkflowVariableHandler(execution);
    try {
      Map<String, Object> inputNamespaceMap =
          JsonUtils.readOrConvertValue(inputNamespaceMapExpr.getValue(execution), Map.class);

      UUID feedbackId =
          UUID.fromString(
              (String)
                  varHandler.getNamespacedVariable(
                      GLOBAL_NAMESPACE, TRIGGERING_OBJECT_ID_VARIABLE));

      String updatedByNamespace = (String) inputNamespaceMap.get(UPDATED_BY_VARIABLE);
      String reviewedBy = "governance-bot";
      if (updatedByNamespace != null) {
        String actualUser =
            (String) varHandler.getNamespacedVariable(updatedByNamespace, UPDATED_BY_VARIABLE);
        if (actualUser != null && !actualUser.isEmpty()) {
          reviewedBy = actualUser;
        }
      }

      String comment =
          (String) varHandler.getNamespacedVariable(GLOBAL_NAMESPACE, "rejectionComment");

      RecognizerFeedbackRepository repo =
          new RecognizerFeedbackRepository(Entity.getCollectionDAO());
      RecognizerFeedback feedback = repo.get(feedbackId);
      repo.rejectFeedback(feedback, reviewedBy, comment);

      LOG.info("Rejected RecognizerFeedback {} by {}", feedbackId, reviewedBy);

    } catch (Exception exc) {
      LOG.error(
          "[{}] Failure: ", getProcessDefinitionKeyFromId(execution.getProcessDefinitionId()), exc);
      varHandler.setGlobalVariable(EXCEPTION_VARIABLE, ExceptionUtils.getStackTrace(exc));
      throw new BpmnError(WORKFLOW_RUNTIME_EXCEPTION, exc.getMessage());
    }
  }
}
