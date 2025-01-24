package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl;

import static org.openmetadata.service.governance.workflows.Workflow.EXCEPTION_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.RESULT_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.WORKFLOW_RUNTIME_EXCEPTION;
import static org.openmetadata.service.governance.workflows.WorkflowHandler.getProcessDefinitionKeyFromId;
import static org.openmetadata.service.util.EntityUtil.Fields.EMPTY_FIELDS;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.BpmnError;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatusType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;
import org.openmetadata.service.util.JsonUtils;

@Slf4j
public class CheckIngestionPipelineSucceededImpl implements JavaDelegate {
  Expression varNameExpr;

  @Override
  public void execute(DelegateExecution execution) {
    try {
      String varName = (String) varNameExpr.getValue(execution);
      Map<String, Object> variables =
          JsonUtils.readOrConvertValue(execution.getVariable("variables"), Map.class);
      UUID ingestionPipelineId = UUID.fromString((String) variables.get(varName));

      IngestionPipelineRepository repository =
          (IngestionPipelineRepository) Entity.getEntityRepository(Entity.INGESTION_PIPELINE);
      IngestionPipeline ingestionPipeline = repository.get(null, ingestionPipelineId, EMPTY_FIELDS);

      long startTimeMillis = System.currentTimeMillis();
      long timeoutMillis = 60 * 60 * 60 * 1000; // 1 Hora
      while (true) {
        if (System.currentTimeMillis() - startTimeMillis > timeoutMillis) {
          execution.setVariable(RESULT_VARIABLE, false);
          break;
        }
        Optional<PipelineStatus> oStatus =
            Optional.ofNullable(repository.getLatestPipelineStatus(ingestionPipeline));

        if (oStatus.isEmpty()) {
          continue;
        }

        PipelineStatus status = oStatus.get();

        if (status.getPipelineState().equals(PipelineStatusType.FAILED)) {
          execution.setVariable(RESULT_VARIABLE, false);
          break;
        } else if (status.getPipelineState().equals(PipelineStatusType.SUCCESS)
            || status.getPipelineState().equals(PipelineStatusType.PARTIAL_SUCCESS)) {
          execution.setVariable(RESULT_VARIABLE, true);
          break;
        }
      }

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
