package org.openmetadata.service.apps.bundles.searchIndex;

import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.DistributedSearchIndexExecutor;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.IndexJobStatus;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.SearchIndexJob;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityTimeSeriesRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.search.DefaultRecreateHandler;
import org.openmetadata.service.search.RecreateIndexHandler;
import org.openmetadata.service.search.ReindexContext;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
public class DistributedIndexingStrategy {
  private static final long MONITOR_POLL_INTERVAL_MS = 2000;

  private final CollectionDAO collectionDAO;
  private final SearchRepository searchRepository;
  private final EventPublisherJob jobData;
  private final UUID appId;
  private final Long appStartTime;
  private final String createdBy;
  private final DistributedReindexStatsMapper statsMapper;

  private final CompositeProgressListener listeners = new CompositeProgressListener();
  private final AtomicBoolean stopped = new AtomicBoolean(false);
  private final AtomicReference<Stats> currentStats = new AtomicReference<>();

  private volatile DistributedSearchIndexExecutor distributedExecutor;
  private volatile BulkSink searchIndexSink;
  private volatile ReindexingConfiguration config;

  public DistributedIndexingStrategy(
      CollectionDAO collectionDAO,
      SearchRepository searchRepository,
      EventPublisherJob jobData,
      UUID appId,
      Long appStartTime,
      String createdBy) {
    this.collectionDAO = collectionDAO;
    this.searchRepository = searchRepository;
    this.jobData = jobData;
    this.appId = appId;
    this.appStartTime = appStartTime;
    this.createdBy = createdBy;
    this.statsMapper = new DistributedReindexStatsMapper(collectionDAO);
  }

  public void addListener(ReindexingProgressListener listener) {
    listeners.addListener(listener);
  }

  public ExecutionResult execute(ReindexingConfiguration config, ReindexingJobContext context) {
    long startTime = System.currentTimeMillis();
    try {
      return doExecute(config, context, startTime);
    } catch (Exception e) {
      LOG.error("Distributed reindexing failed", e);
      if (searchIndexSink != null) {
        try {
          searchIndexSink.close();
        } catch (Exception closeEx) {
          LOG.error("Error closing search index sink during exception handling", closeEx);
        }
        searchIndexSink = null;
      }
      Stats stats = currentStats.get();
      return ExecutionResult.fromStats(stats, ExecutionResult.Status.FAILED, startTime);
    }
  }

  private ExecutionResult doExecute(
      ReindexingConfiguration config, ReindexingJobContext context, long startTime) {

    this.config = config;
    Set<String> entityTypes = SearchIndexEntityTypes.normalizeEntityTypes(config.entities());
    LOG.info("Starting distributed reindexing for entities: {}", entityTypes);

    Stats stats = initializeTotalRecords(entityTypes);
    currentStats.set(stats);

    int partitionSize = jobData.getPartitionSize() != null ? jobData.getPartitionSize() : 10000;
    distributedExecutor = new DistributedSearchIndexExecutor(collectionDAO, partitionSize);
    distributedExecutor.performStartupRecovery();

    distributedExecutor.addListener(listeners);

    SearchIndexJob distributedJob =
        distributedExecutor.createJob(entityTypes, jobData, createdBy, config);

    LOG.info(
        "Created distributed job {} with {} total records",
        distributedJob.getId(),
        distributedJob.getTotalRecords());

    searchIndexSink =
        searchRepository.createBulkSink(
            config.batchSize(), config.maxConcurrentRequests(), config.payloadSize());

    RecreateIndexHandler stagedIndexHandler = searchRepository.createReindexHandler();
    if (stagedIndexHandler instanceof DefaultRecreateHandler defaultHandler) {
      defaultHandler.withJobData(jobData);
    }
    ReindexContext stagedIndexContext = stagedIndexHandler.reCreateIndexes(entityTypes);
    if (stagedIndexContext == null || stagedIndexContext.isEmpty()) {
      throw new IllegalStateException(
          "Staged index preparation did not produce any target indexes");
    }
    distributedExecutor.updateStagedIndexMapping(stagedIndexContext.getStagedIndexMapping());

    distributedExecutor.setAppContext(appId, appStartTime);
    distributedExecutor.execute(searchIndexSink, stagedIndexContext, config);

    monitorDistributedJob(distributedJob.getId());

    flushAndAwaitSink();

    SearchIndexJob finalJob = distributedExecutor.getJobWithFreshStats();
    Map<String, Object> metadata = new HashMap<>();

    if (finalJob != null) {
      StepStats sinkStats = searchIndexSink != null ? searchIndexSink.getStats() : null;
      updateStatsFromDistributedJob(stats, finalJob, sinkStats);

      if (searchIndexSink != null) {
        StepStats sinkVectorStats = searchIndexSink.getVectorStats();
        if (sinkVectorStats != null && sinkVectorStats.getTotalRecords() > 0) {
          stats.setVectorStats(sinkVectorStats);
        }
      }

      if (finalJob.getServerStats() != null && !finalJob.getServerStats().isEmpty()) {
        metadata.put("serverStats", finalJob.getServerStats());
        metadata.put("serverCount", finalJob.getServerStats().size());
        metadata.put("distributedJobId", finalJob.getId().toString());
      }
    }

    currentStats.set(stats);

    boolean success =
        finalizeAllEntityReindex(
            stagedIndexHandler,
            stagedIndexContext,
            !stopped.get() && !hasIncompleteProcessing(stats));

    ExecutionResult.Status resultStatus = determineStatus(stats);

    StatsReconciler.reconcile(stats);

    return ExecutionResult.builder()
        .status(resultStatus)
        .totalRecords(stats.getJobStats().getTotalRecords())
        .successRecords(stats.getJobStats().getSuccessRecords())
        .failedRecords(stats.getJobStats().getFailedRecords())
        .startTime(startTime)
        .endTime(System.currentTimeMillis())
        .finalStats(stats)
        .metadata(metadata)
        .build();
  }

