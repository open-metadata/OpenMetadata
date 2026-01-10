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
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.RESULT_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.WORKFLOW_RUNTIME_EXCEPTION;
import static org.openmetadata.service.governance.workflows.WorkflowHandler.getProcessDefinitionKeyFromId;

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
 * <p>This delegate retrieves the appropriate sink provider from the registry, builds the context,
 * fetches the entity, and writes it to the sink destination.
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

      // Get entity from workflow context
      String relatedEntityNamespace = inputNamespaceMap.get(RELATED_ENTITY_VARIABLE);
      String relatedEntityValue =
          (String)
              varHandler.getNamespacedVariable(relatedEntityNamespace, RELATED_ENTITY_VARIABLE);

      MessageParser.EntityLink entityLink = MessageParser.EntityLink.parse(relatedEntityValue);
      EntityInterface entity = Entity.getEntity(entityLink, "*", Include.ALL);

      // Execute sink
      SinkResult result = sinkProvider.write(context, entity);

      // Set output variables
      varHandler.setNodeVariable("syncResult", JsonUtils.pojoToJson(result));
      varHandler.setNodeVariable("syncedCount", result.getSyncedCount());
      varHandler.setNodeVariable("failedCount", result.getFailedCount());
      varHandler.setNodeVariable(RESULT_VARIABLE, result.isSuccess() ? "success" : "failure");
      varHandler.setFailure(!result.isSuccess());

      LOG.info(
          "[{}] Sink operation completed: syncedCount={}, failedCount={}, success={}",
          getProcessDefinitionKeyFromId(execution.getProcessDefinitionId()),
          result.getSyncedCount(),
          result.getFailedCount(),
          result.isSuccess());

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
}
