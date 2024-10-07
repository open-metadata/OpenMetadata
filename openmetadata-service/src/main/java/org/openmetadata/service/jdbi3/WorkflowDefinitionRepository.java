package org.openmetadata.service.jdbi3;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.governance.WorkflowDefinitionResource;
import org.openmetadata.service.util.EntityUtil;

import java.util.Set;
import java.util.UUID;

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
    EntityReference workflowDefinitionReference = getByName(null, workflowDefinitionName, new EntityUtil.Fields(Set.of("*"))).getEntityReference();
    return workflowDefinitionReference.getId();
  }
}
