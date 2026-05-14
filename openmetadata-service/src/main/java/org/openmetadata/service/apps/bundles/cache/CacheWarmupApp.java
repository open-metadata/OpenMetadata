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
package org.openmetadata.service.apps.bundles.cache;

import static org.openmetadata.service.apps.scheduler.AppScheduler.ON_DEMAND_JOB;
import static org.openmetadata.service.apps.scheduler.OmAppJobListener.APP_CONFIG;
import static org.openmetadata.service.apps.scheduler.OmAppJobListener.APP_RUN_STATS;
import static org.openmetadata.service.apps.scheduler.OmAppJobListener.WEBSOCKET_STATUS_CHANNEL;
import static org.openmetadata.service.socket.WebSocketManager.CACHE_WARMUP_JOB_BROADCAST_CHANNEL;

import com.fasterxml.jackson.core.type.TypeReference;
import java.net.InetAddress;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.app.FailureContext;
import org.openmetadata.schema.entity.app.SuccessContext;
import org.openmetadata.schema.entity.applications.configuration.internal.CacheWarmupAppConfig;
import org.openmetadata.schema.system.EntityStats;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.AbstractNativeApplication;
import org.openmetadata.service.cache.BundleWarmupBatcher;
import org.openmetadata.service.cache.CacheBundle;
import org.openmetadata.service.cache.CacheConfig;
import org.openmetadata.service.cache.CacheKeys;
import org.openmetadata.service.cache.CacheMetrics;
import org.openmetadata.service.cache.CacheProvider;
import org.openmetadata.service.exception.AppException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.socket.WebSocketManager;
import org.quartz.JobExecutionContext;

/**
 * Cache warmup driven by bulk SQL + pipelined Redis writes.
 *
 * <p>The previous implementation iterated entities one at a time through
 * {@code EntityRepository.find(Include.ALL)} (which triggers the full ReadBundle fan-out) and
 * fronted the work with a producer/consumer queue plus a single-instance Redis distributed lock.
 * Even modest installs took hours, and multi-instance deployments idled all but one server.
 *
 * <p>The new flow:
 * <ul>
 *   <li>Stream pages of raw JSON rows via {@link EntityDAO#listAfterWithOffset} — no joins, no
 *       relationship resolution, just the column store.</li>
 *   <li>Populate {@code om:<ns>:e:<type>:<uuid>} (HSET field {@code base}) and
 *       {@code om:<ns>:en:<type>:<fqnHash>} (SET) for each row.</li>
 *   <li>Write each batch with Lettuce async pipelining — one await covers the whole batch rather
 *       than one RTT per key.</li>
 *   <li>No distributed lock. Instances warm independently; Redis writes are idempotent, so the
 *       worst case is redundant SETs of identical JSON.</li>
 * </ul>
 *
 * <p>The {@code bundle:{<uuid>}:<type>} entries are pre-warmed by default via {@link
 * org.openmetadata.service.cache.BundleWarmupBatcher}, which uses cheap batched queries to populate
 * tags + certification. Operators can opt into {@code warmRelationships=true} to also batch-warm
 * common low-cardinality relation fields in the bundle. Set {@code warmBundles=false} in the app
 * config (or
 * {@code -Dom.cache.warmBundles=false} at JVM start) to skip the bundle pass for very large
 * installs.
 *
 * <p>Optional opt-in {@code enableDistributedClaim=true} adds a Redis SETNX-based per-entity-
 * type claim so multi-instance deployments avoid redundant DB scans. Per-entity-type checkpoints
 * persist warmup progress across restarts; an aborted run resumes from the last successfully
 * pipelined offset.
 */
@Slf4j
public class CacheWarmupApp extends AbstractNativeApplication {
  private static final String ALL = "all";
  private static final int DEFAULT_BATCH_SIZE = 1000;
  private static final Set<String> LEGACY_APP_CONFIG_FIELDS =
      Set.of("consumerThreads", "queueSize");
  // Built per-instance from cacheConfig.redis.keyspace so multi-environment deployments sharing
  // one Redis with different keyspaces don't collide on warmup metadata. TTL is one day for
  // checkpoints (long enough for ops staff to notice and resume a stuck warmup, short enough
  // that abandoned checkpoints self-clean). Claim TTL is short enough to limit the
  // stop-the-world hold if an instance dies mid-warm.
  private static final Duration CHECKPOINT_TTL = Duration.ofDays(1);
  private static final Duration CLAIM_TTL = Duration.ofMinutes(10);

