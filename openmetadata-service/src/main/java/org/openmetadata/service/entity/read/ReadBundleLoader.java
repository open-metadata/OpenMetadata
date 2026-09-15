package org.openmetadata.service.entity.read;

import static org.openmetadata.service.monitoring.RequestLatencyContext.phase;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.locks.Lock;
import java.util.function.Supplier;
import java.util.function.ToLongFunction;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Votes;
import org.openmetadata.service.cache.CachedReadBundle;

/** Orchestrates a requested read projection using injected relationship, metadata and cache sources. */
public final class ReadBundleLoader<T extends EntityInterface> {
  private final Options options;
  private final RelationshipReadLoader relationships;
  private final CacheAccess cacheAccess;
  private final ReadMetadataSource<T> metadata;

  public record Options(String entityType, boolean supportsCertification) {}

  public record CacheAccess(
      boolean cacheable, Supplier<CachedReadBundle> provider, ToLongFunction<UUID> epoch) {}

  public ReadBundleLoader(
      Options options,
      RelationshipReadLoader relationships,
      CacheAccess cacheAccess,
      ReadMetadataSource<T> metadata) {
    this.options = options;
    this.relationships = relationships;
    this.cacheAccess = cacheAccess;
    this.metadata = metadata;
  }

  public ReadBundle load(T entity, ReadPlan readPlan) {
    ReadBundle bundle = new ReadBundle();
    if (entity == null || entity.getId() == null || readPlan == null || readPlan.isEmpty()) {
      return bundle;
    }

    boolean cacheReadBundle = isReadPlanNonDeletedOnly(readPlan) && cacheAccess.cacheable();
    CachedReadBundle bundleCache = cacheReadBundle ? cacheAccess.provider().get() : null;

    Lock loadLock = null;
    CachedReadBundle.Snapshot initialSnapshot = null;
    long loadEpoch = bundleCache == null ? 0L : cacheAccess.epoch().applyAsLong(entity.getId());
    if (bundleCache != null) {
      try (var ignored = phase("readBundleCacheGet")) {
        initialSnapshot = bundleCache.getSnapshot(options.entityType(), entity.getId());
      }
      // Coordinate only missing coverage. Complete hits stay lock-free; publication below
      // compares the observed bytes so another instance's fill or invalidation wins its race.
      if (!hasBundleCoverage(readPlan, initialSnapshot)) {
        loadLock = bundleCache.loadLockFor(options.entityType(), entity.getId());
        try (var ignored = phase("readBundleWaitForLoad")) {
          loadLock.lock();
        }
        // Re-check under the lock — another thread on this instance may have just populated.
        // Any throw from here on must still unlock; use a try/catch so we fail-closed if the
        // get itself throws.
        try {
          try (var ignored = phase("readBundleCacheGet")) {
            initialSnapshot = bundleCache.getSnapshot(options.entityType(), entity.getId());
          }
        } catch (RuntimeException | Error e) {
          loadLock.unlock();
          loadLock = null;
          throw e;
        }
      }
    }
    try {
      return fillReadBundle(
          entity,
          readPlan,
          bundle,
          bundleCache == null
              ? BundleCacheState.BYPASS
              : new BundleCacheState(bundleCache, initialSnapshot, loadEpoch));
    } finally {
      if (loadLock != null) {
        loadLock.unlock();
      }
    }
  }

