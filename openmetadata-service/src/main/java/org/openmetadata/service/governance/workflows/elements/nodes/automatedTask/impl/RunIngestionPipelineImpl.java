package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl;

import static org.openmetadata.service.governance.workflows.Workflow.EXCEPTION_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.INGESTION_PIPELINE_ID_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.RESULT_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.WORKFLOW_RUNTIME_EXCEPTION;
import static org.openmetadata.service.governance.workflows.WorkflowHandler.getProcessDefinitionKeyFromId;
import static org.openmetadata.service.util.EntityUtil.Fields.EMPTY_FIELDS;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.BpmnError;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatusType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.OpenMetadataConnectionBuilder;

@Slf4j
public class RunIngestionPipelineImpl implements JavaDelegate {
  private Expression inputNamespaceMapExpr;
  private Expression pipelineServiceClientExpr;
  private Expression waitForCompletionExpr;
  private Expression timeoutSecondsExpr;

  @Override
  public void execute(DelegateExecution execution) {
    WorkflowVariableHandler varHandler = new WorkflowVariableHandler(execution);
    try {
      Map<String, String> inputNamespaceMap =
          JsonUtils.readOrConvertValue(inputNamespaceMapExpr.getValue(execution), Map.class);

      boolean waitForCompletion =
          Boolean.parseBoolean((String) waitForCompletionExpr.getValue(execution));
      long timeoutSeconds = Long.parseLong((String) timeoutSecondsExpr.getValue(execution));

      PipelineServiceClientInterface pipelineServiceClient =
          (PipelineServiceClientInterface) pipelineServiceClientExpr.getValue(execution);

      UUID ingestionPipelineId =
          (UUID)
              varHandler.getNamespacedVariable(
                  inputNamespaceMap.get(INGESTION_PIPELINE_ID_VARIABLE),
                  INGESTION_PIPELINE_ID_VARIABLE);

      IngestionPipelineRepository repository =
          (IngestionPipelineRepository) Entity.getEntityRepository(Entity.INGESTION_PIPELINE);
      OpenMetadataApplicationConfig config = repository.getOpenMetadataApplicationConfig();

      IngestionPipeline ingestionPipeline = repository.get(null, ingestionPipelineId, EMPTY_FIELDS);
      ingestionPipeline.setOpenMetadataServerConnection(
          new OpenMetadataConnectionBuilder(config).build());

      ServiceEntityInterface service =
          Entity.getEntity(ingestionPipeline.getService(), "", Include.NON_DELETED);
      // TODO: Currently using this for v0. We should change to actually pooling the pipeline to
      // check if it was deployed
      Thread.sleep(60 * 1000);
      pipelineServiceClient.runPipeline(ingestionPipeline, service);

      boolean success = true;
      if (waitForCompletion) {
        success = waitForIngestionPipeline(ingestionPipeline, repository, timeoutSeconds);
      }
      varHandler.setNodeVariable(RESULT_VARIABLE, success);
    } catch (Exception exc) {
      LOG.error(
          String.format(
              "[%s] Failure: ", getProcessDefinitionKeyFromId(execution.getProcessDefinitionId())),
          exc);
      varHandler.setGlobalVariable(EXCEPTION_VARIABLE, exc.toString());
      throw new BpmnError(WORKFLOW_RUNTIME_EXCEPTION, exc.getMessage());
    }
  }

  private boolean waitForIngestionPipeline(
      IngestionPipeline ingestionPipeline,
      IngestionPipelineRepository repository,
      long timeoutSeconds) {

    long startTimeMillis = System.currentTimeMillis();
    long timeoutMillis = timeoutSeconds * 1000;
    while (true) {
      if (System.currentTimeMillis() - startTimeMillis > timeoutMillis) {
        return false;
      }

      long FIVE_MINUTES_IN_MILLIS = 5 * 60 * 1000;
      List<PipelineStatus> statuses =
          repository
              .listPipelineStatus(
                  ingestionPipeline.getFullyQualifiedName(),
                  startTimeMillis - FIVE_MINUTES_IN_MILLIS,
                  startTimeMillis + timeoutMillis)
              .getData();

      if (statuses.isEmpty()) {
        continue;
      }

      PipelineStatus status = statuses.get(statuses.size() - 1);

      if (status.getPipelineState().equals(PipelineStatusType.FAILED)) {
        return false;
      } else if (status.getPipelineState().equals(PipelineStatusType.SUCCESS)
          || status.getPipelineState().equals(PipelineStatusType.PARTIAL_SUCCESS)) {
        return true;
      }
    }
  }
}
