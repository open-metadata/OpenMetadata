/*
 *  Copyright 2026 Collate
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
package org.openmetadata.service.cache;

import java.time.Duration;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;

/**
 * Negative cache for "we looked, this entity doesn't exist" verdicts. Short TTL ({@link
 * CacheConfig#notFoundTtlSeconds}, default 30s) so a freshly-created entity isn't shadowed for
 * long. Invalidated on entity create via the {@link Invalidatable} registry — without that
 * invalidation, a UI flow that creates an entity and immediately reads it would hit the
 * negative cache and 404 for up to 30s.
 *
 * <p>Normal misses are only authoritative for non-deleted reads because a soft-deleted row may
 * still match {@code Include.DELETED} or {@code Include.ALL}. Hard-delete markers are distinct and
 * authoritative for every include mode, preventing a racing loader from serving an entity that no
 * longer exists.
 *
 * <p>Cache-off semantics: {@link #enabled()} returns false when {@code notFoundTtlSeconds <= 0}
 * or the provider is unavailable. Marker reads then return false (treat as "we don't know"),
 * forcing the caller down the normal DB path. Same-shape contract as the other optional layers.
 */
@Slf4j
public final class NotFoundCache implements Invalidatable {
  private static final int INVALIDATION_BATCH_SIZE = 500;
  private static final int INVALIDATION_CAS_ATTEMPTS = 3;
  private static final String LEGACY_NOT_FOUND = "1";
  private static final String NOT_FOUND = "not-found";
  private static final String HARD_DELETED = "hard-deleted";
  private static final String HARD_DELETED_NAME_PREFIX = HARD_DELETED + ":";

  private final CacheProvider cache;
  private final CacheKeys keys;
  private final int ttlSeconds;

  public NotFoundCache(CacheProvider cache, CacheKeys keys, CacheConfig config) {
    this.cache = cache;
    this.keys = keys;
    this.ttlSeconds = config.notFoundTtlSeconds;
  }

  public boolean enabled() {
    return ttlSeconds > 0 && cache != null && cache.available();
  }

  public boolean isMarkedNotFoundById(String type, UUID id) {
    return markerById(type, id).isPresent();
  }

  public boolean isMarkedNotFoundByName(String type, String fqn) {
    return markerByName(type, fqn).isPresent();
  }

  public boolean isMarkedHardDeletedById(String type, UUID id) {
    return markerById(type, id).filter(NotFoundCache::isHardDeletedMarker).isPresent();
  }

  public boolean isMarkedHardDeletedByName(String type, String fqn) {
    return markerByName(type, fqn).filter(NotFoundCache::isHardDeletedMarker).isPresent();
  }

  public boolean isKnownMissingById(String type, UUID id, boolean includeNormalMisses) {
    return isKnownMissing(markerById(type, id), includeNormalMisses);
  }

  public boolean isKnownMissingByName(String type, String fqn, boolean includeNormalMisses) {
    return isKnownMissing(markerByName(type, fqn), includeNormalMisses);
  }

  public void markNotFoundById(String type, UUID id) {
    if (!enabled()) return;
    try {
      cache.setIfAbsent(keys.notFoundById(type, id), NOT_FOUND, Duration.ofSeconds(ttlSeconds));
    } catch (Exception e) {
      LOG.debug("notFound cache write failed type={} id={}", type, id, e);
    }
  }

  public void markNotFoundByName(String type, String fqn) {
    if (!enabled()) return;
    try {
      cache.setIfAbsent(keys.notFoundByName(type, fqn), NOT_FOUND, Duration.ofSeconds(ttlSeconds));
    } catch (Exception e) {
      LOG.debug("notFound cache write failed type={} fqn={}", type, fqn, e);
    }
  }

  public void markHardDeletedById(String type, UUID id) {
    if (!enabled()) return;
    try {
      cache.set(keys.notFoundById(type, id), HARD_DELETED, Duration.ofSeconds(ttlSeconds));
    } catch (Exception e) {
      LOG.debug("hardDelete cache write failed type={} id={}", type, id, e);
    }
  }

  public void markHardDeletedByName(String type, String fqn, UUID id) {
    if (!enabled()) return;
    try {
      String marker = id == null ? HARD_DELETED : HARD_DELETED_NAME_PREFIX + id;
      cache.set(keys.notFoundByName(type, fqn), marker, Duration.ofSeconds(ttlSeconds));
    } catch (Exception e) {
      LOG.debug("hardDelete cache write failed type={} fqn={}", type, fqn, e);
    }
  }