  // Bound how long we wait for a flapping cache before declaring the warmup partial. Each retry
  // sleeps {@link #UNAVAILABLE_BACKOFF_MS}, so the total grace before bailing is roughly
  // MAX_UNAVAILABLE_RETRIES * UNAVAILABLE_BACKOFF_MS / 1000 seconds. Old behaviour was a single
  // {@code break} on first {@code !available}, which combined with a 300ms-timeout cache flipping
  // unavailable on the very first hiccup left 84% of entities cold while the run reported SUCCESS.
  private static final int MAX_UNAVAILABLE_RETRIES = 30;
  private static final long UNAVAILABLE_BACKOFF_MS = 1_000L;

  // Runtime state used for the AppRunRecord broadcast. We keep an EventPublisherJob here purely
  // because that's what the AppRunRecord serialization expects in the success/failure contexts;
  // it is NOT parsed from the user-supplied JSON. User configuration lives on {@link #appConfig}.
  @Getter private EventPublisherJob jobData;
  private CacheWarmupAppConfig appConfig;

  private CacheProvider cacheProvider;
  private CacheKeys keys;
  private CacheConfig cacheConfig;
  private BundleWarmupBatcher bundleBatcher;
  // Set during initCacheComponents from cacheConfig.redis.keyspace.
  private String checkpointKeyPrefix;
  private String claimKeyPrefix;
  private final String instanceId = generateInstanceId();

  private JobExecutionContext jobExecutionContext;
  private volatile boolean stopped = false;
  private final Stats stats = new Stats().withEntityStats(new EntityStats());
  private volatile boolean partiallyWarmed = false;
  // Per-entity-type bail-out reasons collected during warmEntity. Surfaced through
  // jobData.failure → AppRunRecord.failureContext when the run finishes in ACTIVE_ERROR /
  // FAILED so operators can see which entity types and offsets bailed without trawling logs.
  private final java.util.Map<String, String> partialWarmupFailures =
      new java.util.concurrent.ConcurrentHashMap<>();
  private volatile long lastWebSocketUpdate = 0;
  private static final long WEBSOCKET_UPDATE_INTERVAL_MS = 2000;

  public CacheWarmupApp(CollectionDAO collectionDAO, SearchRepository searchRepository) {
    super(collectionDAO, searchRepository);
  }

  @Override
  public void init(App app) {
    super.init(app);
    appConfig = parseAppConfig(app.getAppConfiguration());
    jobData = newRuntimeJobData();
  }

  private CacheWarmupAppConfig parseAppConfig(Object raw) {
    return normalizeAppConfig(raw);
  }

  static CacheWarmupAppConfig normalizeAppConfig(final Object raw) {
    if (raw == null) {
      return new CacheWarmupAppConfig();
    }
    final Object rawConfig =
        raw instanceof String configJson
            ? JsonUtils.readValue(configJson, new TypeReference<Map<String, Object>>() {})
            : raw;
    if (rawConfig == null) {
      return new CacheWarmupAppConfig();
    }
    final Map<String, Object> sanitized =
        JsonUtils.convertValue(rawConfig, new TypeReference<Map<String, Object>>() {});
    if (sanitized == null) {
      return new CacheWarmupAppConfig();
    }
    LEGACY_APP_CONFIG_FIELDS.forEach(sanitized::remove);
    return JsonUtils.convertValue(sanitized, CacheWarmupAppConfig.class);
  }

  private EventPublisherJob newRuntimeJobData() {
    EventPublisherJob runtime = new EventPublisherJob();
    if (appConfig != null) {
      runtime.setEntities(appConfig.getEntities());
      if (appConfig.getBatchSize() != null) {
        runtime.setBatchSize(appConfig.getBatchSize());
      }
    }
    return runtime;
  }

  @Override
  public void execute(JobExecutionContext jobExecutionContext) {
    this.jobExecutionContext = jobExecutionContext;
    this.stopped = false;
    try {
      // Resolve the live config before constructing components. On-demand runs carry user
      // overrides in the Quartz JobDataMap (entities, batchSize, warmBundles,
      // enableDistributedClaim) that aren't in the persisted App config, and bundleBatcher in
      // particular needs the right warmBundles flag at construction time.
      initJobData(jobExecutionContext);
      initCacheComponents();
      if (cacheProvider == null || !cacheProvider.available()) {
        // Surface this as FAILED — initJobData set status to RUNNING above, and the finally block
        // will broadcast the terminal state. Leaving it RUNNING here would pin the job record in
        // an active state indefinitely. Populate jobData.failure so the AppRunRecord carries an
        // actionable reason instead of a bare FAILED status.
        LOG.warn("Cache not available, skipping warmup");
        jobData.setStatus(EventPublisherJob.Status.FAILED);
        jobData.setFailure(
            new IndexingError()
                .withErrorSource(IndexingError.ErrorSource.JOB)
                .withMessage(
                    cacheProvider == null
                        ? "Cache provider not configured — warmup skipped"
                        : "Redis cache provider unavailable at warmup start — warmup skipped"));
        return;
      }
      runWarmup();
    } catch (Exception e) {
      LOG.error("Cache warmup failed", e);
      if (jobData != null) {
        jobData.setStatus(EventPublisherJob.Status.FAILED);
        jobData.setFailure(
            new IndexingError()
                .withErrorSource(IndexingError.ErrorSource.JOB)
                .withMessage("Cache warmup failed: " + exceptionMessage(e)));
      }
    } finally {
      sendUpdates(jobExecutionContext, true);
    }
  }

