package org.openmetadata.service.entity;

import static org.openmetadata.schema.type.Include.ALL;

import java.util.List;
import java.util.UUID;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.cache.CacheBundle;
import org.openmetadata.service.cache.NotFoundCache;
import org.openmetadata.service.entity.cache.EntityCacheKeys;
import org.openmetadata.service.entity.policy.EntityPolicyContext;
import org.openmetadata.service.entity.policy.EntityPolicySupport;
import org.openmetadata.service.util.PostCommitActionQueue;

public final class EntityDeletionCallbacks {

  private EntityDeletionCallbacks() {}

  public static <T extends EntityInterface> void populateRelationFields(
      EntityPolicyContext<T> context, List<T> entities) {
    try {
      context.policy().setFieldsInBulk(context.putFields(), entities);
    } catch (Exception e) {
      EntityPolicySupport.LOG.debug(
          "Bulk field population failed during bulk hard delete for {}, falling back per-entity: {}",
          context.schema().entityType(),
          e.getMessage());
      for (T entity : entities) {
        try {
          context.policy().setFieldsInternal(entity, context.putFields());
        } catch (Exception ignored) {
          // postDelete subclass overrides must remain null-safe for cascade-deleted parents.
        }
      }
    }
  }

  /**
   * Per-entity hydration with {@link Include#ALL} for the bulk restore and soft-delete paths. The bulk
   * {@link #setFieldsInBulk} variant hard-codes {@code NON_DELETED} when batch-fetching
   * relationship references (see {@code DashboardRepository.batchFetchCharts}), so a
   * cascade-deleted chart wouldn't show up in {@code dashboard.charts} — exactly the
   * scenario where we need it to. Falling back to per-entity {@link #setFieldsInternal}
   * routes through the subclass's {@code setFields(entity, fields, relationIncludes)} which
   * honours the include passed in. Restore batches are typically small (single subtree
   * level), so the extra DB round-trips are acceptable for the correctness this buys.
   */
  public static <T extends EntityInterface> void hydrateRelationsForBulkUpdater(
      EntityPolicyContext<T> context, List<T> entities) {
    for (T entity : entities) {
      try {
        context.policy().setFieldsInternal(entity, context.putFields(), ALL);
      } catch (Exception ex) {
        // Best-effort: if hydration fails on a single entity the PUT updater may wipe its
        // HAS rows. restoreAdditionalChildren will still attempt to put them back, but log
        // so operators can correlate any missing-relationship reports with hydration noise
        // rather than digging through change-event history.
        EntityPolicySupport.LOG.warn(
            "Hydration failed for {} {}; HAS rows may be wiped before restore hook runs",
            context.schema().entityType(),
            entity.getId(),
            ex);
      }
    }
  }

  public static <T extends EntityInterface> void bulkInvalidate(
      EntityPolicyContext<T> context, List<T> entities) {
    for (T entity : entities) {
      context.policy().invalidate(entity);
      // Mirror cleanup()'s NotFoundCache marker so a concurrent reader that re-populates
      // L1/Redis between the row purge and the next invalidate doesn't keep
      // returning a stale "found" entity. Without this the next get_by_name/find against
      // the same id or FQN can still hit the cache and return a deleted entity, which
      // breaks fixture teardown (DELETE returns 404 because the row is gone but Redis
      // still hands out the entity to the get_by_name probe).
      EntityDeletionCallbacks.markEntityNotFound(context, entity);
    }
  }

  public static <T extends EntityInterface> void markEntityNotFound(
      EntityPolicyContext<T> context, T entity) {
    final UUID id = entity.getId();
    final String fqn = entity.getFullyQualifiedName();
    PostCommitActionQueue.runOrDefer(
        () -> EntityDeletionCallbacks.publishEntityNotFound(context, id, fqn));
  }

  public static <T extends EntityInterface> void publishEntityNotFound(
      EntityPolicyContext<T> context, UUID id, String fqn) {
    NotFoundCache notFoundCache = CacheBundle.getNotFoundCache();
    if (notFoundCache == null || !notFoundCache.enabled()) {
      return;
    }
    if (id != null) {
      notFoundCache.markNotFoundById(context.schema().entityType(), id);
    }
    if (fqn != null) {
      notFoundCache.markNotFoundByName(
          context.schema().entityType(),
          EntityCacheKeys.name(context.schema().entityType(), fqn).getRight());
    }
  }
}
