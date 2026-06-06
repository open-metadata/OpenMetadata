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
import static org.openmetadata.schema.type.Include.ALL;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.Map.Entry;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;

/** Thread-local parent caches for entity inheritance resolution, extracted from
 * EntityRepository. Standalone (no repository state); EntityRepository delegates. */
public final class InheritanceParentCache {

  private final ThreadLocal<Map<UUID, EntityInterface>> parentCacheForPrepare = new ThreadLocal<>();
  private static final ThreadLocal<Map<InheritanceCacheKey, EntityInterface>>
      inheritanceParentCache = ThreadLocal.withInitial(HashMap::new);

  record InheritanceCacheKey(String entityType, UUID entityId, String fieldsKey) {}

  public EntityInterface getCachedParentOrLoad(
      EntityReference ref, String fields, Include include) {
    var cache = parentCacheForPrepare.get();
    if (cache != null && ref != null && ref.getId() != null) {
      var cached = cache.get(ref.getId());
      if (cached != null) return cached;
    }
    return Entity.getEntity(ref, fields, include);
  }

  /** Store preloaded parents in the thread-local cache. */
  public void setParentCache(Map<UUID, EntityInterface> cache) {
    parentCacheForPrepare.set(cache);
  }

  /** Clear the parent cache after bulk prepare. */
  public void clearParentCache() {
    parentCacheForPrepare.remove();
    inheritanceParentCache.remove();
  }

  public static void clearInheritanceParentCache() {
    inheritanceParentCache.remove();
  }

  public EntityInterface getCachedInheritanceParent(EntityReference parentRef, String fields) {
    if (parentRef == null || parentRef.getId() == null || nullOrEmpty(parentRef.getType())) {
      return null;
    }
    Map<InheritanceCacheKey, EntityInterface> cache = inheritanceParentCache.get();
    InheritanceCacheKey directKey = inheritanceCacheKey(parentRef, fields);
    EntityInterface direct = cache.get(directKey);
    if (direct != null) {
      return direct;
    }

    // Reuse a superset entry when the same parent was already loaded with broader fields
    // (for example "owners,domains,retentionPeriod" can serve "owners,domains").
    Set<String> requestedFields = parseFieldSet(directKey.fieldsKey());
    for (Entry<InheritanceCacheKey, EntityInterface> entry : cache.entrySet()) {
      InheritanceCacheKey cachedKey = entry.getKey();
      if (!cachedKey.entityType().equals(parentRef.getType())
          || !cachedKey.entityId().equals(parentRef.getId())) {
        continue;
      }
      if (parseFieldSet(cachedKey.fieldsKey()).containsAll(requestedFields)) {
        return entry.getValue();
      }
    }
    return null;
  }

  public <P extends EntityInterface> P getOrLoadInheritanceParent(
      EntityReference parentRef, String fields, Class<P> parentClass) {
    if (parentRef == null || parentRef.getId() == null || nullOrEmpty(parentRef.getType())) {
      return null;
    }
    EntityInterface parent = getCachedInheritanceParent(parentRef, fields);
    if (parent == null) {
      parent = Entity.getEntityForInheritance(parentRef.getType(), parentRef.getId(), fields, ALL);
      cacheInheritanceParent(parentRef, fields, parent);
    }
    if (!parentClass.isInstance(parent)) {
      return null;
    }
    return parentClass.cast(parent);
  }

  public void cacheInheritanceParent(
      EntityReference parentRef, String fields, EntityInterface parent) {
    if (parentRef == null || parentRef.getId() == null || nullOrEmpty(parentRef.getType())) {
      return;
    }
    if (parent == null || parent.getId() == null) {
      return;
    }
    inheritanceParentCache.get().put(inheritanceCacheKey(parentRef, fields), parent);
  }

  private InheritanceCacheKey inheritanceCacheKey(EntityReference parentRef, String fields) {
    return new InheritanceCacheKey(
        parentRef.getType(), parentRef.getId(), normalizeFieldList(fields));
  }

  private String normalizeFieldList(String fields) {
    if (fields == null || fields.isBlank()) {
      return "";
    }
    // Canonicalize field order so cache keys are stable across equivalent requests
    // (e.g. "owners,domains" and "domains, owners" should share the same parent entry).
    return fields
        .lines()
        .flatMap(line -> Stream.of(line.split(",")))
        .map(String::trim)
        .filter(field -> !field.isEmpty())
        .distinct()
        .sorted()
        .collect(Collectors.joining(","));
  }

  private Set<String> parseFieldSet(String fields) {
    if (fields == null || fields.isBlank()) {
      return Collections.emptySet();
    }
    return Stream.of(fields.split(","))
        .map(String::trim)
        .filter(field -> !field.isEmpty())
        .collect(Collectors.toSet());
  }
}
