package org.openmetadata.service.util;

import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.service.monitoring.RequestLatencyContext.phase;

import java.util.ArrayDeque;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.function.Predicate;
import java.util.stream.Collectors;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.monitoring.RequestLatencyContext.Phase;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

/**
 * Request-scoped entity cache that stores JSON strings instead of entity objects. This eliminates
 * the two {@code deepCopy} calls per cache interaction that previously caused ~1 MB of allocation
 * per 247 KB entity (deepCopy on put + deepCopy on get).
 *
 * <p>Now: {@code put()} serializes once to JSON string (~247 KB), {@code get()} deserializes back.
 * The JSON string is immutable and safe to share, so no defensive copying is needed. Net savings:
 * ~50% less allocation per cache interaction compared to the deepCopy approach.
 *
 * <p>Bounded to {@value MAX_ENTRIES_PER_REQUEST} entries using LRU eviction.
 *
 * <p>A {@link Scope} gives a stretch of code on the same thread its own empty cache: nothing cached
 * before the scope answers a read inside it, and nothing cached inside it outlives it. Invalidation
 * reaches the request cache and every open scope. {@link FreshReadScope} opens one.
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
      ThreadLocal.withInitial(RequestEntityCache::newEntryMap);

  // Open scopes, innermost first; absent when none is open.
  private static final ThreadLocal<Deque<Scope>> SCOPES = new ThreadLocal<>();

  private RequestEntityCache() {}

  public static void clear() {
    REQUEST_CACHE.remove();
    forEachScope(Scope::clearEntries);
  }

  /** Opens a scope with its own empty cache on this thread. Close it to drop that cache. */
  static Scope openScope() {
    Deque<Scope> scopes = SCOPES.get();
    if (scopes == null) {
      scopes = new ArrayDeque<>();
      SCOPES.set(scopes);
    }
    Scope scope = new Scope();
    scopes.push(scope);
    return scope;
  }

  static boolean hasOpenScopes() {
    return SCOPES.get() != null;
  }

  /**
   * Invalidate cached shapes for a single entity across all field/include combinations. This is
   * required for same-thread read-after-write correctness (for example async jobs).
   */
  public static void invalidate(String entityType, UUID id, String name) {
    if (entityType == null || (id == null && name == null)) {
      return;
    }
    Predicate<EntityCacheKey> stale = key -> key.refersTo(entityType, id, name);
    try (Phase ignored = phase("requestCacheInvalidate")) {
      REQUEST_CACHE.get().keySet().removeIf(stale);
      forEachScope(scope -> scope.evict(stale));
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
    String cachedJson;
    try (Phase ignored = phase("requestCacheGet")) {
      cachedJson = entries().get(key);
    }
    if (cachedJson == null) {
      return null;
    }
    try (Phase ignored = phase("requestCacheDeserialize")) {
      return JsonUtils.readValue(cachedJson, entityClass);
    }
  }

  private static <T extends EntityInterface> void put(EntityCacheKey key, T entity) {
    if (entity == null) {
      return;
    }
    try (Phase ignored = phase("requestCacheSerialize")) {
      String json = JsonUtils.pojoToJson(entity);
      entries().put(key, json);
    }
  }

  private static Map<EntityCacheKey, String> entries() {
    Deque<Scope> scopes = SCOPES.get();
    return scopes == null ? REQUEST_CACHE.get() : scopes.peek().entries;
  }

  private static void forEachScope(Consumer<Scope> action) {
    Deque<Scope> scopes = SCOPES.get();
    if (scopes != null) {
      scopes.forEach(action);
    }
  }

  private static Map<EntityCacheKey, String> newEntryMap() {
    return new LinkedHashMap<>(INITIAL_CAPACITY, LOAD_FACTOR, ACCESS_ORDER) {
      @Override
      protected boolean removeEldestEntry(Map.Entry<EntityCacheKey, String> eldest) {
        return size() > MAX_ENTRIES_PER_REQUEST;
      }
    };
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

  /**
   * One scope's own cache on its thread. Scopes are told apart by identity, so closing one never
   * removes another that happens to hold the same entries.
   */
  static final class Scope implements AutoCloseable {
    private final Map<EntityCacheKey, String> entries = newEntryMap();

    private Scope() {}

    private void evict(Predicate<EntityCacheKey> stale) {
      entries.keySet().removeIf(stale);
    }

    private void clearEntries() {
      entries.clear();
    }

    @Override
    public void close() {
      Deque<Scope> scopes = SCOPES.get();
      if (scopes == null) {
        return;
      }
      scopes.remove(this);
      if (scopes.isEmpty()) {
        SCOPES.remove();
      }
    }
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

    boolean refersTo(String type, UUID id, String name) {
      if (!entityType.equals(type)) {
        return false;
      }
      return lookupType == LookupType.ID
          ? id != null && lookupValue.equals(id.toString())
          : name != null && lookupValue.equals(name);
    }
  }
}
