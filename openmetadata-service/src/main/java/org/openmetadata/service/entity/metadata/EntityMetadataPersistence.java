package org.openmetadata.service.entity.metadata;

import java.util.List;
import java.util.function.Consumer;
import org.openmetadata.schema.EntityInterface;

/** Ordered metadata writes that participate in their caller's retained transaction. */
public final class EntityMetadataPersistence<T extends EntityInterface> {
  private final List<Consumer<T>> single;
  private final List<Consumer<List<T>>> batch;
  private final List<Consumer<List<T>>> cleanup;

  public EntityMetadataPersistence(
      final List<Consumer<T>> single,
      final List<Consumer<List<T>>> batch,
      final List<Consumer<List<T>>> cleanup) {
    this.single = List.copyOf(single);
    this.batch = List.copyOf(batch);
    this.cleanup = List.copyOf(cleanup);
  }

  public void store(final T entity) {
    for (final Consumer<T> step : single) {
      step.accept(entity);
    }
  }

  public void storeMany(final List<T> entities) {
    if (!entities.isEmpty()) {
      for (final Consumer<List<T>> step : batch) {
        step.accept(entities);
      }
    }
  }

  public void clearMany(final List<T> entities) {
    for (final Consumer<List<T>> step : cleanup) {
      step.accept(entities);
    }
  }
}
