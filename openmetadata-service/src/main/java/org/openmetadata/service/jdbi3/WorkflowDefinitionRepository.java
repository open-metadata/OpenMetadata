package org.openmetadata.service.jdbi3;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.governance.workflows.elements.EdgeDefinition;
import org.openmetadata.schema.governance.workflows.elements.WorkflowNodeDefinitionInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.Workflow;
import org.openmetadata.service.governance.workflows.WorkflowDeploymentStrategy;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.resources.governance.WorkflowDefinitionResource;
import org.openmetadata.service.util.EntityUtil;

@Slf4j
public class WorkflowDefinitionRepository extends EntityRepository<WorkflowDefinition> {

  // Strategy for controlling workflow deployment
  private WorkflowDeploymentStrategy deploymentStrategy = WorkflowDeploymentStrategy.ALWAYS_DEPLOY;

  public void setDeploymentStrategy(WorkflowDeploymentStrategy strategy) {
    this.deploymentStrategy =
        strategy != null ? strategy : WorkflowDeploymentStrategy.ALWAYS_DEPLOY;
  }

  public WorkflowDefinitionRepository() {
    super(
        WorkflowDefinitionResource.COLLECTION_PATH,
        Entity.WORKFLOW_DEFINITION,
        WorkflowDefinition.class,
        Entity.getCollectionDAO().workflowDefinitionDAO(),
        "",
        "");
  }

  @Override
  public List<WorkflowDefinition> getEntitiesFromSeedData() throws IOException {
    return getEntitiesFromSeedData(".*json/data/governance/workflows/.*\\.json$");
  }

  @Override
  protected void postCreate(WorkflowDefinition entity) {
    // Use deployment strategy to determine if we should deploy
    if (deploymentStrategy.shouldDeploy("create") && WorkflowHandler.isInitialized()) {
      WorkflowHandler.getInstance().deploy(new Workflow(entity));
    }
  }

  @Override
  protected void postUpdate(WorkflowDefinition original, WorkflowDefinition updated) {
    // Use deployment strategy to determine if we should deploy
    if (deploymentStrategy.shouldDeploy("update") && WorkflowHandler.isInitialized()) {
      // For PeriodicBatchEntityTrigger workflows, we need to undeploy the old version first
      // to avoid having multiple timer events triggering simultaneously
      if (original.getTrigger() != null
          && "periodicBatchEntityTrigger".equals(original.getTrigger().getType())) {
        LOG.info(
            "Undeploying old periodic batch workflow before redeployment: {}", original.getName());
        WorkflowHandler.getInstance().deleteWorkflowDefinition(original);
      }

      // Deploy the updated workflow
      WorkflowHandler.getInstance().deploy(new Workflow(updated));
    }
  }

  @Override
  protected void postDelete(WorkflowDefinition entity, boolean hardDelete) {
    super.postDelete(entity, hardDelete);
    // Use deployment strategy to determine if we should undeploy
    if (deploymentStrategy.shouldDeploy("delete") && WorkflowHandler.isInitialized()) {
      WorkflowHandler.getInstance().deleteWorkflowDefinition(entity);
    }
  }

  @Override
  protected void setFields(WorkflowDefinition entity, EntityUtil.Fields fields) {
    if (WorkflowHandler.isInitialized()) {
      entity.withDeployed(WorkflowHandler.getInstance().isDeployed(entity));
    } else {
      LOG.debug("Can't get `deploy` status since WorkflowHandler is not initialized.");
    }
  }

  @Override
  protected void clearFields(WorkflowDefinition entity, EntityUtil.Fields fields) {}

  @Override
  protected void prepare(WorkflowDefinition entity, boolean update) {
    // Validate workflow configuration
    LOG.info("Validating workflow configuration for: {}", entity.getName());
    validateWorkflowConfiguration(entity);
  }

  @Override
  public EntityRepository<WorkflowDefinition>.EntityUpdater getUpdater(
      WorkflowDefinition original,
      WorkflowDefinition updated,
      Operation operation,
      ChangeSource changeSource) {
    return new WorkflowDefinitionRepository.WorkflowDefinitionUpdater(original, updated, operation);
  }

  public class WorkflowDefinitionUpdater extends EntityUpdater {
    public WorkflowDefinitionUpdater(
        WorkflowDefinition original, WorkflowDefinition updated, Operation operation) {
      super(original, updated, operation);
    }

    @Transaction
    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      updateTrigger();
      updateConfig();
      updateNodes();
      updateEdges();
    }

    private void updateTrigger() {
      if (original.getTrigger() == updated.getTrigger()) {
        return;
      }
      recordChange("trigger", original.getTrigger(), updated.getTrigger());
    }

    private void updateConfig() {
      if (Objects.equals(original.getConfig(), updated.getConfig())) {
        return;
      }
      recordChange("config", original.getConfig(), updated.getConfig());
    }

    private void updateNodes() {
      List<WorkflowNodeDefinitionInterface> addedNodes = new ArrayList<>();
      List<WorkflowNodeDefinitionInterface> deletedNodes = new ArrayList<>();
      recordListChange(
          "nodes",
          original.getNodes(),
          updated.getNodes(),
          addedNodes,
          deletedNodes,
          WorkflowNodeDefinitionInterface::equals);
    }