  /**
   * Clear ordinary negative entries after a successful update without erasing a hard-delete that
   * committed before the updater's post-commit cache phase. Name tombstones from a different
   * entity id are stale FQN-reuse markers and may be removed. Every delete is compare-and-delete,
   * so a concurrent hard-delete cannot be lost between the marker read and deletion.
   */
  public boolean invalidatePreservingHardDelete(String type, UUID id, String fqn) {
    if (!enabled()) return false;
    try {
      String idKey = id == null ? null : keys.notFoundById(type, id);
      String nameKey = fqn == null ? null : keys.notFoundByName(type, fqn);
      List<String> markerKeys = new ArrayList<>(2);
      if (idKey != null) markerKeys.add(idKey);
      if (nameKey != null) markerKeys.add(nameKey);
      List<Optional<String>> markers = cache.mget(markerKeys);
      int markerIndex = 0;
      Optional<String> idMarker = idKey == null ? Optional.empty() : markers.get(markerIndex++);
      Optional<String> nameMarker = nameKey == null ? Optional.empty() : markers.get(markerIndex);
      boolean hardDeleteWon = idMarker.filter(NotFoundCache::isHardDeletedMarker).isPresent();

      if (id != null && idMarker.isPresent()) {
        hardDeleteWon |= clearReplaceableMarker(idKey, idMarker.get(), id, false);
      }
      if (nameKey != null && nameMarker.isPresent()) {
        hardDeleteWon |= clearReplaceableMarker(nameKey, nameMarker.get(), id, true);
      }
      return hardDeleteWon;
    } catch (Exception e) {
      LOG.debug("notFound update invalidate failed type={} id={} fqn={}", type, id, fqn, e);
      return true;
    }
  }

  public Set<UUID> invalidateAll(String type, Map<UUID, String> entities) {
    if (!enabled() || entities == null || entities.isEmpty()) return Set.of();
    Set<UUID> hardDeleteWinners = new HashSet<>();
    try {
      Map<String, Set<UUID>> entityIdsByKey = new LinkedHashMap<>(entities.size() * 2);
      Set<String> idKeys = new HashSet<>(entities.size());
      entities.forEach(
          (id, fqn) -> {
            if (id != null) {
              String idKey = keys.notFoundById(type, id);
              idKeys.add(idKey);
              entityIdsByKey.computeIfAbsent(idKey, ignored -> new LinkedHashSet<>()).add(id);
            }
            if (fqn != null) {
              entityIdsByKey
                  .computeIfAbsent(keys.notFoundByName(type, fqn), ignored -> new LinkedHashSet<>())
                  .add(id);
            }
          });
      List<String> cacheKeys = new ArrayList<>(entityIdsByKey.keySet());
      for (int offset = 0; offset < cacheKeys.size(); offset += INVALIDATION_BATCH_SIZE) {
        int end = Math.min(offset + INVALIDATION_BATCH_SIZE, cacheKeys.size());
        List<String> batchKeys = cacheKeys.subList(offset, end);
        List<Optional<String>> markers = cache.mget(batchKeys);
        Map<String, String> expectedValues = new LinkedHashMap<>();
        for (int index = 0; index < batchKeys.size(); index++) {
          String key = batchKeys.get(index);
          Optional<String> marker = markers.get(index);
          if (marker.isEmpty()) continue;
          classifyBatchMarker(
              key, marker.get(), idKeys, entityIdsByKey, expectedValues, hardDeleteWinners);
        }
        deleteReplaceableMarkers(expectedValues, idKeys, entityIdsByKey, hardDeleteWinners);
      }
    } catch (Exception e) {
      LOG.debug("notFound batch invalidate failed type={} count={}", type, entities.size(), e);
      entities.keySet().stream().filter(Objects::nonNull).forEach(hardDeleteWinners::add);
    }
    return hardDeleteWinners;
  }

  private boolean clearReplaceableMarker(String key, String marker, UUID id, boolean nameKey) {
    String current = marker;
    for (int attempt = 0; attempt < INVALIDATION_CAS_ATTEMPTS; attempt++) {
      boolean replaceable =
          isNormalNotFoundMarker(current) || nameKey && isHardDeleteForDifferentEntity(current, id);
      if (!replaceable) {
        return isHardDeletedMarker(current);
      }
      if (cache.deleteIfValue(key, current)) {
        return false;
      }
      Optional<String> replacement = cache.get(key);
      if (replacement.isEmpty()) {
        return false;
      }
      current = replacement.get();
    }
    throw new IllegalStateException("Negative-cache marker kept changing during invalidation");
  }

