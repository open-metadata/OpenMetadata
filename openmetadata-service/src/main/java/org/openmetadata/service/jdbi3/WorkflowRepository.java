package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.Entity.WORKFLOW;

import java.io.IOException;
import org.openmetadata.schema.entity.automations.Workflow;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.automations.WorkflowResource;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.secrets.SecretsManagerFactory;
import org.openmetadata.service.util.EntityUtil;

public class WorkflowRepository extends EntityRepository<Workflow> {

  private static final String UPDATE_FIELDS = "owner";
  private static final String PATCH_FIELDS = "owner";

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
    OpenMetadataConnection openmetadataConnection = entity.getOpenMetadataServerConnection();
    SecretsManager secretsManager = SecretsManagerFactory.getSecretsManager();

    if (secretsManager != null) {
      entity = secretsManager.encryptOrDecryptWorkflow(entity, true);
    }

    // Don't store owner, database, href and tags as JSON. Build it on the fly based on relationships
    entity.withOwner(null).withHref(null).withOpenMetadataServerConnection(null);
    store(entity, update);

    // Restore the relationships
    entity.withOwner(owner).withOpenMetadataServerConnection(openmetadataConnection);
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
