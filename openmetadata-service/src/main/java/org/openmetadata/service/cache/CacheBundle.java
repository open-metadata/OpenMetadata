package org.openmetadata.service.cache;

import com.codahale.metrics.health.HealthCheck;
import io.dropwizard.core.ConfiguredBundle;
import io.dropwizard.core.setup.Bootstrap;
import io.dropwizard.core.setup.Environment;
import io.dropwizard.lifecycle.Managed;
import io.micrometer.core.instrument.Metrics;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;

@Slf4j
public class CacheBundle implements ConfiguredBundle<OpenMetadataApplicationConfig> {

  private static CacheBundle instance;
  private static CacheProvider cacheProvider;
  private static CachedEntityDao cachedEntityDao;
  private static CachedRelationshipDao cachedRelationshipDao;
  private static CachedTagUsageDao cachedTagUsageDao;
  private static CachedReadBundle cachedReadBundle;
  private static AncestorsCache ancestorsCache;
  private static ChildrenPageCache childrenPageCache;
  private static CachedSearchLayer cachedSearchLayer;
  private static CachedLineage cachedLineage;
  private static NotFoundCache notFoundCache;
  private static CacheInvalidationPubSub cacheInvalidationPubSub;
  private static CacheConfig cacheConfig;
  // Registry of cache layers that implement Invalidatable. Both the pub-sub handler (remote pod
  // writes) and CacheBundle.invalidateEntity (local mutations) iterate this list and fan out a
  // single (type, id, fqn) tuple to every registered layer. New cache layers should call
  // registerInvalidatable() in their owner — typically here in run(), right after construction.
  private static final java.util.List<Invalidatable> INVALIDATABLES =
      new java.util.concurrent.CopyOnWriteArrayList<>();

  public CacheBundle() {
    instance = this;
  }

  public static CacheBundle getInstance() {
    return instance;
  }

  @Override
  public void initialize(Bootstrap<?> bootstrap) {}

