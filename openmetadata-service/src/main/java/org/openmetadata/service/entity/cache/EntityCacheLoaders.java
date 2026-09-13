package org.openmetadata.service.entity.cache;

import static org.openmetadata.schema.type.Include.ALL;

import com.google.common.cache.CacheLoader;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.tuple.Pair;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.cache.CachedEntityDao;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.EntityDAO;

/** Loads canonical JSON through Redis with validation and concurrent-write publication guards. */
@Slf4j
public final class EntityCacheLoaders {
  private final Function<String, EntityCacheSource> sources;
  private final Supplier<CachedEntityDao> redis;
  private final EntityCacheEpochs epochs;
  private final EntityLoaderWithId ids = new EntityLoaderWithId();
  private final EntityLoaderWithName names = new EntityLoaderWithName();

  public EntityCacheLoaders(
      final Function<String, EntityCacheSource> sources,
      final Supplier<CachedEntityDao> redis,
      final EntityCacheEpochs epochs) {
    this.sources = sources;
    this.redis = redis;
    this.epochs = epochs;
  }

  public String byId(final Pair<String, UUID> key) {
    return ids.load(key);
  }

  public String byName(final Pair<String, String> key) {
    return names.load(key);
  }

  private static boolean isValidEntityForCache(final EntityInterface entity) {
    return entity != null && entity.getId() != null && entity.getFullyQualifiedName() != null;
  }

  public static final class LoaderRaceException extends RuntimeException {
    private LoaderRaceException(final String message) {
      super(message);
    }
  }

  private final class EntityLoaderWithName extends CacheLoader<Pair<String, String>, String> {
    @Override
    public String load(Pair<String, String> fqnPair) {
      // Race guard — epoch mismatch means a writer ran during the load; throw so Guava skips
      // caching the now-stale value and find() re-reads via the bypass path.
      long startEpoch = epochs.byName(fqnPair);
      String json = loadInternal(fqnPair, startEpoch);
      if (epochs.byName(fqnPair) != startEpoch) {
        evictExternalCache(fqnPair, json);
        throw new LoaderRaceException("Concurrent write during loadByName: " + fqnPair);
      }
      return json;
    }

    private String loadInternal(final Pair<String, String> key, final long startEpoch) {
      final EntityCacheSource source = sources.apply(key.getLeft());
      final EntityDAO<?> dao = source.getDao();
      final String cached = cachedJson(key, startEpoch, source);
      return cached == null ? databaseJson(key, startEpoch, source, dao) : cached;
    }

    private String cachedJson(
        final Pair<String, String> key, final long startEpoch, final EntityCacheSource source) {
      if (!EntityCachePolicy.isCacheable(key.getLeft()) || epochs.byName(key) != startEpoch) {
        return null;
      }
      final CachedEntityDao cache = redis.get();
      final Optional<String> cached =
          cache == null ? Optional.empty() : cache.getByName(key.getLeft(), key.getRight());
      return cached.isEmpty() ? null : validatedRedisJson(key, source, cache, cached.get());
    }

    private String validatedRedisJson(
        final Pair<String, String> key,
        final EntityCacheSource source,
        final CachedEntityDao cache,
        final String json) {
      try {
        final EntityInterface entity = JsonUtils.readValue(json, source.getEntityClass());
        if (entity.getId() == null || entity.getFullyQualifiedName() == null) {
          LOG.error("Cached entity from name lookup is invalid: {}", key);
          cache.deleteByName(key.getLeft(), key.getRight());
          return null;
        }
        return json;
      } catch (RuntimeException exception) {
        LOG.warn("Failed to deserialize cached entity by name: {}", key, exception);
        evictCorrupt(cache, key);
        return null;
      }
    }

    private void evictCorrupt(final CachedEntityDao cache, final Pair<String, String> key) {
      try {
        cache.deleteByName(key.getLeft(), key.getRight());
      } catch (RuntimeException exception) {
        LOG.debug("Failed to evict bad cache entry by name: {}", key, exception);
      }
    }

    private String databaseJson(
        final Pair<String, String> key,
        final long startEpoch,
        final EntityCacheSource source,
        final EntityDAO<?> dao) {
      final String lookupFqn =
          Entity.USER.equals(key.getLeft())
              ? key.getRight().toLowerCase(Locale.ROOT)
              : key.getRight();
      final String json =
          dao.findByName(
              dao.getTableName(), dao.getNameHashColumn(), lookupFqn, dao.getCondition(ALL));
      if (json == null) {
        throw new EntityNotFoundException(
            String.format("Entity not found: %s %s", key.getLeft(), key.getRight()));
      }
      final EntityInterface entity = validatedDatabaseEntity(key, source, json);
      publish(key, startEpoch, json, entity.getId());
      return json;
    }

    private EntityInterface validatedDatabaseEntity(
        final Pair<String, String> key, final EntityCacheSource source, final String json) {
      final EntityInterface entity = JsonUtils.readValue(json, source.getEntityClass());
      if (!isValidEntityForCache(entity)) {
        LOG.error("Entity loaded from database by name is invalid: {}", key);
        throw new IllegalStateException(
            String.format("Invalid entity from database: %s %s", key.getLeft(), key.getRight()));
      }
      return entity;
    }

    private void publish(
        final Pair<String, String> key, final long startEpoch, final String json, final UUID id) {
      if (EntityCachePolicy.isCacheable(key.getLeft()) && epochs.byName(key) == startEpoch) {
        final CachedEntityDao cache = redis.get();
        if (cache != null) {
          publishAliases(cache, key, json, id);
        }
      }
    }

