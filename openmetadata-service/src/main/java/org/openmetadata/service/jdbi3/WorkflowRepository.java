package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.Entity.WORKFLOW;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.entity.automations.Workflow;
import org.openmetadata.schema.security.secrets.SecretsManagerProvider;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.automations.WorkflowResource;
import org.openmetadata.service.secrets.SecretMapOwnership;
import org.openmetadata.service.secrets.SecretsManager;
import org.openmetadata.service.secrets.SecretsManager.SecretInventory;
import org.openmetadata.service.secrets.SecretsManagerFactory;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.PostCommitActionQueue;

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
  protected boolean isStoragePreparationSideEffecting() {
    return true;
  }

  @Override
  protected Workflow prepareForStorage(Workflow entity) {
    final SecretsManager secretsManager = SecretsManagerFactory.getSecretsManager();
    return secretsManager == null ? entity : secretsManager.encryptWorkflow(entity);
  }

  @Override
  public void storeEntity(Workflow entity, boolean update) {
    store(entity, update);
  }

  @Override
  public void storeEntities(List<Workflow> workflows) {
    storeMany(workflows);
  }

  @Override
  protected <R> R executeEntityWrite(List<Workflow> entities, Supplier<R> work) {
    SecretsManager manager = SecretsManagerFactory.getSecretsManager();
    if (manager == null || manager.getSecretsManagerProvider() == SecretsManagerProvider.DB) {
      return super.executeEntityWrite(entities, work);
    }
    // Take the ownership lock before workflow row locks in direct writes and bulk cascades.
    return executeInTransaction(
        () -> {
          new SecretMapOwnership(daoCollection.entityExtensionDAO(), manager).lock();
          return work.get();
        });
  }

  @Override
  protected void store(Workflow workflow, boolean update, Double expectedVersion) {
    writeWithSharedCredentials(
        List.of(workflow), update, () -> super.store(workflow, update, expectedVersion));
  }

  @Override
  protected void storeMany(List<Workflow> entities) {
    writeWithSharedCredentials(entities, false, () -> super.storeMany(entities));
  }

  @Override
  protected void updateMany(List<Workflow> entities) {
    writeWithSharedCredentials(entities, true, () -> super.updateMany(entities));
  }

  private void writeWithSharedCredentials(List<Workflow> entities, boolean update, Runnable write) {
    SecretsManager manager = SecretsManagerFactory.getSecretsManager();
    if (manager == null || manager.getSecretsManagerProvider() == SecretsManagerProvider.DB) {
      write.run();
    } else {
      SecretMapOwnership ownership =
          new SecretMapOwnership(daoCollection.entityExtensionDAO(), manager);
      withOwnershipLock(
          ownership,
          () -> {
            List<SecretInventory> previous =
                update
                    ? entities.stream().map(entity -> storedInventory(manager, entity)).toList()
                    : List.of();
            write.run();
            for (int i = 0; i < previous.size(); i++) {
              SecretInventory before = previous.get(i);
              if (before != null) {
                scheduleRelease(
                    ownership, before, manager.secretInventory(entities.get(i)).references());
              }
            }
          });
    }
  }

  private SecretInventory storedInventory(SecretsManager manager, Workflow entity) {
    String json = dao.findJsonByIdForUpdate(entity.getId(), Include.ALL);
    return json == null ? null : manager.secretInventory(JsonUtils.readValue(json, Workflow.class));
  }

  private void withOwnershipLock(SecretMapOwnership ownership, Runnable work) {
    executeInTransaction(
        () -> {
          ownership.lock();
          work.run();
          return null;
        });
  }

  private void scheduleRelease(
      SecretMapOwnership ownership, SecretInventory before, Set<String> remaining) {
    if (ownership.recordReleasedReferences(before, remaining)) {
      PostCommitActionQueue.runOrDefer(
          () -> withOwnershipLock(ownership, () -> ownership.clean(before.root())));
    }
  }

  @Override
  protected Runnable preparePostDeleteCleanup(List<Workflow> workflows) {
    SecretsManager manager = SecretsManagerFactory.getSecretsManager();
    if (manager == null) {
      return super.preparePostDeleteCleanup(workflows);
    }
    if (manager.getSecretsManagerProvider() == SecretsManagerProvider.DB) {
      return () -> workflows.forEach(manager::deleteSecretsFromWorkflow);
    }
    SecretMapOwnership ownership =
        new SecretMapOwnership(daoCollection.entityExtensionDAO(), manager);
    Set<UUID> markers = new HashSet<>();
    for (Workflow workflow : workflows) {
      SecretInventory stored = storedInventory(manager, workflow);
      if (stored != null) {
        markers.add(ownership.recordWorkflowDeletion(workflow.getId(), stored));
      }
    }
    return () -> ownership.cleanDeletedWorkflows(daoCollection, markers);
  }

  @Override
  protected void postDelete(Workflow workflow, boolean hardDelete) {
    super.postDelete(workflow, hardDelete);
    if (!hardDelete) {
      SecretsManagerFactory.getSecretsManager().deleteSecretsFromWorkflow(workflow);
    }
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
      // Trigger authorization and stored credentials are bound to the original execution inputs.
      updated.withWorkflowType(original.getWorkflowType()).withRequest(original.getRequest());
      compareAndUpdate(
          "status", () -> recordChange("status", original.getStatus(), updated.getStatus()));
      compareAndUpdate(
          "response",
          () -> recordChange("response", original.getResponse(), updated.getResponse(), true));
    }
  }
}