  private void initCacheComponents() {
    cacheProvider = CacheBundle.getCacheProvider();
    cacheConfig = CacheBundle.getCacheConfig();
    if (cacheConfig != null) {
      keys = new CacheKeys(cacheConfig.redis.keyspace);
      String ks = cacheConfig.redis.keyspace == null ? "om:prod" : cacheConfig.redis.keyspace;
      checkpointKeyPrefix = ks + ":warmup:checkpoint:";
      claimKeyPrefix = ks + ":warmup:claim:";
    }
    if (warmBundlesEnabled() && cacheProvider != null && keys != null) {
      bundleBatcher =
          new BundleWarmupBatcher(collectionDAO, cacheProvider, keys, warmRelationshipsEnabled());
    }
  }

  private boolean warmBundlesEnabled() {
    if (appConfig != null && appConfig.getWarmBundles() != null) {
      return appConfig.getWarmBundles();
    }
    return Boolean.parseBoolean(System.getProperty("om.cache.warmBundles", "true"));
  }

  private boolean warmRelationshipsEnabled() {
    if (appConfig != null && appConfig.getWarmRelationships() != null) {
      return appConfig.getWarmRelationships();
    }
    return Boolean.parseBoolean(System.getProperty("om.cache.warmRelationships", "false"));
  }

  private boolean distributedClaimEnabled() {
    if (appConfig != null && appConfig.getEnableDistributedClaim() != null) {
      return appConfig.getEnableDistributedClaim();
    }
    return Boolean.parseBoolean(System.getProperty("om.cache.warmup.distributedClaim", "false"));
  }

  /** When true, this run warms every entity type even if another instance has already
   *  claimed it. Use sparingly — concurrent warmers race on the same Redis keys, which is
   *  idempotent but wastes work and may briefly serve mixed-version reads. */
  private boolean forceWarmup() {
    return appConfig != null
        && appConfig.getForce() != null
        && Boolean.TRUE.equals(appConfig.getForce());
  }

  /** Stash a per-entity-type bail-out reason. We append rather than replace so a single
   *  entity type that hits multiple failure paths during one run keeps the full picture. */
  private void recordPartialFailure(String entityType, String reason) {
    partialWarmupFailures.merge(entityType, reason, (a, b) -> a + "; " + b);
  }

  /** Compose an {@link IndexingError} summarising every entity-type partial failure for
   *  display in the AppRunRecord's failureContext. The message is bounded so it doesn't blow
   *  up the websocket payload on degenerate runs. */
  private IndexingError buildPartialWarmupFailure() {
    if (partialWarmupFailures.isEmpty()) {
      return new IndexingError()
          .withErrorSource(IndexingError.ErrorSource.JOB)
          .withMessage(
              "Cache warmup completed with one or more entity types only partially warmed");
    }
    StringBuilder sb = new StringBuilder("Partial warmup; per-entity reasons:");
    int budget = 1024;
    for (Map.Entry<String, String> e : partialWarmupFailures.entrySet()) {
      String chunk = String.format(" %s=[%s];", e.getKey(), e.getValue());
      if (sb.length() + chunk.length() > budget) {
        sb.append(" (truncated, ")
            .append(partialWarmupFailures.size())
            .append(" entity types total)");
        break;
      }
      sb.append(chunk);
    }
    return new IndexingError()
        .withErrorSource(IndexingError.ErrorSource.JOB)
        .withFailedCount(partialWarmupFailures.size())
        .withMessage(sb.toString());
  }

  private static String exceptionMessage(Throwable t) {
    String msg = t.getMessage();
    return msg != null ? msg : t.getClass().getSimpleName();
  }