    private void publishAliases(
        final CachedEntityDao cache,
        final Pair<String, String> key,
        final String json,
        final UUID id) {
      try {
        cache.putByName(key.getLeft(), key.getRight(), json);
        cache.putBase(key.getLeft(), id, json);
      } catch (RuntimeException exception) {
        LOG.debug("Failed to populate Redis on byName miss: {}", key, exception);
      }
    }

    private void evictExternalCache(Pair<String, String> fqnPair, String json) {
      var cachedEntityDao = redis.get();
      if (cachedEntityDao == null) {
        return;
      }
      cachedEntityDao.deleteByName(fqnPair.getLeft(), fqnPair.getRight());
      try {
        EntityCacheSource repository = sources.apply(fqnPair.getLeft());
        EntityInterface entity = JsonUtils.readValue(json, repository.getEntityClass());
        if (entity.getId() != null) {
          cachedEntityDao.deleteBase(fqnPair.getLeft(), entity.getId());
        }
      } catch (RuntimeException e) {
        LOG.debug("Failed to evict raced cache entry by id for {}", fqnPair, e);
      }
    }
  }

  private final class EntityLoaderWithId extends CacheLoader<Pair<String, UUID>, String> {
    @Override
    public String load(Pair<String, UUID> idPair) {
      // See EntityLoaderWithName.load for the race-guard rationale.
      long startEpoch = epochs.byId(idPair);
      String json = loadInternal(idPair, startEpoch);
      if (epochs.byId(idPair) != startEpoch) {
        var cachedEntityDao = redis.get();
        if (cachedEntityDao != null) {
          cachedEntityDao.deleteBase(idPair.getLeft(), idPair.getRight());
        }
        throw new LoaderRaceException("Concurrent write during loadById: " + idPair);
      }
      return json;
    }

    private String loadInternal(final Pair<String, UUID> key, final long startEpoch) {
      final EntityCacheSource source = sources.apply(key.getLeft());
      final EntityDAO<?> dao = source.getDao();
      final String cached = cachedJson(key, source);
      return cached == null ? databaseJson(key, startEpoch, source, dao) : cached;
    }

    private String cachedJson(final Pair<String, UUID> key, final EntityCacheSource source) {
      if (!EntityCachePolicy.isCacheable(key.getLeft())) {
        return null;
      }
      final CachedEntityDao cache = redis.get();
      final Optional<String> cached =
          cache == null ? Optional.empty() : cache.getBase(key.getRight(), key.getLeft());
      return cached.isEmpty() ? null : validatedRedisJson(key, source, cache, cached.get());
    }

    private String validatedRedisJson(
        final Pair<String, UUID> key,
        final EntityCacheSource source,
        final CachedEntityDao cache,
        final String json) {
      try {
        final EntityInterface entity = JsonUtils.readValue(json, source.getEntityClass());
        if (entity.getId() == null) {
          LOG.error("Cached entity has null ID: {}", key);
          cache.deleteBase(key.getLeft(), key.getRight());
          return null;
        }
        return json;
      } catch (RuntimeException exception) {
        LOG.warn("Failed to deserialize cached entity by ID: {}", key, exception);
        evictCorrupt(cache, key);
        return null;
      }
    }

    private void evictCorrupt(final CachedEntityDao cache, final Pair<String, UUID> key) {
      try {
        cache.deleteBase(key.getLeft(), key.getRight());
      } catch (RuntimeException exception) {
        LOG.debug("Failed to evict bad cache entry: {}", key, exception);
      }
    }

    private String databaseJson(
        final Pair<String, UUID> key,
        final long startEpoch,
        final EntityCacheSource source,
        final EntityDAO<?> dao) {
      final String json = dao.findById(dao.getTableName(), key.getRight(), dao.getCondition(ALL));
      if (json == null) {
        throw new EntityNotFoundException(
            String.format("Entity not found: %s %s", key.getLeft(), key.getRight()));
      }
      final String validated = validatedDatabaseJson(key, source, json);
      publish(key, startEpoch, validated);
      return validated;
    }

    private String validatedDatabaseJson(
        final Pair<String, UUID> key, final EntityCacheSource source, final String json) {
      final EntityInterface entity = JsonUtils.readValue(json, source.getEntityClass());
      if (isValidEntityForCache(entity)) {
        return json;
      }
      final String repaired = repairId(key, entity, json);
      if (!isValidEntityForCache(JsonUtils.readValue(repaired, source.getEntityClass()))) {
        LOG.error("Entity from database is invalid for caching: {}", key);
        throw new IllegalStateException(
            String.format("Invalid entity from database: %s %s", key.getLeft(), key.getRight()));
      }
      return repaired;
    }

    private String repairId(
        final Pair<String, UUID> key, final EntityInterface entity, final String json) {
      if (entity.getId() == null) {
        LOG.error(
            "Entity loaded from database has null ID: {} fqn={}",
            key,
            entity.getFullyQualifiedName());
        entity.setId(key.getRight());
        return JsonUtils.pojoToJson(entity);
      }
      return json;
    }

    private void publish(final Pair<String, UUID> key, final long startEpoch, final String json) {
      if (EntityCachePolicy.isCacheable(key.getLeft()) && epochs.byId(key) == startEpoch) {
        final CachedEntityDao cache = redis.get();
        if (cache != null) {
          cache.putBase(key.getLeft(), key.getRight(), json);
        }
      }
    }
  }
}
