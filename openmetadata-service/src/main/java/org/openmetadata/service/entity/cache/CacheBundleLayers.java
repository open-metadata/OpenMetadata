package org.openmetadata.service.entity.cache;

import java.util.UUID;
import org.openmetadata.service.cache.CacheBundle;
import org.openmetadata.service.cache.CacheInvalidationPubSub;
import org.openmetadata.service.cache.CachedEntityDao;
import org.openmetadata.service.cache.CachedLineage;
import org.openmetadata.service.cache.CachedReadBundle;
import org.openmetadata.service.cache.CachedRelationshipDao;
import org.openmetadata.service.cache.CachedTagUsageDao;

/** Application composition boundary for cache layers initialized after repository registration. */
final class CacheBundleLayers implements EntityCacheLayers {
  @Override
  public CachedEntityDao entities() {
    return CacheBundle.getCachedEntityDao();
  }

  @Override
  public CachedRelationshipDao relationships() {
    return CacheBundle.getCachedRelationshipDao();
  }

  @Override
  public CachedReadBundle bundles() {
    return CacheBundle.getCachedReadBundle();
  }

  @Override
  public CachedLineage lineage() {
    return CacheBundle.getCachedLineage();
  }

  @Override
  public CachedTagUsageDao tags() {
    return CacheBundle.getCachedTagUsageDao();
  }

  @Override
  public void publish(final String type, final UUID id, final String fqn, final String operation) {
    final CacheInvalidationPubSub pubsub = CacheBundle.getCacheInvalidationPubSub();
    if (pubsub != null) {
      pubsub.publish(type, id, fqn, operation);
    }
  }
}
