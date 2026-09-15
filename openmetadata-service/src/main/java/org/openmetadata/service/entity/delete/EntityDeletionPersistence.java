package org.openmetadata.service.entity.delete;

import java.util.List;
import java.util.function.BiConsumer;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.util.PostCommitActionQueue;

/** Composes dependent cleanup and row deletion against the owning transaction's DAO graph. */
public final class EntityDeletionPersistence<T extends EntityInterface> {
  public record Schema<T extends EntityInterface>(
      String type, EntityDAO<T> entities, CollectionDAO collection) {}

  public record Policy(
      EntityDependentCleanup.Policy dependents, BooleanSupplier batchTransactionsAvailable) {}

  public record Hooks<T>(
      BiConsumer<String, T> cleanup, Consumer<T> invalidate, Consumer<T> missing) {}

  private final EntityPurge<T> purge;

  public EntityDeletionPersistence(
      final Schema<T> schema,
      final Policy policy,
      final Hooks<T> hooks,
      final Consumer<Runnable> transaction) {
    final var dependents = dependencies(schema, policy.dependents());
    final var workflows = workflows();
    purge =
        new EntityPurge<>(
            new EntityPurge.Rows<>(
                dependents::remove, schema.entities()::delete,
                dependents::removeMany, schema.entities()::deleteByIds),
            new EntityPurge.Lifecycle<>(
                hooks.cleanup(), hooks.invalidate(), hooks.missing(), workflows::cancel),
            transaction,
            policy.batchTransactionsAvailable());
  }

  public void delete(final String actor, final T entity) {
    purge.delete(actor, entity);
  }

  public void deleteMany(final List<T> entities) {
    purge.deleteMany(entities);
  }

  private static <T extends EntityInterface> EntityDependentCleanup<T> dependencies(
      final Schema<T> schema, final EntityDependentCleanup.Policy policy) {
    final CollectionDAO dao = schema.collection();
    return new EntityDependentCleanup<>(
        schema.type(),
        new EntityDependentCleanup.Rows(
            () -> dao.relationshipDAO(),
            () -> dao.fieldRelationshipDAO(),
            () -> dao.entityExtensionDAO(),
            () -> dao.tagUsageDAO(),
            () -> dao.usageDAO()),
        policy,
        feed(schema.type(), dao),
        ids -> Entity.getConversationRepository().deleteByEntity(schema.type(), ids));
  }

  private static EntityFeedCleanup feed(final String type, final CollectionDAO dao) {
    return new EntityFeedCleanup(
        type,
        () -> dao.relationshipDAO(),
        List.of(
            new EntityFeedCleanup.Artifact(Entity.TASK, () -> dao.taskDAO()),
            new EntityFeedCleanup.Artifact(Entity.ANNOUNCEMENT, () -> dao.announcementDAO())));
  }

  private static EntityWorkflowCleanup workflows() {
    return new EntityWorkflowCleanup(
        WorkflowHandler::isInitialized,
        ids -> WorkflowHandler.getInstance().cancelInstancesForEntities(ids, "Entity deleted"),
        PostCommitActionQueue::runOrDefer);
  }
}
