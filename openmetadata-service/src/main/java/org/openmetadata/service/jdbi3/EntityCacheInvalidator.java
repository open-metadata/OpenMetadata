/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.IntSupplier;
import org.apache.commons.lang3.tuple.ImmutablePair;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.cache.CacheBundle;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.workflows.searchIndex.ReindexingUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/** Static entity-cache invalidation: per-entity, rename-cascade, referenced-entity and
 * tag-based eviction, plus the transactional deferral scope. Extracted from EntityRepository. */
public final class EntityCacheInvalidator {
  private static final Logger LOG = LoggerFactory.getLogger(EntityCacheInvalidator.class);

  private EntityCacheInvalidator() {}

  /**
   * Invalidate cache entries for every descendant of {@code oldPrefix} in the given entity type's
   * DB table. Called by rename-cascade flows (e.g. DomainRepository.updateName) right before the
   * bulk {@code UPDATE ... WHERE fqnHash LIKE 'oldPrefix.%'} so downstream reads don't see the
   * stale (pre-rename) FQN on the children.
   *
   * <p>Publishes pub/sub for each descendant so peer OM instances drop their Guava entries too.
   *
   * <p>Returns the enumerated {@code (id, oldFqn)} pairs so the caller can pass them to {@link
   * #finishInvalidateCacheForRenameCascade} once the rename-related DB statements have run —
   * necessary because a reader landing in the window between this call and the bulk
   * {@code UPDATE} can repopulate the by-id cache with the still-visible pre-rename row, and
   * only a second invalidate pass after the DB statement can evict the poisoned entry.
   *
   * <p><b>Transactional scope:</b> the existing rename call sites invoke both passes inside the
   * same {@code @Transaction}-annotated updater, so the {@code finish} pass runs after the bulk
   * {@code UPDATE} statement(s) but <i>before</i> the surrounding transaction commits. That
   * closes the wide pre-update window (seconds, dominated by search-index walks) that CI
   * traced as the failure mode, but a residual race remains: a concurrent reader landing
   * between the {@code finish} pass and commit can still see the pre-rename row under
   * READ COMMITTED and repopulate the cache. The window is on the order of milliseconds and
   * we have no integration failures attributed to it; a true after-commit hook would close it
   * fully and is tracked as a follow-up.
   *
   * @param entityType type name (e.g. {@code domain}, {@code dataProduct}, {@code tag})
   * @param oldPrefix fully qualified name prefix the rename is moving away from
   */
  public static List<EntityDAO.EntityIdFqnPair> invalidateCacheForRenameCascade(
      String entityType, String oldPrefix) {
    if (entityType == null || nullOrEmpty(oldPrefix)) {
      return Collections.emptyList();
    }
    EntityRepository<?> repo;
    try {
      repo = Entity.getEntityRepository(entityType);
    } catch (Exception e) {
      return Collections.emptyList();
    }
    if (repo == null || repo.getDao() == null) {
      return Collections.emptyList();
    }
    List<EntityDAO.EntityIdFqnPair> affected;
    try {
      affected = repo.getDao().listDescendantIdFqnByPrefix(oldPrefix);
    } catch (Exception e) {
      LOG.warn(
          "Failed to enumerate descendants for cache invalidation: type={} prefix={}",
          entityType,
          oldPrefix,
          e);
      return Collections.emptyList();
    }
    if (affected.isEmpty()) {
      return Collections.emptyList();
    }
    dropDescendantCacheEntries(entityType, affected);
    LOG.info(
        "Invalidated cache for {} descendants of rename cascade: type={} prefix={}",
        affected.size(),
        entityType,
        oldPrefix);
    return affected;
  }

