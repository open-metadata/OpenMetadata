package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.runApp;

import static org.openmetadata.service.governance.workflows.Workflow.EXCEPTION_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.RESULT_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.WORKFLOW_RUNTIME_EXCEPTION;
import static org.openmetadata.service.governance.workflows.WorkflowHandler.getProcessDefinitionKeyFromId;

import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang.exception.ExceptionUtils;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.BpmnError;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler;
import org.openmetadata.service.resources.feeds.MessageParser;

@Slf4j
public class RunAppDelegate implements JavaDelegate {
  private Expression inputNamespaceMapExpr;
  private Expression pipelineServiceClientExpr;
  private Expression appNameExpr;
  private Expression waitForCompletionExpr;
  private Expression timeoutSecondsExpr;

  @Override
  public void execute(DelegateExecution execution) {
    WorkflowVariableHandler varHandler = new WorkflowVariableHandler(execution);
    try {
      Map<String, String> inputNamespaceMap =
          JsonUtils.readOrConvertValue(inputNamespaceMapExpr.getValue(execution), Map.class);

      String appName = (String) appNameExpr.getValue(execution);
      boolean waitForCompletion =
          Boolean.parseBoolean((String) waitForCompletionExpr.getValue(execution));
      long timeoutSeconds = Long.parseLong((String) timeoutSecondsExpr.getValue(execution));

      PipelineServiceClientInterface pipelineServiceClient =
          (PipelineServiceClientInterface) pipelineServiceClientExpr.getValue(execution);

      MessageParser.EntityLink entityLink =
          MessageParser.EntityLink.parse(
              (String)
                  varHandler.getNamespacedVariable(
                      inputNamespaceMap.get(RELATED_ENTITY_VARIABLE), RELATED_ENTITY_VARIABLE));

      boolean wasSuccessful =
          new RunAppImpl()
              .execute(
                  pipelineServiceClient, appName, waitForCompletion, timeoutSeconds, entityLink);

      varHandler.setNodeVariable(RESULT_VARIABLE, getResultValue(wasSuccessful));
      varHandler.setFailure(!wasSuccessful);
    } catch (Exception exc) {
      LOG.error(
          String.format(
              "[%s] Failure: ", getProcessDefinitionKeyFromId(execution.getProcessDefinitionId())),
          exc);
      varHandler.setGlobalVariable(EXCEPTION_VARIABLE, ExceptionUtils.getStackTrace(exc));
      throw new BpmnError(WORKFLOW_RUNTIME_EXCEPTION, exc.getMessage());
    }
  }

  private String getResultValue(boolean result) {
    if (result) {
      return "success";
    } else {
      return "failure";
    }
  }
}
