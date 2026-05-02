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
import org.openmetadata.schema.system.EntityStats;
import org.openmetadata.schema.system.EventPublisherJob;
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
 * <p>The {@code bundle:{<uuid>}:<type>} entries are pre-warmed by default via
 * {@link org.openmetadata.service.cache.BundleWarmupBatcher}, which uses the cheap batched
 * tag_usage query to populate tags + certification (the parts of the bundle that don't require
 * full relationship hydration). Relations are left null so the {@link
 * org.openmetadata.service.cache.CachedReadBundle} read path lazily populates them on first
 * read. Set {@code warmBundles=false} in the app config (or
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
  // Built per-instance from cacheConfig.redis.keyspace so multi-environment deployments sharing
  // one Redis with different keyspaces don't collide on warmup metadata. TTL is one day for
  // checkpoints (long enough for ops staff to notice and resume a stuck warmup, short enough
  // that abandoned checkpoints self-clean). Claim TTL is short enough to limit the
  // stop-the-world hold if an instance dies mid-warm.
  private static final Duration CHECKPOINT_TTL = Duration.ofDays(1);
  private static final Duration CLAIM_TTL = Duration.ofMinutes(10);

  @Getter private EventPublisherJob jobData;

  private CacheProvider cacheProvider;
  private CacheKeys keys;
  private CacheConfig cacheConfig;
  private BundleWarmupBatcher bundleBatcher;
  // Set during initCacheComponents from cacheConfig.redis.keyspace.
  private String checkpointKeyPrefix;
  private String claimKeyPrefix;
  private final String instanceId = generateInstanceId();
  // Read in initJobData from the user-supplied app config (cacheWarmupAppConfig schema). System
  // properties remain a fallback for cases where the app record isn't editable (e.g. bootstrap).
  private boolean warmBundles =
      Boolean.parseBoolean(System.getProperty("om.cache.warmBundles", "true"));
  private boolean enableDistributedClaim =
      Boolean.parseBoolean(System.getProperty("om.cache.warmup.distributedClaim", "false"));

  private JobExecutionContext jobExecutionContext;
  private volatile boolean stopped = false;
  private final Stats stats = new Stats().withEntityStats(new EntityStats());
  private volatile long lastWebSocketUpdate = 0;
  private static final long WEBSOCKET_UPDATE_INTERVAL_MS = 2000;

  public CacheWarmupApp(CollectionDAO collectionDAO, SearchRepository searchRepository) {
    super(collectionDAO, searchRepository);
  }

  @Override
  public void init(App app) {
    super.init(app);
    jobData = JsonUtils.convertValue(app.getAppConfiguration(), EventPublisherJob.class);
    readAppConfigFlags();
  }

  @Override
  public void execute(JobExecutionContext jobExecutionContext) {
    this.jobExecutionContext = jobExecutionContext;
    this.stopped = false;
    try {
      initCacheComponents();
      initJobData(jobExecutionContext);
      if (cacheProvider == null || !cacheProvider.available()) {
        // Surface this as FAILED — initJobData set status to RUNNING above, and the finally block
        // will broadcast the terminal state. Leaving it RUNNING here would pin the job record in
        // an active state indefinitely.
        LOG.warn("Cache not available, skipping warmup");
        jobData.setStatus(EventPublisherJob.Status.FAILED);
        return;
      }
      runWarmup();
    } catch (Exception e) {
      LOG.error("Cache warmup failed", e);
      if (jobData != null) {
        jobData.setStatus(EventPublisherJob.Status.FAILED);
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
    if (warmBundles && cacheProvider != null && keys != null) {
      bundleBatcher = new BundleWarmupBatcher(collectionDAO, cacheProvider, keys);
    }
  }

  /**
   * Pull the user-supplied warmBundles / enableDistributedClaim flags out of the raw app config
   * map. The runtime parses the same payload as {@link EventPublisherJob}, which doesn't include
   * these fields, so we read them from the original map rather than trying to extend the
   * EventPublisherJob schema.
   */
  private void readAppConfigFlags() {
    if (getApp() == null || getApp().getAppConfiguration() == null) {
      return;
    }
    try {
      Map<?, ?> raw = JsonUtils.convertValue(getApp().getAppConfiguration(), Map.class);
      if (raw == null) {
        return;
      }
      Object wb = raw.get("warmBundles");
      if (wb instanceof Boolean) {
        warmBundles = (Boolean) wb;
      }
      Object dc = raw.get("enableDistributedClaim");
      if (dc instanceof Boolean) {
        enableDistributedClaim = (Boolean) dc;
      }
    } catch (Exception e) {
      LOG.debug("Could not read warmBundles / enableDistributedClaim from app config", e);
    }
  }

  private void initJobData(JobExecutionContext ctx) {
    if (jobData == null) {
      jobData = loadJobData(ctx);
    }
    if (ctx.getJobDetail().getKey().getName().equals(ON_DEMAND_JOB)) {
      Map<String, Object> asMap =
          JsonUtils.convertValue(jobData, new TypeReference<Map<String, Object>>() {});
      getApp().setAppConfiguration(asMap);
    }
    if (jobData.getBatchSize() == null) {
      jobData.setBatchSize(DEFAULT_BATCH_SIZE);
    }
    jobData.setStatus(EventPublisherJob.Status.RUNNING);
    jobData.setStats(stats);
  }

  private EventPublisherJob loadJobData(JobExecutionContext ctx) {
    String raw = (String) ctx.getJobDetail().getJobDataMap().get(APP_CONFIG);
    if (raw != null) {
      return JsonUtils.readValue(raw, EventPublisherJob.class);
    }
    if (getApp() != null && getApp().getAppConfiguration() != null) {
      return JsonUtils.convertValue(getApp().getAppConfiguration(), EventPublisherJob.class);
    }
    throw new AppException("JobData is not initialized");
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
    for (String entityType : entityTypes) {
      if (stopped) break;
      warmupEntityType(entityType, batchSize, ttl);
    }
    if (stopped) {
      jobData.setStatus(EventPublisherJob.Status.STOPPED);
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
    if (enableDistributedClaim && !claimEntityType(entityType)) {
      LOG.info("Skipping {} — claimed by another instance", entityType);
      return;
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
    long start = System.currentTimeMillis();
    while (!stopped) {
      if (!cacheProvider.available()) {
        // A prior batch tripped the provider to unavailable. Iterating further would silently
        // drop every subsequent pipelineSet/Hset (their guard `if (!available) return;` fires)
        // while the accounting below still counted pages as success. Bail out — the health
        // checker will flip the flag back if Redis recovers; rerun the app to resume warmup.
        LOG.warn("Cache provider unavailable, aborting warmup for {}", entityType);
        break;
      }
      List<String> page;
      try {
        page = dao.listAfterWithOffset(batchSize, offset);
      } catch (Exception e) {
        LOG.warn("Bulk fetch failed for {} at offset {}", entityType, offset, e);
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
        if (bundleBatcher != null && !parsedEntities.isEmpty()) {
          BundleWarmupBatcher.BatchResult bundleResult =
              bundleBatcher.warmupBatch(entityType, parsedEntities, ttl);
          bundlesWritten += bundleResult.success();
        }
        writeCheckpoint(entityType, offset + page.size());
      } catch (RuntimeException e) {
        // Redis rejected the batch. Count every row in this page as failed so warmup progress and
        // the WebSocket status reflect the actual state — the cache is not warm for these rows.
        LOG.warn("Pipelined write failed for {} batch at offset {}", entityType, offset, e);
        int pageTotal = pageSuccess + pageFailed;
        failed += pageTotal;
        updateEntityStats(entityType, 0, pageTotal);
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
      clearCheckpoint(entityType);
    }
    if (enableDistributedClaim) {
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
   * Compare-and-delete release. If our claim's TTL expired and another instance acquired the key
   * mid-warm, we must NOT delete their lock. We GET the current owner and only DEL when it
   * still matches our {@link #instanceId}. This is a non-atomic check (a second instance could
   * still acquire between our GET and DEL), but the resulting cost is at most one redundant
   * concurrent warm — the Redis writes are idempotent.
   */
  private void releaseClaim(String entityType) {
    if (cacheProvider == null || !cacheProvider.available() || claimKeyPrefix == null) {
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
      LOG.debug("Failed to release claim for {}", entityType, e);
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
      JsonUtils.convertValue(appConfig, EventPublisherJob.class);
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