  private void flushAndAwaitSink() {
    if (searchIndexSink == null) {
      return;
    }

    int pendingVectorTasks = searchIndexSink.getPendingVectorTaskCount();
    if (pendingVectorTasks > 0) {
      LOG.info("Waiting for {} pending vector embedding tasks to complete", pendingVectorTasks);
      boolean vectorComplete = searchIndexSink.awaitVectorCompletion(120);
      if (!vectorComplete) {
        LOG.warn("Vector embedding wait timed out - some tasks may not be reflected in stats");
      }
    }

    LOG.info("Flushing sink and waiting for pending bulk requests");
    boolean flushComplete = searchIndexSink.flushAndAwait(60);
    if (!flushComplete) {
      LOG.warn("Sink flush timed out - some requests may not be reflected in stats");
    }

    try {
      searchIndexSink.close();
    } catch (Exception e) {
      LOG.error("Error closing search index sink", e);
    }
  }

  private void monitorDistributedJob(UUID jobId) {
    CountDownLatch completionLatch = new CountDownLatch(1);
    ScheduledExecutorService monitor =
        Executors.newSingleThreadScheduledExecutor(
            Thread.ofPlatform()
                .name("reindex-distributed-monitor-" + jobId.toString().substring(0, 8))
                .factory());

    try {
      monitor.scheduleAtFixedRate(
          () -> {
            try {
              if (stopped.get()) {
                LOG.info("Stop signal received, stopping distributed job");
                distributedExecutor.stop();
                completionLatch.countDown();
                return;
              }

              SearchIndexJob job = distributedExecutor.getJobWithFreshStats();
              if (job == null) {
                completionLatch.countDown();
                return;
              }

              IndexJobStatus status = job.getStatus();
              if (status == IndexJobStatus.COMPLETED
                  || status == IndexJobStatus.COMPLETED_WITH_ERRORS
                  || status == IndexJobStatus.FAILED
                  || status == IndexJobStatus.STOPPED) {
                LOG.info("Distributed job {} completed with status: {}", jobId, status);
                completionLatch.countDown();
                return;
              }

              updateStatsFromDistributedJob(currentStats.get(), job, null);
            } catch (Exception e) {
              LOG.error("Error in distributed job monitor task for job {}", jobId, e);
            }
          },
          0,
          MONITOR_POLL_INTERVAL_MS,
          TimeUnit.MILLISECONDS);

      completionLatch.await();
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      LOG.warn("Distributed job monitoring interrupted");
    } finally {
      monitor.shutdownNow();
      try {
        if (!monitor.awaitTermination(5, TimeUnit.SECONDS)) {
          LOG.warn("Distributed job monitor did not terminate within 5 seconds");
        }
      } catch (InterruptedException e) {
        Thread.currentThread().interrupt();
      }
    }
  }

