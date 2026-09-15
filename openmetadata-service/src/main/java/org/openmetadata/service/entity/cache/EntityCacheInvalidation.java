package org.openmetadata.service.entity.cache;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.entity.write.DeferredCacheInvalidations;
import org.openmetadata.service.entity.write.DeferredCacheInvalidations.Invalidator;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipRecord;
import org.openmetadata.service.util.PostCommitActionQueue;

/** Keeps local eviction inline and shared publication at the existing owning commit boundary. */
@Slf4j
public final class EntityCacheInvalidation {
  private static final String FULLY_QUALIFIED_NAME = "fullyQualifiedName";

  @FunctionalInterface
  public interface Repair {
    void schedule(String type, UUID id, String fqn, String previousFqn);
  }

  public record Effects(Repair repair, Invalidator request, Invalidator registeredLayers) {}

  private final EntityLocalCache local;
  private final EntityCacheEpochs epochs;
  private final EntitySharedCacheInvalidation shared;
  private final Effects effects;
  private final DeferredCacheInvalidations deferred;

  public EntityCacheInvalidation(
      final EntityLocalCache local,
      final EntityCacheEpochs epochs,
      final EntitySharedCacheInvalidation shared,
      final Effects effects) {
    this.local = local;
    this.epochs = epochs;
    this.shared = shared;
    this.effects = effects;
    deferred =
        new DeferredCacheInvalidations(
            this::sharedReferencesChanged, this::committedReferencesChanged);
  }

  public DeferredCacheInvalidations deferred() {
    return deferred;
  }

  public void referencesChanged(final String type, final UUID id, final String fqn) {
    if (type != null && id != null) {
      epochs.advance(type, id, fqn);
      local.byId().invalidate(EntityCacheKeys.id(type, id));
      effects.repair().schedule(type, id, fqn, null);
      if (fqn != null) {
        local.byName().invalidate(EntityCacheKeys.name(type, fqn));
      }
      deferred.deferOrRun(type, id, fqn);
    }
  }

  private void sharedReferencesChanged(final String type, final UUID id, final String fqn) {
    if (EntityCachePolicy.isCacheable(type)) {
      shared.referencesChanged(type, id, fqn);
    }
  }

  private void committedReferencesChanged(final String type, final UUID id, final String fqn) {
    try {
      sharedReferencesChanged(type, id, fqn);
    } finally {
      // Readers can refill L1 from the previous committed row after the inline invalidation.
      // Evict after Redis so a refill cannot retain a shared entry awaiting deletion.
      remotelyChanged(type, id, fqn);
      effects.request().invalidate(type, id, fqn);
    }
  }

  public void remotelyChanged(final String type, final UUID id, final String fqn) {
    if (type != null) {
      epochs.advance(type, id, fqn);
      if (id != null) {
        local.byId().invalidate(EntityCacheKeys.id(type, id));
      }
      if (fqn != null) {
        local.byName().invalidate(EntityCacheKeys.name(type, fqn));
      }
    }
  }

  public void beforeEntityInvalidation(final String type, final UUID id, final String fqn) {
    epochs.advance(type, id, fqn);
    evictLocal(type, id, fqn);
    effects.request().invalidate(type, id, fqn);
    effects.repair().schedule(type, id, fqn, null);
  }

  public void entityDeleted(final String type, final UUID id, final String fqn) {
    try {
      evictLocal(type, id, fqn);
      shared.entityDeleted(type, id, fqn);
      LOG.debug("Invalidated cache for deleted entity: {} {}", type, id);
    } catch (RuntimeException exception) {
      LOG.warn("Failed to invalidate cache for entity: {} {}", type, id, exception);
    }
  }

  /** Called after a committed metadata write, before rebuilding search or other projections. */
  public void metadataChanged(final String type, final UUID id, final String fqn) {
    beforeEntityInvalidation(type, id, fqn);
    shared.metadataChanged(type, id, fqn);
    registeredAfterCommit(type, id, fqn);
  }

  public void prepareStored(
      final String type, final UUID id, final String fqn, final String previousFqn) {
    epochs.advance(type, id, fqn);
    final boolean renamed = previousFqn != null && !previousFqn.equals(fqn);
    if (renamed) {
      epochs.advance(type, null, previousFqn);
    }
    evictLocal(type, id, fqn);
    if (renamed) {
      local.byName().invalidate(EntityCacheKeys.name(type, previousFqn));
    }
    shared.beforeWriteThrough(type, id, fqn, previousFqn);
  }

  public void finishStored(
      final String type, final UUID id, final String fqn, final String previousFqn) {
    effects.request().invalidate(type, id, fqn);
    registeredAfterCommit(type, id, fqn);
    effects.repair().schedule(type, id, fqn, previousFqn);
    shared.afterWriteThrough(type, id, fqn, previousFqn);
  }

  public void registeredAfterCommit(final String type, final UUID id, final String fqn) {
    PostCommitActionQueue.runOrDefer(() -> effects.registeredLayers().invalidate(type, id, fqn));
  }

  public void referenced(final EntityRelationshipRecord record) {
    if (record != null) {
      referencesChanged(record.getType(), record.getId(), extractFqn(record.getJson()));
    }
  }

  private void evictLocal(final String type, final UUID id, final String fqn) {
    local.byId().invalidate(EntityCacheKeys.id(type, id));
    local.byName().invalidate(EntityCacheKeys.name(type, fqn));
  }

  private static String extractFqn(final String json) {
    if (nullOrEmpty(json)) {
      return null;
    }
    try {
      final var node = JsonUtils.readTree(json);
      return node.hasNonNull(FULLY_QUALIFIED_NAME) ? node.get(FULLY_QUALIFIED_NAME).asText() : null;
    } catch (RuntimeException exception) {
      LOG.debug("Failed to extract fullyQualifiedName for cache invalidation", exception);
      return null;
    }
  }
}