  /**
   * Post-rename-write pair to {@link #invalidateCacheForRenameCascade}. Re-evicts the cached
   * forms of every descendant captured before the rename — by id and by the old FQN. Closes
   * the wide race window where a concurrent reader arriving in the seconds between the
   * pre-invalidate and the bulk rename {@code UPDATE} repopulates the by-id (or by-old-fqn)
   * cache with the still-visible pre-rename row and pins that staleness for the entity TTL.
   *
   * <p>Called inside the same transaction as the rename writes (see {@link
   * #invalidateCacheForRenameCascade} for the full transactional caveat); the millisecond
   * window between this pass and commit is still racy but is not the failure mode CI traced.
   *
   * <p>Safe to call with an empty or null list (no-op).
   */
  public static void finishInvalidateCacheForRenameCascade(
      String entityType, List<EntityDAO.EntityIdFqnPair> affected) {
    if (entityType == null || affected == null || affected.isEmpty()) {
      return;
    }
    dropDescendantCacheEntries(entityType, affected);
    LOG.debug(
        "Post-rename-write re-invalidated cache for {} descendants: type={}",
        affected.size(),
        entityType);
  }

  private static void dropDescendantCacheEntries(
      String entityType, List<EntityDAO.EntityIdFqnPair> affected) {
    // Rename cascades run inside the rename flush transaction. Route each descendant through
    // invalidateCacheForEntity so the Guava-L1 eviction stays inline (cheap) while the Redis-L2
    // round trip is deferred to the post-commit drain when a flush scope is open — never issued
    // while the pooled connection is held. The previous per-row pub/sub reason label was
    // informational only (remote listeners evict L1 regardless), so the unified path is equivalent.
    for (EntityDAO.EntityIdFqnPair row : affected) {
      invalidateCacheForEntity(entityType, row.id, row.fqn);
    }
  }

  /**
   * When a cache-deferral scope is open on the calling thread, {@link #invalidateCacheForEntity}
   * records the Redis-L2 invalidation key here instead of issuing the (blocking, syncCommands)
   * Redis round trip inline. The flush opens a scope before its DB transaction so no Redis call
   * runs while a pooled connection is held — only the cheap local Guava-L1 invalidate stays inline
   * — then drains the de-duplicated keys after commit, on the request thread, preserving
   * read-your-write. {@code null} means "no scope active" and the Redis-L2 work runs inline.
   */
  private static final ThreadLocal<Map<CacheInvalidationKey, CacheInvalidationKey>>
      DEFERRED_CACHE_INVALIDATIONS = new ThreadLocal<>();

  /**
   * De-duplication key for a deferred Redis-L2 cache invalidation. Equality is on {@code
   * (entityType, id)} only so repeated relationship writes touching the same entity collapse to one
   * post-commit invalidation; the {@code fqn} is carried along (best non-null wins) so the by-name
   * Redis variant is evicted when any caller knew the FQN.
   */
  private static final class CacheInvalidationKey {
    private final String entityType;
    private final UUID id;
    private final String fqn;

    private CacheInvalidationKey(String entityType, UUID id, String fqn) {
      this.entityType = entityType;
      this.id = id;
      this.fqn = fqn;
    }

    @Override
    public boolean equals(Object other) {
      boolean result = this == other;
      if (!result && other instanceof CacheInvalidationKey key) {
        result = entityType.equals(key.entityType) && id.equals(key.id);
      }
      return result;
    }

    @Override
    public int hashCode() {
      return Objects.hash(entityType, id);
    }
  }

  /**
   * Open a Redis-L2 cache-invalidation deferral scope on the current thread. While open, {@link
   * #invalidateCacheForEntity} records keys instead of issuing the blocking Redis round trip.
   * Returns {@code true} if this call opened the scope (caller owns draining/closing it), {@code
   * false} if a scope was already open (nested call — the outer owner stays responsible). Pair a
   * {@code true} result with {@link #drainCacheInvalidations()} after commit and {@link
   * #clearCacheInvalidations()} on failure.
   */
  static boolean beginCacheInvalidationDeferral() {
    boolean opened = DEFERRED_CACHE_INVALIDATIONS.get() == null;
    if (opened) {
      DEFERRED_CACHE_INVALIDATIONS.set(new LinkedHashMap<>());
    }
    return opened;
  }