  private void initJobData(JobExecutionContext ctx) {
    boolean isOnDemand = ctx.getJobDetail().getKey().getName().equals(ON_DEMAND_JOB);
    // For on-demand runs, OmAppJobListener places the user-supplied config (with overrides
    // for entities / batchSize / warmBundles / warmRelationships / enableDistributedClaim) into the
    // Quartz
    // JobDataMap[APP_CONFIG]. {@code init(App)} ran earlier and cached the persisted App
    // config in {@code appConfig}; if we don't reload here, those manual overrides are
    // silently ignored. Always reload for on-demand; for scheduled runs the persisted config
    // is what we want.
    if (appConfig == null || isOnDemand) {
      appConfig = loadAppConfig(ctx);
    }
    jobData = newRuntimeJobData();
    if (isOnDemand) {
      // Reflect the (typed) user-supplied config back onto the in-memory App instance so the
      // rest of THIS execution (status pushes, WebSocket payloads, downstream handlers reading
      // getApp()) sees the override. Intentionally NOT persisted via AppRepository — on-demand
      // is meant to be a one-shot override of the stored config, not a permanent edit. The
      // Configuration page continues to reflect the persisted defaults; users that want a
      // permanent change save the config explicitly through the API. Round-trip through Map
      // so AbstractNativeApplication's persistence layer doesn't need to know about
      // CacheWarmupAppConfig directly.
      Map<String, Object> asMap =
          JsonUtils.convertValue(appConfig, new TypeReference<Map<String, Object>>() {});
      getApp().setAppConfiguration(asMap);
    }
    if (jobData.getBatchSize() == null) {
      jobData.setBatchSize(DEFAULT_BATCH_SIZE);
    }
    jobData.setStatus(EventPublisherJob.Status.RUNNING);
    jobData.setStats(stats);
  }

  private CacheWarmupAppConfig loadAppConfig(JobExecutionContext ctx) {
    String raw = (String) ctx.getJobDetail().getJobDataMap().get(APP_CONFIG);
    if (raw != null) {
      return normalizeAppConfig(raw);
    }
    if (getApp() != null && getApp().getAppConfiguration() != null) {
      return parseAppConfig(getApp().getAppConfiguration());
    }
    throw new AppException("CacheWarmup app configuration is not initialized");
  }

  private void runWarmup() {
    Set<String> entityTypes = resolveEntityTypes();
    for (String entityType : entityTypes) {
      initEntityStats(entityType);
    }
    long totalTargetCount = 0;
    for (String entityType : entityTypes) {
      totalTargetCount +=
          stats.getEntityStats().getAdditionalProperties().get(entityType).getTotalRecords();
    }
    stats.setJobStats(new StepStats().withTotalRecords((int) totalTargetCount));
    sendUpdates(jobExecutionContext, true);

    int batchSize = jobData.getBatchSize();
    Duration ttl = Duration.ofSeconds(cacheConfig.entityTtlSeconds);
    partiallyWarmed = false;
    partialWarmupFailures.clear();
    for (String entityType : entityTypes) {
      if (stopped) break;
      warmupEntityType(entityType, batchSize, ttl);
    }
    if (stopped) {
      jobData.setStatus(EventPublisherJob.Status.STOPPED);
    } else if (partiallyWarmed) {
      jobData.setStatus(EventPublisherJob.Status.ACTIVE_ERROR);
      // Surface the per-entity bail-out reasons in jobData.failure so
      // updateRecordToDbAndNotify (and the WebSocket payload) carry actionable detail. The UI
      // shows AppRunRecord.failureContext.failure verbatim, so a human-readable summary here
      // beats an opaque ACTIVE_ERROR with no clue which entity type or offset failed.
      jobData.setFailure(buildPartialWarmupFailure());
      LOG.warn("Cache warmup completed with one or more entity types only partially warmed");
    } else {
      jobData.setStatus(EventPublisherJob.Status.COMPLETED);
      CacheMetrics metrics = CacheMetrics.getInstance();
      if (metrics != null) {
        metrics.recordWarmupCompleted();
      }
    }
  }

