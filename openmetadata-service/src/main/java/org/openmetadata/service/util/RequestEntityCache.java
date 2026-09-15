package org.openmetadata.service.util;

import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.service.monitoring.RequestLatencyContext.phase;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

/**
 * Request-scoped entity cache. ID and name aliases share immutable JSON; each retrieval
 * deserializes a fresh entity so callers cannot mutate another reader's response.
 *
 * <p>Bounded to {@value MAX_ENTRIES_PER_REQUEST} entries using LRU eviction.
 */
public final class RequestEntityCache {

  /**
   * Cap per-request entity cache at 50 entries. A typical API request touches 5-20 entities. Bulk
   * operations may touch more, but LRU eviction ensures only the most recently accessed are kept.
   */
  private static final int MAX_ENTRIES_PER_REQUEST = 50;

  private static final int INITIAL_CAPACITY = 16;
  private static final float LOAD_FACTOR = 0.75f;
  private static final boolean ACCESS_ORDER = true; // LRU eviction order

  // Stores JSON strings (not entity objects) to avoid deepCopy overhead
  private static final ThreadLocal<Map<EntityCacheKey, String>> REQUEST_CACHE =
      ThreadLocal.withInitial(
          () ->
              new LinkedHashMap<>(INITIAL_CAPACITY, LOAD_FACTOR, ACCESS_ORDER) {
                @Override
                protected boolean removeEldestEntry(Map.Entry<EntityCacheKey, String> eldest) {
                  return size() > MAX_ENTRIES_PER_REQUEST;
                }
              });

  private RequestEntityCache() {}

  /** A normalized projection can be shared by every lookup and alias of the same read. */
  public record Projection(String fields, String includes, boolean fromCache) {}

  public static Projection projection(
      Fields fields, RelationIncludes relationIncludes, boolean fromCache) {
    return new Projection(fieldsKey(fields), relationIncludesKey(relationIncludes), fromCache);
  }

  public static void clear() {
    REQUEST_CACHE.remove();
  }

  /**
   * Invalidate cached shapes for a single entity across all field/include combinations. This is
   * required for same-thread read-after-write correctness (for example async jobs).
   */
  public static void invalidate(String entityType, UUID id, String name) {
    if (entityType == null || (id == null && name == null)) {
      return;
    }
    try (var ignored = phase("requestCacheInvalidate")) {
      REQUEST_CACHE
          .get()
          .entrySet()
          .removeIf(
              entry -> {
                EntityCacheKey key = entry.getKey();
                if (!entityType.equals(key.entityType())) {
                  return false;
                }
                boolean idMatch =
                    id != null
                        && key.lookupType() == LookupType.ID
                        && id.toString().equals(key.lookupValue());
                boolean nameMatch =
                    name != null
                        && key.lookupType() == LookupType.NAME
                        && name.equals(key.lookupValue());
                return idMatch || nameMatch;
              });
    }
  }

  public static <T extends EntityInterface> T getById(
      String entityType,
      UUID id,
      Fields fields,
      RelationIncludes relationIncludes,
      boolean fromCache,
      Class<T> entityClass) {
    return getById(entityType, id, projection(fields, relationIncludes, fromCache), entityClass);
  }

  public static <T extends EntityInterface> T getById(
      String entityType, UUID id, Projection projection, Class<T> entityClass) {
    return get(EntityCacheKey.forId(entityType, id, projection), entityClass);
  }

  public static <T extends EntityInterface> T getByName(
      String entityType,
      String name,
      Fields fields,
      RelationIncludes relationIncludes,
      boolean fromCache,
      Class<T> entityClass) {
    return getByName(
        entityType, name, projection(fields, relationIncludes, fromCache), entityClass);
  }

  public static <T extends EntityInterface> T getByName(
      String entityType, String name, Projection projection, Class<T> entityClass) {
    return get(EntityCacheKey.forName(entityType, name, projection), entityClass);
  }

  public static void putByIdAndName(
      String entityType, UUID id, String name, Projection projection, EntityInterface entity) {
    putAliases(
        EntityCacheKey.forId(entityType, id, projection),
        name == null ? null : EntityCacheKey.forName(entityType, name, projection),
        entity);
  }

  public static void putByNameAndId(
      String entityType, String name, UUID id, Projection projection, EntityInterface entity) {
    putAliases(
        EntityCacheKey.forName(entityType, name, projection),
        id == null ? null : EntityCacheKey.forId(entityType, id, projection),
        entity);
  }

  public static <T extends EntityInterface> void putById(
      String entityType,
      UUID id,
      Fields fields,
      RelationIncludes relationIncludes,
      boolean fromCache,
      T entity,
      Class<T> entityClass) {
    put(
        EntityCacheKey.forId(entityType, id, projection(fields, relationIncludes, fromCache)),
        entity);
  }

  public static <T extends EntityInterface> void putByName(
      String entityType,
      String name,
      Fields fields,
      RelationIncludes relationIncludes,
      boolean fromCache,
      T entity,
      Class<T> entityClass) {
    put(
        EntityCacheKey.forName(entityType, name, projection(fields, relationIncludes, fromCache)),
        entity);
  }

  private static <T extends EntityInterface> T get(EntityCacheKey key, Class<T> entityClass) {
    String cachedJson;
    try (var ignored = phase("requestCacheGet")) {
      cachedJson = REQUEST_CACHE.get().get(key);
    }
    if (cachedJson == null) {
      return null;
    }
    try (var ignored = phase("requestCacheDeserialize")) {
      return JsonUtils.readValue(cachedJson, entityClass);
    }
  }

  private static <T extends EntityInterface> void put(EntityCacheKey key, T entity) {
    putAliases(key, null, entity);
  }

  private static void putAliases(
      EntityCacheKey primary, EntityCacheKey secondary, EntityInterface entity) {
    if (entity == null) {
      return;
    }
    try (var ignored = phase("requestCacheSerialize")) {
      String json = JsonUtils.pojoToJson(entity);
      Map<EntityCacheKey, String> cache = REQUEST_CACHE.get();
      cache.put(primary, json);
      if (secondary != null) {
        cache.put(secondary, json);
      }
    }
  }

  private static String fieldsKey(Fields fields) {
    if (fields == null || fields.getFieldList().isEmpty()) {
      return "";
    }
    return fields.getFieldList().stream().sorted().collect(Collectors.joining(","));
  }

  private static String relationIncludesKey(RelationIncludes relationIncludes) {
    if (relationIncludes == null) {
      return ALL.name();
    }
    Include defaultInclude =
        relationIncludes.getDefaultInclude() == null ? ALL : relationIncludes.getDefaultInclude();
    if (relationIncludes.getFieldIncludes().isEmpty()) {
      return defaultInclude.name();
    }
    String fieldOverrides =
        relationIncludes.getFieldIncludes().entrySet().stream()
            .sorted(Map.Entry.comparingByKey())
            .map(entry -> entry.getKey() + ":" + entry.getValue().name())
            .collect(Collectors.joining(","));
    return defaultInclude.name() + "|" + fieldOverrides;
  }

  private enum LookupType {
    ID,
    NAME
  }

  private record EntityCacheKey(
      String entityType, LookupType lookupType, String lookupValue, Projection projection) {

    static EntityCacheKey forId(String entityType, UUID id, Projection projection) {
      return new EntityCacheKey(entityType, LookupType.ID, id.toString(), projection);
    }

    static EntityCacheKey forName(String entityType, String name, Projection projection) {
      return new EntityCacheKey(entityType, LookupType.NAME, name, projection);
    }
  }
}