  private void updateStatsFromDistributedJob(
      Stats stats, SearchIndexJob distributedJob, StepStats actualSinkStats) {
    statsMapper.updateStats(stats, distributedJob, actualSinkStats, getColumnStats());
  }

  private ExecutionResult.Status determineStatus(Stats stats) {
    if (stopped.get()) {
      return ExecutionResult.Status.STOPPED;
    }
    if (hasIncompleteProcessing(stats)) {
      return ExecutionResult.Status.COMPLETED_WITH_ERRORS;
    }
    return ExecutionResult.Status.COMPLETED;
  }

  private boolean hasIncompleteProcessing(Stats stats) {
    if (stats == null || stats.getJobStats() == null) {
      return false;
    }
    StepStats jobStats = stats.getJobStats();
    long failed = jobStats.getFailedRecords() != null ? jobStats.getFailedRecords() : 0;
    long processed = jobStats.getSuccessRecords() != null ? jobStats.getSuccessRecords() : 0;
    long total = jobStats.getTotalRecords() != null ? jobStats.getTotalRecords() : 0;
    return failed > 0 || (total > 0 && processed < total);
  }

  private boolean finalizeAllEntityReindex(
      RecreateIndexHandler indexPromotionHandler,
      ReindexContext stagedIndexContext,
      boolean finalSuccess) {
    if (indexPromotionHandler == null || stagedIndexContext == null) {
      return finalSuccess;
    }

    return new DistributedReindexFinalizer(indexPromotionHandler, stagedIndexContext)
        .finalizeRemainingEntities(getPromotedEntities(), getFinalEntityStats(), finalSuccess);
  }

  private StepStats getColumnStats() {
    return searchIndexSink != null ? searchIndexSink.getColumnStats() : null;
  }

  private Set<String> getPromotedEntities() {
    if (distributedExecutor != null && distributedExecutor.getEntityTracker() != null) {
      return distributedExecutor.getEntityTracker().getPromotedEntities();
    }
    return Collections.emptySet();
  }

  private Map<String, SearchIndexJob.EntityTypeStats> getFinalEntityStats() {
    Map<String, SearchIndexJob.EntityTypeStats> finalEntityStats = new HashMap<>();
    if (distributedExecutor == null) {
      mergeInitializedEntityStats(finalEntityStats);
      return finalEntityStats;
    }
    SearchIndexJob finalJob = distributedExecutor.getJobWithFreshStats();
    if (finalJob != null && finalJob.getEntityStats() != null) {
      finalEntityStats.putAll(finalJob.getEntityStats());
    }
    mergeInitializedEntityStats(finalEntityStats);
    return finalEntityStats;
  }

  private void mergeInitializedEntityStats(
      Map<String, SearchIndexJob.EntityTypeStats> finalEntityStats) {
    Stats stats = currentStats.get();
    if (stats == null
        || stats.getEntityStats() == null
        || stats.getEntityStats().getAdditionalProperties() == null) {
      return;
    }

    stats
        .getEntityStats()
        .getAdditionalProperties()
        .forEach(
            (entityType, stepStats) ->
                finalEntityStats.computeIfAbsent(
                    entityType, key -> toEntityTypeStats(key, stepStats)));
  }

  private SearchIndexJob.EntityTypeStats toEntityTypeStats(String entityType, StepStats stepStats) {
    long success = stepStats != null ? statValue(stepStats.getSuccessRecords()) : 0L;
    long failed = stepStats != null ? statValue(stepStats.getFailedRecords()) : 0L;
    return SearchIndexJob.EntityTypeStats.builder()
        .entityType(entityType)
        .totalRecords(stepStats != null ? statValue(stepStats.getTotalRecords()) : 0L)
        .processedRecords(success + failed)
        .successRecords(success)
        .failedRecords(failed)
        .totalPartitions(0)
        .completedPartitions(0)
        .failedPartitions(0)
        .build();
  }

  private long statValue(Number value) {
    return value != null ? value.longValue() : 0L;
  }

  public Optional<Stats> getStats() {
    return Optional.ofNullable(currentStats.get());
  }