  private void warmupEntityType(String entityType, int batchSize, Duration ttl) {
    if (Entity.USER.equals(entityType)) {
      LOG.debug("Skipping user entity type — not cached by design");
      return;
    }
    if (distributedClaimEnabled() && !forceWarmup() && !claimEntityType(entityType)) {
      LOG.info("Skipping {} — claimed by another instance", entityType);
      return;
    }
    if (distributedClaimEnabled() && forceWarmup()) {
      LOG.info(
          "Force warmup enabled for {} — bypassing distributed claim (operator override)",
          entityType);
    }
    EntityRepository<?> repository;
    EntityDAO<?> dao;
    Class<? extends EntityInterface> entityClass;
    try {
      repository = Entity.getEntityRepository(entityType);
      dao = repository.getDao();
      entityClass = repository.getEntityClass();
    } catch (Exception e) {
      LOG.debug("Unknown entity type {}, skipping", entityType);
      return;
    }

    int offset = readCheckpoint(entityType);
    if (offset > 0) {
      LOG.info("Resuming {} warmup from checkpoint offset {}", entityType, offset);
    }
    int success = 0;
    int bundlesWritten = 0;
    int failed = 0;
    int unavailableAttempts = 0;
    boolean bailedOut = false;
    long start = System.currentTimeMillis();
    while (!stopped) {
      if (!cacheProvider.available()) {
        // Cache flipped to unavailable mid-warmup. Old behaviour was an immediate {@code break}
        // here, which combined with a hair-trigger availability flag (a single 300ms timeout
        // marked the whole provider unavailable) routinely left 80%+ of entities cold while the
        // run reported COMPLETED. Now we wait for the health-check to confirm recovery (with
        // bounded retries) before declaring this entity type partially warmed.
        if (++unavailableAttempts > MAX_UNAVAILABLE_RETRIES) {
          LOG.warn(
              "Cache provider unavailable for {} after {} retries (~{}s); marking warmup partial",
              entityType,
              unavailableAttempts,
              (MAX_UNAVAILABLE_RETRIES * UNAVAILABLE_BACKOFF_MS) / 1000);
          partiallyWarmed = true;
          bailedOut = true;
          recordPartialFailure(
              entityType,
              String.format(
                  "cache unavailable after %d retries at offset %d", unavailableAttempts, offset));
          break;
        }
        try {
          Thread.sleep(UNAVAILABLE_BACKOFF_MS);
        } catch (InterruptedException ie) {
          Thread.currentThread().interrupt();
          break;
        }
        continue;
      }
      // Reset retry counter once the provider is available again so a flaky cache that recovers
      // doesn't accumulate retry budget across separate hiccups within the same entity type.
      unavailableAttempts = 0;
      List<String> page;
      try {
        page = dao.listAfterWithOffset(batchSize, offset);
      } catch (Exception e) {
        // DB read failures during warmup leave the rest of this entity type cold. Mark
        // partial so the run reports ACTIVE_ERROR (not COMPLETED) and the saved checkpoint
        // is preserved for the next run instead of being cleared at the end of warmEntity.
        LOG.warn("Bulk fetch failed for {} at offset {}", entityType, offset, e);
        partiallyWarmed = true;
        bailedOut = true;
        recordPartialFailure(
            entityType,
            String.format("bulk fetch failed at offset %d: %s", offset, exceptionMessage(e)));
        break;
      }
      if (page.isEmpty()) break;

      Map<String, Map<String, String>> hsetBatch = new HashMap<>(page.size() * 2);
      Map<String, String> setBatch = new HashMap<>(page.size());
      List<EntityInterface> parsedEntities = new ArrayList<>(page.size());
      // Per-page deltas — updateEntityStats adds to the running totals, so passing cumulative
      // counts would double-count entries from earlier pages.
      int pageSuccess = 0;
      int pageFailed = 0;
      for (String json : page) {
        if (json == null || json.isEmpty()) continue;
        try {
          EntityInterface entity = JsonUtils.readValue(json, entityClass);
          if (entity.getId() == null || entity.getFullyQualifiedName() == null) {
            pageFailed++;
            continue;
          }
          hsetBatch.put(keys.entity(entityType, entity.getId()), Map.of("base", json));
          setBatch.put(keys.entityByName(entityType, entity.getFullyQualifiedName()), json);
          parsedEntities.add(entity);
          pageSuccess++;
        } catch (Exception e) {
          pageFailed++;
        }
      }
      try {
        cacheProvider.pipelineHset(hsetBatch, ttl);
        cacheProvider.pipelineSet(setBatch, ttl);
        success += pageSuccess;
        failed += pageFailed;
        updateEntityStats(entityType, pageSuccess, pageFailed);
        boolean bundleOk = true;
        if (bundleBatcher != null && !parsedEntities.isEmpty()) {
          BundleWarmupBatcher.BatchResult bundleResult =
              bundleBatcher.warmupBatch(entityType, parsedEntities, ttl);
          bundlesWritten += bundleResult.success();
          // Whole-page bundle failure (Redis pipeline error / DB tag fetch error) means the
          // bundles for this page are cold despite the entity JSON being warm. Hold the
          // checkpoint so the next run retries the page; advance only on partial-or-better
          // success. This trades an occasional duplicate entity write for not silently leaving
          // bundle keys stale.
          if (bundleResult.success() == 0 && bundleResult.failed() > 0) {
            bundleOk = false;
            // Bundle keys are cold even though entity JSON is warm. Surface as partial so
            // the run status reflects the incoherent state and the operator can re-trigger.
            // Set bailedOut so the end-of-warmEntity block preserves the checkpoint —
            // otherwise a later success page would advance it past this failed page and the
            // next retry would skip the still-cold bundles.
            partiallyWarmed = true;
            bailedOut = true;
            recordPartialFailure(
                entityType,
                String.format(
                    "bundle warmup failed at offset %d (%d rows)", offset, bundleResult.failed()));
            LOG.warn(
                "Bundle warmup pass failed for {} batch at offset {} ({} rows); holding"
                    + " checkpoint so the next run retries.",
                entityType,
                offset,
                bundleResult.failed());
          }
        }
        if (bundleOk) {
          writeCheckpoint(entityType, offset + page.size());
        }
        // Refresh the distributed claim TTL on every successful page — large entity types can
        // outlast CLAIM_TTL, and without refresh another instance could acquire mid-warm.
        refreshClaim(entityType);
      } catch (RuntimeException e) {
        // Redis rejected the batch. Count every row in this page as failed so warmup progress and
        // the WebSocket status reflect the actual state — the cache is not warm for these rows.
        // Mark partial so the run reports ACTIVE_ERROR rather than COMPLETED — the bundle/key
        // state for these rows is incoherent and a follow-up retry should re-warm them.
        // bailedOut prevents subsequent success pages from clearing the checkpoint at end-of-
        // warmEntity, so the next retry resumes at this failed page.
        LOG.warn("Pipelined write failed for {} batch at offset {}", entityType, offset, e);
        int pageTotal = pageSuccess + pageFailed;
        failed += pageTotal;
        updateEntityStats(entityType, 0, pageTotal);
        partiallyWarmed = true;
        bailedOut = true;
        recordPartialFailure(
            entityType,
            String.format(
                "pipelined write failed at offset %d (%d rows): %s",
                offset, pageTotal, exceptionMessage(e)));
      }
      offset += page.size();
      sendUpdates(jobExecutionContext, false);
      if (page.size() < batchSize) break;
    }
    long elapsed = System.currentTimeMillis() - start;
    LOG.info(
        "Warmed {} entities (type={}, failed={}, bundles={}) in {} ms",
        success,
        entityType,
        failed,
        bundlesWritten,
        elapsed);
    if (!stopped) {
      reportCoverage(entityType, dao, success, bundlesWritten);
      // Only clear the checkpoint when this entity type fully completed. If we bailed because
      // the cache went unavailable, the saved offset is the last successfully pipelined page
      // and the next run should resume from there — clearing it would force a restart from
      // offset 0 and re-warm everything we already wrote.
      if (!bailedOut) {
        clearCheckpoint(entityType);
      }
    }
    if (distributedClaimEnabled()) {
      releaseClaim(entityType);
    }
  }

