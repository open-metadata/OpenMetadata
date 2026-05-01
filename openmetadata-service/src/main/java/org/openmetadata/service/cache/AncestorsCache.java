package org.openmetadata.service.cache;

import com.fasterxml.jackson.core.type.TypeReference;
import java.time.Duration;
import java.util.List;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Cache for the resolved ancestor chain (root → immediate parent) of a hierarchical entity,
 * keyed by the descendant's FQN.
 *
 * <p>Stores only the chain's <em>topology</em> — the ordered list of ancestor FQNs — not their
 * display metadata. Display names live in the existing write-through per-entity reference
 * cache ({@code om:rn:} keys, kept fresh on every entity write), so callers rehydrate
 * {@link org.openmetadata.schema.type.EntityReference}s on read and never see stale display
 * names — TTL drift on cosmetic fields is gone.
 *
 * <p>Invalidation is descendant-local: each writer drops the key for its own FQN. A rename
 * is self-healing because the descendant's FQN itself changes — the old key is orphaned and
 * TTL-expires, the new FQN starts cold and is populated on first read. A non-cascading
 * delete of a mid-level ancestor is the one edge case: descendants whose cached chain still
 * references the deleted entity will hydrate it through the per-entity ref cache and skip
 * the missing entry on read (yielding a shorter chain) until the descendant's own ancestors
 * key TTL-expires. Acceptable for breadcrumb metadata; deletes in OM are typically cascading.
 */
@Slf4j
public class AncestorsCache {
  private static final TypeReference<List<String>> FQN_LIST_REF = new TypeReference<>() {};

  private final CacheProvider cache;
  private final CacheKeys keys;
  private final CacheConfig config;

  public AncestorsCache(CacheProvider cache, CacheKeys keys, CacheConfig config) {
    this.cache = cache;
    this.keys = keys;
    this.config = config;
  }

  public List<String> getFqns(String entityType, String fqn) {
    if (fqn == null) {
      return null;
    }
    String key = keys.ancestors(entityType, fqn);
    try {
      Optional<String> json = cache.get(key);
      if (json.isEmpty()) {
        return null;
      }
      return JsonUtils.readValue(json.get(), FQN_LIST_REF);
    } catch (Exception e) {
      LOG.warn("Bad ancestors cache entry, evicting: {} {}", entityType, fqn, e);
      cache.del(key);
      return null;
    }
  }

  public void putFqns(String entityType, String fqn, List<String> ancestorFqns) {
    if (fqn == null || ancestorFqns == null) {
      return;
    }
    String key = keys.ancestors(entityType, fqn);
    try {
      String json = JsonUtils.pojoToJson(ancestorFqns);
      cache.set(key, json, Duration.ofSeconds(config.entityTtlSeconds));
    } catch (Exception e) {
      LOG.warn("Failed to cache ancestors: {} {}", entityType, fqn, e);
    }
  }

  public void invalidate(String entityType, String fqn) {
    if (fqn == null) {
      return;
    }
    cache.del(keys.ancestors(entityType, fqn));
  }
}