  private void deleteReplaceableMarkers(
      Map<String, String> expectedValues,
      Set<String> idKeys,
      Map<String, Set<UUID>> entityIdsByKey,
      Set<UUID> hardDeleteWinners) {
    Map<String, String> pending = expectedValues;
    for (int attempt = 0; attempt < INVALIDATION_CAS_ATTEMPTS && !pending.isEmpty(); attempt++) {
      if (cache.deleteIfValues(pending) == pending.size()) {
        return;
      }
      List<String> pendingKeys = new ArrayList<>(pending.keySet());
      List<Optional<String>> replacements = cache.mget(pendingKeys);
      Map<String, String> retry = new LinkedHashMap<>();
      for (int index = 0; index < pendingKeys.size(); index++) {
        if (replacements.get(index).isPresent()) {
          classifyBatchMarker(
              pendingKeys.get(index),
              replacements.get(index).get(),
              idKeys,
              entityIdsByKey,
              retry,
              hardDeleteWinners);
        }
      }
      pending = retry;
    }
    if (!pending.isEmpty()) {
      throw new IllegalStateException("Negative-cache markers kept changing during invalidation");
    }
  }

  private static void classifyBatchMarker(
      String key,
      String marker,
      Set<String> idKeys,
      Map<String, Set<UUID>> entityIdsByKey,
      Map<String, String> replaceableMarkers,
      Set<UUID> hardDeleteWinners) {
    Set<UUID> entityIds = entityIdsByKey.get(key);
    if (isNormalNotFoundMarker(marker)
        || !idKeys.contains(key) && isHardDeleteForDifferentEntities(marker, entityIds)) {
      replaceableMarkers.put(key, marker);
    } else if (isHardDeletedMarker(marker)) {
      addHardDeleteWinners(marker, entityIds, hardDeleteWinners);
    }
  }

  private static void addHardDeleteWinners(
      String marker, Set<UUID> entityIds, Set<UUID> hardDeleteWinners) {
    if (HARD_DELETED.equals(marker)) {
      entityIds.stream().filter(Objects::nonNull).forEach(hardDeleteWinners::add);
      return;
    }
    entityIds.stream()
        .filter(Objects::nonNull)
        .filter(id -> marker.equals(HARD_DELETED_NAME_PREFIX + id))
        .forEach(hardDeleteWinners::add);
  }

  private static boolean isHardDeletedMarker(String marker) {
    return HARD_DELETED.equals(marker) || marker.startsWith(HARD_DELETED_NAME_PREFIX);
  }

  private static boolean isKnownMissing(Optional<String> marker, boolean includeNormalMisses) {
    return marker
        .filter(
            value ->
                isHardDeletedMarker(value) || includeNormalMisses && isNormalNotFoundMarker(value))
        .isPresent();
  }

  private static boolean isNormalNotFoundMarker(String marker) {
    return NOT_FOUND.equals(marker) || LEGACY_NOT_FOUND.equals(marker);
  }

  private static boolean isHardDeleteForDifferentEntity(String marker, UUID id) {
    return marker.startsWith(HARD_DELETED_NAME_PREFIX)
        && id != null
        && !marker.equals(HARD_DELETED_NAME_PREFIX + id);
  }

  private static boolean isHardDeleteForDifferentEntities(String marker, Set<UUID> entityIds) {
    return marker.startsWith(HARD_DELETED_NAME_PREFIX)
        && entityIds.stream()
            .filter(Objects::nonNull)
            .noneMatch(id -> marker.equals(HARD_DELETED_NAME_PREFIX + id));
  }

  private Optional<String> markerById(String type, UUID id) {
    if (!enabled()) return Optional.empty();
    try {
      return cache.get(keys.notFoundById(type, id));
    } catch (Exception e) {
      LOG.debug("notFound cache read failed (treated as not-cached) type={} id={}", type, id, e);
      return Optional.empty();
    }
  }

  private Optional<String> markerByName(String type, String fqn) {
    if (!enabled()) return Optional.empty();
    try {
      return cache.get(keys.notFoundByName(type, fqn));
    } catch (Exception e) {
      LOG.debug("notFound cache read failed (treated as not-cached) type={} fqn={}", type, fqn, e);
      return Optional.empty();
    }
  }

  /**
   * Drop the negative-cache markers for this (type, id, fqn) on entity create / restore.
   * Without this, a freshly-created entity would 404 for up to 30s after a prior failed lookup.
   */
  @Override
  public void invalidate(String type, UUID id, String fqn) {
    if (!enabled()) return;
    try {
      if (id != null) cache.del(keys.notFoundById(type, id));
      if (fqn != null) cache.del(keys.notFoundByName(type, fqn));
    } catch (Exception e) {
      LOG.debug("notFound cache invalidate failed type={} id={} fqn={}", type, id, fqn, e);
    }
  }
}
