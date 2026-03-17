package org.openmetadata.service.util;

import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.service.monitoring.RequestLatencyContext.phase;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

/**
 * Request-scoped entity cache used to avoid duplicate loads of the same entity shape
 * (entity + include + field set + relation include set) within one HTTP request.
 */
public final class RequestEntityCache {
  private static final ThreadLocal<Map<EntityCacheKey, EntityInterface>> REQUEST_CACHE =
      ThreadLocal.withInitial(HashMap::new);

  private RequestEntityCache() {}

  public static void clear() {
    REQUEST_CACHE.remove();
  }

  /**
   * Invalidate cached shapes for a single entity across all field/include combinations.
   * This is required for same-thread read-after-write correctness (for example async jobs).
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
    return get(
        EntityCacheKey.forId(
            entityType, id, fieldsKey(fields), relationIncludesKey(relationIncludes), fromCache),
        entityClass);
  }

  public static <T extends EntityInterface> T getByName(
      String entityType,
      String name,
      Fields fields,
      RelationIncludes relationIncludes,
      boolean fromCache,
      Class<T> entityClass) {
    return get(
        EntityCacheKey.forName(
            entityType, name, fieldsKey(fields), relationIncludesKey(relationIncludes), fromCache),
        entityClass);
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
        EntityCacheKey.forId(
            entityType, id, fieldsKey(fields), relationIncludesKey(relationIncludes), fromCache),
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
        EntityCacheKey.forName(
            entityType, name, fieldsKey(fields), relationIncludesKey(relationIncludes), fromCache),
        entity);
  }

  private static <T extends EntityInterface> T get(EntityCacheKey key, Class<T> entityClass) {
    EntityInterface cached;
    try (var ignored = phase("requestCacheGet")) {
      cached = REQUEST_CACHE.get().get(key);
    }
    if (cached == null) {
      return null;
    }
    try (var ignored = phase("requestCacheDeserialize")) {
      return JsonUtils.deepCopy(entityClass.cast(cached), entityClass);
    }
  }

  private static <T extends EntityInterface> void put(EntityCacheKey key, T entity) {
    if (entity == null) {
      return;
    }
    T cachedCopy = null;
    try (var ignored = phase("requestCacheSerialize")) {
      @SuppressWarnings("unchecked")
      Class<T> entityClass = (Class<T>) entity.getClass();
      cachedCopy = JsonUtils.deepCopy(entity, entityClass);
    }
    try (var ignored = phase("requestCachePut")) {
      if (cachedCopy != null) {
        REQUEST_CACHE.get().put(key, cachedCopy);
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
      String entityType,
      LookupType lookupType,
      String lookupValue,
      String fieldsKey,
      String includesKey,
      boolean fromCache) {

    static EntityCacheKey forId(
        String entityType,
        UUID id,
        String fieldsKey,
        String relationIncludesKey,
        boolean fromCache) {
      return new EntityCacheKey(
          entityType, LookupType.ID, id.toString(), fieldsKey, relationIncludesKey, fromCache);
    }

    static EntityCacheKey forName(
        String entityType,
        String name,
        String fieldsKey,
        String relationIncludesKey,
        boolean fromCache) {
      return new EntityCacheKey(
          entityType, LookupType.NAME, name, fieldsKey, relationIncludesKey, fromCache);
    }
  }
}
