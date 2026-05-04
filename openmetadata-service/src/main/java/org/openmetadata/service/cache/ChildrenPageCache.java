package org.openmetadata.service.cache;

import com.fasterxml.jackson.core.type.TypeReference;
import java.time.Duration;
import java.util.Optional;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;

/**
 * Cache for paginated children listings of a hierarchical entity (today: containers). Keyed by
 * the parent's FQN + a per-parent version stamp + page coordinates {@code (limit, offset)}.
 *
 * <p>Invalidation uses version-stamp rotation rather than per-page deletes: any change to the
 * parent's children list (a child create / update / delete / move) writes a fresh version
 * value at the {@code childrenVersion} key, which makes every previously-cached page key
 * unreachable in one Redis SET. The orphaned page entries TTL-expire on their own — no
 * SCAN-and-delete fanout needed and no per-page bookkeeping.
 *
 * <p>Default version is the literal string {@code "0"} when no rotation has happened yet, so
 * a cold parent with no writes still gets cache hits.
 *
 * <p>Currently {@link Container}-specific because that's the only entity type with a
 * {@code /children} sub-resource. If we add it elsewhere, generalise the value type via
 * {@link TypeReference} parameterisation.
 */
@Slf4j
public class ChildrenPageCache {
  private static final String DEFAULT_VERSION = "0";
  private static final TypeReference<ResultList<Container>> PAGE_REF = new TypeReference<>() {};

  private final CacheProvider cache;
  private final CacheKeys keys;
  private final CacheConfig config;

  public ChildrenPageCache(CacheProvider cache, CacheKeys keys, CacheConfig config) {
    this.cache = cache;
    this.keys = keys;
    this.config = config;
  }

  public ResultList<Container> get(String entityType, String parentFqn, int limit, int offset) {
    if (parentFqn == null || EntityCacheBypass.isSkipped()) {
      return null;
    }
    String version = currentVersion(entityType, parentFqn);
    String pageKey = keys.childrenPage(entityType, parentFqn, version, limit, offset);
    try {
      Optional<String> json = cache.get(pageKey);
      if (json.isEmpty()) {
        return null;
      }
      return JsonUtils.readValue(json.get(), PAGE_REF);
    } catch (Exception e) {
      LOG.warn(
          "Bad children-page cache entry, evicting: {} {} v={}", entityType, parentFqn, version, e);
      cache.del(pageKey);
      return null;
    }
  }

  public void put(
      String entityType, String parentFqn, int limit, int offset, ResultList<Container> page) {
    if (parentFqn == null || page == null || EntityCacheBypass.isSkipped()) {
      return;
    }
    // Re-read the version: if a writer rotated between our DB fetch and now, populate against
    // the fresh stamp so the next reader at the new stamp consumes our page. The previous
    // version's slot would be unreachable and TTL out anyway.
    String version = currentVersion(entityType, parentFqn);
    String pageKey = keys.childrenPage(entityType, parentFqn, version, limit, offset);
    try {
      String json = JsonUtils.pojoToJson(page);
      cache.set(pageKey, json, Duration.ofSeconds(config.entityTtlSeconds));
    } catch (Exception e) {
      LOG.warn("Failed to cache children page: {} {} v={}", entityType, parentFqn, version, e);
    }
  }

  /**
   * Rotate the version stamp for {@code parentFqn} so every page cached under the previous
   * stamp is unreachable. The version key carries a long TTL — outliving the page TTL — so
   * a parent that goes idle doesn't drop back to {@link #DEFAULT_VERSION} while stale pages
   * are still in Redis.
   */
  public void invalidate(String entityType, String parentFqn) {
    if (parentFqn == null || EntityCacheBypass.isSkipped()) {
      return;
    }
    String verKey = keys.childrenVersion(entityType, parentFqn);
    String newVersion = UUID.randomUUID().toString();
    Duration verTtl = Duration.ofSeconds(Math.max(config.entityTtlSeconds * 4L, 86_400L));
    try {
      cache.set(verKey, newVersion, verTtl);
    } catch (Exception e) {
      LOG.warn("Failed to rotate children-page version: {} {}", entityType, parentFqn, e);
    }
  }

  private String currentVersion(String entityType, String parentFqn) {
    if (EntityCacheBypass.isSkipped()) {
      return DEFAULT_VERSION;
    }
    String verKey = keys.childrenVersion(entityType, parentFqn);
    try {
      return cache.get(verKey).orElse(DEFAULT_VERSION);
    } catch (Exception e) {
      // Cache provider issue — treat as default version. The page lookup may miss, but
      // correctness is preserved: a stale entry from an older version becomes unreachable as
      // soon as the version key recovers.
      LOG.debug("Children-page version read failed for {} {}", entityType, parentFqn, e);
      return DEFAULT_VERSION;
    }
  }
}
