package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.createAndRunIngestionPipeline;

import static org.openmetadata.service.governance.workflows.Workflow.EXCEPTION_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.INGESTION_PIPELINE_ID_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.RESULT_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.WORKFLOW_RUNTIME_EXCEPTION;
import static org.openmetadata.service.governance.workflows.Workflow.getResultFromBoolean;
import static org.openmetadata.service.governance.workflows.WorkflowHandler.getProcessDefinitionKeyFromId;

import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang.exception.ExceptionUtils;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.BpmnError;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.resources.services.ingestionpipelines.IngestionPipelineMapper;

@Slf4j
public class CreateIngestionPipelineDelegate implements JavaDelegate {
  private Expression pipelineTypeExpr;
  private Expression deployExpr;
  private Expression inputNamespaceMapExpr;
  private Expression ingestionPipelineMapperExpr;
  private Expression pipelineServiceClientExpr;

  @Override
  public void execute(DelegateExecution execution) {
    WorkflowVariableHandler varHandler = new WorkflowVariableHandler(execution);
    try {
      Map<String, String> inputNamespaceMap =
          JsonUtils.readOrConvertValue(inputNamespaceMapExpr.getValue(execution), Map.class);

      PipelineType pipelineType =
          PipelineType.fromValue((String) pipelineTypeExpr.getValue(execution));
      boolean deploy = Boolean.parseBoolean((String) deployExpr.getValue(execution));
      IngestionPipelineMapper mapper =
          (IngestionPipelineMapper) ingestionPipelineMapperExpr.getValue(execution);
      PipelineServiceClientInterface pipelineServiceClient =
          (PipelineServiceClientInterface) pipelineServiceClientExpr.getValue(execution);

      MessageParser.EntityLink entityLink =
          MessageParser.EntityLink.parse(
              (String)
                  varHandler.getNamespacedVariable(
                      inputNamespaceMap.get(RELATED_ENTITY_VARIABLE), RELATED_ENTITY_VARIABLE));

      ServiceEntityInterface service = Entity.getEntity(entityLink, "owners", Include.NON_DELETED);

      CreateIngestionPipelineImpl.CreateIngestionPipelineResult result =
          new CreateIngestionPipelineImpl(mapper, pipelineServiceClient)
              .execute(service, pipelineType, deploy);

      varHandler.setNodeVariable(RESULT_VARIABLE, getResultFromBoolean(result.isSuccessful()));
      varHandler.setNodeVariable(INGESTION_PIPELINE_ID_VARIABLE, result.getIngestionPipelineId());

      if (!result.isSuccessful()) {
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
