package org.openmetadata.service.entity.write;

import java.util.function.BiConsumer;
import java.util.function.Consumer;

/** Produces the validated entity and its canonical name once for each preparation. */
public final class EntityPreparation<T> implements EntityPrepares<T> {
  public record Steps<T>(
      Consumer<T> tags,
      BiConsumer<T, Boolean> entity,
      Consumer<T> name,
      BiConsumer<T, Boolean> extension,
      BiConsumer<T, Boolean> status) {}

  private final Steps<T> steps;

  public EntityPreparation(final Steps<T> steps) {
    this.steps = steps;
  }

  @Override
  public void prepare(final T entity, final boolean update) {
    steps.tags().accept(entity);
    steps.entity().accept(entity, update);
    steps.name().accept(entity);
    steps.extension().accept(entity, update);
    steps.status().accept(entity, update);
  }
}