  /** Run every de-duplicated Redis-L2 invalidation captured since the scope opened, then close it. */
  static void drainCacheInvalidations() {
    Map<CacheInvalidationKey, CacheInvalidationKey> deferred = DEFERRED_CACHE_INVALIDATIONS.get();
    DEFERRED_CACHE_INVALIDATIONS.remove();
    if (deferred != null) {
      for (CacheInvalidationKey key : deferred.values()) {
        invalidateRedisL2ForEntity(key.entityType, key.id, key.fqn);
      }
    }
  }

  /** Discard captured keys and close the scope without running them (failed transaction). */
  static void clearCacheInvalidations() {
    DEFERRED_CACHE_INVALIDATIONS.remove();
  }

  /**
   * Full local + cross-instance cache eviction for a single entity. Used by code paths that
   * update a referring entity indirectly (e.g. data-product domain change updates the linked
   * tables; a tag delete affects policies that embed it). Does the same work as
   * {@link #invalidateCache(EntityInterface)} but doesn't require the full entity POJO — the
   * {@code (type, id, fqn)} triple is enough to drop every cached variant.
   *
   * <p>The Guava-L1 eviction always runs inline (local, cheap). The Redis-L2 portion (base/by-name
   * hash, relationship, bundle, lineage, pub/sub) issues a blocking {@code syncCommands} round
   * trip, so when a deferral scope is active (a flush is holding a pooled DB connection) it is
   * recorded and replayed post-commit on the request thread instead — never inside the handle.
   */
  public static void invalidateCacheForEntity(String entityType, UUID id, String fqn) {
    if (entityType == null || id == null) {
      return;
    }
    // Guava L1 always cleared inline — it is a local map eviction, not a network round trip, and
    // the rare uncached read path may have populated it even for UNCACHED_ENTITY_TYPES.
    EntityCaches.CACHE_WITH_ID.invalidate(new ImmutablePair<>(entityType, id));
    if (fqn != null) {
      EntityCaches.CACHE_WITH_NAME.invalidate(EntityCaches.cacheNameKey(entityType, fqn));
    }
    // Skip every Redis op for entity types that are never cached. Bot/domain/data-product
    // deletes cascade through many addRelationship/deleteRelationship calls; without this
    // short-circuit each cascade pays for a pub/sub publish + multiple DELs that touch keys
    // we never wrote — under heavy parallel load that pushes test budgets like
    // TaskResourceIT.testDeletingBotCreatorCleansUpOpenSuggestionTasks past their 30 s window.
    if (!EntityRepository.isCacheableEntityType(entityType)) {
      return;
    }
    Map<CacheInvalidationKey, CacheInvalidationKey> deferred = DEFERRED_CACHE_INVALIDATIONS.get();
    if (deferred != null) {
      recordCacheInvalidation(deferred, entityType, id, fqn);
    } else {
      invalidateRedisL2ForEntity(entityType, id, fqn);
    }
  }

  private static void recordCacheInvalidation(
      Map<CacheInvalidationKey, CacheInvalidationKey> deferred,
      String entityType,
      UUID id,
      String fqn) {
    CacheInvalidationKey key = new CacheInvalidationKey(entityType, id, fqn);
    CacheInvalidationKey existing = deferred.putIfAbsent(key, key);
    if (existing != null && existing.fqn == null && fqn != null) {
      deferred.put(key, key);
    }
  }

  private static void invalidateRedisL2ForEntity(String entityType, UUID id, String fqn) {
    var cachedEntityDao = CacheBundle.getCachedEntityDao();
    if (cachedEntityDao != null) {
      cachedEntityDao.invalidateBase(entityType, id);
      if (fqn != null) {
        cachedEntityDao.invalidateByName(entityType, fqn);
      }
    }
    var cachedRelationshipDao = CacheBundle.getCachedRelationshipDao();
    if (cachedRelationshipDao != null) {
      cachedRelationshipDao.invalidateOwners(entityType, id);
      cachedRelationshipDao.invalidateDomains(entityType, id);
      cachedRelationshipDao.invalidateContainer(entityType, id);
    }
    var cachedReadBundle = CacheBundle.getCachedReadBundle();
    if (cachedReadBundle != null) {
      cachedReadBundle.invalidate(entityType, id);
    }
    var cachedLineage = CacheBundle.getCachedLineage();
    if (cachedLineage != null) {
      cachedLineage.invalidate(id);
    }
    var pubsub = CacheBundle.getCacheInvalidationPubSub();
    if (pubsub != null) {
      pubsub.publish(entityType, id, fqn, "ref-change");
    }
  }

