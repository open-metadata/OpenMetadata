package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.createAndRunIngestionPipeline;

import static org.openmetadata.service.governance.workflows.Workflow.EXCEPTION_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.INGESTION_PIPELINE_ID_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.RESULT_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.WORKFLOW_RUNTIME_EXCEPTION;
import static org.openmetadata.service.governance.workflows.Workflow.getResultFromBoolean;
import static org.openmetadata.service.governance.workflows.WorkflowHandler.getProcessDefinitionKeyFromId;

import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang.exception.ExceptionUtils;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.BpmnError;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler;

@Slf4j
public class RunIngestionPipelineDelegate implements JavaDelegate {
  private Expression inputNamespaceMapExpr;
  private Expression pipelineServiceClientExpr;
  private Expression shouldRunExpr;
  private Expression waitForCompletionExpr;
  private Expression timeoutSecondsExpr;

  @Override
  public void execute(DelegateExecution execution) {
    WorkflowVariableHandler varHandler = new WorkflowVariableHandler(execution);
    try {
      Map<String, String> inputNamespaceMap =
          JsonUtils.readOrConvertValue(inputNamespaceMapExpr.getValue(execution), Map.class);

      boolean shouldRun = Boolean.parseBoolean((String) shouldRunExpr.getValue(execution));

      boolean waitForCompletion =
          Boolean.parseBoolean((String) waitForCompletionExpr.getValue(execution));
      long timeoutSeconds = Long.parseLong((String) timeoutSecondsExpr.getValue(execution));

      boolean result = true;

      if (shouldRun) {
        PipelineServiceClientInterface pipelineServiceClient =
            (PipelineServiceClientInterface) pipelineServiceClientExpr.getValue(execution);

        UUID ingestionPipelineId =
            (UUID) varHandler.getNodeVariable(INGESTION_PIPELINE_ID_VARIABLE);

        result =
            new RunIngestionPipelineImpl(pipelineServiceClient)
                .execute(ingestionPipelineId, waitForCompletion, timeoutSeconds);
      }

      varHandler.setNodeVariable(RESULT_VARIABLE, getResultFromBoolean(result));
      if (!result) {
        varHandler.setFailure(true);
      }
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