  @Override
  public void run(OpenMetadataApplicationConfig configuration, Environment environment) {
    cacheConfig = configuration.getCacheConfig();

    LOG.info("CacheBundle.run() called with cacheConfig: {}", cacheConfig);

    if (cacheConfig == null || cacheConfig.provider == CacheConfig.Provider.none) {
      LOG.info("Cache is disabled. Using NoopCacheProvider.");
      cacheProvider = new NoopCacheProvider();
      return;
    }

    try {
      LOG.info("Initializing cache with provider: {}", cacheConfig.provider);

      CacheMetrics.initialize(Metrics.globalRegistry);

      switch (cacheConfig.provider) {
        case redis:
          cacheProvider = new RedisCacheProvider(cacheConfig);
          break;
        default:
          LOG.warn("Unknown cache provider: {}. Using NoopCacheProvider.", cacheConfig.provider);
          cacheProvider = new NoopCacheProvider();
          return;
      }

      CacheKeys keys = new CacheKeys(cacheConfig.redis.keyspace);
      cachedEntityDao = new CachedEntityDao(cacheProvider, keys, cacheConfig);
      cachedRelationshipDao =
          new CachedRelationshipDao(Entity.getCollectionDAO(), cacheProvider, keys, cacheConfig);
      cachedTagUsageDao =
          new CachedTagUsageDao(Entity.getCollectionDAO(), cacheProvider, keys, cacheConfig);
      cachedReadBundle = new CachedReadBundle(cacheProvider, keys, cacheConfig);
      ancestorsCache = new AncestorsCache(cacheProvider, keys, cacheConfig);
      childrenPageCache = new ChildrenPageCache(cacheProvider, keys, cacheConfig);
      cachedSearchLayer = new CachedSearchLayer(cacheProvider, keys, cacheConfig);
      cachedLineage = new CachedLineage(cacheProvider, keys, cacheConfig);
      notFoundCache = new NotFoundCache(cacheProvider, keys, cacheConfig);
      // Register all id-keyed cache layers that participate in entity-write invalidation.
      // Layers with type/fqn-keyed semantics (CachedReadBundle, AncestorsCache, etc.) keep
      // their existing wiring for now — see .context/cache-improvements-design.md P1.3 for
      // the full audit and the planned migration of those layers to the registry.
      registerInvalidatable(cachedLineage);
      registerInvalidatable(notFoundCache);
      cacheInvalidationPubSub = new CacheInvalidationPubSub(cacheConfig);
      cacheInvalidationPubSub.setHandler(
          msg -> {
            try {
              // Out-of-band signal: a session was revoked on another pod, drop any WebSocket
              // connections this pod is holding for that user. Encoded as type=session, op=revoke,
              // id=<userId> so it rides the existing channel without needing a second subscriber.
              if ("session".equals(msg.type()) && "revoke".equals(msg.op()) && msg.id() != null) {
                org.openmetadata.service.socket.WebSocketManager wsManager =
                    org.openmetadata.service.socket.WebSocketManager.getInstance();
                if (wsManager != null) {
                  if (msg.fqn() != null) {
                    wsManager.disconnectForSession(msg.id(), msg.fqn());
                  } else {
                    wsManager.disconnectAllForUser(msg.id());
                  }
                }
                return;
              }
              org.openmetadata.service.jdbi3.EntityRepository.onRemoteCacheInvalidate(
                  msg.type(), msg.id(), msg.fqn());
              if (msg.id() != null && cachedReadBundle != null) {
                cachedReadBundle.invalidate(msg.type(), msg.id());
              }
              // Fan invalidation out to every Invalidatable registered with the bundle. This is
              // the path new cache layers should plug into — implement Invalidatable, call
              // registerInvalidatable, and the remote-pod invalidation Just Works.
              for (Invalidatable layer : INVALIDATABLES) {
                // NotFoundCache is Redis-backed and therefore already shared by every pod. A
                // remote entity invalidation must not delete a hard-delete tombstone that the
                // writer just installed after removing the row. Create/restore paths still clear
                // the shared marker directly through CacheBundle.invalidateEntity().
                if (layer instanceof NotFoundCache) {
                  continue;
                }
                try {
                  layer.invalidate(msg.type(), msg.id(), msg.fqn());
                } catch (Exception ex) {
                  LOG.debug("Invalidatable {} failed for {}", layer, msg, ex);
                }
              }
              // Container-only derived caches: ancestors keyed by descendant FQN, children-page
              // keyed by parent FQN. Other entity types don't have these caches today, so this
              // gate keeps unrelated invalidations from doing redundant Redis work on every
              // table / dashboard / user write.
              if (msg.fqn() != null
                  && org.openmetadata.service.Entity.CONTAINER.equals(msg.type())) {
                if (ancestorsCache != null) {
                  ancestorsCache.invalidate(msg.type(), msg.fqn());
                }
                if (childrenPageCache != null) {
                  // Two children-page caches need rotation:
                  //   1. The parent's — the parent's child list changed (this row was added,
                  //      renamed, or removed under it).
                  //   2. The container's own — if the changed container is itself a parent
                  //      (typical for buckets/folders), its /children pages cached on this
                  //      pod must be invalidated too. Otherwise a delete on the writer leaves
                  //      readers serving 200 with the old child list until the page TTL.
                  childrenPageCache.invalidate(msg.type(), msg.fqn());
                  String parentFqn =
                      org.openmetadata.service.util.FullyQualifiedName.getParentFQN(msg.fqn());
                  if (parentFqn != null) {
                    childrenPageCache.invalidate(msg.type(), parentFqn);
                  }
                }
              }
            } catch (Exception e) {
              LOG.debug("Remote invalidation handler failed for {}", msg, e);
            }
          });
      cacheInvalidationPubSub.start();

      environment.lifecycle().manage(new CacheLifecycleManager());
      environment.healthChecks().register("cache", new CacheHealthCheck());

      LOG.info("Cache bundle initialized successfully");

    } catch (Exception e) {
      LOG.error("Failed to initialize cache bundle", e);
      cacheProvider = new NoopCacheProvider();
    }
  }

  public static CacheProvider getCacheProvider() {
    return cacheProvider != null ? cacheProvider : new NoopCacheProvider();
  }

  public static CachedEntityDao getCachedEntityDao() {
    return cachedEntityDao;
  }

  public static CachedRelationshipDao getCachedRelationshipDao() {
    return cachedRelationshipDao;
  }

  public static CachedTagUsageDao getCachedTagUsageDao() {
    return cachedTagUsageDao;
  }

  public static CachedReadBundle getCachedReadBundle() {
    return cachedReadBundle;
  }

  public static AncestorsCache getAncestorsCache() {
    return ancestorsCache;
  }

  public static ChildrenPageCache getChildrenPageCache() {
    return childrenPageCache;
  }

  public static CachedSearchLayer getCachedSearchLayer() {
    return cachedSearchLayer;
  }

  public static CachedLineage getCachedLineage() {
    return cachedLineage;
  }

  public static NotFoundCache getNotFoundCache() {
    return notFoundCache;
  }