  private boolean claimEntityType(String entityType) {
    if (cacheProvider == null || !cacheProvider.available() || claimKeyPrefix == null) {
      return true;
    }
    try {
      return cacheProvider.setIfAbsent(claimKeyPrefix + entityType, instanceId, CLAIM_TTL);
    } catch (Exception e) {
      LOG.debug("Claim attempt failed, proceeding without lock for {}", entityType, e);
      return true;
    }
  }

  /**
   * Refresh the claim TTL after a successful page so a long-running warm doesn't lose the lock
   * mid-flight. Compare-and-set: GET the current owner; if it's still us, SET with a fresh
   * TTL. If somebody else now owns it (our TTL expired), don't fight — just stop refreshing.
   * The warmup itself continues to completion regardless; the worst case is the other instance
   * does redundant work (Redis writes are idempotent).
   */
  private void refreshClaim(String entityType) {
    if (!distributedClaimEnabled()
        || cacheProvider == null
        || !cacheProvider.available()
        || claimKeyPrefix == null) {
      return;
    }
    String key = claimKeyPrefix + entityType;
    try {
      String owner = cacheProvider.get(key).orElse(null);
      if (instanceId.equals(owner)) {
        cacheProvider.set(key, instanceId, CLAIM_TTL);
      }
    } catch (Exception e) {
      LOG.debug("Failed to refresh claim for {}", entityType, e);
    }
  }

