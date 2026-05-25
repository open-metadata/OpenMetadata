/*
 *  Copyright 2024 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.sink;

import static org.openmetadata.service.governance.workflows.Workflow.EXCEPTION_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.RESULT_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.WORKFLOW_RUNTIME_EXCEPTION;
import static org.openmetadata.service.governance.workflows.WorkflowHandler.getProcessDefinitionKeyFromId;

import com.google.common.collect.Lists;
import io.github.resilience4j.retry.Retry;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.exception.ExceptionUtils;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.BpmnError;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.Workflow;
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler;

/**
 * Flowable delegate that executes sink operations within a workflow.
 *
 * <p>Always reads from {@code ENTITY_LIST_VARIABLE}. When {@code batchMode=true} and the sink
 * provider supports batching, all entities are written in a single batch call. Otherwise each
 * entity is written individually.
 */
@Slf4j
public class SinkTaskDelegate implements JavaDelegate {

  /**
   * Maximum number of entities to fetch in memory at once during batch processing. This prevents
   * OOM issues when processing very large entity lists.
   */
  private static final int MAX_ENTITIES_PER_FETCH_BATCH = 100;

  private Expression sinkTypeExpr;
  private Expression sinkConfigExpr;
  private Expression syncModeExpr;
  private Expression outputFormatExpr;
  private Expression hierarchyConfigExpr;
  private Expression entityFilterExpr;
  private Expression batchModeExpr;
  private Expression timeoutSecondsExpr;
  private Expression inputNamespaceMapExpr;

  @Override
  public void execute(DelegateExecution execution) {
    WorkflowVariableHandler varHandler = new WorkflowVariableHandler(execution);
    SinkProvider sinkProvider = null;

    try {
      String sinkType = (String) sinkTypeExpr.getValue(execution);
      Object sinkConfig =
          JsonUtils.readOrConvertValue(sinkConfigExpr.getValue(execution), Object.class);
      String syncMode = (String) syncModeExpr.getValue(execution);
      String outputFormat = (String) outputFormatExpr.getValue(execution);
      Object hierarchyConfig =
          JsonUtils.readOrConvertValue(hierarchyConfigExpr.getValue(execution), Object.class);
      Object entityFilter =
          JsonUtils.readOrConvertValue(entityFilterExpr.getValue(execution), Object.class);
      boolean batchMode = Boolean.parseBoolean((String) batchModeExpr.getValue(execution));
      int timeoutSeconds =
          timeoutSecondsExpr != null
              ? Integer.parseInt((String) timeoutSecondsExpr.getValue(execution))
              : 300; // Default 5 minutes

      Map<String, String> inputNamespaceMap =
          JsonUtils.readOrConvertValue(inputNamespaceMapExpr.getValue(execution), Map.class);

      List<String> entityList =
          WorkflowVariableHandler.getEntityList(inputNamespaceMap, varHandler);

      // Get the sink provider from registry
      sinkProvider =
          SinkProviderRegistry.getInstance()
              .create(sinkType, sinkConfig)
              .orElseThrow(
                  () ->
                      new IllegalArgumentException(
                          "No sink provider registered for type: " + sinkType));

      // Validate the configuration
      sinkProvider.validate(sinkConfig);

      // Build sink context
      SinkContext context =
          SinkContext.builder()
              .sinkConfig(sinkConfig)
              .syncMode(syncMode)
              .outputFormat(outputFormat)
              .hierarchyConfig(hierarchyConfig)
              .entityFilter(entityFilter)
              .batchMode(batchMode)
              .timeoutSeconds(timeoutSeconds)
              .workflowExecutionId(execution.getProcessInstanceId())
              .workflowName(getProcessDefinitionKeyFromId(execution.getProcessDefinitionId()))
              .build();

      SinkResult result;

      if (batchMode && !entityList.isEmpty() && sinkProvider.supportsBatch()) {
        result = executeBatchMode(context, sinkProvider, entityList);
      } else {
        result = executeListMode(context, sinkProvider, entityList);
      }

      // Set output variables
      varHandler.setNodeVariable("syncResult", JsonUtils.pojoToJson(result));
      varHandler.setNodeVariable("syncedCount", result.getSyncedCount());
      varHandler.setNodeVariable("failedCount", result.getFailedCount());
      varHandler.setNodeVariable(RESULT_VARIABLE, result.isSuccess() ? "success" : "failure");
      varHandler.setFailure(!result.isSuccess());

      LOG.info(
          "[{}] Sink operation completed: syncedCount={}, failedCount={}, success={}, batchMode={}",
          getProcessDefinitionKeyFromId(execution.getProcessDefinitionId()),
          result.getSyncedCount(),
          result.getFailedCount(),
          result.isSuccess(),
          batchMode && entityList != null);

    } catch (Exception exc) {
      LOG.error(
          "[{}] Sink operation failed: ",
          getProcessDefinitionKeyFromId(execution.getProcessDefinitionId()),
          exc);
      varHandler.setGlobalVariable(EXCEPTION_VARIABLE, ExceptionUtils.getStackTrace(exc));
      throw new BpmnError(WORKFLOW_RUNTIME_EXCEPTION, exc.getMessage());
    } finally {
      if (sinkProvider != null) {
        try {
          sinkProvider.close();
        } catch (Exception e) {
          LOG.warn("Error closing sink provider", e);
        }
      }
    }
  }

