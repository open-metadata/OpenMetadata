package org.openmetadata.service.entity.policy;

import java.util.List;
import java.util.UUID;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.service.entity.delete.EntityDeletionService;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipRecord;

public interface EntityDeletionPolicy<T extends EntityInterface> extends EntityPolicyAccess<T> {

  public default void preDelete(T entity, String deletedBy) {
    // Override this method to perform any operation required after deletion.
    // For example ingestion pipeline deletes a pipeline in AirFlow.
  }

  @Transaction
  public default void deleteChildren(
      UUID id, boolean recursive, boolean hardDelete, String updatedBy) {
    context()
        .services()
        .getChildDeletion()
        .delete(id, new EntityDeletionService.Request(updatedBy, recursive, hardDelete));
  }

  @Transaction
  public default void deleteChildren(
      List<EntityRelationshipRecord> children, boolean hardDelete, String updatedBy) {
    context().services().getHierarchy().deleteChildren(children, hardDelete, updatedBy);
  }

  public default void cleanup(T entityInterface) {
    context().policy().cleanup(entityInterface.getUpdatedBy(), entityInterface);
  }

  public default void cleanup(String deletedBy, T entityInterface) {
    context().services().getDeletionPersistence().delete(deletedBy, entityInterface);
  }

  public default void entitySpecificCleanup(T entityInterface) {}

  public default boolean shouldCleanupFqnDependents() {
    return true;
  }

  /**
   * Variant of {@link #entitySpecificCleanup(EntityInterface)} that receives the user performing
   * the delete. Defaults to delegating so subclasses that don't care about the deleter keep
   * working unchanged; override this when you need to cascade-delete other entities and want the
   * audit trail to credit the actual operator instead of a hard-coded system user.
   */
  public default void entitySpecificCleanup(String deletedBy, T entityInterface) {
    context().policy().entitySpecificCleanup(entityInterface);
  }

  @Transaction
  public default void restoreChildren(UUID id, String updatedBy) {
    context().services().getHierarchy().restoreChildren(id, updatedBy);
  }

  public default List<EntityRelationshipRecord> prepareChildrenForHardDeleteCascade(
      UUID parentId, List<EntityRelationshipRecord> children, String updatedBy) {
    return children;
  }

  public default List<CollectionDAO.EntityRelationshipObject> prepareChildrenForHardDeleteCascade(
      List<T> parents, List<CollectionDAO.EntityRelationshipObject> children, String updatedBy) {
    return children;
  }

  public default Runnable enterBulkHardDeleteCascade(List<T> entities) {
    return () -> {};
  }

  /**
   * Hook called once per restored entity for repositories that have non-CONTAINS related
   * entities that need to be restored alongside the parent. Default: no-op.
   */
  public default void restoreAdditionalChildren(UUID id, String updatedBy) {
    // No-op. Override in subclasses for HAS-style related-entity restore.
  }

  /**
   * Hook called once per soft-deleted entity for repositories that have non-CONTAINS related
   * entities that need to be soft-deleted alongside the parent (e.g., charts attached to
   * dashboards via HAS). Default: no-op.
   */
  public default void softDeleteAdditionalChildren(UUID id, String updatedBy) {
    // No-op. Override in subclasses for HAS-style related-entity soft delete.
  }

  /**
   * Hook called once per hard-deleted entity for repositories that have non-CONTAINS related
   * entities that need to be hard-deleted alongside the parent (e.g., charts attached to
   * dashboards via HAS). Default: no-op.
   */
  public default void hardDeleteAdditionalChildren(UUID id, String updatedBy) {
    // No-op. Override in subclasses for HAS-style related-entity hard delete.
  }

  /**
   * Hook for entity-type-specific cleanup invoked once per bulk-hard-delete batch. Default
   * implementation loops {@link #entitySpecificCleanup(String, EntityInterface)} so subclasses
   * keep current behavior. Override for true batching where external resources warrant it (e.g.,
   * Airflow DAG deregistration, S3 object cleanup, secrets-store purges).
   */
  public default void bulkEntitySpecificCleanup(List<T> entities, String deletedBy) {
    for (T entity : entities) {
      // Must be the deletedBy-aware overload: TableRepository overrides only that one (its
      // residual test case / test suite sweep credits the operator), and dispatching to the
      // no-arg variant silently skipped it for every entity deleted through an ancestor cascade.
      context().policy().entitySpecificCleanup(deletedBy, entity);
    }
  }

  public default void checkSystemEntityDeletion(T entity) {
    if (ProviderType.SYSTEM.equals(entity.getProvider())) {
      // System provided entity can't be deleted
      throw new IllegalArgumentException(
          CatalogExceptionMessage.systemEntityDeleteNotAllowed(
              entity.getName(), context().schema().entityType()));
    }
  }
}
