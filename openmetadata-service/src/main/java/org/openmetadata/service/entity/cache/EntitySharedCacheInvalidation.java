package org.openmetadata.service.entity.cache;

import java.util.UUID;
import org.openmetadata.service.cache.CachedEntityDao;
import org.openmetadata.service.cache.CachedLineage;
import org.openmetadata.service.cache.CachedReadBundle;
import org.openmetadata.service.cache.CachedRelationshipDao;
import org.openmetadata.service.cache.CachedTagUsageDao;

/** Shared-cache eviction profiles; callers retain the owning post-commit boundary. */
public final class EntitySharedCacheInvalidation {
  private static final String REFERENCE_CHANGE = "ref-change";
  private static final String INVALIDATE = "invalidate";
  private static final String UPDATE = "update";
  private static final String RENAME_OLD = "rename-old";
  private final EntityCacheLayers layers;

  public EntitySharedCacheInvalidation(final EntityCacheLayers layers) {
    this.layers = layers;
  }

  public void referencesChanged(final String type, final UUID id, final String fqn) {
    evictAliases(layers.entities(), type, id, fqn);
    evictDerivedViews(type, id);
    layers.publish(type, id, fqn, REFERENCE_CHANGE);
  }

  public void metadataChanged(final String type, final UUID id, final String fqn) {
    evictAliases(layers.entities(), type, id, fqn);
    evictDerivedViews(type, id);
    final CachedTagUsageDao tags = layers.tags();
    if (tags != null) {
      tags.invalidateTags(type, id);
    }
    layers.publish(type, id, fqn, UPDATE);
  }

  public void entityDeleted(final String type, final UUID id, final String fqn) {
    evictDeletedAliases(type, id, fqn);
    evictDerivedViews(type, id);
    final CachedTagUsageDao tags = layers.tags();
    if (tags != null) {
      tags.invalidateTags(type, id);
    }
    layers.publish(type, id, fqn, INVALIDATE);
  }

  public void beforeWriteThrough(
      final String type, final UUID id, final String fqn, final String previousFqn) {
    final CachedEntityDao entities = layers.entities();
    evictAliases(entities, type, id, fqn);
    if (entities != null && renamed(fqn, previousFqn)) {
      entities.invalidateByName(type, previousFqn);
    }
    evictDerivedViews(type, id);
  }

  public void afterWriteThrough(
      final String type, final UUID id, final String fqn, final String previousFqn) {
    layers.publish(type, id, fqn, UPDATE);
    if (renamed(fqn, previousFqn)) {
      layers.publish(type, id, previousFqn, RENAME_OLD);
    }
  }

  private static boolean renamed(final String fqn, final String previousFqn) {
    return previousFqn != null && !previousFqn.equals(fqn);
  }

  private void evictAliases(
      final CachedEntityDao entities, final String type, final UUID id, final String fqn) {
    if (entities != null) {
      entities.invalidateBase(type, id);
      if (fqn != null) {
        entities.invalidateByName(type, fqn);
      }
    }
  }

  private void evictDeletedAliases(final String type, final UUID id, final String fqn) {
    final CachedEntityDao entities = layers.entities();
    if (entities != null) {
      entities.invalidateBase(type, id);
      entities.invalidateByName(type, fqn);
      entities.invalidateReference(type, id);
      entities.invalidateReferenceByName(type, fqn);
    }
  }

  private void evictDerivedViews(final String type, final UUID id) {
    evictRelationships(type, id);
    final CachedReadBundle bundles = layers.bundles();
    if (bundles != null) {
      bundles.invalidate(type, id);
    }
    final CachedLineage lineage = layers.lineage();
    if (lineage != null) {
      lineage.invalidate(id);
    }
  }

  private void evictRelationships(final String type, final UUID id) {
    final CachedRelationshipDao relationships = layers.relationships();
    if (relationships != null) {
      relationships.invalidateOwners(type, id);
      relationships.invalidateDomains(type, id);
      relationships.invalidateContainer(type, id);
    }
  }
}
