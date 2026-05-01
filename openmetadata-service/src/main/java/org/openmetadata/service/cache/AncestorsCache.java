package org.openmetadata.service.cache;

import com.fasterxml.jackson.core.type.TypeReference;
import java.time.Duration;
import java.util.List;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Cache for the resolved ancestor chain (root → immediate parent) of a hierarchical entity,
 * keyed by the descendant's FQN.
 *
 * <p>Reads on the breadcrumb path used to do a per-level FQN lookup (or, after the batched
 * rewrite, one indexed {@code findReferencesByFqns} call) — small but executed on every
 * detail-page render. This cache collapses that to a single Redis GET when the chain is warm.
 *
 * <p>Invalidation policy: on entity update/delete the writer drops its own key. Renames are
 * self-healing (the new FQN is a different key, the old key TTL-expires). Display-name drift
 * on a remote ancestor is bounded by the TTL — acceptable since breadcrumb metadata is
 * cosmetic, not authoritative.
 */
@Slf4j
public class AncestorsCache {
  private static final TypeReference<List<EntityReference>> LIST_REF = new TypeReference<>() {};

  private final CacheProvider cache;
  private final CacheKeys keys;
  private final CacheConfig config;

  public AncestorsCache(CacheProvider cache, CacheKeys keys, CacheConfig config) {
    this.cache = cache;
    this.keys = keys;
    this.config = config;
  }

  public List<EntityReference> get(String entityType, String fqn) {
    if (fqn == null) {
      return null;
    }
    String key = keys.ancestors(entityType, fqn);
    try {
      Optional<String> json = cache.get(key);
      if (json.isEmpty()) {
        return null;
      }
      return JsonUtils.readValue(json.get(), LIST_REF);
    } catch (Exception e) {
      LOG.warn("Bad ancestors cache entry, evicting: {} {}", entityType, fqn, e);
      cache.del(key);
      return null;
    }
  }

  public void put(String entityType, String fqn, List<EntityReference> ancestors) {
    if (fqn == null || ancestors == null) {
      return;
    }
    String key = keys.ancestors(entityType, fqn);
    try {
      String json = JsonUtils.pojoToJson(ancestors);
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
