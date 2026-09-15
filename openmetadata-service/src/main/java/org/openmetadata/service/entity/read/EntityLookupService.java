package org.openmetadata.service.entity.read;

import static org.openmetadata.schema.type.Include.NON_DELETED;
import static org.openmetadata.schema.utils.EntityInterfaceUtil.quoteName;
import static org.openmetadata.service.exception.CatalogExceptionMessage.entityNotFound;
import static org.openmetadata.service.monitoring.RequestLatencyContext.phase;

import com.google.common.cache.LoadingCache;
import com.google.common.util.concurrent.UncheckedExecutionException;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutionException;
import java.util.function.BooleanSupplier;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.tuple.Pair;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.cache.NotFoundCache;
import org.openmetadata.service.entity.cache.EntityCacheEpochs;
import org.openmetadata.service.entity.cache.EntityCacheKeys;
import org.openmetadata.service.entity.cache.EntityCacheLoaders.LoaderRaceException;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.util.FreshReadScope;

/** Finds canonical entities, retaining L1-first lookups, fresh reads and negative-cache semantics. */
@Slf4j
public final class EntityLookupService<T extends EntityInterface> {
  public record Schema<T>(String entityType, Class<T> entityClass, BooleanSupplier quoteFqn) {}

  public record Caches(
      Supplier<LoadingCache<Pair<String, UUID>, String>> ids,
      Supplier<LoadingCache<Pair<String, String>, String>> names,
      Supplier<NotFoundCache> notFound,
      EntityCacheEpochs epochs) {}

  private final Schema<T> schema;
  private final EntityDAO<T> dao;
  private final Caches caches;

  public EntityLookupService(final Schema<T> schema, final EntityDAO<T> dao, final Caches caches) {
    this.schema = schema;
    this.dao = dao;
    this.caches = caches;
  }

  public static boolean canUseCache(final boolean requested) {
    return requested && !FreshReadScope.isActive();
  }

  public T byId(final UUID id, final Include include) {
    return byId(id, include, true);
  }

  public List<T> byIds(final List<UUID> ids, final Include include) {
    try (var ignored = phase("dbBatchFind")) {
      return dao.findEntitiesByIds(ids, include);
    }
  }

  public T byName(final String fqn, final Include include) {
    return byName(fqn, include, true);
  }

  public T byNameOrNull(final String fqn, final Include include) {
    try {
      return byName(fqn, include);
    } catch (EntityNotFoundException exception) {
      return null;
    }
  }

  public EntityReference referenceById(final UUID id, final Include include) {
    return byId(id, include).getEntityReference();
  }

  public List<EntityReference> referencesByIds(final List<UUID> ids, final Include include) {
    return dao.findReferencesByIds(ids, include);
  }

  public EntityReference referenceByName(final String fqn, final Include include) {
    final String name = schema.quoteFqn().getAsBoolean() ? quoteName(fqn) : fqn;
    return dao.findReferencesByFqns(List.of(name), include).stream()
        .findFirst()
        .orElseThrow(() -> missingName(name));
  }

  public T byId(final UUID id, final Include include, final boolean fromCache) {
    final var key = EntityCacheKeys.id(schema.entityType(), id);
    final var local = caches.ids().get();
    final NotFoundCache missing = caches.notFound().get();
    final T entity =
        canUseCache(fromCache)
            ? cachedId(key, include, missing, local)
            : uncachedId(key, include, missing, local);
    if (hidden(entity, include)) {
      throw missingId(id);
    }
    return entity;
  }

  public T byName(final String fqn, final Include include, final boolean fromCache) {
    final String name = schema.quoteFqn().getAsBoolean() ? quoteName(fqn) : fqn;
    final var key = EntityCacheKeys.name(schema.entityType(), name);
    final var local = caches.names().get();
    final NotFoundCache missing = caches.notFound().get();
    final T entity =
        canUseCache(fromCache)
            ? cachedName(name, key, include, missing, local)
            : uncachedName(name, key, include, missing, local);
    if (hidden(entity, include)) {
      throw missingName(name);
    }
    return entity;
  }

  private T uncachedId(
      final Pair<String, UUID> key,
      final Include include,
      final NotFoundCache missing,
      final LoadingCache<Pair<String, UUID>, String> local) {
    if (isMissingId(key.getRight(), include, missing)) {
      throw missingId(key.getRight());
    }
    local.invalidate(key);
    final T entity;
    try (var ignored = phase("dbFindByIdNoCache")) {
      entity = dao.findEntityById(key.getRight(), include);
    }
    if (entity == null) {
      rememberId(key.getRight(), include, missing);
      throw missingId(key.getRight());
    }
    repairMissingId(entity, key.getRight());
    return entity;
  }

  private void repairMissingId(final T entity, final UUID id) {
    if (entity.getId() == null) {
      LOG.error(
          "Entity loaded from database has null ID: type={} id={} fqn={}",
          schema.entityType(),
          id,
          entity.getFullyQualifiedName());
      entity.setId(id);
    }
  }