  /**
   * Execute sink in batch mode - process entities in sub-batches to prevent OOM.
   *
   * <p>Entities are fetched and processed in chunks of {@link #MAX_ENTITIES_PER_FETCH_BATCH} to
   * avoid loading all entities into memory at once when dealing with very large entity lists.
   */
  private SinkResult executeBatchMode(
      SinkContext context, SinkProvider sinkProvider, List<String> entityLinks) {

    LOG.info(
        "[{}] Executing batch sink for {} entities (batch size: {})",
        context.getWorkflowName(),
        entityLinks.size(),
        MAX_ENTITIES_PER_FETCH_BATCH);

    // Accumulator for aggregating results across sub-batches
    record BatchAccumulator(
        int syncedCount,
        int failedCount,
        List<String> syncedEntities,
        List<SinkResult.SinkError> errors,
        boolean success) {

      static BatchAccumulator empty() {
        return new BatchAccumulator(0, 0, new ArrayList<>(), new ArrayList<>(), true);
      }

      BatchAccumulator merge(SinkResult result, List<SinkResult.SinkError> fetchErrors) {
        List<String> mergedSynced = new ArrayList<>(syncedEntities);
        List<SinkResult.SinkError> mergedErrors = new ArrayList<>(errors);

        if (result.getSyncedEntities() != null) mergedSynced.addAll(result.getSyncedEntities());
        if (result.getErrors() != null) mergedErrors.addAll(result.getErrors());
        mergedErrors.addAll(fetchErrors);

        return new BatchAccumulator(
            syncedCount + result.getSyncedCount(),
            failedCount + result.getFailedCount() + fetchErrors.size(),
            mergedSynced,
            mergedErrors,
            success && result.isSuccess() && fetchErrors.isEmpty());
      }
    }

    Retry batchFetchRetry = Retry.of("sink-batch-fetch", Workflow.TASK_RETRY_CONFIG);

    // Process entities in sub-batches using Guava's partition
    BatchAccumulator result =
        Lists.partition(entityLinks, MAX_ENTITIES_PER_FETCH_BATCH).stream()
            .reduce(
                BatchAccumulator.empty(),
                (acc, subBatch) -> {
                  LOG.debug(
                      "[{}] Processing sub-batch of {} entities",
                      context.getWorkflowName(),
                      subBatch.size());

                  // Fetch entities for this sub-batch in a single batch query
                  List<SinkResult.SinkError> fetchErrors = new ArrayList<>();
                  Map<String, EntityInterface> entityMap;
                  try {
                    entityMap =
                        Retry.decorateSupplier(
                                batchFetchRetry,
                                () -> Entity.getEntitiesByLinks(subBatch, "*", Include.ALL))
                            .get();
                  } catch (Exception e) {
                    LOG.error(
                        "Failed to batch fetch sub-batch of {} entities after retries",
                        subBatch.size(),
                        e);
                    entityMap = Map.of();
                  }
                  List<EntityInterface> entities = new ArrayList<>();
                  for (String entityLinkStr : subBatch) {
                    EntityInterface entity = entityMap.get(entityLinkStr);
                    if (entity != null) {
                      entities.add(entity);
                    } else {
                      fetchErrors.add(
                          SinkResult.SinkError.builder()
                              .entityFqn(entityLinkStr)
                              .errorMessage("Failed to fetch entity")
                              .build());
                    }
                  }

                  if (entities.isEmpty()) {
                    return acc.merge(
                        SinkResult.builder()
                            .success(fetchErrors.isEmpty())
                            .syncedCount(0)
                            .failedCount(0)
                            .build(),
                        fetchErrors);
                  }

                  // Execute batch write for this sub-batch
                  return acc.merge(sinkProvider.writeBatch(context, entities), fetchErrors);
                },
                (a, b) -> a); // Sequential stream, combiner not used

    return SinkResult.builder()
        .success(result.success())
        .syncedCount(result.syncedCount())
        .failedCount(result.failedCount())
        .syncedEntities(result.syncedEntities())
        .errors(result.errors().isEmpty() ? null : result.errors())
        .build();
  }