  /**
   * Compare-and-delete release. If our claim's TTL expired and another instance acquired the key
   * mid-warm, we must NOT delete their lock. We GET the current owner and only DEL when it
   * still matches our {@link #instanceId}. This is a non-atomic check (a second instance could
   * still acquire between our GET and DEL), but the resulting cost is at most one redundant
   * concurrent warm — the Redis writes are idempotent.
   */
  private void releaseClaim(String entityType) {
    // Don't gate on cacheProvider.available() here. The common case for needing to release is
    // exactly when a partial-warm bailed because the provider went unavailable — if the
    // provider has since recovered, our claim is still in Redis and we'd otherwise leave it
    // held until CLAIM_TTL (10 min), which makes every follow-up run on any node skip this
    // entity type for a long window. The DEL is best-effort: if Redis is still down we catch
    // the exception and let the TTL clean it up.
    if (cacheProvider == null || claimKeyPrefix == null) {
      return;
    }
    String key = claimKeyPrefix + entityType;
    try {
      String owner = cacheProvider.get(key).orElse(null);
      if (instanceId.equals(owner)) {
        cacheProvider.del(key);
      } else if (owner != null) {
        LOG.debug(
            "Skipping release of claim {} — owner {} != self {}", entityType, owner, instanceId);
      }
    } catch (Exception e) {
      LOG.debug(
          "Failed to release claim for {} (provider available={}); CLAIM_TTL will clear it",
          entityType,
          cacheProvider.available(),
          e);
    }
  }

  private int readCheckpoint(String entityType) {
    if (cacheProvider == null || !cacheProvider.available() || checkpointKeyPrefix == null) {
      return 0;
    }
    try {
      return cacheProvider.get(checkpointKeyPrefix + entityType).map(Integer::parseInt).orElse(0);
    } catch (Exception e) {
      LOG.debug("Failed to read checkpoint for {}", entityType, e);
      return 0;
    }
  }

  private void writeCheckpoint(String entityType, int offset) {
    if (cacheProvider == null || !cacheProvider.available() || checkpointKeyPrefix == null) {
      return;
    }
    try {
      cacheProvider.set(checkpointKeyPrefix + entityType, Integer.toString(offset), CHECKPOINT_TTL);
    } catch (Exception e) {
      LOG.debug("Failed to write checkpoint for {} at {}", entityType, offset, e);
    }
  }

  private void clearCheckpoint(String entityType) {
    if (cacheProvider == null || !cacheProvider.available() || checkpointKeyPrefix == null) {
      return;
    }
    try {
      cacheProvider.del(checkpointKeyPrefix + entityType);
    } catch (Exception e) {
      LOG.debug("Failed to clear checkpoint for {}", entityType, e);
    }
  }

  private void reportCoverage(
      String entityType, EntityDAO<?> dao, int success, int bundlesWritten) {
    CacheMetrics metrics = CacheMetrics.getInstance();
    if (metrics == null) {
      return;
    }
    int total;
    try {
      total = dao.listTotalCount();
    } catch (Exception e) {
      LOG.debug("Failed to fetch total count for coverage metric: {}", entityType, e);
      return;
    }
    if (total <= 0) {
      return;
    }
    // Prefer the actual Redis key count when the provider supports it — this gives the true
    // end-state coverage including pages warmed by prior resumed runs. Fall back to the
    // current-run success count when SCAN is unsupported (negative return). Same reasoning for
    // the bundle pass below.
    long entityKeys = scanEntityKeyCount(entityType);
    double coverage = entityKeys >= 0 ? (double) entityKeys / total : (double) success / total;
    metrics.recordCoverage(entityType, coverage);
    if (coverage < 0.95) {
      LOG.warn(
          "Cache coverage below threshold for {}: {}/{} ({}%)",
          entityType, entityKeys >= 0 ? entityKeys : success, total, Math.round(coverage * 100));
    }
    if (bundleBatcher != null) {
      long bundleKeys = scanBundleKeyCount(entityType);
      double bundleCoverage =
          bundleKeys >= 0 ? (double) bundleKeys / total : (double) bundlesWritten / total;
      metrics.recordBundleCoverage(entityType, bundleCoverage);
    }
  }

  private long scanEntityKeyCount(String entityType) {
    if (cacheProvider == null || cacheConfig == null || !cacheProvider.available()) {
      return -1L;
    }
    return cacheProvider.scanCount(cacheConfig.redis.keyspace + ":e:" + entityType + ":*");
  }

  private long scanBundleKeyCount(String entityType) {
    if (cacheProvider == null || cacheConfig == null || !cacheProvider.available()) {
      return -1L;
    }
    // CacheKeys.bundle wraps the id portion in {} for hash-tag colocation:
    // om:<ks>:bundle:{<id>}:<type> — match all those for this type.
    return cacheProvider.scanCount(cacheConfig.redis.keyspace + ":bundle:*:" + entityType);
  }

  private static String generateInstanceId() {
    try {
      return InetAddress.getLocalHost().getHostName()
          + ":"
          + ProcessHandle.current().pid()
          + ":"
          + System.currentTimeMillis();
    } catch (Exception e) {
      return "warmup:" + System.currentTimeMillis();
    }
  }