  /**
   * Invalidate cache entries for an entity identified by an {@link
   * CollectionDAO.EntityRelationshipRecord}. Extracts {@code fullyQualifiedName} from the record's
   * JSON payload (when present) so the by-name cache variant is evicted alongside the by-id one.
   * Callers that only have {@code (type, id)} and pass {@code fqn=null} leave GET-by-name entries
   * stale until TTL expiry — use this when the referenced entity's FQN needs to be invalidated too.
   */
  public static void invalidateCacheForReferencedEntity(
      CollectionDAO.EntityRelationshipRecord record) {
    if (record == null) {
      return;
    }
    invalidateCacheForEntity(record.getType(), record.getId(), extractFqn(record.getJson()));
  }

  /**
   * Drop cached entity JSON, bundle, and relationship caches for every entity that carries the
   * given tag FQN. The {@code tag_usage} table only stores {@code targetFQNHash}, so we cannot
   * cheaply derive (type, id, fqn) from it; we lean on the search index instead — the same source
   * the search-side {@code updateClassificationTagByFqnPrefix} reindex uses to find affected
   * documents. Run this BEFORE the search reindex runs so the search query still matches documents
   * by the old tag FQN.
   *
   * <p><b>Consistency tradeoff:</b> coverage is bounded by search-index freshness. Entities
   * tagged recently enough that the indexer hasn't picked them up are missed and fall back to
   * the entity TTL (default 48h). On busy clusters with replication lag this can be minutes.
   * If strict consistency is ever required, a direct {@code tag_usage} table query joined back
   * to each candidate entity table would be more reliable at the cost of one round-trip per
   * candidate type.
   */
  public static int invalidateCacheForTaggedEntities(String tagFqn) {
    int result = 0;
    if (!nullOrEmpty(tagFqn)) {
      result =
          deferOrRunSearchBackedInvalidation(
              () -> searchTaggedEntitiesAndInvalidate(tagFqn), tagFqn);
    }
    return result;
  }

  /**
   * Run the search-backed cache invalidation for {@code tagFqn} inline when no flush deferral scope
   * is open, or capture it for post-commit drain when a rename/move cascade has opened one — the
   * blocking ES search loop must never run while the DB transaction handle is held, and it must run
   * exactly once even when a deadlock replays the cascade. The inline (non-flush) result is the live
   * invalidated count; the deferred path returns {@code 0} because the work runs after this method
   * returns and the count is only known then (it is logged inside {@code
   * searchTaggedEntitiesAndInvalidate}).
   */
  private static int deferOrRunSearchBackedInvalidation(IntSupplier invalidation, String tagFqn) {
    int result = 0;
    if (SearchRepository.isSearchWriteDeferralActive()) {
      SearchRepository.deferOrRunSearchWrite(
          invalidation::getAsInt, "invalidateCacheForTaggedEntities", null, tagFqn, null);
    } else {
      result = invalidation.getAsInt();
    }
    return result;
  }

  private static int searchTaggedEntitiesAndInvalidate(String tagFqn) {
    int total = 0;
    int from = 0;
    boolean exhausted = false;
    while (!exhausted) {
      List<EntityReference> page = findTaggedEntitiesPage(tagFqn, from);
      if (page.isEmpty()) {
        exhausted = true;
      } else {
        for (EntityReference ref : page) {
          invalidateCacheForEntity(ref.getType(), ref.getId(), ref.getFullyQualifiedName());
          total++;
        }
        from += page.size();
      }
    }
    if (total > 0) {
      LOG.info("Invalidated cache for {} entities tagged with: {}", total, tagFqn);
    }
    return total;
  }