    private void updateEdges() {
      List<EdgeDefinition> addedEdges = new ArrayList<>();
      List<EdgeDefinition> deletedEdges = new ArrayList<>();
      recordListChange(
          "nodes",
          original.getEdges(),
          updated.getEdges(),
          addedEdges,
          deletedEdges,
          EdgeDefinition::equals);
    }
  }

  @Override
  protected void storeEntity(WorkflowDefinition entity, boolean update) {
    store(entity, update);
  }

  @Override
  protected void storeRelationships(WorkflowDefinition entity) {}

  public UUID getIdFromName(String workflowDefinitionName) {
    EntityReference workflowDefinitionReference =
        getByName(null, workflowDefinitionName, new EntityUtil.Fields(Set.of("*")))
            .getEntityReference();
    return workflowDefinitionReference.getId();
  }

  /**
   * Efficiently retrieves WorkflowDefinition with minimal fields for stage processing.
   * This returns the full object so callers can extract both ID and stage displayName without additional DB calls.
   */
  public WorkflowDefinition getByNameForStageProcessing(String workflowDefinitionName) {
    return getByName(null, workflowDefinitionName, EntityUtil.Fields.EMPTY_FIELDS);
  }

  /**
   * Validates workflow configuration to ensure user approval tasks are only used
   * when the target entity type has reviewers configured.
   */
  private void validateWorkflowConfiguration(WorkflowDefinition workflowDefinition) {
    // Check if workflow has any user approval or change review tasks
    boolean hasUserApprovalTasks = false;
    List<String> userTaskTypes = List.of("userApprovalTask", "changeReviewTask");

    if (workflowDefinition.getNodes() != null) {
      for (WorkflowNodeDefinitionInterface node : workflowDefinition.getNodes()) {
        LOG.debug("Checking node: {} with subType: {}", node.getName(), node.getSubType());
        if (userTaskTypes.contains(node.getSubType())) {
          hasUserApprovalTasks = true;
          LOG.debug(
              "Found user approval task in workflow: {} - node: {}",
              workflowDefinition.getName(),
              node.getName());
          break;
        }
      }
    }

    // If workflow has user approval tasks, validate entity types support reviewers
    if (hasUserApprovalTasks) {
      // Get entity types from trigger configuration
      List<String> entityTypes = getEntityTypesFromWorkflow(workflowDefinition);
      LOG.debug(
          "Validating entity types {} for workflow: {}", entityTypes, workflowDefinition.getName());

      if (!entityTypes.isEmpty()) {
        validateEntityTypesSupportsReviewers(entityTypes, workflowDefinition.getName());
      }
    }
  }

  /**
   * Extracts entity types from workflow trigger configuration.
   * Handles both single entityType and multiple entityTypes fields.
   */
  private List<String> getEntityTypesFromWorkflow(WorkflowDefinition workflowDefinition) {
    List<String> entityTypes = new ArrayList<>();

    if (workflowDefinition.getTrigger() != null
        && workflowDefinition.getTrigger().getConfig() != null) {

      // Convert config to Map for field access
      Map<String, Object> configMap = JsonUtils.getMap(workflowDefinition.getTrigger().getConfig());

      // Check for single entityType (deprecated, kept for backward compatibility)
      Object entityTypeObj = configMap.get("entityType");
      if (entityTypeObj != null) {
        entityTypes.add(entityTypeObj.toString());
      }

      // Check for multiple entityTypes (both eventBasedEntity and periodicBatchEntity triggers)
      @SuppressWarnings("unchecked")
      List<String> multipleEntityTypes = (List<String>) configMap.get("entityTypes");
      if (multipleEntityTypes != null) {
        entityTypes.addAll(multipleEntityTypes);
      }
    }

    return entityTypes;
  }

  /**
   * Validates that the entity types support reviewers.
   */
  private void validateEntityTypesSupportsReviewers(List<String> entityTypes, String workflowName) {
    for (String entityType : entityTypes) {
      try {
        // Get the repository for the entity type to check if it supports reviewers
        EntityRepository<?> entityRepository = Entity.getEntityRepository(entityType);
        boolean supportsReviewers = entityRepository.isSupportsReviewers();

        LOG.debug("Entity type '{}' supports reviewers: {}", entityType, supportsReviewers);

        if (!supportsReviewers) {
          String errorMsg =
              String.format(
                  "Workflow '%s' contains user approval tasks but entity type '%s' does not support reviewers. "
                      + "User approval tasks can only be used with entities that have reviewer support.",
                  workflowName, entityType);
          LOG.error(errorMsg);
          throw new IllegalArgumentException(errorMsg);
        }

        LOG.debug(
            "Workflow '{}' validated: Entity type '{}' supports reviewers for user approval tasks",
            workflowName,
            entityType);
      } catch (IllegalArgumentException e) {
        LOG.error("Validation failed: {}", e.getMessage());
        throw e; // Re-throw validation exceptions
      } catch (Exception e) {
        // If we can't determine the entity type repository, log a warning but allow the workflow
        LOG.warn(
            "Could not verify reviewer support for entity type '{}' in workflow '{}': {}",
            entityType,
            workflowName,
            e.getMessage());
      }
    }
  }
}
