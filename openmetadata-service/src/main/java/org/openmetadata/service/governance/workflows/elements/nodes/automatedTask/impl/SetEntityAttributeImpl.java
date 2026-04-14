package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl;

import static org.openmetadata.service.governance.workflows.Workflow.ENTITY_LIST_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.EXCEPTION_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.UPDATED_BY_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.WORKFLOW_RUNTIME_EXCEPTION;
import static org.openmetadata.service.governance.workflows.WorkflowHandler.getProcessDefinitionKeyFromId;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
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
  private static final int PARALLELISM = 4;

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
    } catch (ExecutionException e) {
      Throwable cause = e.getCause() != null ? e.getCause() : e;
      LOG.error(
          "[{}] Failure: ",
          getProcessDefinitionKeyFromId(execution.getProcessDefinitionId()),
          cause);
      varHandler.setGlobalVariable(EXCEPTION_VARIABLE, ExceptionUtils.getStackTrace(cause));
      throw new BpmnError(WORKFLOW_RUNTIME_EXCEPTION, cause.getMessage());
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new BpmnError(WORKFLOW_RUNTIME_EXCEPTION, e.getMessage());
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
    List<String> entityLinks =
        resolveEntityList(
            varHandler, inputNamespaceMap, (String) inputNamespaceMap.get(ENTITY_LIST_VARIABLE));
    if (entityLinks.isEmpty()) {
      return;
    }
    BatchContext ctx = buildBatchContext(execution, varHandler, inputNamespaceMap, entityLinks);
    runBatchesConcurrently(partition(entityLinks, PARALLELISM), ctx);
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

  private void runBatchesConcurrently(List<List<String>> partitions, BatchContext ctx)
      throws InterruptedException, ExecutionException {
    try (ExecutorService pool = Executors.newVirtualThreadPerTaskExecutor()) {
      List<Future<Void>> futures = new ArrayList<>();
      for (List<String> batch : partitions) {
        Callable<Void> task =
            () -> {
              processBatch(batch, ctx);
              return null;
            };
        futures.add(pool.submit(task));
      }
      for (Future<Void> future : futures) {
        future.get();
      }
    }
  }

  private void processBatch(List<String> entityLinks, BatchContext ctx) throws Exception {
    Map<String, EntityInterface> existingByFqn = new LinkedHashMap<>();
    for (String linkStr : entityLinks) {
      MessageParser.EntityLink link = MessageParser.EntityLink.parse(linkStr);
      EntityInterface entity = Entity.getEntity(link, "*", Include.ALL);
      existingByFqn.put(entity.getFullyQualifiedName(), entity);
    }
    List<EntityInterface> modifiedEntities = buildModifiedEntities(existingByFqn, ctx);
    @SuppressWarnings("unchecked")
    EntityRepository<EntityInterface> repo =
        (EntityRepository<EntityInterface>) Entity.getEntityRepository(ctx.entityType());
    repo.bulkUpdateEntities(modifiedEntities, existingByFqn, ctx.userName());
  }

  private List<EntityInterface> buildModifiedEntities(
      Map<String, EntityInterface> existingByFqn, BatchContext ctx) {
    List<EntityInterface> modified = new ArrayList<>();
    for (EntityInterface original : existingByFqn.values()) {
      @SuppressWarnings("unchecked")
      EntityInterface copy =
          (EntityInterface) JsonUtils.deepCopy(original, (Class) original.getClass());
      EntityFieldUtils.setEntityField(
          copy, ctx.entityType(), ctx.userName(), ctx.fieldName(), ctx.fieldValue(), false, null);
      copy.setImpersonatedBy(ctx.impersonatedBy());
      modified.add(copy);
    }
    return modified;
  }

  private static List<List<String>> partition(List<String> list, int parts) {
    if (list.isEmpty()) {
      return List.of();
    }
    int size = (int) Math.ceil((double) list.size() / parts);
    List<List<String>> result = new ArrayList<>();
    for (int i = 0; i < list.size(); i += size) {
      result.add(list.subList(i, Math.min(i + size, list.size())));
    }
    return result;
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

  private List<String> resolveEntityList(
      WorkflowVariableHandler varHandler,
      Map<String, Object> inputNamespaceMap,
      String entityListNamespace) {
    if (entityListNamespace != null) {
      Object raw = varHandler.getNamespacedVariable(entityListNamespace, ENTITY_LIST_VARIABLE);
      if (raw instanceof List) {
        @SuppressWarnings("unchecked")
        List<String> list = (List<String>) raw;
        if (!list.isEmpty()) {
          return list;
        }
      }
    }
    String relatedEntityNamespace = (String) inputNamespaceMap.get(RELATED_ENTITY_VARIABLE);
    if (relatedEntityNamespace != null) {
      String singleLink =
          (String)
              varHandler.getNamespacedVariable(relatedEntityNamespace, RELATED_ENTITY_VARIABLE);
      if (singleLink != null && !singleLink.isEmpty()) {
        return List.of(singleLink);
      }
    }
    return List.of();
  }
}
