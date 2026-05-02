/*
 *  Copyright 2024 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 */
package org.openmetadata.service.cache;

import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Batched pre-warm for the {@link CachedReadBundle} keys.
 *
 * <p>The standard read path's bundle population fans out to ~3 DB queries per entity (TO
 * relationships, FROM relationships, tag_usage). Doing that during warmup is exactly what
 * {@link org.openmetadata.service.apps.bundles.cache.CacheWarmupApp} is trying to avoid — it took
 * hours on modest installs.
 *
 * <p>This batcher takes a different tradeoff: it pre-warms only the parts of the bundle that have
 * cheap batched queries — tags (one batched {@code SELECT ... WHERE targetFQNHash IN (...)}) and
 * certification (already on the entity JSON we just paged through). Relations are left null so the
 * read path's lazy populate runs and fills them in on first read. After that first read the bundle
 * gets re-cached with the full relations map.
 *
 * <p>Net benefit: tag and certification reads are warm immediately after warmup, eliminating one of
 * the three fan-out queries on every first read post-deploy.
 */
@Slf4j
@RequiredArgsConstructor
public class BundleWarmupBatcher {
  private final CollectionDAO dao;
  private final CacheProvider cache;
  private final CacheKeys keys;

  /** Outcome of a batch warmup — caller uses for stats reporting. */
  public record BatchResult(int success, int failed) {}

  public BatchResult warmupBatch(
      String entityType, List<? extends EntityInterface> entities, Duration ttl) {
    if (entities == null || entities.isEmpty()) {
      return new BatchResult(0, 0);
    }
    Map<String, EntityInterface> entitiesByFqnHash = new HashMap<>(entities.size() * 2);
    List<String> fqnHashes = new ArrayList<>(entities.size());
    for (EntityInterface entity : entities) {
      if (entity.getId() == null || entity.getFullyQualifiedName() == null) {
        continue;
      }
      String hash = FullyQualifiedName.buildHash(entity.getFullyQualifiedName());
      entitiesByFqnHash.put(hash, entity);
      fqnHashes.add(hash);
    }
    if (fqnHashes.isEmpty()) {
      return new BatchResult(0, 0);
    }

    Map<String, List<TagLabel>> tagsByFqnHash;
    try {
      tagsByFqnHash = dao.tagUsageDAO().getTagsByTargetFQNHashes(fqnHashes);
    } catch (Exception e) {
      LOG.warn("Bundle warmup: tag batch fetch failed for type={}", entityType, e);
      return new BatchResult(0, entities.size());
    }

    Map<String, String> bundleKeyValues = new HashMap<>(entitiesByFqnHash.size() * 2);
    int failed = 0;
    for (Map.Entry<String, EntityInterface> entry : entitiesByFqnHash.entrySet()) {
      EntityInterface entity = entry.getValue();
      try {
        CachedReadBundle.Dto dto = new CachedReadBundle.Dto();
        // Relations left null on purpose — first read populates via the lazy path. See class
        // javadoc for the rationale.
        dto.relations = null;
        dto.tags = tagsByFqnHash.getOrDefault(entry.getKey(), Collections.emptyList());
        dto.tagsLoaded = true;
        dto.certification = entity.getCertification();
        dto.certificationLoaded = true;
        bundleKeyValues.put(keys.bundle(entityType, entity.getId()), JsonUtils.pojoToJson(dto));
      } catch (Exception e) {
        failed++;
        LOG.debug("Bundle warmup row failed: type={} id={}", entityType, entity.getId(), e);
      }
    }
    if (bundleKeyValues.isEmpty()) {
      return new BatchResult(0, failed);
    }
    try {
      cache.pipelineSet(bundleKeyValues, ttl);
    } catch (RuntimeException e) {
      LOG.warn("Bundle warmup: pipelined write failed for type={}", entityType, e);
      return new BatchResult(0, bundleKeyValues.size() + failed);
    }
    return new BatchResult(bundleKeyValues.size(), failed);
  }
}