  /**
   * Register an {@link Invalidatable} cache layer with the bundle. Both the pub-sub handler
   * (remote pod writes) and {@link #invalidateEntity} (local mutations) iterate registered
   * layers and call {@code invalidate(type, id, fqn)} on each. Idempotent — safe to call
   * multiple times for the same instance.
   */
  public static void registerInvalidatable(Invalidatable layer) {
    if (layer != null && !INVALIDATABLES.contains(layer)) {
      INVALIDATABLES.add(layer);
    }
  }

  /**
   * Fan an entity-write invalidation out to every registered {@link Invalidatable}. Today
   * this is invoked from {@code EntityRepository.invalidateCacheForEntity(type, id, fqn)}
   * (the static helper called from {@code postCreate} and other mutation paths), from the
   * pub-sub handler above when a remote pod publishes a write, and from the admin
   * {@code POST /system/cache/invalidate} endpoint.
   *
   * <p>Entity creates call this directly, while update, delete, and restore paths reach it through
   * the repository's mutation cache invalidation. New mutation paths must do the same so registered
   * layers such as the negative cache cannot outlive a successful write.
   *
   * <p>No-op if no layers are registered (cache disabled or none registered yet).
   */
  public static void invalidateEntity(String type, UUID id, String fqn) {
    for (Invalidatable layer : INVALIDATABLES) {
      try {
        layer.invalidate(type, id, fqn);
      } catch (Exception e) {
        LOG.debug("Invalidatable {} failed for type={} id={} fqn={}", layer, type, id, fqn, e);
      }
    }
  }

  public static Set<UUID> invalidateEntities(String type, Map<UUID, String> entities) {
    if (entities == null || entities.isEmpty()) {
      return Set.of();
    }
    Set<UUID> hardDeleteWinners = new HashSet<>();
    for (Invalidatable layer : INVALIDATABLES) {
      try {
        if (layer instanceof NotFoundCache negativeCache) {
          hardDeleteWinners.addAll(negativeCache.invalidateAll(type, entities));
        } else if (layer instanceof CachedLineage lineageCache) {
          lineageCache.invalidateAll(entities.keySet());
        } else {
          entities.forEach((id, fqn) -> layer.invalidate(type, id, fqn));
        }
      } catch (Exception e) {
        LOG.debug("Invalidatable {} failed for {} created entities", layer, entities.size(), e);
      }
    }
    return hardDeleteWinners;
  }

  /**
   * Invalidate an entity after an update while preserving a hard-delete tombstone that may have
   * committed between the database update and its post-commit cache write-through.
   */
  public static boolean invalidateEntityPreservingHardDelete(String type, UUID id, String fqn) {
    boolean hardDeleteWon = false;
    for (Invalidatable layer : INVALIDATABLES) {
      try {
        if (layer instanceof NotFoundCache negativeCache) {
          hardDeleteWon |= negativeCache.invalidatePreservingHardDelete(type, id, fqn);
        } else {
          layer.invalidate(type, id, fqn);
        }
      } catch (Exception e) {
        LOG.debug(
            "Invalidatable {} failed after update for type={} id={} fqn={}",
            layer,
            type,
            id,
            fqn,
            e);
      }
    }
    return hardDeleteWon;
  }

  public static CacheInvalidationPubSub getCacheInvalidationPubSub() {
    return cacheInvalidationPubSub;
  }

  public static CacheConfig getCacheConfig() {
    return cacheConfig;
  }

  private static class CacheLifecycleManager implements Managed {
    @Override
    public void start() {
      LOG.debug("Cache lifecycle started");
    }

    @Override
    public void stop() {
      try {
        if (cacheInvalidationPubSub != null) {
          cacheInvalidationPubSub.stop();
        }
        if (cacheProvider != null) {
          cacheProvider.close();
        }
        LOG.info("Cache provider closed successfully");
      } catch (Exception e) {
        LOG.error("Error closing cache provider", e);
      }
    }
  }

  private static class CacheHealthCheck extends HealthCheck {
    @Override
    protected Result check() {
      try {
        if (cacheProvider == null) {
          return Result.unhealthy("Cache provider not initialized");
        }

        if (!cacheProvider.available()) {
          return Result.unhealthy("Cache provider not available");
        }

        String testKey = "health:check:" + System.currentTimeMillis();
        cacheProvider.set(testKey, "test", java.time.Duration.ofSeconds(5));
        var result = cacheProvider.get(testKey);
        cacheProvider.del(testKey);

        if (result.isPresent() && "test".equals(result.get())) {
          return Result.healthy("Cache is responding");
        } else {
          return Result.unhealthy("Cache read/write test failed");
        }
      } catch (Exception e) {
        return Result.unhealthy("Cache health check failed: " + e.getMessage());
      }
    }
  }
}
