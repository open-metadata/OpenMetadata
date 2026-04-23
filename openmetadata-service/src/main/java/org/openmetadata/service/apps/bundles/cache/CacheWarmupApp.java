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
import java.time.Duration;
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
import org.openmetadata.service.cache.CacheBundle;
import org.openmetadata.service.cache.CacheConfig;
import org.openmetadata.service.cache.CacheKeys;
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
 * <p>The more expensive {@code bundle:{<uuid>}:<type>} entries are populated on first read via
 * {@link org.openmetadata.service.cache.CachedReadBundle}; pre-warming the bundle would require
 * full relationship hydration (the thing this app is trying to avoid) and is intentionally not
 * done here.
 */
@Slf4j
public class CacheWarmupApp extends AbstractNativeApplication {
  private static final String ALL = "all";
  private static final int DEFAULT_BATCH_SIZE = 1000;

  @Getter private EventPublisherJob jobData;

  private CacheProvider cacheProvider;
  private CacheKeys keys;
  private CacheConfig cacheConfig;

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
    }
  }

  private void warmupEntityType(String entityType, int batchSize, Duration ttl) {
    if (Entity.USER.equals(entityType)) {
      LOG.debug("Skipping user entity type — not cached by design");
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

    int offset = 0;
    int success = 0;
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
        "Warmed {} entities (type={}, failed={}) in {} ms", success, entityType, failed, elapsed);
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