  private SinkResult executeListMode(
      SinkContext context, SinkProvider sinkProvider, List<String> entityList) {
    int syncedCount = 0;
    int failedCount = 0;
    List<String> syncedEntities = new ArrayList<>();
    List<SinkResult.SinkError> errors = new ArrayList<>();

    Map<String, EntityInterface> entityMap;
    try {
      entityMap =
          Retry.decorateSupplier(
                  Retry.of("sink-list-fetch", Workflow.TASK_RETRY_CONFIG),
                  () -> Entity.getEntitiesByLinks(entityList, "*", Include.ALL))
              .get();
    } catch (Exception e) {
      LOG.error(
          "[{}] Batch fetch failed for {} entities after retries",
          context.getWorkflowName(),
          entityList.size(),
          e);
      entityMap = Map.of();
    }

    Retry retry = Retry.of("sink-list-write", Workflow.TASK_RETRY_CONFIG);

    for (String entityLinkStr : entityList) {
      EntityInterface entity = entityMap.get(entityLinkStr);
      if (entity == null) {
        LOG.error("[{}] Failed to fetch entity: {}", context.getWorkflowName(), entityLinkStr);
        failedCount++;
        errors.add(
            SinkResult.SinkError.builder()
                .entityFqn(entityLinkStr)
                .errorMessage("Failed to fetch entity")
                .build());
        continue;
      }
      try {
        SinkResult entityResult =
            Retry.decorateSupplier(retry, () -> sinkProvider.write(context, entity)).get();
        syncedCount += entityResult.getSyncedCount();
        failedCount += entityResult.getFailedCount();
        if (entityResult.getSyncedEntities() != null) {
          syncedEntities.addAll(entityResult.getSyncedEntities());
        }
        if (entityResult.getErrors() != null) {
          errors.addAll(entityResult.getErrors());
        }
      } catch (Exception e) {
        LOG.error("[{}] Failed to process entity: {}", context.getWorkflowName(), entityLinkStr, e);
        failedCount++;
        errors.add(
            SinkResult.SinkError.builder()
                .entityFqn(entity.getFullyQualifiedName())
                .errorMessage("Failed to process entity: " + e.getMessage())
                .cause(e)
                .build());
      }
    }

    return SinkResult.builder()
        .success(failedCount == 0)
        .syncedCount(syncedCount)
        .failedCount(failedCount)
        .syncedEntities(syncedEntities.isEmpty() ? null : syncedEntities)
        .errors(errors.isEmpty() ? null : errors)
        .build();
  }
}
