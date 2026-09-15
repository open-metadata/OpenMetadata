package org.openmetadata.service.entity.write;

/** Validates and prepares an entity before its create or update command. */
@FunctionalInterface
public interface EntityPrepares<T> {
  void prepare(T entity, boolean update);
}
