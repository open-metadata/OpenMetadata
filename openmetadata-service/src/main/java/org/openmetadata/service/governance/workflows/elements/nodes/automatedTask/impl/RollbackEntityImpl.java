package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl;

import static org.openmetadata.service.governance.workflows.Workflow.EXCEPTION_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.UPDATED_BY_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.WORKFLOW_INSTANCE_EXECUTION_ID_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.WORKFLOW_RUNTIME_EXCEPTION;

import io.github.resilience4j.retry.Retry;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.exception.ExceptionUtils;
import org.flowable.common.engine.api.delegate.Expression;
import org.flowable.engine.delegate.BpmnError;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.Workflow;
import org.openmetadata.service.governance.workflows.WorkflowVariableHandler;
import org.openmetadata.service.jdbi3.EntityRepository;

@Slf4j
public class RollbackEntityImpl implements JavaDelegate {
  private Expression inputNamespaceMapExpr;

  @Override
  public void execute(DelegateExecution execution) {
    WorkflowVariableHandler varHandler = new WorkflowVariableHandler(execution);
    try {
      Map<String, String> inputNamespaceMap =
          JsonUtils.readOrConvertValue(inputNamespaceMapExpr.getValue(execution), Map.class);

      Object workflowInstanceExecutionIdObj =
          execution.getVariable(WORKFLOW_INSTANCE_EXECUTION_ID_VARIABLE);
      String workflowInstanceExecutionId =
          workflowInstanceExecutionIdObj instanceof UUID
              ? workflowInstanceExecutionIdObj.toString()
              : (String) workflowInstanceExecutionIdObj;

      String updatedBy =
          (String)
              varHandler.getNamespacedVariable(
                  inputNamespaceMap.get(UPDATED_BY_VARIABLE), UPDATED_BY_VARIABLE);
      if (updatedBy == null || updatedBy.isEmpty()) {
        updatedBy = "governance-bot";
      }
      final String resolvedUpdatedBy = updatedBy;

      List<String> entityList =
          WorkflowVariableHandler.getEntityList(inputNamespaceMap, varHandler);

      Map<String, EntityInterface> entityMap =
          Entity.getEntitiesByLinks(entityList, "*", Include.ALL);

      Retry retry = Retry.of("rollback-entity", Workflow.TASK_RETRY_CONFIG);

      List<String> failedEntities = new ArrayList<>();
      Map<String, String> entityErrors = new LinkedHashMap<>();

      for (String entityLinkStr : entityList) {
        EntityInterface entity = entityMap.get(entityLinkStr);
        if (entity == null) {
          failedEntities.add(entityLinkStr);
          entityErrors.put(entityLinkStr, "Entity not found");
          continue;
        }
        try {
          Retry.decorateRunnable(
                  retry,
                  () -> rollbackEntity(entity, resolvedUpdatedBy, workflowInstanceExecutionId))
              .run();
        } catch (Exception e) {
          failedEntities.add(entityLinkStr);
          entityErrors.put(entityLinkStr, e.getMessage());
          LOG.error(
              "[RollbackEntity] Failed entity '{}' after retries: {}",
              entityLinkStr,
              e.getMessage(),
              e);
        }
      }

      if (!failedEntities.isEmpty()) {
        varHandler.setNodeVariable("failedEntities", failedEntities);
        varHandler.setNodeVariable("entityErrors", entityErrors);
        int total = entityList.size();
        int failed = failedEntities.size();
        String processingStatus = (failed == total) ? "failure" : "partial_success";
        varHandler.setNodeVariable("processingStatus", processingStatus);
        LOG.warn("[RollbackEntity] {}: {}/{} entities failed", processingStatus, failed, total);
        varHandler.setGlobalVariable(
            EXCEPTION_VARIABLE, String.format("%d/%d entities failed", failed, total));
      }

    } catch (BpmnError e) {
      throw e;
    } catch (Exception e) {
      LOG.error("[RollbackEntity] Error during entity rollback: {}", e.getMessage(), e);
      varHandler.setGlobalVariable(EXCEPTION_VARIABLE, ExceptionUtils.getStackTrace(e));
      throw new BpmnError(WORKFLOW_RUNTIME_EXCEPTION, e.getMessage());
    }
  }

  private void rollbackEntity(
      EntityInterface currentEntity, String updatedBy, String workflowInstanceExecutionId) {
    String entityType = currentEntity.getEntityReference().getType();
    UUID entityId = currentEntity.getId();

    LOG.info(
        "[RollbackEntity] Rolling back entity: {} ({}), Workflow Instance: {}",
        currentEntity.getName(),
        entityId,
        workflowInstanceExecutionId);

    EntityRepository<?> repository = Entity.getEntityRepository(entityType);

    Double previousVersion = getPreviousRollbackTargetVersion(currentEntity, repository);
    if (previousVersion == null) {
      LOG.warn(
          "[RollbackEntity] No previous approved version found for entity: {} ({})",
          currentEntity.getName(),
          entityId);
      return;
    }

    EntityInterface previousEntity = repository.getVersion(entityId, previousVersion.toString());

    LOG.info(
        "[RollbackEntity] Rolling back entity {} from version {} to version {}",
        currentEntity.getName(),
        currentEntity.getVersion(),
        previousVersion);

    restoreToPreviousVersion(repository, currentEntity, previousEntity, updatedBy);

    LOG.info(
        "[RollbackEntity] Successfully rolled back entity: {} ({}) to version {}",
        currentEntity.getName(),
        entityId,
        previousVersion);
  }

