package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl;

import static org.openmetadata.service.governance.workflows.Workflow.EXCEPTION_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.WORKFLOW_RUNTIME_EXCEPTION;
import static org.openmetadata.service.governance.workflows.WorkflowHandler.getProcessDefinitionKeyFromId;
import static org.openmetadata.service.util.EntityUtil.Fields.EMPTY_FIELDS;

import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.flowable.engine.delegate.BpmnError;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.type.Include;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.clients.pipeline.PipelineServiceClientFactory;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;
import org.openmetadata.service.util.OpenMetadataConnectionBuilder;

@Slf4j
public class TriggerIngestionPipelineImpl implements JavaDelegate {
  @Override
  public void execute(DelegateExecution execution) {
    try {
      UUID ingestionPipelineId =
          UUID.fromString((String) execution.getVariable("ingestionPipelineId"));

      IngestionPipelineRepository repository =
          (IngestionPipelineRepository) Entity.getEntityRepository(Entity.INGESTION_PIPELINE);
      OpenMetadataApplicationConfig config = repository.getOpenMetadataApplicationConfig();
      IngestionPipeline ingestionPipeline = repository.get(null, ingestionPipelineId, EMPTY_FIELDS);
      ingestionPipeline.setOpenMetadataServerConnection(
          new OpenMetadataConnectionBuilder(config).build());

      ServiceEntityInterface service =
          Entity.getEntity(ingestionPipeline.getService(), "", Include.NON_DELETED);

      PipelineServiceClientInterface pipelineServiceClient =
          PipelineServiceClientFactory.createPipelineServiceClient(
              config.getPipelineServiceClientConfiguration());
      pipelineServiceClient.runPipeline(ingestionPipeline, service);
    } catch (Exception exc) {
      LOG.error(
          String.format(
              "[%s] Failure: ", getProcessDefinitionKeyFromId(execution.getProcessDefinitionId())),
          exc);
      execution.setVariable(EXCEPTION_VARIABLE, exc.toString());
      throw new BpmnError(WORKFLOW_RUNTIME_EXCEPTION, exc.getMessage());
    }
  }
}
