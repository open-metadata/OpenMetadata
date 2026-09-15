package org.openmetadata.service.entity;

import java.util.List;
import java.util.UUID;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.entity.cache.EntityCaches;
import org.openmetadata.service.entity.metadata.CustomPropertyValidator;
import org.openmetadata.service.entity.policy.EntityPolicyContext;
import org.openmetadata.service.entity.write.StoredEntity;

public final class EntityWriteCallbacks {

  private EntityWriteCallbacks() {}

  public static <T extends EntityInterface> void storeEntityWithVersionAndCaptureJson(
      EntityPolicyContext<T> context, T entity, boolean update, Double expectedVersion) {
    context
        .services()
        .getPersistence()
        .capture(
            entity, () -> context.policy().storeEntityWithVersion(entity, update, expectedVersion));
  }

  public static <T extends EntityInterface> List<StoredEntity> flushAndCaptureStoredJson(
      EntityPolicyContext<T> context, Runnable flushBody) {
    return context
        .services()
        .getPersistence()
        .captureFlush(flushBody, context.policy()::flushInOneTransaction);
  }

  public static <T extends EntityInterface> List<T> createManyEntities(
      EntityPolicyContext<T> context, List<T> entities) {
    return context.services().getCreateWorkflow().createMany(entities);
  }

  public static <T extends EntityInterface> void validateExtension(
      EntityPolicyContext<T> context, T entity, boolean update) {
    if (entity.getExtension() != null && !update) {
      entity.setExtension(
          CustomPropertyValidator.shared()
              .validateAndTransform(entity.getExtension(), context.schema().entityType()));
    }
  }

  public static <T extends EntityInterface> void writeThroughCacheMany(
      EntityPolicyContext<T> context, List<T> entities, boolean update, List<StoredEntity> stored) {
    context.services().getPersistence().publishMany(entities, stored);
  }

  public static <T extends EntityInterface> void publishUpdatedEntity(
      EntityPolicyContext<T> context, final T updated, final String originalFqn) {
    final UUID id = updated.getId();
    final String fqn = updated.getFullyQualifiedName();
    EntityCaches.invalidations().prepareStored(context.schema().entityType(), id, fqn, originalFqn);
    context.policy().writeThroughCache(updated, true);
    EntityCaches.invalidations().finishStored(context.schema().entityType(), id, fqn, originalFqn);
  }
}