  private Double getPreviousRollbackTargetVersion(
      EntityInterface entity, EntityRepository<?> repository) {
    try {
      UUID entityId = entity.getId();
      EntityHistory history = repository.listVersions(entityId);
      Double currentVersion = entity.getVersion();
      List<Double> versionNumbers = new ArrayList<>();
      for (Object versionObj : history.getVersions()) {
        try {
          String versionJson;
          if (versionObj instanceof String) {
            versionJson = (String) versionObj;
          } else {
            versionJson = JsonUtils.pojoToJson(versionObj);
          }
          EntityInterface versionEntity = JsonUtils.readValue(versionJson, entity.getClass());
          Double versionNumber = versionEntity.getVersion();
          if (versionNumber < currentVersion) {
            versionNumbers.add(versionNumber);
          }
        } catch (Exception e) {
          LOG.warn("Could not parse version: {}", e.getMessage());
        }
      }
      versionNumbers.sort((v1, v2) -> Double.compare(v2, v1));

      Double approvedVersion = null;
      Double draftVersion = null;
      Double deprecatedVersion = null;

      for (Double versionNumber : versionNumbers) {
        try {
          EntityInterface fullVersionEntity =
              repository.getVersion(entityId, versionNumber.toString());
          EntityStatus status = getEntityStatus(fullVersionEntity);
          if (status == EntityStatus.APPROVED && approvedVersion == null) {
            approvedVersion = versionNumber;
          } else if (status == EntityStatus.DRAFT && draftVersion == null) {
            draftVersion = versionNumber;
          } else if (status == EntityStatus.DEPRECATED && deprecatedVersion == null) {
            deprecatedVersion = versionNumber;
          }
        } catch (Exception e) {
          LOG.warn("Could not load version {}: {}", versionNumber, e.getMessage());
        }
      }

      if (approvedVersion != null) {
        LOG.info(
            "[RollbackEntity] Found APPROVED version {} for entity: {} ({})",
            approvedVersion,
            entity.getName(),
            entityId);
        return approvedVersion;
      }
      if (draftVersion != null) {
        LOG.info(
            "[RollbackEntity] No APPROVED version found, falling back to DRAFT version {} for entity: {} ({})",
            draftVersion,
            entity.getName(),
            entityId);
        return draftVersion;
      }
      if (deprecatedVersion != null) {
        LOG.info(
            "[RollbackEntity] No APPROVED/DRAFT version found, falling back to DEPRECATED version {} for entity: {} ({})",
            deprecatedVersion,
            entity.getName(),
            entityId);
        return deprecatedVersion;
      }

      LOG.warn(
          "[RollbackEntity] No approved, draft, or deprecated version found in history for entity: {} ({})",
          entity.getName(),
          entityId);
      return null;
    } catch (Exception e) {
      LOG.error("Error finding previous rollback target version", e);
      return null;
    }
  }

  private EntityStatus getEntityStatus(EntityInterface entity) {
    try {
      java.lang.reflect.Method getStatusMethod = entity.getClass().getMethod("getEntityStatus");
      Object statusObj = getStatusMethod.invoke(entity);
      if (statusObj instanceof EntityStatus status) {
        return status;
      }
      return null;
    } catch (NoSuchMethodException e) {
      return EntityStatus.APPROVED;
    } catch (Exception e) {
      LOG.error(
          "[RollbackEntity] Error checking entity status for {}",
          entity.getClass().getSimpleName(),
          e);
      return null;
    }
  }

  private void restoreToPreviousVersion(
      EntityRepository<?> repository,
      EntityInterface currentEntity,
      EntityInterface previousEntity,
      String updatedBy) {
    try {
      currentEntity =
          repository.getVersion(currentEntity.getId(), currentEntity.getVersion().toString());

      String currentJson = JsonUtils.pojoToJson(currentEntity);
      String previousJson = JsonUtils.pojoToJson(previousEntity);
      jakarta.json.JsonPatch patch = JsonUtils.getJsonPatch(currentJson, previousJson);

      repository.patch(null, currentEntity.getFullyQualifiedName(), updatedBy, patch);

      LOG.info(
          "[RollbackEntity] Successfully applied rollback patch for entity: {} ({})",
          currentEntity.getName(),
          currentEntity.getId());

    } catch (Exception e) {
      LOG.error("[RollbackEntity] Failed to restore entity to previous version", e);
      throw new RuntimeException("Failed to restore entity to previous version", e);
    }
  }
}