  private T uncachedName(
      final String name,
      final Pair<String, String> key,
      final Include include,
      final NotFoundCache missing,
      final LoadingCache<Pair<String, String>, String> local) {
    if (isMissingName(key.getRight(), include, missing)) {
      throw missingName(name);
    }
    local.invalidate(key);
    final T entity;
    try (var ignored = phase("dbFindByNameNoCache")) {
      entity = dao.findEntityByName(name, include);
    }
    if (entity == null) {
      rememberName(key.getRight(), include, missing);
      throw missingName(name);
    }
    return entity;
  }

  private T cachedId(
      final Pair<String, UUID> key,
      final Include include,
      final NotFoundCache missing,
      final LoadingCache<Pair<String, UUID>, String> local) {
    try {
      final T entity = copy(idJson(key, include, missing, local));
      return entity != null && entity.getId() == null ? reloadId(key, include, local) : entity;
    } catch (ExecutionException | UncheckedExecutionException exception) {
      if (exception.getCause() instanceof LoaderRaceException) {
        return byId(key.getRight(), include, false);
      }
      throw loaderFailure(exception, () -> rememberId(key.getRight(), include, missing));
    }
  }

  private T reloadId(
      final Pair<String, UUID> key,
      final Include include,
      final LoadingCache<Pair<String, UUID>, String> local) {
    LOG.error("Entity from cache has null ID: type={} id={}", schema.entityType(), key.getRight());
    local.invalidate(key);
    final T entity = dao.findEntityById(key.getRight(), include);
    if (entity == null) {
      throw missingId(key.getRight());
    }
    return entity;
  }

  private String idJson(
      final Pair<String, UUID> key,
      final Include include,
      final NotFoundCache missing,
      final LoadingCache<Pair<String, UUID>, String> local)
      throws ExecutionException {
    final String json = local.getIfPresent(key);
    if (include == NON_DELETED
        && missing != null
        && (json == null || caches.epochs().byId(key) != 0)
        && isMissingId(key.getRight(), include, missing)) {
      if (json != null) {
        local.invalidate(key);
      }
      throw missingId(key.getRight());
    }
    return json == null ? load(local, key) : json;
  }

  private T cachedName(
      final String name,
      final Pair<String, String> key,
      final Include include,
      final NotFoundCache missing,
      final LoadingCache<Pair<String, String>, String> local) {
    try {
      return copy(nameJson(name, key, include, missing, local));
    } catch (ExecutionException | UncheckedExecutionException exception) {
      if (exception.getCause() instanceof LoaderRaceException) {
        return byName(name, include, false);
      }
      throw loaderFailure(exception, () -> rememberName(key.getRight(), include, missing));
    }
  }

  private String nameJson(
      final String name,
      final Pair<String, String> key,
      final Include include,
      final NotFoundCache missing,
      final LoadingCache<Pair<String, String>, String> local)
      throws ExecutionException {
    final String json = local.getIfPresent(key);
    if (include == NON_DELETED
        && missing != null
        && (json == null || caches.epochs().byName(key) != 0)
        && isMissingName(key.getRight(), include, missing)) {
      if (json != null) {
        local.invalidate(key);
      }
      throw missingName(name);
    }
    return json == null ? load(local, key) : json;
  }

  private <K> String load(final LoadingCache<K, String> local, final K key)
      throws ExecutionException {
    try (var ignored = phase("cacheGet")) {
      return local.get(key);
    }
  }

  private T copy(final String json) {
    try (var ignored = phase("cacheCopy")) {
      return JsonUtils.readValue(json, schema.entityClass());
    }
  }

  private boolean hidden(final T entity, final Include include) {
    return switch (include) {
      case NON_DELETED -> Boolean.TRUE.equals(entity.getDeleted());
      case DELETED -> !Boolean.TRUE.equals(entity.getDeleted());
      case ALL -> false;
      case null -> false;
    };
  }

  private boolean isMissingId(final UUID id, final Include include, final NotFoundCache missing) {
    return include == NON_DELETED
        && missing != null
        && missing.isMarkedNotFoundById(schema.entityType(), id);
  }

  private boolean isMissingName(
      final String name, final Include include, final NotFoundCache missing) {
    return include == NON_DELETED
        && missing != null
        && missing.isMarkedNotFoundByName(schema.entityType(), name);
  }

  private void rememberId(final UUID id, final Include include, final NotFoundCache missing) {
    if (include == NON_DELETED && missing != null) {
      missing.markNotFoundById(schema.entityType(), id);
    }
  }

  private void rememberName(final String name, final Include include, final NotFoundCache missing) {
    if (include == NON_DELETED && missing != null) {
      missing.markNotFoundByName(schema.entityType(), name);
    }
  }

  private EntityNotFoundException missingId(final UUID id) {
    return new EntityNotFoundException(entityNotFound(schema.entityType(), id));
  }

  private EntityNotFoundException missingName(final String name) {
    return new EntityNotFoundException(entityNotFound(schema.entityType(), name));
  }

  private RuntimeException loaderFailure(
      final Exception exception, final Runnable rememberMissing) {
    return switch (exception.getCause()) {
      case EntityNotFoundException missing -> {
        rememberMissing.run();
        yield missing;
      }
      case RuntimeException failure -> failure;
      case null -> new RuntimeException(exception);
      default -> new RuntimeException(exception.getCause());
    };
  }
}
