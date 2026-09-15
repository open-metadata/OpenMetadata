package org.openmetadata.service.entity.read;

import static org.openmetadata.service.monitoring.RequestLatencyContext.phase;

import jakarta.ws.rs.core.UriInfo;
import java.util.UUID;
import java.util.function.BiConsumer;
import java.util.function.BiFunction;
import java.util.function.Consumer;
import java.util.function.UnaryOperator;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.RequestEntityCache;
import org.openmetadata.service.util.RequestEntityCache.Projection;

/** Coordinates detail reads, request-cache aliases and the ordered hydration lifecycle. */
public final class EntityReadService<T extends EntityInterface> implements EntityReader<T> {
  public record Schema<T extends EntityInterface>(
      String type, Class<T> entityClass, UnaryOperator<String> normalizeName) {}

  public record Query(UriInfo uri, Fields fields, RelationIncludes includes, boolean fromCache) {}

  public interface ById<T> {
    T get(UUID id, Include include, boolean fromCache);
  }

  public interface ByName<T> {
    T get(String name, Include include, boolean fromCache);
  }

  public record Lookup<T>(
      ById<T> byId,
      ByName<T> byName,
      Consumer<UUID> invalidateId,
      Consumer<String> invalidateName) {}

  public interface Planner<T> {
    ReadPlan create(T entity, Fields fields, RelationIncludes includes);
  }

  public interface FieldLoader<T> {
    void load(T entity, Fields fields, RelationIncludes includes);
  }

  public record Hydration<T>(
      Planner<T> planner,
      BiFunction<T, ReadPlan, ReadBundle> bundle,
      FieldLoader<T> fields,
      BiConsumer<T, Fields> inheritance,
      BiConsumer<T, Fields> clear) {}

  private final Schema<T> schema;
  private final Lookup<T> lookup;
  private final Hydration<T> hydration;
  private final BiFunction<UriInfo, T, T> withHref;

  public EntityReadService(
      final Schema<T> schema,
      final Lookup<T> lookup,
      final Hydration<T> hydration,
      final BiFunction<UriInfo, T, T> withHref) {
    this.schema = schema;
    this.lookup = lookup;
    this.hydration = hydration;
    this.withHref = withHref;
  }

  @Override
  public T byId(final UUID id, final Query query) {
    final Projection projection = projection(query);
    final T cached =
        RequestEntityCache.getById(schema.type(), id, projection, schema.entityClass());
    return cached != null ? withHref.apply(query.uri(), cached) : loadId(id, query, projection);
  }

  private T loadId(final UUID id, final Query query, final Projection projection) {
    if (!projection.fromCache()) {
      lookup.invalidateId().accept(id);
    }
    final T entity;
    try (var ignored = phase("entityLookup")) {
      entity = lookup.byId().get(id, query.includes().getDefaultInclude(), projection.fromCache());
    }
    final T hydrated = hydrate(entity, query);
    try (var ignored = phase("requestCachePutById")) {
      RequestEntityCache.putByIdAndName(
          schema.type(), id, hydrated.getFullyQualifiedName(), projection, hydrated);
    }
    return hydrated;
  }

  @Override
  public T byName(final String name, final Query query) {
    final boolean useCache = EntityLookupService.canUseCache(query.fromCache());
    final String normalized = schema.normalizeName().apply(name);
    final Projection projection =
        RequestEntityCache.projection(query.fields(), query.includes(), useCache);
    final T cached =
        RequestEntityCache.getByName(schema.type(), normalized, projection, schema.entityClass());
    return cached != null
        ? withHref.apply(query.uri(), cached)
        : loadName(normalized, query, projection);
  }

  private T loadName(final String name, final Query query, final Projection projection) {
    if (!projection.fromCache()) {
      lookup.invalidateName().accept(name);
    }
    final T entity;
    try (var ignored = phase("entityLookup")) {
      entity =
          lookup.byName().get(name, query.includes().getDefaultInclude(), projection.fromCache());
    }
    final T hydrated = hydrate(entity, query);
    try (var ignored = phase("requestCachePutByName")) {
      RequestEntityCache.putByNameAndId(
          schema.type(), name, hydrated.getId(), projection, hydrated);
    }
    return hydrated;
  }

  private Projection projection(final Query query) {
    return RequestEntityCache.projection(
        query.fields(), query.includes(), EntityLookupService.canUseCache(query.fromCache()));
  }

  private T hydrate(final T entity, final Query query) {
    final ReadBundle bundle = buildBundle(entity, query);
    ReadBundleContext.push(bundle);
    try {
      populate(entity, query);
    } finally {
      ReadBundleContext.pop();
    }
    try (var ignored = phase("readClearFields")) {
      hydration.clear().accept(entity, query.fields());
    }
    try (var ignored = phase("readWithHref")) {
      return withHref.apply(query.uri(), entity);
    }
  }

  private ReadBundle buildBundle(final T entity, final Query query) {
    final ReadPlan plan;
    try (var ignored = phase("readCreatePlan")) {
      plan = hydration.planner().create(entity, query.fields(), query.includes());
    }
    try (var ignored = phase("buildReadBundle")) {
      return hydration.bundle().apply(entity, plan);
    }
  }

  private void populate(final T entity, final Query query) {
    try (var ignored = phase("setFields")) {
      hydration.fields().load(entity, query.fields(), query.includes());
    }
    try (var ignored = phase("setInheritedFields")) {
      hydration.inheritance().accept(entity, query.fields());
    }
  }
}
