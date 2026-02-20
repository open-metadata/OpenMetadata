package org.openmetadata.service.governance.workflows.elements.nodes.userTask.impl;

import static org.openmetadata.service.governance.workflows.Workflow.EXCEPTION_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.RECOGNIZER_FEEDBACK;
import static org.openmetadata.service.governance.workflows.Workflow.WORKFLOW_RUNTIME_EXCEPTION;
import static org.openmetadata.service.governance.workflows.WorkflowHandler.getProcessDefinitionKeyFromId;

import com.fasterxml.jackson.core.type.TypeReference;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.exception.ExceptionUtils;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.BpmnError;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.schema.type.RecognizerFeedback;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler;

@Slf4j
public class CheckFeedbackSubmitterIsReviewerImpl implements JavaDelegate {
  private Expression inputNamespaceMapExpr;
  private Expression assigneesVarNameExpr;

  @Override
  public void execute(DelegateExecution execution) {
    LOG.debug(
        "[Process: {}] Checking if feedback submitter is reviewer",
        execution.getProcessInstanceId());
    WorkflowVariableHandler varHandler = new WorkflowVariableHandler(execution);
    try {
      Map<String, String> inputNamespaceMap =
          JsonUtils.readOrConvertValue(inputNamespaceMapExpr.getValue(execution), Map.class);

      String feedbackJson =
          (String)
              varHandler.getNamespacedVariable(
                  inputNamespaceMap.get(RECOGNIZER_FEEDBACK), RECOGNIZER_FEEDBACK);
      RecognizerFeedback feedback = JsonUtils.readValue(feedbackJson, RecognizerFeedback.class);

      String assigneesVarName = assigneesVarNameExpr.getValue(execution).toString();
      String assigneesJson = (String) execution.getVariable(assigneesVarName);
      List<String> assignees =
          JsonUtils.readValue(assigneesJson, new TypeReference<List<String>>() {});

      LOG.debug(
          "[Process: {}] Feedback entity: {}",
          execution.getProcessInstanceId(),
          feedback.getEntityLink());
      LOG.debug(
          "[Process: {}] Feedback tag: {}", execution.getProcessInstanceId(), feedback.getTagFQN());
      LOG.debug(
          "[Process: {}] Feedback created by: {}",
          execution.getProcessInstanceId(),
          feedback.getCreatedBy());
      LOG.debug(
          "[Process: {}] Assignees: {}",
          execution.getProcessInstanceId(),
          assignees != null ? assignees.toString() : "None");

      boolean submitterIsReviewer = false;

      if (feedback.getCreatedBy() != null && assignees != null && !assignees.isEmpty()) {
        String submitterFqn = feedback.getCreatedBy().getFullyQualifiedName();

        for (String assigneeLink : assignees) {
          if (assigneeLink.contains(submitterFqn)) {
            submitterIsReviewer = true;
            LOG.debug(
                "Feedback submitter {} is a reviewer, auto-approving for process instance {}",
                submitterFqn,
                execution.getProcessInstanceId());
            break;
          }
        }
      }

      execution.setVariable("submitterIsReviewer", submitterIsReviewer);

      LOG.debug(
          "[Process: {}] ✓ Set submitterIsReviewer={}, flow will {}",
          execution.getProcessInstanceId(),
          submitterIsReviewer,
          submitterIsReviewer ? "AUTO-APPROVE" : "continue to assignee check");
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
