package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.impl;

import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.WORKFLOW_INSTANCE_EXECUTION_ID_VARIABLE;

import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.flowable.engine.delegate.DelegateExecution;
import org.flowable.engine.delegate.JavaDelegate;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.EntityHistory;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.Workflow;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.springframework.beans.factory.annotation.Autowired;

@Slf4j
public class RollbackEntityImpl implements JavaDelegate {
  @Autowired private Workflow workflow;

  @Override
  public void execute(DelegateExecution execution) {
    try {
      String workflowInstanceExecutionId =
          (String) execution.getVariable(WORKFLOW_INSTANCE_EXECUTION_ID_VARIABLE);

      Map<String, Object> relatedEntityMap =
          (Map<String, Object>) execution.getVariable(RELATED_ENTITY_VARIABLE);
      if (relatedEntityMap == null) {
        throw new IllegalArgumentException("Related entity variable is null");
      }

      EntityReference entityReference =
          JsonUtils.convertValue(relatedEntityMap, EntityReference.class);
      String entityType = entityReference.getType();
      UUID entityId = entityReference.getId();

      LOG.info(
          "[RollbackEntity] Rolling back entity: {} ({}), Workflow Instance: {}",
          entityReference.getName(),
          entityId,
          workflowInstanceExecutionId);

      EntityRepository<?> repository = Entity.getEntityRepository(entityType);

      EntityInterface currentEntity =
          repository.get(null, entityId, repository.getFields("*"), Include.ALL, false);

      String rollbackToStatus = (String) execution.getVariable("rollbackToStatus");
      if (rollbackToStatus == null || rollbackToStatus.isEmpty()) {
        rollbackToStatus = "Approved";
      }

      Double previousVersion =
          getPreviousApprovedVersion(currentEntity, repository, rollbackToStatus);
      if (previousVersion == null) {
        LOG.warn(
            "[RollbackEntity] No previous approved version found for entity: {} ({})",
            entityReference.getName(),
            entityId);
        return;
      }

      EntityInterface previousEntity = repository.getVersion(entityId, previousVersion.toString());

      LOG.info(
          "[RollbackEntity] Rolling back entity {} from version {} to version {}",
          entityReference.getName(),
          currentEntity.getVersion(),
          previousVersion);

      restoreToPreviousVersion(repository, currentEntity, previousEntity);

      // Store rollback information in execution variables
      execution.setVariable("rollbackAction", "rollback");
      execution.setVariable("rollbackFromVersion", currentEntity.getVersion());
      execution.setVariable("rollbackToVersion", previousVersion);
      execution.setVariable("rollbackEntityId", entityId.toString());
      execution.setVariable("rollbackEntityType", entityType);

      LOG.info(
          "[RollbackEntity] Successfully rolled back entity: {} ({}) to version {}",
          entityReference.getName(),
          entityId,
          previousVersion);

    } catch (Exception e) {
      LOG.error("[RollbackEntity] Error during entity rollback: {}", e.getMessage(), e);
      throw new RuntimeException("Failed to rollback entity", e);
    }
  }

  private Double getPreviousApprovedVersion(
      EntityInterface entity, EntityRepository<?> repository, String rollbackToStatus) {
    try {
      UUID entityId = entity.getId();

      // Get entity history using listVersions method
      EntityHistory history = repository.listVersions(entityId);

      // Current version
      Double currentVersion = entity.getVersion();

      // Look through versions to find the most recent approved one before current
      Double previousApprovedVersion = null;

      for (Object versionObj : history.getVersions()) {
        try {
          // The versions list contains JSON strings, not Maps
          String versionJson;
          if (versionObj instanceof String) {
            versionJson = (String) versionObj;
          } else {
            // Fallback: convert to JSON if it's not already a string
            versionJson = JsonUtils.pojoToJson(versionObj);
          }

          // Parse just the version number from the JSON
          EntityInterface versionEntity = JsonUtils.readValue(versionJson, entity.getClass());
          Double versionNumber = versionEntity.getVersion();

          // Skip current and later versions
          if (versionNumber >= currentVersion) {
            continue;
          }

          // Get this version's full entity using getVersion
          EntityInterface fullVersionEntity =
              repository.getVersion(entityId, versionNumber.toString());

          // Check if it's approved (for GlossaryTerm, check status field)
          if (isApprovedVersion(fullVersionEntity, rollbackToStatus)) {
            previousApprovedVersion = versionNumber;
            break; // Found the most recent approved version
          }
        } catch (Exception e) {
          LOG.warn("Could not parse version: {}", e.getMessage());
          continue;
        }
      }

      return previousApprovedVersion;
    } catch (Exception e) {
      LOG.error("Error finding previous approved version", e);
      return null;
    }
  }

  private boolean isApprovedVersion(EntityInterface entity, String targetStatus) {
    // For GlossaryTerm, check the status field
    if (entity instanceof GlossaryTerm) {
      GlossaryTerm glossaryTerm = (GlossaryTerm) entity;
      return targetStatus.equalsIgnoreCase(glossaryTerm.getStatus().value());
    }

    // For other entities, we'd need to check their status when that field is added
    // For now, just return the previous version as "approved"
    return true;
  }

  private void restoreToPreviousVersion(
      EntityRepository<?> repository,
      EntityInterface currentEntity,
      EntityInterface previousEntity) {
    try {
      // Get current entity using getVersion (same loading method as previous)
      currentEntity =
          repository.getVersion(currentEntity.getId(), currentEntity.getVersion().toString());

      // Get previous entity using getVersion (already loaded this way)
      // previousEntity is already from getVersion in the calling method

      // Now both loaded the same way - create PATCH
      String currentJson = JsonUtils.pojoToJson(currentEntity);
      String previousJson = JsonUtils.pojoToJson(previousEntity);
      jakarta.json.JsonPatch patch = JsonUtils.getJsonPatch(currentJson, previousJson);

      // Apply PATCH using FQN (not ID)
      String user = "governance-bot"; // System user for rollback operations
      repository.patch(null, currentEntity.getFullyQualifiedName(), user, patch);

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
