package org.openmetadata.service.entity.cache;

import java.util.UUID;
import org.openmetadata.service.cache.CachedEntityDao;
import org.openmetadata.service.cache.CachedLineage;
import org.openmetadata.service.cache.CachedReadBundle;
import org.openmetadata.service.cache.CachedRelationshipDao;
import org.openmetadata.service.cache.CachedTagUsageDao;

/** Access to the currently configured shared cache layers. */
public interface EntityCacheLayers {
  CachedEntityDao entities();

  CachedRelationshipDao relationships();

  CachedReadBundle bundles();

  CachedLineage lineage();

  CachedTagUsageDao tags();

  void publish(String type, UUID id, String fqn, String operation);
}
