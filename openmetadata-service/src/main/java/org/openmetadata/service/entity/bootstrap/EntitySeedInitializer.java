package org.openmetadata.service.entity.bootstrap;

import static org.openmetadata.service.Entity.ADMIN_USER_NAME;

import java.time.Clock;
import java.util.List;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.function.Function;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;

/** Initializes missing seeds through the entity's existing creation policy. */
@Slf4j
public final class EntitySeedInitializer<T extends EntityInterface> {
  public record Operations<T>(Function<String, T> existing, Consumer<T> create, Runnable failure) {}

  private final String entityType;
  private final Operations<T> operations;
  private final Clock clock;

  public EntitySeedInitializer(
      final String entityType, final Operations<T> operations, final Clock clock) {
    this.entityType = entityType;
    this.operations = operations;
    this.clock = clock;
  }

  public void initializeAll(final List<T> entities) {
    for (final T entity : entities) {
      try {
        initialize(entity);
      } catch (RuntimeException failure) {
        operations.failure().run();
        LOG.warn(
            "Failed to initialize {} '{}': {}",
            entityType,
            entity.getFullyQualifiedName(),
            failure.getMessage(),
            failure);
      }
    }
  }

  public void initialize(final T entity) {
    final T existing = operations.existing().apply(entity.getFullyQualifiedName());
    if (existing != null) {
      LOG.debug("{} {} is already initialized", entityType, entity.getFullyQualifiedName());
      return;
    }
    LOG.debug("{} {} is not initialized", entityType, entity.getFullyQualifiedName());
    entity.setUpdatedBy(ADMIN_USER_NAME);
    entity.setUpdatedAt(clock.millis());
    entity.setId(UUID.randomUUID());
    operations.create().accept(entity);
    LOG.debug("Created a new {} {}", entityType, entity.getFullyQualifiedName());
  }
}