  private ReadBundle fillReadBundle(
      T entity, ReadPlan readPlan, ReadBundle bundle, BundleCacheState cacheState) {
    boolean relationsFilledFromCache = false;
    boolean tagsFilledFromCache = false;
    boolean certificationFilledFromCache = false;
    final CachedReadBundle.Dto dto =
        cacheState.observed() == null ? null : cacheState.observed().value();
    if (dto != null) {
      if (dto.relations != null) {
        readPlan
            .getRelationSpecs()
            .forEach(
                (field, spec) -> {
                  if (dto.relations.containsKey(field)) {
                    bundle.putRelations(
                        entity.getId(), field, spec.include(), dto.relations.get(field));
                  }
                });
        relationsFilledFromCache = readPlanCoversRelations(readPlan, dto.relations);
      }
      if (dto.tagsLoaded && readPlan.shouldLoadTags()) {
        bundle.putTags(entity.getId(), dto.tags == null ? Collections.emptyList() : dto.tags);
        tagsFilledFromCache = true;
      }
      if (dto.certificationLoaded && options.supportsCertification()) {
        bundle.putCertification(entity.getId(), dto.certification);
        certificationFilledFromCache = true;
      }
    }

    if (!relationsFilledFromCache) {
      relationships.load(
          entity.getId(), options.entityType(), missingBundleRelations(readPlan, dto), bundle);
    }

    if (readPlan.shouldLoadTags() && !tagsFilledFromCache) {
      try (var ignored = phase("readBundleFetchTags")) {
        // One DB round-trip returns both normal tags and any certification tag for this entity.
        // Previously getCertification() fired a second query (getCertTagsInternalBatch) and
        // batchFetchTags() discarded the cert rows it had already loaded.
        metadata.loadTags(entity, bundle);
      }
    }

    if (readPlan.shouldLoadVotes()) {
      Votes votes;
      try (var ignored = phase("readBundleFetchVotes")) {
        votes = metadata.loadVotes(entity);
      }
      bundle.putVotes(entity.getId(), votes);
    }

    if (readPlan.shouldLoadExtension()) {
      Object extension;
      try (var ignored = phase("readBundleFetchExtension")) {
        extension = metadata.loadExtension(entity);
      }
      bundle.putExtension(entity.getId(), extension);
    }

    try (var ignored = phase("readBundlePrefetchEntitySpecific")) {
      metadata.prefetch(entity, readPlan, bundle);
    }

    if (cacheState.cache() != null
        && cacheState.epoch() == cacheAccess.epoch().applyAsLong(entity.getId())
        && (!relationsFilledFromCache || !tagsFilledFromCache || !certificationFilledFromCache)) {
      CachedReadBundle.Dto populated =
          buildBundleDto(entity, readPlan, bundle, options.supportsCertification());
      if (populated != null) {
        try (var ignored = phase("readBundleCachePut")) {
          boolean loadedCoverage =
              !relationsFilledFromCache || (readPlan.shouldLoadTags() && !tagsFilledFromCache);
          if (loadedCoverage) {
            cacheState
                .cache()
                .publish(options.entityType(), entity.getId(), cacheState.observed(), populated);
          } else {
            cacheState.cache().refresh(options.entityType(), entity.getId());
          }
        }
      }
    }
    return bundle;
  }

  private record BundleCacheState(
      CachedReadBundle cache, CachedReadBundle.Snapshot observed, long epoch) {
    private static final BundleCacheState BYPASS = new BundleCacheState(null, null, 0L);
  }

  private static boolean hasBundleCoverage(ReadPlan plan, CachedReadBundle.Snapshot snapshot) {
    if (snapshot == null) {
      return false;
    }
    CachedReadBundle.Dto dto = snapshot.value();
    boolean hasRelations =
        plan.getRelationSpecs().isEmpty()
            || (dto.relations != null && readPlanCoversRelations(plan, dto.relations));
    return hasRelations && (!plan.shouldLoadTags() || dto.tagsLoaded);
  }

  private static ReadPlan missingBundleRelations(ReadPlan plan, CachedReadBundle.Dto dto) {
    if (dto == null || dto.relations == null) {
      return plan;
    }
    ReadPlanBuilder missing = new ReadPlanBuilder(plan.getEntityId());
    plan.getRelationSpecs()
        .forEach(
            (field, spec) -> {
              if (!dto.relations.containsKey(field)) {
                switch (spec.direction()) {
                  case TO -> missing.addToRelationField(
                      field, spec.include(), spec.relationship(), spec.relatedEntityType());
                  case FROM -> missing.addFromRelationField(
                      field, spec.include(), spec.relationship(), spec.relatedEntityType());
                }
              }
            });
    return missing.build();
  }

  private static boolean isReadPlanNonDeletedOnly(ReadPlan readPlan) {
    return readPlan.getRelationSpecs().values().stream()
        .allMatch(spec -> spec.include() == Include.NON_DELETED);
  }

  private static boolean readPlanCoversRelations(
      ReadPlan readPlan, Map<String, List<EntityReference>> cached) {
    for (String field : readPlan.getRelationSpecs().keySet()) {
      if (!cached.containsKey(field)) {
        return false;
      }
    }
    return true;
  }

  private static CachedReadBundle.Dto buildBundleDto(
      EntityInterface entity, ReadPlan readPlan, ReadBundle bundle, boolean supportsCertification) {
    CachedReadBundle.Dto dto = new CachedReadBundle.Dto();
    dto.relations = new HashMap<>();
    readPlan
        .getRelationSpecs()
        .forEach(
            (field, spec) -> {
              bundle
                  .getRelations(entity.getId(), field, spec.include())
                  .ifPresent(refs -> dto.relations.put(field, refs));
            });
    if (supportsCertification && bundle.hasCertification(entity.getId())) {
      dto.certificationLoaded = true;
      dto.certification = bundle.getCertificationOrNull(entity.getId());
    }
    if (readPlan.shouldLoadTags()) {
      bundle
          .getTags(entity.getId())
          .ifPresent(
              tags -> {
                dto.tags = tags;
                dto.tagsLoaded = true;
              });
    }
    if (dto.relations.isEmpty() && !dto.tagsLoaded && !dto.certificationLoaded) {
      return null;
    }
    return dto;
  }
}
