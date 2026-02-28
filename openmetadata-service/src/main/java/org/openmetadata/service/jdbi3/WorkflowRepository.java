package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.Entity.WORKFLOW;

import java.util.ArrayList;
import java.util.List;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.entity.automations.Workflow;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.automations.WorkflowResource;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.secrets.SecretsManagerFactory;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

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
  public void setFields(
      Workflow entity, EntityUtil.Fields fields, RelationIncludes relationIncludes) {
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
  protected List<String> getFieldsStrippedFromStorageJson() {
    return List.of("openMetadataServerConnection");
  }

  @Override
  public void storeEntity(Workflow entity, boolean update) {
    SecretsManager secretsManager = SecretsManagerFactory.getSecretsManager();

    if (secretsManager != null) {
      entity = secretsManager.encryptWorkflow(entity);
    }

    store(entity, update);
  }

  public void storeEntities(List<Workflow> workflows) {
    List<String> fqns = new ArrayList<>(workflows.size());
    List<String> jsons = new ArrayList<>(workflows.size());
    SecretsManager secretsManager = SecretsManagerFactory.getSecretsManager();

    for (Workflow workflow : workflows) {
      if (secretsManager != null) {
        workflow = secretsManager.encryptWorkflow(workflow);
      }

      fqns.add(workflow.getFullyQualifiedName());
      jsons.add(serializeForStorage(workflow));
    }

    dao.insertMany(dao.getTableName(), dao.getNameHashColumn(), fqns, jsons);
  }

  /** Remove the secrets from the secret manager */
  @Override
  protected void postDelete(Workflow workflow, boolean hardDelete) {
    super.postDelete(workflow, hardDelete);
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
      compareAndUpdate(
          "status",
          () -> {
            recordChange("status", original.getStatus(), updated.getStatus());
          });
      compareAndUpdate(
          "response",
          () -> {
            recordChange("response", original.getResponse(), updated.getResponse(), true);
          });
    }
  }
}
