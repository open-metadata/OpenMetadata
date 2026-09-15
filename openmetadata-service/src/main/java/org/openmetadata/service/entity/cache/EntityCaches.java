package org.openmetadata.service.entity.cache;

import com.google.common.cache.LoadingCache;
import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.tuple.Pair;
import org.openmetadata.service.Entity;
import org.openmetadata.service.cache.CacheBundle;
import org.openmetadata.service.config.CacheConfiguration;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.util.RequestEntityCache;
import org.openmetadata.service.workflows.searchIndex.ReindexingUtil;

/** Shared application cache runtime; callers always obtain the currently configured caches. */
@Slf4j
public final class EntityCaches {
  private static final EntityCacheEpochs EPOCHS = new EntityCacheEpochs();
  private static final EntityCacheLoaders LOADERS =
      new EntityCacheLoaders(Entity::getEntityRepository, CacheBundle::getCachedEntityDao, EPOCHS);
  private static final EntityLocalCache LOCAL =
      new EntityLocalCache(LOADERS::byId, LOADERS::byName, new CacheConfiguration());
  private static final EntityCacheRepair REPAIRS = new EntityCacheRepair(LOCAL);

  private static final EntitySharedCacheInvalidation SHARED_INVALIDATION =
      new EntitySharedCacheInvalidation(new CacheBundleLayers());

  private static final EntityCacheInvalidation INVALIDATION =
      new EntityCacheInvalidation(
          LOCAL,
          EPOCHS,
          SHARED_INVALIDATION,
          new EntityCacheInvalidation.Effects(
              REPAIRS::scheduleRepair,
              RequestEntityCache::invalidate,
              CacheBundle::invalidateEntity));
  private static final EntityCacheTargets TARGETS = createCacheTargets();

  public static EntityCacheInvalidation invalidations() {
    return INVALIDATION;
  }

  public static EntityCacheRepair repairs() {
    return REPAIRS;
  }

  public static EntityCacheTargets targets() {
    return TARGETS;
  }

  private EntityCaches() {}

  private static EntityCacheTargets createCacheTargets() {
    return new EntityCacheTargets(
        (type, prefix) -> {
          final EntityCacheSource repository = Entity.getEntityRepository(type);
          return repository == null || repository.getDao() == null
              ? List.of()
              : repository.getDao().listDescendantIdFqnByPrefix(prefix);
        },
        (tagFqn, offset) ->
            ReindexingUtil.findReferenceInElasticSearchAcrossAllIndexes(
                "tags.tagFQN", ReindexingUtil.escapeDoubleQuotes(tagFqn), offset),
        new EntityCacheTargets.SearchDeferral() {
          @Override
          public boolean active() {
            return SearchRepository.isSearchWriteDeferralActive();
          }

          @Override
          public void defer(Runnable search, String tagFqn) {
            SearchRepository.deferOrRunSearchWrite(
                search, "invalidateCacheForTaggedEntities", null, tagFqn, null);
          }
        },
        INVALIDATION::referencesChanged);
  }

  public static LoadingCache<Pair<String, UUID>, String> byId() {
    return LOCAL.byId();
  }

  public static LoadingCache<Pair<String, String>, String> byName() {
    return LOCAL.byName();
  }

  public static EntityCacheEpochs epochs() {
    return EPOCHS;
  }

  public static void configure(final CacheConfiguration config) {
    LOCAL.configure(config);
    LOG.info(
        "Entity caches initialized: maxWeight={}MB, ttl={}s",
        config.getEntityCacheMaxSizeBytes() / (1024 * 1024),
        config.getEntityCacheTTLSeconds());
  }
}
