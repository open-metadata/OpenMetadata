package org.openmetadata.service.jdbi3;

import java.io.IOException;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.type.EntityReference;
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
  protected void postDelete(WorkflowDefinition entity) {
    WorkflowHandler.getInstance().deleteWorkflowDefinition(entity.getName());
  }

  @Override
  protected void setFields(WorkflowDefinition entity, EntityUtil.Fields fields) {}

  @Override
  protected void clearFields(WorkflowDefinition entity, EntityUtil.Fields fields) {}

  @Override
  protected void prepare(WorkflowDefinition entity, boolean update) {}

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
