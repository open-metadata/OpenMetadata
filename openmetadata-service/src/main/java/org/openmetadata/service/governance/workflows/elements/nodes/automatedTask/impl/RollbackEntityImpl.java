package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl;

import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.UPDATED_BY_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.WORKFLOW_INSTANCE_EXECUTION_ID_VARIABLE;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.flowable.common.engine.api.delegate.Expression;
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
import org.openmetadata.service.resources.feeds.MessageParser;

@Slf4j
public class RollbackEntityImpl implements JavaDelegate {
  private Workflow workflow;
  private Expression inputNamespaceMapExpr;

  @Deprecated
  @SuppressWarnings("unused")
  private org.flowable.common.engine.api.delegate.Expression rollbackToStatus;

  @Override
  public void execute(DelegateExecution execution) {
    try {
      WorkflowVariableHandler varHandler = new WorkflowVariableHandler(execution);

      Map<String, String> inputNamespaceMap =
          JsonUtils.readOrConvertValue(inputNamespaceMapExpr.getValue(execution), Map.class);

      Object workflowInstanceExecutionIdObj =
          execution.getVariable(WORKFLOW_INSTANCE_EXECUTION_ID_VARIABLE);
      String workflowInstanceExecutionId =
          workflowInstanceExecutionIdObj instanceof UUID
              ? workflowInstanceExecutionIdObj.toString()
              : (String) workflowInstanceExecutionIdObj;

      MessageParser.EntityLink entityLink =
          MessageParser.EntityLink.parse(
              (String)
                  varHandler.getNamespacedVariable(
                      inputNamespaceMap.get(RELATED_ENTITY_VARIABLE), RELATED_ENTITY_VARIABLE));

      String updatedBy =
          (String)
              varHandler.getNamespacedVariable(
                  inputNamespaceMap.get(UPDATED_BY_VARIABLE), UPDATED_BY_VARIABLE);
      if (updatedBy == null || updatedBy.isEmpty()) {
        updatedBy = "governance-bot";
      }

      EntityInterface currentEntity = Entity.getEntity(entityLink, "*", Include.ALL);

      String entityType = currentEntity.getEntityReference().getType();
      UUID entityId = currentEntity.getId();

      LOG.info(
          "[RollbackEntity] Rolling back entity: {} ({}), Workflow Instance: {}",
          currentEntity.getName(),
          entityId,
          workflowInstanceExecutionId);

      EntityRepository<?> repository = Entity.getEntityRepository(entityType);

      Double previousVersion = getPreviousApprovedVersion(currentEntity, repository);
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

      execution.setVariable("rollbackAction", "rollback");
      execution.setVariable("rollbackFromVersion", currentEntity.getVersion());
      execution.setVariable("rollbackToVersion", previousVersion);
      execution.setVariable("rollbackEntityId", entityId.toString());
      execution.setVariable("rollbackEntityType", entityType);

      LOG.info(
          "[RollbackEntity] Successfully rolled back entity: {} ({}) to version {}",
          currentEntity.getName(),
          entityId,
          previousVersion);

    } catch (Exception e) {
      LOG.error("[RollbackEntity] Error during entity rollback: {}", e.getMessage(), e);
      throw new RuntimeException("Failed to rollback entity", e);
    }
  }

  private Double getPreviousApprovedVersion(
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
          continue;
        }
      }

      versionNumbers.sort((v1, v2) -> Double.compare(v2, v1));

      for (Double versionNumber : versionNumbers) {
        try {
          EntityInterface fullVersionEntity =
              repository.getVersion(entityId, versionNumber.toString());

          try {
            java.lang.reflect.Method getStatusMethod =
                fullVersionEntity.getClass().getMethod("getEntityStatus");
            Object statusObj = getStatusMethod.invoke(fullVersionEntity);
            LOG.debug(
                "[RollbackEntity] Checking {} version {} - Status: {}",
                fullVersionEntity.getClass().getSimpleName(),
                versionNumber,
                statusObj != null ? statusObj.toString() : "null");
          } catch (NoSuchMethodException e) {
            LOG.debug(
                "[RollbackEntity] {} version {} - No entityStatus field",
                fullVersionEntity.getClass().getSimpleName(),
                versionNumber);
          } catch (Exception e) {
            LOG.debug(
                "[RollbackEntity] Could not get status for {} version {}",
                fullVersionEntity.getClass().getSimpleName(),
                versionNumber);
          }

          String status = getRollbackStatus(fullVersionEntity);
          if (status != null) {
            LOG.info(
                "[RollbackEntity] Found {} version {} for entity: {} ({})",
                status,
                versionNumber,
                entity.getName(),
                entityId);
            return versionNumber;
          } else {
            LOG.debug(
                "[RollbackEntity] Skipping version {} - not in Approved/Rejected status",
                versionNumber);
          }
        } catch (Exception e) {
          LOG.warn("Could not load version {}: {}", versionNumber, e.getMessage());
          continue;
        }
      }

      LOG.warn(
          "[RollbackEntity] No approved or rejected version found in history for entity: {} ({})",
          entity.getName(),
          entityId);
      return null;
    } catch (Exception e) {
      LOG.error("Error finding previous approved or rejected version", e);
      return null;
    }
  }

  private String getRollbackStatus(EntityInterface entity) {
    try {
      java.lang.reflect.Method getStatusMethod = entity.getClass().getMethod("getEntityStatus");
      Object statusObj = getStatusMethod.invoke(entity);

      if (statusObj == null) {
        LOG.warn(
            "[RollbackEntity] Status is null for {} version {}",
            entity.getClass().getSimpleName(),
            entity.getVersion());
        return null;
      }

      if (statusObj instanceof EntityStatus) {
        EntityStatus status = (EntityStatus) statusObj;
        LOG.debug(
            "[RollbackEntity] Checking status: '{}' for version {}", status, entity.getVersion());

        if (status == EntityStatus.APPROVED) {
          return "Approved";
        } else if (status == EntityStatus.REJECTED) {
          return "Rejected";
        }

        LOG.debug(
            "[RollbackEntity] Skipping version {} with status '{}' - not a rollback target",
            entity.getVersion(),
            status);

        return null;
      }

      LOG.warn(
          "[RollbackEntity] Unexpected status type for {}: {}",
          entity.getClass().getSimpleName(),
          statusObj.getClass().getName());
      return null;

    } catch (NoSuchMethodException e) {
      LOG.debug(
          "[RollbackEntity] Entity type {} doesn't have entityStatus field, treating as approved",
          entity.getClass().getSimpleName());
      return "Approved";
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