  private static List<EntityReference> findTaggedEntitiesPage(String tagFqn, int from) {
    List<EntityReference> page;
    try {
      page =
          ReindexingUtil.findReferenceInElasticSearchAcrossAllIndexes(
              "tags.tagFQN", ReindexingUtil.escapeDoubleQuotes(tagFqn), from);
    } catch (Exception e) {
      LOG.warn("Search-based cache invalidation failed for tag={}", tagFqn, e);
      page = List.of();
    }
    return page;
  }

  /** Bulk variant — invalidates entities tagged with any of the supplied tag FQNs. */
  public static int invalidateCacheForTaggedEntities(Collection<String> tagFqns) {
    int total = 0;
    if (!nullOrEmpty(tagFqns)) {
      for (String fqn : tagFqns) {
        total += invalidateCacheForTaggedEntities(fqn);
      }
      if (total > 0) {
        LOG.info(
            "Invalidated cache for {} entities across {} renamed tag FQNs", total, tagFqns.size());
      }
    }
    return total;
  }

  /**
   * Convenience wrapper for tag-like entity renames (Tag, GlossaryTerm) where the rename cascades
   * to descendants in the same entity table. Enumerates the descendant FQNs from the entity DAO
   * BEFORE the DB rename rewrites them, then invalidates cached entities tagged with the prefix or
   * any descendant. For Classification (where children live in a different entity table), enumerate
   * child tag FQNs at the call site and pass them to {@link
   * #invalidateCacheForTaggedEntities(Collection)} directly.
   */
  public static int invalidateCacheForTaggedEntitiesAndDescendants(
      String entityType, String oldPrefix) {
    if (entityType == null || nullOrEmpty(oldPrefix)) {
      return 0;
    }
    List<String> fqns = new ArrayList<>();
    fqns.add(oldPrefix);
    try {
      EntityRepository<?> repo = Entity.getEntityRepository(entityType);
      if (repo != null && repo.getDao() != null) {
        List<EntityDAO.EntityIdFqnPair> descendants =
            repo.getDao().listDescendantIdFqnByPrefix(oldPrefix);
        for (EntityDAO.EntityIdFqnPair pair : descendants) {
          if (pair.fqn != null && !pair.fqn.equals(oldPrefix)) {
            fqns.add(pair.fqn);
          }
        }
      }
    } catch (Exception e) {
      LOG.warn(
          "Failed to enumerate descendants for tagged-entity invalidation: type={} fqn={}",
          entityType,
          oldPrefix,
          e);
    }
    return invalidateCacheForTaggedEntities(fqns);
  }

  private static String extractFqn(String json) {
    if (json == null || json.isEmpty()) {
      return null;
    }
    try {
      var node = JsonUtils.readTree(json);
      return node.hasNonNull("fullyQualifiedName") ? node.get("fullyQualifiedName").asText() : null;
    } catch (Exception e) {
      LOG.debug("Failed to extract fullyQualifiedName for cache invalidation", e);
      return null;
    }
  }

  /**
   * Invoked by {@link org.openmetadata.service.cache.CacheInvalidationPubSub} when another OM
   * instance signals an entity change. Evicts this instance's per-process Guava caches so the next
   * read pulls fresh data. Does not touch Redis — the writer already invalidated shared keys
   * before publishing.
   */
  public static void onRemoteCacheInvalidate(String entityType, UUID id, String fqn) {
    if (entityType == null) {
      return;
    }
    if (id != null) {
      EntityCaches.CACHE_WITH_ID.invalidate(new ImmutablePair<>(entityType, id));
    }
    if (fqn != null) {
      EntityCaches.CACHE_WITH_NAME.invalidate(EntityCaches.cacheNameKey(entityType, fqn));
    }
  }
}
