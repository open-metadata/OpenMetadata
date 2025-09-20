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
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.EntityHistory;
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

      // Get the input namespace map to know which namespace contains the related entity
      Map<String, String> inputNamespaceMap =
          JsonUtils.readOrConvertValue(inputNamespaceMapExpr.getValue(execution), Map.class);

      Object workflowInstanceExecutionIdObj =
          execution.getVariable(WORKFLOW_INSTANCE_EXECUTION_ID_VARIABLE);
      String workflowInstanceExecutionId =
          workflowInstanceExecutionIdObj instanceof UUID
              ? workflowInstanceExecutionIdObj.toString()
              : (String) workflowInstanceExecutionIdObj;

      // Get the related entity using the correct namespace from inputNamespaceMap
      MessageParser.EntityLink entityLink =
          MessageParser.EntityLink.parse(
              (String)
                  varHandler.getNamespacedVariable(
                      inputNamespaceMap.get(RELATED_ENTITY_VARIABLE), RELATED_ENTITY_VARIABLE));

      // Get the updatedBy user from the workflow context
      String updatedBy =
          (String)
              varHandler.getNamespacedVariable(
                  inputNamespaceMap.get(UPDATED_BY_VARIABLE), UPDATED_BY_VARIABLE);
      if (updatedBy == null || updatedBy.isEmpty()) {
        updatedBy = "governance-bot"; // Fallback to system user
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

      // Store rollback information in execution variables
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

          // Only include versions before the current version
          if (versionNumber < currentVersion) {
            versionNumbers.add(versionNumber);
          }
        } catch (Exception e) {
          LOG.warn("Could not parse version: {}", e.getMessage());
          continue;
        }
      }

      // Sort versions in descending order to check most recent first
      versionNumbers.sort((v1, v2) -> Double.compare(v2, v1));

      // Iterate through versions in descending order to find the first approved or rejected version
      for (Double versionNumber : versionNumbers) {
        try {
          // Get this version's full entity using getVersion
          EntityInterface fullVersionEntity =
              repository.getVersion(entityId, versionNumber.toString());

          // Log the entity type and status for debugging
          if (fullVersionEntity instanceof GlossaryTerm) {
            GlossaryTerm term = (GlossaryTerm) fullVersionEntity;
            LOG.debug(
                "[RollbackEntity] Checking version {} - Status: {}",
                versionNumber,
                term.getEntityStatus() != null ? term.getEntityStatus().value() : "null");
          }

          // Check if it's approved or rejected (for GlossaryTerm, check status field)
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
    // For GlossaryTerm, check if the status is "Approved" or "Rejected"
    if (entity instanceof GlossaryTerm) {
      GlossaryTerm glossaryTerm = (GlossaryTerm) entity;
      if (glossaryTerm.getEntityStatus() == null) {
        LOG.warn(
            "[RollbackEntity] Status is null for GlossaryTerm version {}",
            glossaryTerm.getVersion());
        return null;
      }

      String status = glossaryTerm.getEntityStatus().value();
      LOG.debug(
          "[RollbackEntity] Checking status: '{}' for version {}",
          status,
          glossaryTerm.getVersion());

      // Return the status if it's either Approved or Rejected (these are rollback targets)
      // Use exact case matching as per the enum definition
      if ("Approved".equals(status)) {
        return "Approved";
      } else if ("Rejected".equals(status)) {
        return "Rejected";
      }

      // Log why we're skipping this version
      LOG.debug(
          "[RollbackEntity] Skipping version {} with status '{}' - not a rollback target",
          glossaryTerm.getVersion(),
          status);

      // Return null for other statuses (Draft, In Review, Deprecated) as we don't rollback to those
      return null;
    }

    // For other entities, we'd need to check their status when that field is added
    // For now, just return "Approved" as the default rollback status
    return "Approved";
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
