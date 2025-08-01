package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.Entity.WORKFLOW;

import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.entity.automations.Workflow;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.automations.WorkflowResource;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.secrets.SecretsManagerFactory;
import org.openmetadata.service.util.EntityUtil;

public class WorkflowRepository extends EntityRepository<Workflow> {
  private static final String PATCH_FIELDS = "status,response";

  public WorkflowRepository() {
    super(
        WorkflowResource.COLLECTION_PATH,
        WORKFLOW,
        Workflow.class,
        Entity.getCollectionDAO().workflowDAO(),
        PATCH_FIELDS,
        "");
    quoteFqn = true;
  }

  @Override
  public void setFields(Workflow entity, EntityUtil.Fields fields) {
    /* Nothing to do */
  }

  @Override
  public void clearFields(Workflow entity, EntityUtil.Fields fields) {
    /* Nothing to do */
  }

  @Override
  public void prepare(Workflow entity, boolean update) {
    // validate request and status
    if (entity.getRequest() == null) {
      throw new IllegalArgumentException("Request must not be empty");
    }
  }

  @Override
  public void storeEntity(Workflow entity, boolean update) {
    OpenMetadataConnection openmetadataConnection = entity.getOpenMetadataServerConnection();
    SecretsManager secretsManager = SecretsManagerFactory.getSecretsManager();

    if (secretsManager != null) {
      entity = secretsManager.encryptWorkflow(entity);
    }

    // Don't store owners, database, href and tags as JSON. Build it on the fly based on
    // relationships
    entity.withOpenMetadataServerConnection(null);
    store(entity, update);

    // Restore the relationships
    entity.withOpenMetadataServerConnection(openmetadataConnection);
  }

  /** Remove the secrets from the secret manager */
  @Override
  protected void postDelete(Workflow workflow) {
    SecretsManagerFactory.getSecretsManager().deleteSecretsFromWorkflow(workflow);
  }

  @Override
  public void storeRelationships(Workflow entity) {
    // No relationships to store beyond what is stored in the super class
  }

  @Override
  public EntityRepository<Workflow>.EntityUpdater getUpdater(
      Workflow original, Workflow updated, Operation operation, ChangeSource changeSource) {
    return new WorkflowUpdater(original, updated, operation);
  }

  public class WorkflowUpdater extends EntityUpdater {
    public WorkflowUpdater(Workflow original, Workflow updated, Operation operation) {
      super(original, updated, operation);
    }

    @Transaction
    @Override
    public void entitySpecificUpdate(boolean consolidatingChanges) {
      recordChange("status", original.getStatus(), updated.getStatus());
      recordChange("response", original.getResponse(), updated.getResponse(), true);
    }
  }
}
