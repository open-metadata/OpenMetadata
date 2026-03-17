package org.openmetadata.service.apps.bundles.searchIndex;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.service.Entity.QUERY_COST_RECORD;
import static org.openmetadata.service.Entity.TEST_CASE_RESOLUTION_STATUS;
import static org.openmetadata.service.Entity.TEST_CASE_RESULT;

import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
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
import org.openmetadata.schema.analytics.ReportData;
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
import org.openmetadata.service.search.RecreateIndexHandler;
import org.openmetadata.service.search.ReindexContext;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
public class DistributedIndexingStrategy implements IndexingStrategy {

  private static final Set<String> TIME_SERIES_ENTITIES =
      Set.of(
          ReportData.ReportDataType.ENTITY_REPORT_DATA.value(),
          ReportData.ReportDataType.RAW_COST_ANALYSIS_REPORT_DATA.value(),
          ReportData.ReportDataType.WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA.value(),
          ReportData.ReportDataType.WEB_ANALYTIC_ENTITY_VIEW_REPORT_DATA.value(),
          ReportData.ReportDataType.AGGREGATED_COST_ANALYSIS_REPORT_DATA.value(),
          TEST_CASE_RESOLUTION_STATUS,
          TEST_CASE_RESULT,
          QUERY_COST_RECORD);

  private static final long MONITOR_POLL_INTERVAL_MS = 2000;

