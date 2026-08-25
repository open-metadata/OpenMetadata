package org.openmetadata.sdk.fluent.request;

import java.util.function.Function;

/**
 * Fluent builder for update operations.
 *
 * Usage:
 * <pre>
 * // Update with fluent pattern
 * Table updated = Tables.update(id)
 *     .set(table)
 *     .execute();
 *
 * // Or with entity
 * Table updated = Tables.update(table)
 *     .execute();
 * </pre>
 *
 * @param <T> The entity type being updated
 */
public class UpdateRequest<T> {
  private final String id;
  private T entity;
  private final Function<T, T> updateFunction;

  public UpdateRequest(String id, Function<T, T> updateFunction) {
    this.id = id;
    this.updateFunction = updateFunction;
  }

  public UpdateRequest(T entity, Function<T, T> updateFunction) {
    this.id = null;
    this.entity = entity;
    this.updateFunction = updateFunction;
  }

  /**
   * Set the entity to update.
   *
   * @param entity The entity with updated fields
   * @return This request for chaining
   */
  public UpdateRequest<T> set(T entity) {
    this.entity = entity;
    return this;
  }

  /**
   * Execute the update.
   *
   * @return The updated entity
   */
  public T execute() {
    if (entity == null) {
      throw new IllegalStateException("Entity must be set before executing update");
    }
    return updateFunction.apply(entity);
  }

  /**
   * Alias for execute().
   *
   * @return The updated entity
   */
  public T save() {
    return execute();
  }
}
