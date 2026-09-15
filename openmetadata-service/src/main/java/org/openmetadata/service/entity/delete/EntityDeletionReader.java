package org.openmetadata.service.entity.delete;

import java.util.UUID;
import java.util.function.Consumer;
import java.util.function.Function;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.exception.EntityRelationshipNotFoundException;

/** Allows deletion of dangling references without relaxing normal read or write validation. */
@Slf4j
public final class EntityDeletionReader<T extends EntityInterface> {
  public record Queries<T>(Function<UUID, T> hydrated, Function<UUID, T> stored) {}

  private final String entityType;
  private final Consumer<T> hydrate;
  private final Queries<T> queries;

  public EntityDeletionReader(
      final String entityType, final Consumer<T> hydrate, final Queries<T> queries) {
    this.entityType = entityType;
    this.hydrate = hydrate;
    this.queries = queries;
  }

  public void hydrate(final T entity) {
    try {
      hydrate.accept(entity);
    } catch (EntityNotFoundException | EntityRelationshipNotFoundException exception) {
      LOG.warn(
          "Proceeding with delete of {} {} despite a dangling reference while resolving fields: {}",
          entityType,
          entity.getId(),
          exception.getMessage());
    }
  }

  public T load(final UUID id) {
    try {
      return queries.hydrated().apply(id);
    } catch (EntityNotFoundException | EntityRelationshipNotFoundException exception) {
      LOG.warn(
          "Loading {} {} with stored fields only for delete due to a dangling reference: {}",
          entityType,
          id,
          exception.getMessage());
      return queries.stored().apply(id);
    }
  }
}
