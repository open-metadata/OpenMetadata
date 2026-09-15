package org.openmetadata.service.entity.delete;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.monitoring.RequestLatencyContext.phase;

import java.util.List;
import java.util.UUID;
import java.util.function.BiConsumer;
import java.util.function.BooleanSupplier;
import java.util.function.Consumer;
import java.util.function.Function;
import org.openmetadata.schema.EntityInterface;

/** Coordinates bounded, depth-first hard deletion around the existing atomic metadata/row purge. */
public final class EntityHardDeletion<T extends EntityInterface> {
  public record Preparation<T>(
      Function<List<UUID>, List<T>> load,
      Function<List<T>, Runnable> enterCascade,
      Consumer<List<T>> hydrate,
      BiConsumer<T, String> beforeDelete) {}

  public record Cleanup<T>(
      BiConsumer<List<T>, String> entitySpecific,
      BiConsumer<UUID, String> additionalChildren,
      Consumer<List<T>> purge) {}

  public record Completion<T>(
      Consumer<List<T>> invalidate,
      Consumer<T> deleted,
      Consumer<T> removeFromSearch,
      BooleanSupplier searchCoveredByAncestor) {}

  private final Preparation<T> preparation;
  private final Cleanup<T> cleanup;
  private final Completion<T> completion;
  private final EntityHierarchy<T> hierarchy;
  private final int chunkSize;

  public EntityHardDeletion(
      final Preparation<T> preparation,
      final Cleanup<T> cleanup,
      final Completion<T> completion,
      final EntityHierarchy<T> hierarchy,
      final int chunkSize) {
    if (chunkSize <= 0) {
      throw new IllegalArgumentException("Hard-delete chunk size must be positive");
    }
    this.preparation = preparation;
    this.cleanup = cleanup;
    this.completion = completion;
    this.hierarchy = hierarchy;
    this.chunkSize = chunkSize;
  }

  public void delete(final List<UUID> ids, final String actor) {
    if (nullOrEmpty(ids)) {
      return;
    }
    for (int start = 0; start < ids.size(); start += chunkSize) {
      deleteChunk(ids.subList(start, Math.min(start + chunkSize, ids.size())), actor);
    }
  }

  private void deleteChunk(final List<UUID> ids, final String actor) {
    final List<T> entities;
    try (var ignored = phase("bulkHardDeleteLoad")) {
      entities = preparation.load().apply(ids);
    }
    if (!entities.isEmpty()) {
      final Runnable exit = preparation.enterCascade().apply(entities);
      try {
        prepare(entities, actor);
        purge(entities, actor);
        publish(entities);
      } finally {
        exit.run();
      }
    }
  }

  private void prepare(final List<T> entities, final String actor) {
    preparation.hydrate().accept(entities);
    entities.forEach(entity -> preparation.beforeDelete().accept(entity, actor));
    hierarchy.walk(entities, EntityHierarchy.Action.HARD_DELETE, actor);
  }

  private void purge(final List<T> entities, final String actor) {
    cleanup.entitySpecific().accept(entities, actor);
    // HAS-related children must be discovered while their relationship rows still exist.
    entities.forEach(entity -> cleanup.additionalChildren().accept(entity.getId(), actor));
    cleanup.purge().accept(entities);
  }

  private void publish(final List<T> entities) {
    completion.invalidate().accept(entities);
    final boolean covered = completion.searchCoveredByAncestor().getAsBoolean();
    for (final T entity : entities) {
      completion.deleted().accept(entity);
      if (!covered) {
        completion.removeFromSearch().accept(entity);
      }
    }
  }
}
