package org.openmetadata.service.entity.delete;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.monitoring.RequestLatencyContext.phase;

import java.util.List;
import java.util.UUID;
import java.util.function.BiConsumer;
import java.util.function.Function;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.EntityInterface;

/** Reconciles each subtree level, including descendants of parents already in the requested state. */
public final class EntitySubtreeLifecycle<T extends EntityInterface> implements EntitySubtree {
  public record Loading<T>(boolean supportsSoftDelete, Function<List<UUID>, List<T>> findAll) {}

  public record Hooks<T>(
      BiConsumer<T, String> beforeDelete,
      BiConsumer<UUID, String> restoreAdditional,
      BiConsumer<UUID, String> deleteAdditional,
      BiConsumer<UUID, String> deleteUnsupported) {}

  private final Loading<T> loading;
  private final Hooks<T> hooks;
  private final EntityHierarchy<T> hierarchy;
  private final EntitySubtreeUpdates<T> updates;
  private final BiConsumer<List<UUID>, String> hardDelete;

  public EntitySubtreeLifecycle(
      final Loading<T> loading,
      final Hooks<T> hooks,
      final EntityHierarchy<T> hierarchy,
      final EntitySubtreeUpdates<T> updates,
      final BiConsumer<List<UUID>, String> hardDelete) {
    this.loading = loading;
    this.hooks = hooks;
    this.hierarchy = hierarchy;
    this.updates = updates;
    this.hardDelete = hardDelete;
  }

  @Override
  @Transaction
  public void bulkRestoreSubtree(final List<UUID> ids, final String actor) {
    if (nullOrEmpty(ids)) {
      return;
    }
    final List<T> entities = load(ids, "bulkRestoreLoad");
    if (entities.isEmpty()) {
      return;
    }
    hierarchy.walk(entities, EntityHierarchy.Action.RESTORE, actor);
    final List<T> deleted =
        entities.stream().filter(entity -> Boolean.TRUE.equals(entity.getDeleted())).toList();
    updates.update(deleted, actor, EntitySubtreeUpdates.Mode.RESTORE);
    entities.forEach(entity -> hooks.restoreAdditional().accept(entity.getId(), actor));
  }

  @Override
  @Transaction
  public void bulkSoftDeleteSubtree(final List<UUID> ids, final String actor) {
    if (nullOrEmpty(ids)) {
      return;
    }
    if (!loading.supportsSoftDelete()) {
      // Only this level is hard-deleted; descendants retain their own soft-delete policy.
      ids.forEach(id -> hooks.deleteUnsupported().accept(id, actor));
      return;
    }
    final List<T> entities = load(ids, "bulkSoftDeleteLoad");
    if (!entities.isEmpty()) {
      softDeleteLoaded(entities, actor);
    }
  }

  @Override
  public void bulkHardDeleteSubtree(final List<UUID> ids, final String actor) {
    hardDelete.accept(ids, actor);
  }

  private void softDeleteLoaded(final List<T> entities, final String actor) {
    final List<T> live =
        entities.stream().filter(entity -> !Boolean.TRUE.equals(entity.getDeleted())).toList();
    live.forEach(entity -> hooks.beforeDelete().accept(entity, actor));
    hierarchy.walk(entities, EntityHierarchy.Action.SOFT_DELETE, actor);
    updates.update(live, actor, EntitySubtreeUpdates.Mode.SOFT_DELETE);
    entities.forEach(entity -> hooks.deleteAdditional().accept(entity.getId(), actor));
  }

  private List<T> load(final List<UUID> ids, final String phaseName) {
    try (var ignored = phase(phaseName)) {
      return loading.findAll().apply(ids);
    }
  }
}