  private Set<String> resolveEntityTypes() {
    Set<String> configured =
        jobData.getEntities() == null
            ? new HashSet<>()
            : new LinkedHashSet<>(jobData.getEntities());
    if (configured.isEmpty() || configured.contains(ALL)) {
      configured = new LinkedHashSet<>(Entity.getEntityList());
    }
    configured.remove(Entity.USER);
    return configured;
  }

  private void initEntityStats(String entityType) {
    int total = getEntityCount(entityType);
    stats
        .getEntityStats()
        .getAdditionalProperties()
        .put(
            entityType,
            new StepStats().withTotalRecords(total).withSuccessRecords(0).withFailedRecords(0));
  }

  private int getEntityCount(String entityType) {
    try {
      return Entity.getEntityRepository(entityType).getDao().listTotalCount();
    } catch (Exception e) {
      LOG.debug("Cannot get count for {}: {}", entityType, e.getMessage());
      return 0;
    }
  }

  private void updateEntityStats(String entityType, int successDelta, int failedDelta) {
    StepStats per = stats.getEntityStats().getAdditionalProperties().get(entityType);
    if (per == null) return;
    per.setSuccessRecords(
        (per.getSuccessRecords() == null ? 0 : per.getSuccessRecords()) + successDelta);
    per.setFailedRecords(
        (per.getFailedRecords() == null ? 0 : per.getFailedRecords()) + failedDelta);
    updateJobStatsAggregate();
    jobData.setStats(stats);
  }

  private void updateJobStatsAggregate() {
    int success = 0;
    int failed = 0;
    for (StepStats s : stats.getEntityStats().getAdditionalProperties().values()) {
      success += s.getSuccessRecords() == null ? 0 : s.getSuccessRecords();
      failed += s.getFailedRecords() == null ? 0 : s.getFailedRecords();
    }
    StepStats job = stats.getJobStats() == null ? new StepStats() : stats.getJobStats();
    job.setSuccessRecords(success);
    job.setFailedRecords(failed);
    if (job.getTotalRecords() == null) {
      job.setTotalRecords(success + failed);
    }
    stats.setJobStats(job);
  }

  @Override
  public void stop() {
    LOG.info("Cache warmup stopping");
    stopped = true;
    if (jobData != null) {
      jobData.setStatus(EventPublisherJob.Status.STOPPED);
    }
  }

  @Override
  protected void validateConfig(Map<String, Object> appConfig) {
    try {
      normalizeAppConfig(appConfig);
    } catch (IllegalArgumentException e) {
      throw AppException.byMessage(
          jakarta.ws.rs.core.Response.Status.BAD_REQUEST,
          "Invalid App Configuration: " + e.getMessage());
    }
  }

  private void sendUpdates(JobExecutionContext ctx, boolean force) {
    try {
      long now = System.currentTimeMillis();
      if (!force && now - lastWebSocketUpdate < WEBSOCKET_UPDATE_INTERVAL_MS) {
        return;
      }
      lastWebSocketUpdate = now;
      if (ctx == null || ctx.getScheduler() == null) return;
      ctx.getJobDetail().getJobDataMap().put(APP_RUN_STATS, jobData.getStats());
      ctx.getJobDetail()
          .getJobDataMap()
          .put(WEBSOCKET_STATUS_CHANNEL, CACHE_WARMUP_JOB_BROADCAST_CHANNEL);
      updateRecordToDbAndNotify(ctx);
    } catch (Exception e) {
      LOG.debug("Stats update failed", e);
    }
  }

  private void updateRecordToDbAndNotify(JobExecutionContext ctx) {
    try {
      AppRunRecord record = getJobRecord(ctx);
      if (record == null) return;
      record.setStatus(AppRunRecord.Status.fromValue(jobData.getStatus().value()));
      if (jobData.getFailure() != null) {
        record.setFailureContext(
            new FailureContext().withAdditionalProperty("failure", jobData.getFailure()));
      }
      if (jobData.getStats() != null) {
        SuccessContext sc =
            new SuccessContext().withAdditionalProperty("stats", jobData.getStats());
        record.setSuccessContext(sc);
      }
      pushAppStatusUpdates(ctx, record, true);
      if (WebSocketManager.getInstance() != null) {
        WebSocketManager.getInstance()
            .broadCastMessageToAll(
                CACHE_WARMUP_JOB_BROADCAST_CHANNEL, JsonUtils.pojoToJson(record));
      }
    } catch (Exception e) {
      LOG.debug("Unable to update app record (likely test context): {}", e.getMessage());
    }
  }

  // kept for callers that expect a Collection<String> of entities configured
  @SuppressWarnings("unused")
  private Set<String> getAllEntityTypes() {
    Collection<String> all = Entity.getEntityList();
    return new HashSet<>(all);
  }
}
