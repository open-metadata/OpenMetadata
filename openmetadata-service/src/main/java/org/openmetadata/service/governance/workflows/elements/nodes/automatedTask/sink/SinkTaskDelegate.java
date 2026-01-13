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

import static org.openmetadata.service.governance.workflows.Workflow.BATCH_SINK_PROCESSED_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.ENTITY_LIST_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.EXCEPTION_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.GLOBAL_NAMESPACE;
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.RESULT_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.WORKFLOW_RUNTIME_EXCEPTION;
import static org.openmetadata.service.governance.workflows.WorkflowHandler.getProcessDefinitionKeyFromId;

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
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler;
import org.openmetadata.service.resources.feeds.MessageParser;

/**
 * Flowable delegate that executes sink operations within a workflow.
 *
 * <p>This delegate supports two modes:
 * <ul>
 *   <li><b>Single entity mode:</b> Processes one entity at a time (event-based workflows)</li>
 *   <li><b>Batch mode:</b> Processes all entities in the batch at once (periodic batch workflows)</li>
 * </ul>
 *
 * <p>In batch mode, this delegate will process all entities on the first invocation and skip
 * subsequent invocations within the same batch loop.
 */
@Slf4j
public class SinkTaskDelegate implements JavaDelegate {

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

      Map<String, String> inputNamespaceMap =
          JsonUtils.readOrConvertValue(inputNamespaceMapExpr.getValue(execution), Map.class);

      // Check if we have an entity list for batch processing
      String entityListNamespace = inputNamespaceMap.get(ENTITY_LIST_VARIABLE);
      List<String> entityList = null;
      if (entityListNamespace != null) {
        Object entityListObj =
            varHandler.getNamespacedVariable(entityListNamespace, ENTITY_LIST_VARIABLE);
        if (entityListObj instanceof List) {
          entityList = (List<String>) entityListObj;
        }
      }

      // Check if batch sink has already been processed in this batch loop
      Boolean batchProcessed =
          (Boolean)
              varHandler.getNamespacedVariable(GLOBAL_NAMESPACE, BATCH_SINK_PROCESSED_VARIABLE);
      if (batchMode && entityList != null && Boolean.TRUE.equals(batchProcessed)) {
        LOG.info(
            "[{}] Batch sink already processed, skipping this iteration",
            getProcessDefinitionKeyFromId(execution.getProcessDefinitionId()));
        varHandler.setNodeVariable(RESULT_VARIABLE, "success");
        varHandler.setNodeVariable("syncedCount", 0);
        varHandler.setNodeVariable("failedCount", 0);
        varHandler.setNodeVariable("syncResult", "{}");
        varHandler.setFailure(false);
        return;
      }

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
              .workflowExecutionId(execution.getProcessInstanceId())
              .workflowName(getProcessDefinitionKeyFromId(execution.getProcessDefinitionId()))
              .build();

      SinkResult result;

      // Determine execution mode: batch or single entity
      if (batchMode
          && entityList != null
          && !entityList.isEmpty()
          && sinkProvider.supportsBatch()) {
        // Batch mode: process all entities at once
        result = executeBatchMode(context, sinkProvider, entityList, varHandler);
      } else {
        // Single entity mode: process one entity
        result = executeSingleEntityMode(context, sinkProvider, inputNamespaceMap, varHandler);
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
   * Execute sink in batch mode - process all entities from the entity list at once.
   */
  private SinkResult executeBatchMode(
      SinkContext context,
      SinkProvider sinkProvider,
      List<String> entityLinks,
      WorkflowVariableHandler varHandler) {

    LOG.info(
        "[{}] Executing batch sink for {} entities", context.getWorkflowName(), entityLinks.size());

    // Fetch all entities with full metadata (fields=*)
    List<EntityInterface> entities = new ArrayList<>();
    List<SinkResult.SinkError> fetchErrors = new ArrayList<>();

    for (String entityLinkStr : entityLinks) {
      try {
        MessageParser.EntityLink entityLink = MessageParser.EntityLink.parse(entityLinkStr);
        EntityInterface entity = Entity.getEntity(entityLink, "*", Include.ALL);
        entities.add(entity);
      } catch (Exception e) {
        LOG.error("Failed to fetch entity: {}", entityLinkStr, e);
        fetchErrors.add(
            SinkResult.SinkError.builder()
                .entityFqn(entityLinkStr)
                .errorMessage("Failed to fetch entity: " + e.getMessage())
                .cause(e)
                .build());
      }
    }

    if (entities.isEmpty()) {
      return SinkResult.builder()
          .success(fetchErrors.isEmpty())
          .syncedCount(0)
          .failedCount(fetchErrors.size())
          .errors(fetchErrors)
          .build();
    }

    // Execute batch write
    SinkResult result = sinkProvider.writeBatch(context, entities);

    // Merge any fetch errors with write errors
    if (!fetchErrors.isEmpty()) {
      List<SinkResult.SinkError> allErrors = new ArrayList<>(fetchErrors);
      if (result.getErrors() != null) {
        allErrors.addAll(result.getErrors());
      }
      result =
          SinkResult.builder()
              .success(result.isSuccess() && fetchErrors.isEmpty())
              .syncedCount(result.getSyncedCount())
              .failedCount(result.getFailedCount() + fetchErrors.size())
              .syncedEntities(result.getSyncedEntities())
              .errors(allErrors)
              .metadata(result.getMetadata())
              .build();
    }

    // Mark batch as processed to skip subsequent iterations in the multi-instance loop
    varHandler.setGlobalVariable(BATCH_SINK_PROCESSED_VARIABLE, true);

    return result;
  }

  /**
   * Execute sink in single entity mode - process one entity at a time.
   */
  private SinkResult executeSingleEntityMode(
      SinkContext context,
      SinkProvider sinkProvider,
      Map<String, String> inputNamespaceMap,
      WorkflowVariableHandler varHandler) {

    // Get entity from workflow context
    String relatedEntityNamespace = inputNamespaceMap.get(RELATED_ENTITY_VARIABLE);
    String relatedEntityValue =
        (String) varHandler.getNamespacedVariable(relatedEntityNamespace, RELATED_ENTITY_VARIABLE);

    MessageParser.EntityLink entityLink = MessageParser.EntityLink.parse(relatedEntityValue);
    EntityInterface entity = Entity.getEntity(entityLink, "*", Include.ALL);

    LOG.info(
        "[{}] Executing single entity sink for: {}",
        context.getWorkflowName(),
        entity.getFullyQualifiedName());

    // Execute single entity write
    return sinkProvider.write(context, entity);
  }
}