  public void stop() {
    if (stopped.compareAndSet(false, true)) {
      LOG.info("Stopping distributed indexing strategy");

      if (distributedExecutor != null) {
        try {
          distributedExecutor.stop();
        } catch (Exception e) {
          LOG.error("Error stopping distributed executor", e);
        }
      }
      // Do NOT close the sink here — workers may still be writing to it.
      // The sink is properly flushed and closed by flushAndAwaitSink() in doExecute()
      // after the monitor exits and the executor's finally block completes.
    }
  }

  public boolean isStopped() {
    return stopped.get();
  }

  Stats initializeTotalRecords(Set<String> entities) {
    Stats stats = new Stats();
    stats.setEntityStats(new org.openmetadata.schema.system.EntityStats());
    stats.setJobStats(new StepStats());
    stats.setReaderStats(new StepStats());
    stats.setProcessStats(new StepStats());
    stats.setSinkStats(new StepStats());
    stats.setVectorStats(new StepStats());

    List<String> ordered = EntityPriority.sortByPriority(entities);
    int total = 0;
    for (String entityType : ordered) {
      int entityTotal = getEntityTotal(entityType);
      total += entityTotal;

      StepStats entityStats = new StepStats();
      entityStats.setTotalRecords(entityTotal);
      entityStats.setSuccessRecords(0);
      entityStats.setFailedRecords(0);
      stats.getEntityStats().getAdditionalProperties().put(entityType, entityStats);
    }

    if (entities.contains(Entity.TABLE) && !entities.contains(Entity.TABLE_COLUMN)) {
      StepStats columnEntityStats = new StepStats();
      columnEntityStats.setTotalRecords(0);
      columnEntityStats.setSuccessRecords(0);
      columnEntityStats.setFailedRecords(0);
      stats.getEntityStats().getAdditionalProperties().put(Entity.TABLE_COLUMN, columnEntityStats);
      LOG.info("Added TABLE_COLUMN stats slot for column indexing tracking");
    }

    stats.getJobStats().setTotalRecords(total);
    stats.getJobStats().setSuccessRecords(0);
    stats.getJobStats().setFailedRecords(0);

    stats.getReaderStats().setTotalRecords(total);
    stats.getReaderStats().setSuccessRecords(0);
    stats.getReaderStats().setFailedRecords(0);

    stats.getProcessStats().setTotalRecords(0);
    stats.getProcessStats().setSuccessRecords(0);
    stats.getProcessStats().setFailedRecords(0);

    stats.getSinkStats().setTotalRecords(0);
    stats.getSinkStats().setSuccessRecords(0);
    stats.getSinkStats().setFailedRecords(0);

    stats.getVectorStats().setTotalRecords(0);
    stats.getVectorStats().setSuccessRecords(0);
    stats.getVectorStats().setFailedRecords(0);

    return stats;
  }

  private int getEntityTotal(String entityType) {
    try {
      String correctedType = SearchIndexEntityTypes.normalizeEntityType(entityType);

      if (!SearchIndexEntityTypes.isTimeSeriesEntity(correctedType)) {
        return Entity.getEntityRepository(correctedType)
            .getDao()
            .listCount(new ListFilter(Include.ALL));
      } else {
        ListFilter listFilter = new ListFilter(null);
        EntityTimeSeriesRepository<?> repository;

        if (SearchIndexEntityTypes.isDataInsightEntity(correctedType)) {
          listFilter.addQueryParam("entityFQNHash", FullyQualifiedName.buildHash(correctedType));
          repository = Entity.getEntityTimeSeriesRepository(Entity.ENTITY_REPORT_DATA);
        } else {
          repository = Entity.getEntityTimeSeriesRepository(correctedType);
        }

        if (config != null) {
          long startTs = config.getTimeSeriesStartTs(correctedType);
          if (startTs > 0) {
            long endTs = System.currentTimeMillis();
            return repository.getTimeSeriesDao().listCount(listFilter, startTs, endTs, false);
          }
        }
        return repository.getTimeSeriesDao().listCount(listFilter);
      }
    } catch (Exception e) {
      LOG.debug("Error getting total for '{}'", entityType, e);
      return 0;
    }
  }

  DistributedSearchIndexExecutor getDistributedExecutor() {
    return distributedExecutor;
  }
}