  private final CollectionDAO collectionDAO;
  private final SearchRepository searchRepository;
  private final EventPublisherJob jobData;
  private final UUID appId;
  private final Long appStartTime;
  private final String createdBy;

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
  }

  @Override
  public void addListener(ReindexingProgressListener listener) {
    listeners.addListener(listener);
  }

  @Override
  public ExecutionResult execute(ReindexingConfiguration config, ReindexingJobContext context) {
    long startTime = System.currentTimeMillis();
    try {
      return doExecute(config, context, startTime);
    } catch (Exception e) {
      LOG.error("Distributed reindexing failed", e);
      Stats stats = currentStats.get();
      return ExecutionResult.fromStats(stats, ExecutionResult.Status.FAILED, startTime);
    }
  }

  private ExecutionResult doExecute(
      ReindexingConfiguration config, ReindexingJobContext context, long startTime)
      throws Exception {

    this.config = config;
    LOG.info("Starting distributed reindexing for entities: {}", config.entities());

    Stats stats = initializeTotalRecords(config.entities());
    currentStats.set(stats);

    int partitionSize = jobData.getPartitionSize() != null ? jobData.getPartitionSize() : 10000;
    distributedExecutor = new DistributedSearchIndexExecutor(collectionDAO, partitionSize);
    distributedExecutor.performStartupRecovery();

    distributedExecutor.addListener(listeners);

    SearchIndexJob distributedJob =
        distributedExecutor.createJob(config.entities(), jobData, createdBy, config);

    LOG.info(
        "Created distributed job {} with {} total records",
        distributedJob.getId(),
        distributedJob.getTotalRecords());

    searchIndexSink =
        searchRepository.createBulkSink(
            config.batchSize(), config.maxConcurrentRequests(), config.payloadSize());

    RecreateIndexHandler recreateIndexHandler = searchRepository.createReindexHandler();
    ReindexContext recreateContext = null;

    if (config.recreateIndex()) {
      recreateContext = recreateIndexHandler.reCreateIndexes(config.entities());
      if (recreateContext != null && !recreateContext.isEmpty()) {
        distributedExecutor.updateStagedIndexMapping(recreateContext.getStagedIndexMapping());
      }
    }

    distributedExecutor.setAppContext(appId, appStartTime);
    distributedExecutor.execute(
        searchIndexSink, recreateContext, Boolean.TRUE.equals(config.recreateIndex()), config);

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
            recreateIndexHandler,
            recreateContext,
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
    }
  }

  private void updateStatsFromDistributedJob(
      Stats stats, SearchIndexJob distributedJob, StepStats actualSinkStats) {
    if (stats == null) {
      return;
    }

    CollectionDAO.SearchIndexServerStatsDAO.AggregatedServerStats serverStatsAggr = null;
    try {
      serverStatsAggr =
          Entity.getCollectionDAO()
              .searchIndexServerStatsDAO()
              .getAggregatedStats(distributedJob.getId().toString());
      if (serverStatsAggr != null) {
        LOG.info(
            "Fetched aggregated server stats for job {}: readerSuccess={}, readerFailed={}, "
                + "sinkSuccess={}, sinkFailed={}",
            distributedJob.getId(),
            serverStatsAggr.readerSuccess(),
            serverStatsAggr.readerFailed(),
            serverStatsAggr.sinkSuccess(),
            serverStatsAggr.sinkFailed());
      }
    } catch (Exception e) {
      LOG.debug("Could not fetch aggregated server stats for job {}", distributedJob.getId(), e);
    }

    long successRecords;
    long failedRecords;
    String statsSource;

    if (serverStatsAggr != null && serverStatsAggr.sinkSuccess() > 0) {
      successRecords = serverStatsAggr.sinkSuccess();
      failedRecords =
          serverStatsAggr.readerFailed()
              + serverStatsAggr.sinkFailed()
              + serverStatsAggr.processFailed();
      statsSource = "serverStatsTable";
    } else if (actualSinkStats != null) {
      successRecords = actualSinkStats.getSuccessRecords();
      failedRecords = actualSinkStats.getFailedRecords();
      statsSource = "localSink";
    } else {
      successRecords = distributedJob.getSuccessRecords();
      failedRecords = distributedJob.getFailedRecords();
      statsSource = "partition-based";
    }

    LOG.debug(
        "Stats source: {}, success={}, failed={}", statsSource, successRecords, failedRecords);

    StepStats jobStats = stats.getJobStats();
    if (jobStats != null) {
      jobStats.setSuccessRecords(saturatedToInt(successRecords));
      jobStats.setFailedRecords(saturatedToInt(failedRecords));
    }

    StepStats readerStats = stats.getReaderStats();
    if (readerStats != null) {
      readerStats.setTotalRecords(saturatedToInt(distributedJob.getTotalRecords()));
      long readerFailed = serverStatsAggr != null ? serverStatsAggr.readerFailed() : 0;
      long readerWarnings = serverStatsAggr != null ? serverStatsAggr.readerWarnings() : 0;
      long readerSuccess =
          serverStatsAggr != null
              ? serverStatsAggr.readerSuccess()
              : distributedJob.getTotalRecords() - readerFailed - readerWarnings;
      readerStats.setSuccessRecords(saturatedToInt(readerSuccess));
      readerStats.setFailedRecords(saturatedToInt(readerFailed));
      readerStats.setWarningRecords(saturatedToInt(readerWarnings));
    }

    StepStats processStats = stats.getProcessStats();
    if (processStats != null && serverStatsAggr != null) {
      long processSuccess = serverStatsAggr.processSuccess();
      long processFailed = serverStatsAggr.processFailed();
      processStats.setTotalRecords(saturatedToInt(processSuccess + processFailed));
      processStats.setSuccessRecords(saturatedToInt(processSuccess));
      processStats.setFailedRecords(saturatedToInt(processFailed));
    }

    StepStats sinkStats = stats.getSinkStats();
    if (sinkStats != null) {
      if (serverStatsAggr != null) {
        long sinkSuccess = serverStatsAggr.sinkSuccess();
        long sinkFailed = serverStatsAggr.sinkFailed();
        long actualSinkTotal = sinkSuccess + sinkFailed;
        sinkStats.setTotalRecords(saturatedToInt(actualSinkTotal));
        sinkStats.setSuccessRecords(saturatedToInt(sinkSuccess));
        sinkStats.setFailedRecords(saturatedToInt(sinkFailed));
      } else {
        long sinkTotal = distributedJob.getTotalRecords();
        sinkStats.setTotalRecords(saturatedToInt(sinkTotal));
        sinkStats.setSuccessRecords(saturatedToInt(successRecords));
        sinkStats.setFailedRecords(saturatedToInt(failedRecords));
      }
    }

    StepStats vectorStats = stats.getVectorStats();
    if (vectorStats != null && serverStatsAggr != null) {
      long vectorSuccess = serverStatsAggr.vectorSuccess();
      long vectorFailed = serverStatsAggr.vectorFailed();
      vectorStats.setTotalRecords(saturatedToInt(vectorSuccess + vectorFailed));
      vectorStats.setSuccessRecords(saturatedToInt(vectorSuccess));
      vectorStats.setFailedRecords(saturatedToInt(vectorFailed));
    }

    if (distributedJob.getEntityStats() != null && stats.getEntityStats() != null) {
      for (Map.Entry<String, SearchIndexJob.EntityTypeStats> entry :
          distributedJob.getEntityStats().entrySet()) {
        StepStats entityStats =
            stats.getEntityStats().getAdditionalProperties().get(entry.getKey());
        if (entityStats != null) {
          entityStats.setSuccessRecords(saturatedToInt(entry.getValue().getSuccessRecords()));
          entityStats.setFailedRecords(saturatedToInt(entry.getValue().getFailedRecords()));
        }
      }
    }

    updateColumnStatsFromSink(stats);

    StatsReconciler.reconcile(stats);
  }

  private void updateColumnStatsFromSink(Stats jobDataStats) {
    if (searchIndexSink == null || jobDataStats == null || jobDataStats.getEntityStats() == null) {
      return;
    }
    StepStats columnStats = searchIndexSink.getColumnStats();
    if (columnStats != null) {
      StepStats existingColumnStats =
          jobDataStats.getEntityStats().getAdditionalProperties().get(Entity.TABLE_COLUMN);
      if (existingColumnStats != null) {
        existingColumnStats.setTotalRecords(columnStats.getTotalRecords());
        existingColumnStats.setSuccessRecords(columnStats.getSuccessRecords());
        existingColumnStats.setFailedRecords(columnStats.getFailedRecords());
      }
    }
  }

  private void promoteColumnIndex(
      RecreateIndexHandler recreateIndexHandler,
      ReindexContext recreateContext,
      boolean tableSuccess) {
    Optional<String> columnStagedIndex = recreateContext.getStagedIndex(Entity.TABLE_COLUMN);
    if (columnStagedIndex.isEmpty()) {
      return;
    }
    try {
      finalizeEntityReindex(
          recreateIndexHandler, recreateContext, Entity.TABLE_COLUMN, tableSuccess);
      LOG.info("Promoted column index (tableSuccess={})", tableSuccess);
    } catch (Exception ex) {
      LOG.error("Failed to promote column index", ex);
    }
  }

  private static int saturatedToInt(long value) {
    return (int) Math.min(value, Integer.MAX_VALUE);
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
      RecreateIndexHandler recreateIndexHandler,
      ReindexContext recreateContext,
      boolean finalSuccess) {
    if (recreateIndexHandler == null || recreateContext == null) {
      return finalSuccess;
    }

    Set<String> promotedEntities = Collections.emptySet();
    if (distributedExecutor != null && distributedExecutor.getEntityTracker() != null) {
      promotedEntities = distributedExecutor.getEntityTracker().getPromotedEntities();
    }

    // Get per-entity stats for determining per-entity success
    Map<String, SearchIndexJob.EntityTypeStats> entityStatsMap = Collections.emptyMap();
    if (distributedExecutor != null) {
      SearchIndexJob finalJob = distributedExecutor.getJobWithFreshStats();
      if (finalJob != null && finalJob.getEntityStats() != null) {
        entityStatsMap = finalJob.getEntityStats();
      }
    }

    LOG.debug(
        "Finalization: finalSuccess={}, promotedEntities={}, allEntities={}",
        finalSuccess,
        promotedEntities,
        recreateContext.getEntities());

    Set<String> entitiesToFinalize = new HashSet<>(recreateContext.getEntities());
    entitiesToFinalize.removeAll(promotedEntities);

    if (promotedEntities.contains(Entity.TABLE)
        && !promotedEntities.contains(Entity.TABLE_COLUMN)) {
      boolean tableSuccess = computeEntitySuccess(Entity.TABLE, entityStatsMap);
      promoteColumnIndex(recreateIndexHandler, recreateContext, tableSuccess);
      entitiesToFinalize.remove(Entity.TABLE_COLUMN);
    }

    LOG.debug("Entities to finalize={}, already promoted={}", entitiesToFinalize, promotedEntities);

    try {
      if (!entitiesToFinalize.isEmpty()) {
        LOG.info(
            "Finalizing {} remaining entities (already promoted: {})",
            entitiesToFinalize.size(),
            promotedEntities.size());

        for (String entityType : entitiesToFinalize) {
          try {
            boolean entitySuccess = computeEntitySuccess(entityType, entityStatsMap);
            LOG.debug(
                "Finalizing entity '{}' with perEntitySuccess={} (globalSuccess={})",
                entityType,
                entitySuccess,
                finalSuccess);
            finalizeEntityReindex(recreateIndexHandler, recreateContext, entityType, entitySuccess);
            if (Entity.TABLE.equals(entityType)) {
              promoteColumnIndex(recreateIndexHandler, recreateContext, entitySuccess);
            }
          } catch (Exception ex) {
            LOG.error("Failed to finalize reindex for entity: {}", entityType, ex);
          }
        }
      }
    } catch (Exception e) {
      LOG.error("Error during entity finalization", e);
    }

    return finalSuccess;
  }

  private boolean computeEntitySuccess(
      String entityType, Map<String, SearchIndexJob.EntityTypeStats> entityStatsMap) {
    if (entityStatsMap == null || entityStatsMap.isEmpty()) {
      return false;
    }
    SearchIndexJob.EntityTypeStats stats = entityStatsMap.get(entityType);
    if (stats == null) {
      // Entity not in stats means 0 records — nothing to index = success
      return true;
    }
    return stats.getFailedRecords() == 0
        && stats.getSuccessRecords() + stats.getFailedRecords() >= stats.getTotalRecords();
  }

  private void finalizeEntityReindex(
      RecreateIndexHandler recreateIndexHandler,
      ReindexContext recreateContext,
      String entityType,
      boolean success) {
    try {
      var entityReindexContext =
          org.openmetadata.service.search.EntityReindexContext.builder()
              .entityType(entityType)
              .originalIndex(recreateContext.getOriginalIndex(entityType).orElse(null))
              .canonicalIndex(recreateContext.getCanonicalIndex(entityType).orElse(null))
              .activeIndex(recreateContext.getOriginalIndex(entityType).orElse(null))
              .stagedIndex(recreateContext.getStagedIndex(entityType).orElse(null))
              .canonicalAliases(recreateContext.getCanonicalAlias(entityType).orElse(null))
              .existingAliases(recreateContext.getExistingAliases(entityType))
              .parentAliases(
                  new HashSet<>(listOrEmpty(recreateContext.getParentAliases(entityType))))
              .build();

      recreateIndexHandler.finalizeReindex(entityReindexContext, success);
    } catch (Exception ex) {
      LOG.error("Failed to finalize index recreation flow for {}", entityType, ex);
    }
  }

  @Override
  public Optional<Stats> getStats() {
    return Optional.ofNullable(currentStats.get());
  }

  @Override
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

  @Override
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
      String correctedType = "queryCostResult".equals(entityType) ? QUERY_COST_RECORD : entityType;

      if (!TIME_SERIES_ENTITIES.contains(correctedType)) {
        return Entity.getEntityRepository(correctedType)
            .getDao()
            .listCount(new ListFilter(Include.ALL));
      } else {
        ListFilter listFilter = new ListFilter(null);
        EntityTimeSeriesRepository<?> repository;

        if (isDataInsightIndex(correctedType)) {
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

  private boolean isDataInsightIndex(String entityType) {
    return entityType.endsWith("ReportData");
  }

  DistributedSearchIndexExecutor getDistributedExecutor() {
    return distributedExecutor;
  }
}
