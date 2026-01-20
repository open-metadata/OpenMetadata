package org.openmetadata.service.governance.workflows.elements.nodes.userTask.impl;

import static org.openmetadata.service.governance.workflows.Workflow.EXCEPTION_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.TRIGGERING_OBJECT_ID_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.WORKFLOW_RUNTIME_EXCEPTION;
import static org.openmetadata.service.governance.workflows.WorkflowHandler.getProcessDefinitionKeyFromId;

import com.fasterxml.jackson.core.type.TypeReference;
import java.util.List;
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
public class CheckFeedbackSubmitterIsReviewerImpl implements JavaDelegate {
  private Expression inputNamespaceMapExpr;
  private Expression assigneesVarNameExpr;

  @Override
  public void execute(DelegateExecution execution) {
    WorkflowVariableHandler varHandler = new WorkflowVariableHandler(execution);
    try {
      Map<String, String> inputNamespaceMap =
          JsonUtils.readOrConvertValue(inputNamespaceMapExpr.getValue(execution), Map.class);

      UUID feedbackId =
          UUID.fromString(
              (String)
                  varHandler.getNamespacedVariable(
                      inputNamespaceMap.get(TRIGGERING_OBJECT_ID_VARIABLE),
                      TRIGGERING_OBJECT_ID_VARIABLE));

      RecognizerFeedbackRepository feedbackRepository =
          new RecognizerFeedbackRepository(Entity.getCollectionDAO());
      RecognizerFeedback feedback = feedbackRepository.get(feedbackId);

      String assigneesVarName = assigneesVarNameExpr.getValue(execution).toString();
      String assigneesJson = (String) execution.getVariable(assigneesVarName);
      List<String> assignees =
          JsonUtils.readValue(assigneesJson, new TypeReference<List<String>>() {});

      boolean submitterIsReviewer = false;

      if (feedback.getCreatedBy() != null && assignees != null && !assignees.isEmpty()) {
        String submitterFqn = feedback.getCreatedBy().getFullyQualifiedName();

        for (String assigneeLink : assignees) {
          if (assigneeLink.contains(submitterFqn)) {
            submitterIsReviewer = true;
            LOG.info(
                "Feedback submitter {} is a reviewer, auto-approving for process instance {}",
                submitterFqn,
                execution.getProcessInstanceId());
            break;
          }
        }
      }

      execution.setVariable("submitterIsReviewer", submitterIsReviewer);

      LOG.debug(
          "Set submitterIsReviewer={} for process instance {}",
          submitterIsReviewer,
          execution.getProcessInstanceId());
    } catch (Exception exc) {
      LOG.error(
          String.format(
              "[%s] Failure: ", getProcessDefinitionKeyFromId(execution.getProcessDefinitionId())),
          exc);
      varHandler.setGlobalVariable(EXCEPTION_VARIABLE, ExceptionUtils.getStackTrace(exc));
      throw new BpmnError(WORKFLOW_RUNTIME_EXCEPTION, exc.getMessage());
    }
  }
}
