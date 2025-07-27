package org.openmetadata.service.jdbi3;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.governance.workflows.elements.EdgeDefinition;
import org.openmetadata.schema.governance.workflows.elements.WorkflowNodeDefinitionInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.Workflow;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.resources.governance.WorkflowDefinitionResource;
import org.openmetadata.service.util.EntityUtil;

@Slf4j
public class WorkflowDefinitionRepository extends EntityRepository<WorkflowDefinition> {

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
    WorkflowHandler.getInstance().deploy(new Workflow(entity));
  }

  @Override
  protected void postUpdate(WorkflowDefinition original, WorkflowDefinition updated) {
    WorkflowHandler.getInstance().deploy(new Workflow(updated));
  }

  @Override
  protected void postDelete(WorkflowDefinition entity, boolean hardDelete) {
    super.postDelete(entity, hardDelete);
    WorkflowHandler.getInstance().deleteWorkflowDefinition(entity);
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
  protected void prepare(WorkflowDefinition entity, boolean update) {}

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
      updateNodes();
      updateEdges();
    }

    private void updateTrigger() {
      if (original.getTrigger() == updated.getTrigger()) {
        return;
      }
      recordChange("trigger", original.getTrigger(), updated.getTrigger());
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
}
