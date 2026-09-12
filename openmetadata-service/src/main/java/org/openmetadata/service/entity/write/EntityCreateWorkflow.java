package org.openmetadata.service.entity.write;

import static org.openmetadata.service.monitoring.RequestLatencyContext.phase;

import java.util.List;
import java.util.function.Consumer;
import org.openmetadata.schema.EntityInterface;

/** Keeps create persistence inside existing transaction boundaries and publishes effects after each flush. */
public final class EntityCreateWorkflow<T extends EntityInterface> {
  public record Writes<T>(
      Consumer<T> row,
      Consumer<T> extensions,
      Consumer<T> columnExtensions,
      Consumer<T> relationships) {}

  public record Effects<T>(
      Consumer<T> inherit, Consumer<T> created, Consumer<T> cache, Runnable clearCapturedJson) {}

  public record Batch<T>(
      Consumer<List<T>> rows,
      Consumer<List<T>> extensions,
      Consumer<List<T>> relationships,
      Consumer<List<T>> inherit,
      Consumer<List<T>> created) {}

  private final Writes<T> writes;
  private final Effects<T> effects;
  private final Batch<T> batch;
  private final Consumer<Runnable> flush;
  private final int chunkSize;

  public EntityCreateWorkflow(
      final Writes<T> writes,
      final Effects<T> effects,
      final Batch<T> batch,
      final Consumer<Runnable> flush,
      final int chunkSize) {
    if (chunkSize <= 0) {
      throw new IllegalArgumentException("Create transaction chunk size must be positive");
    }
    this.writes = writes;
    this.effects = effects;
    this.batch = batch;
    this.flush = flush;
    this.chunkSize = chunkSize;
  }

  public T create(final T entity) {
    try {
      flush.accept(() -> persist(entity));
      publish(entity);
      return entity;
    } finally {
      effects.clearCapturedJson().run();
    }
  }

  private void persist(final T entity) {
    try (var ignored = phase("createStoreEntity")) {
      writes.row().accept(entity);
      writes.extensions().accept(entity);
      writes.columnExtensions().accept(entity);
    }
    try (var ignored = phase("createStoreRelationships")) {
      writes.relationships().accept(entity);
    }
  }

  private void publish(final T entity) {
    try (var ignored = phase("createSetInheritedFields")) {
      effects.inherit().accept(entity);
    }
    try (var ignored = phase("createPostCreate")) {
      effects.created().accept(entity);
    }
    try (var ignored = phase("createWriteThroughCache")) {
      effects.cache().accept(entity);
    }
  }

  public List<T> createMany(final List<T> entities) {
    flushMany(entities);
    try (var ignored = phase("setInheritedFields")) {
      batch.inherit().accept(entities);
    }
    try (var ignored = phase("postCreate")) {
      batch.created().accept(entities);
    }
    return entities;
  }

  private void flushMany(final List<T> entities) {
    for (int start = 0; start < entities.size(); start += chunkSize) {
      final List<T> chunk = entities.subList(start, Math.min(start + chunkSize, entities.size()));
      flush.accept(() -> persistMany(chunk));
    }
  }

  private void persistMany(final List<T> entities) {
    try (var ignored = phase("storeEntities")) {
      batch.rows().accept(entities);
      batch.extensions().accept(entities);
    }
    try (var ignored = phase("storeRelationships")) {
      batch.relationships().accept(entities);
    }
  }
}
