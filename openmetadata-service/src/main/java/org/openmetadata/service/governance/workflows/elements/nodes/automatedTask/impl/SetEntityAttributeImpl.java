package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl;

import static org.openmetadata.service.governance.workflows.Workflow.EXCEPTION_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.UPDATED_BY_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.WORKFLOW_RUNTIME_EXCEPTION;
import static org.openmetadata.service.governance.workflows.WorkflowHandler.getProcessDefinitionKeyFromId;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
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
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.resources.feeds.MessageParser;
import org.openmetadata.service.util.EntityFieldUtils;

@Slf4j
public class SetEntityAttributeImpl implements JavaDelegate {
  private Expression fieldNameExpr;
  private Expression fieldValueExpr;
  private Expression inputNamespaceMapExpr;

  private record BatchContext(
      String entityType,
      String fieldName,
      String fieldValue,
      String userName,
      String impersonatedBy) {}

  @Override
  public void execute(DelegateExecution execution) {
    WorkflowVariableHandler varHandler = new WorkflowVariableHandler(execution);
    try {
      executeInternal(execution, varHandler);
    } catch (Exception exc) {
      LOG.error(
          "[{}] Failure: ", getProcessDefinitionKeyFromId(execution.getProcessDefinitionId()), exc);
      varHandler.setGlobalVariable(EXCEPTION_VARIABLE, ExceptionUtils.getStackTrace(exc));
      throw new BpmnError(WORKFLOW_RUNTIME_EXCEPTION, exc.getMessage());
    }
  }

  private void executeInternal(DelegateExecution execution, WorkflowVariableHandler varHandler)
      throws Exception {
    Map<String, Object> inputNamespaceMap =
        JsonUtils.readOrConvertValue(inputNamespaceMapExpr.getValue(execution), Map.class);
    List<String> entityLinks = WorkflowVariableHandler.getEntityList(inputNamespaceMap, varHandler);
    if (entityLinks.isEmpty()) {
      return;
    }
    BatchContext ctx = buildBatchContext(execution, varHandler, inputNamespaceMap, entityLinks);
    processBatch(entityLinks, ctx);
  }

  private BatchContext buildBatchContext(
      DelegateExecution execution,
      WorkflowVariableHandler varHandler,
      Map<String, Object> inputNamespaceMap,
      List<String> entityLinks) {
    String fieldName = fieldNameExpr != null ? (String) fieldNameExpr.getValue(execution) : "";
    String fieldValue = resolveFieldValue(execution);
    String actualUser = resolveActualUser(varHandler, inputNamespaceMap);
    String userName = (actualUser != null && !actualUser.isEmpty()) ? actualUser : "governance-bot";
    String impersonatedBy = (actualUser != null && !actualUser.isEmpty()) ? "governance-bot" : null;
    String entityType = MessageParser.EntityLink.parse(entityLinks.get(0)).getEntityType();
    return new BatchContext(entityType, fieldName, fieldValue, userName, impersonatedBy);
  }

  private void processBatch(List<String> entityLinks, BatchContext ctx) throws Exception {
    @SuppressWarnings("unchecked")
    EntityRepository<EntityInterface> repo =
        (EntityRepository<EntityInterface>) Entity.getEntityRepository(ctx.entityType());
    Map<String, EntityInterface> loadedByLink =
        Entity.getEntitiesByLinks(entityLinks, "*", Include.ALL);
    Map<String, EntityInterface> existingByFqn = new LinkedHashMap<>();
    for (EntityInterface entity : loadedByLink.values()) {
      existingByFqn.put(entity.getFullyQualifiedName(), entity);
    }
    List<EntityInterface> modified = new ArrayList<>();
    for (EntityInterface entity : existingByFqn.values()) {
      @SuppressWarnings("unchecked")
      EntityInterface copy = JsonUtils.deepCopy(entity, (Class<EntityInterface>) entity.getClass());
      EntityFieldUtils.setEntityField(
          copy,
          ctx.entityType(),
          ctx.userName(),
          ctx.fieldName(),
          ctx.fieldValue(),
          false,
          ctx.impersonatedBy());
      modified.add(copy);
    }
    repo.bulkUpdateEntities(modified, existingByFqn, ctx.userName(), true);
  }

  private String resolveActualUser(
      WorkflowVariableHandler varHandler, Map<String, Object> inputNamespaceMap) {
    String updatedByNamespace = (String) inputNamespaceMap.get(UPDATED_BY_VARIABLE);
    return Optional.ofNullable(updatedByNamespace)
        .map(ns -> (String) varHandler.getNamespacedVariable(ns, UPDATED_BY_VARIABLE))
        .orElse(null);
  }

  private String resolveFieldValue(DelegateExecution execution) {
    if (fieldValueExpr == null) {
      return null;
    }
    Object value = fieldValueExpr.getValue(execution);
    if (value != null && !value.toString().isEmpty()) {
      return value.toString();
    }
    return null;
  }
}
