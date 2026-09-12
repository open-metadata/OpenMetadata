package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.Entity.WORKFLOW;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.entity.automations.Workflow;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.EntityModuleDependencies;
import org.openmetadata.service.entity.EntityModuleFactory;
import org.openmetadata.service.entity.policy.EntityPolicy;
import org.openmetadata.service.entity.policy.EntityPolicyContext;
import org.openmetadata.service.entity.write.EntityOperation;
import org.openmetadata.service.entity.write.EntitySpecificMutation;
import org.openmetadata.service.entity.write.EntityUpdateRequest;
import org.openmetadata.service.entity.write.EntityUpdater;
import org.openmetadata.service.resources.automations.WorkflowResource;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.secrets.SecretsManagerFactory;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

@Repository()
public class WorkflowRepository implements EntityPolicy<Workflow> {

  private static final String PATCH_FIELDS = "status,response";

  public WorkflowRepository() {
    this.entityContext =
        new EntityPolicyContext<>(
            new EntityPolicyContext.Schema<>(
                WorkflowResource.COLLECTION_PATH,
                WORKFLOW,
                Workflow.class,
                Entity.getCollectionDAO().workflowDAO()),
            new EntityPolicyContext.WriteFields(PATCH_FIELDS, "", Set.of()),
            EntityModuleDependencies.standard());
    EntityModuleFactory.initialize(this, true);
    context().options().setQuoteFqn(true);
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
  public List<String> getFieldsStrippedFromStorageJson() {
    return List.of("openMetadataServerConnection");
  }

  @Override
  public void storeEntity(Workflow entity, boolean update) {
    SecretsManager secretsManager = SecretsManagerFactory.getSecretsManager();
    if (secretsManager != null) {
      entity = secretsManager.encryptWorkflow(entity);
    }
    persistence().store(entity, update);
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
    context()
        .schema()
        .dao()
        .insertMany(
            context().schema().dao().getTableName(),
            context().schema().dao().getNameHashColumn(),
            fqns,
            jsons);
  }

  /**
   * Remove the secrets from the secret manager
   */
  @Override
  public void postDelete(Workflow workflow, boolean hardDelete) {
    EntityPolicy.super.postDelete(workflow, hardDelete);
    SecretsManagerFactory.getSecretsManager().deleteSecretsFromWorkflow(workflow);
  }

  @Override
  public void storeRelationships(Workflow entity) {
    // No relationships to store beyond what is stored in the super class
  }

  @Override
  public EntityUpdater<Workflow> getUpdater(
      Workflow original, Workflow updated, EntityOperation operation, ChangeSource changeSource) {
    return new WorkflowUpdater(original, updated, operation).mutation();
  }

  public class WorkflowUpdater implements EntitySpecificMutation<Workflow> {

    public WorkflowUpdater(Workflow original, Workflow updated, EntityOperation operation) {
      this.entityUpdate =
          new EntityUpdater<>(
              context().services().getUpdaterServices(),
              new EntityUpdateRequest<>(original, updated, operation, null, false),
              this);
    }

    @Transaction
    @Override
    public void update(EntityUpdater<Workflow> entityUpdate, boolean consolidatingChanges) {
      entityUpdate.compareAndUpdate(
          "status",
          () ->
              entityUpdate.recordChange(
                  "status",
                  entityUpdate.getOriginal().getStatus(),
                  entityUpdate.getUpdated().getStatus()));
      entityUpdate.compareAndUpdate(
          "response",
          () ->
              entityUpdate.recordChange(
                  "response",
                  entityUpdate.getOriginal().getResponse(),
                  entityUpdate.getUpdated().getResponse(),
                  true));
    }

    private final EntityUpdater<Workflow> entityUpdate;

    public EntityUpdater<Workflow> mutation() {
      return entityUpdate;
    }
  }

  private final EntityPolicyContext<Workflow> entityContext;

  @Override
  public final EntityPolicyContext<Workflow> context() {
    return entityContext;
  }
}
