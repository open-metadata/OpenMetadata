package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.Entity.WORKFLOW;

import java.io.IOException;
import org.openmetadata.schema.entity.operations.Workflow;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.sdk.PipelineServiceClient;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.operations.WorkflowResource;
import org.openmetadata.service.util.EntityUtil;

public class WorkflowRepository extends EntityRepository<Workflow> {

  private static final String UPDATE_FIELDS = "owner";
  private static final String PATCH_FIELDS = "owner";

  private static PipelineServiceClient pipelineServiceClient;

  public WorkflowRepository(CollectionDAO dao) {
    super(
        WorkflowResource.COLLECTION_PATH,
        WORKFLOW,
        Workflow.class,
        dao.workflowDAO(),
        dao,
        PATCH_FIELDS,
        UPDATE_FIELDS);
  }

  public void setPipelineServiceClient(PipelineServiceClient client) {
    pipelineServiceClient = client;
  }

  @Override
  public Workflow setFields(Workflow entity, EntityUtil.Fields fields) throws IOException {
    return entity.withOwner(fields.contains(Entity.FIELD_OWNER) ? getOwner(entity) : null);
  }

  @Override
  public void prepare(Workflow entity) throws IOException {
    // validate request and status
    if (entity.getRequest() == null) {
      throw new IllegalArgumentException("Request must not be empty");
    }
  }

  @Override
  public void storeEntity(Workflow entity, boolean update) throws IOException {
    EntityReference owner = entity.getOwner();
    // Don't store owner, database, href and tags as JSON. Build it on the fly based on relationships
    entity.withOwner(null).withHref(null);
    store(entity, update);

    // Restore the relationships
    entity.withOwner(owner);
  }

  @Override
  public void storeRelationships(Workflow entity) throws IOException {
    storeOwner(entity, entity.getOwner());
  }

  @Override
  public EntityUpdater getUpdater(Workflow original, Workflow updated, Operation operation) {
    return new WorkflowUpdater(original, updated, operation);
  }

  public class WorkflowUpdater extends EntityUpdater {
    public WorkflowUpdater(Workflow original, Workflow updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      recordChange("status", original.getStatus(), updated.getStatus());
      recordChange("response", original.getResponse(), updated.getResponse());
    }
  }
}
