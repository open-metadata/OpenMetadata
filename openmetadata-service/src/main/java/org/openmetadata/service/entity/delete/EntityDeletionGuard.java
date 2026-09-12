package org.openmetadata.service.entity.delete;

import java.util.UUID;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.entity.delete.EntityDeletionService.Request;
import org.openmetadata.service.entity.delete.EntityDeletionService.Scope;
import org.openmetadata.service.lock.HierarchicalLockManager;

/** Preserves best-effort recursive lock acquisition and release around a deletion. */
@Slf4j
public final class EntityDeletionGuard implements EntityDeletionService.Guard<EntityInterface> {
  private static final Scope UNLOCKED = () -> {};
  private final String entityType;
  private final Supplier<HierarchicalLockManager> manager;

  public EntityDeletionGuard(
      final String entityType, final Supplier<HierarchicalLockManager> manager) {
    this.entityType = entityType;
    this.manager = manager;
  }

  @Override
  public Scope acquire(final EntityInterface entity, final Request request) {
    final HierarchicalLockManager locks = manager.get();
    if (locks == null || !request.recursive()) {
      return UNLOCKED;
    }
    try {
      final var lock = locks.acquireDeletionLock(entity, request.actor(), request.recursive());
      LOG.info("Acquired deletion lock for {} {}", entityType, entity.getId());
      return lock == null ? UNLOCKED : () -> release(entity.getId());
    } catch (RuntimeException exception) {
      LOG.error(
          "Failed to acquire deletion lock for {} {}: {}",
          entityType,
          entity.getId(),
          exception.getMessage());
      return UNLOCKED;
    }
  }

  private void release(final UUID id) {
    final HierarchicalLockManager locks = manager.get();
    if (locks == null) {
      return;
    }
    try {
      locks.releaseDeletionLock(id, entityType);
      LOG.info("Released deletion lock for {} {}", entityType, id);
    } catch (RuntimeException exception) {
      LOG.error(
          "Failed to release deletion lock for {} {}: {}", entityType, id, exception.getMessage());
    }
  }
}
