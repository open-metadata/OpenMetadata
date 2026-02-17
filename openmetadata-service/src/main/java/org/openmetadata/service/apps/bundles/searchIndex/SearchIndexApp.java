package org.openmetadata.service.apps.bundles.searchIndex;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.service.Entity.QUERY_COST_RECORD;
import static org.openmetadata.service.Entity.TEST_CASE_RESOLUTION_STATUS;
import static org.openmetadata.service.Entity.TEST_CASE_RESULT;
import static org.openmetadata.service.apps.scheduler.AppScheduler.ON_DEMAND_JOB;
import static org.openmetadata.service.apps.scheduler.OmAppJobListener.APP_CONFIG;
import static org.openmetadata.service.apps.scheduler.OmAppJobListener.APP_RUN_STATS;
import static org.openmetadata.service.socket.WebSocketManager.SEARCH_INDEX_JOB_BROADCAST_CHANNEL;

import com.fasterxml.jackson.core.type.TypeReference;
import jakarta.ws.rs.core.Response;
import java.util.Collections;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.analytics.ReportData;
import org.openmetadata.schema.api.configuration.OpenMetadataBaseUrlConfiguration;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.app.FailureContext;
import org.openmetadata.schema.entity.app.SuccessContext;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.AbstractNativeApplication;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.DistributedSearchIndexExecutor;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.IndexJobStatus;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.SearchIndexJob;
import org.openmetadata.service.apps.bundles.searchIndex.listeners.LoggingProgressListener;
import org.openmetadata.service.apps.bundles.searchIndex.listeners.QuartzProgressListener;
import org.openmetadata.service.apps.bundles.searchIndex.listeners.SlackProgressListener;
import org.openmetadata.service.exception.AppException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityTimeSeriesRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.SystemRepository;
import org.openmetadata.service.search.RecreateIndexHandler;
import org.openmetadata.service.search.ReindexContext;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.socket.WebSocketManager;
import org.openmetadata.service.util.FullyQualifiedName;
import org.quartz.JobExecutionContext;

/**
 * Quartz-scheduled application for reindexing search indices. This class handles the Quartz
 * integration and delegates core reindexing logic to SearchIndexExecutor.
 */
@Slf4j
public class SearchIndexApp extends AbstractNativeApplication {

  public static class ReindexingException extends RuntimeException {
    public ReindexingException(String message) {
      super(message);
    }

    public ReindexingException(String message, Throwable cause) {
      super(message, cause);
    }
  }

  private static final String ALL = "all";
  private static final String APP_SCHEDULE_RUN = "AppScheduleRun";
  private static final long WEBSOCKET_UPDATE_INTERVAL_MS = 2000;

  public static final Set<String> TIME_SERIES_ENTITIES =
      Set.of(
          ReportData.ReportDataType.ENTITY_REPORT_DATA.value(),
          ReportData.ReportDataType.RAW_COST_ANALYSIS_REPORT_DATA.value(),
          ReportData.ReportDataType.WEB_ANALYTIC_USER_ACTIVITY_REPORT_DATA.value(),
          ReportData.ReportDataType.WEB_ANALYTIC_ENTITY_VIEW_REPORT_DATA.value(),
          ReportData.ReportDataType.AGGREGATED_COST_ANALYSIS_REPORT_DATA.value(),
          TEST_CASE_RESOLUTION_STATUS,
          TEST_CASE_RESULT,
          QUERY_COST_RECORD);

  @Getter private EventPublisherJob jobData;
  private JobExecutionContext jobExecutionContext;
  private volatile boolean stopped = false;
  private SearchIndexExecutor executor;
  private DistributedSearchIndexExecutor distributedExecutor;
  private ReindexContext recreateContext;
  private RecreateIndexHandler recreateIndexHandler;
  private BulkSink searchIndexSink;

  public SearchIndexApp(CollectionDAO collectionDAO, SearchRepository searchRepository) {
    super(collectionDAO, searchRepository);
  }

  @Override
  public void init(App app) {
    super.init(app);
    jobData = JsonUtils.convertValue(app.getAppConfiguration(), EventPublisherJob.class);
  }

  private void cleanupOrphanedIndices() {
    try {
      OrphanedIndexCleaner cleaner = new OrphanedIndexCleaner();
      OrphanedIndexCleaner.CleanupResult result =
          cleaner.cleanupOrphanedIndices(searchRepository.getSearchClient());
      if (result.deleted() > 0) {
        LOG.info(
            "Cleaned up {} orphaned rebuild indices on Job End (found={}, failed={})",
            result.deleted(),
            result.found(),
            result.failed());
      }
    } catch (Exception e) {
      LOG.warn("Failed to cleanup orphaned indices on Job End: {}", e.getMessage());
    }
  }

  @Override
  public void execute(JobExecutionContext jobExecutionContext) {
    this.jobExecutionContext = jobExecutionContext;
    initializeJobState();
    initializeJobData(jobExecutionContext);

    try {
      runReindexing(jobExecutionContext);
    } catch (Exception ex) {
      handleExecutionException(ex);
    } finally {
      finalizeJobExecution(jobExecutionContext);
      cleanupOrphanedIndices();
    }
  }

  private void initializeJobState() {
    stopped = false;
    recreateContext = null;
  }

  private void initializeJobData(JobExecutionContext jobExecutionContext) {
    if (jobData == null) {
      jobData = loadJobData(jobExecutionContext);
    }

    String jobName = jobExecutionContext.getJobDetail().getKey().getName();
    if (jobName.equals(ON_DEMAND_JOB)) {
      Map<String, Object> jsonAppConfig =
          JsonUtils.convertValue(jobData, new TypeReference<Map<String, Object>>() {});
      getApp().setAppConfiguration(jsonAppConfig);
    }
  }

  private EventPublisherJob loadJobData(JobExecutionContext jobExecutionContext) {
    String appConfigJson =
        (String) jobExecutionContext.getJobDetail().getJobDataMap().get(APP_CONFIG);
    if (appConfigJson != null) {
      return JsonUtils.readValue(appConfigJson, EventPublisherJob.class);
    }

    if (getApp() != null && getApp().getAppConfiguration() != null) {
      return JsonUtils.convertValue(getApp().getAppConfiguration(), EventPublisherJob.class);
    }

    LOG.error("Unable to initialize jobData from JobDataMap or App configuration");
    throw new ReindexingException("JobData is not initialized");
  }

  private void cleanupOldFailures() {
    try {
      // Delete all previous failure records - we only keep failures for the current run
      int deleted = collectionDAO.searchIndexFailureDAO().deleteAll();
      if (deleted > 0) {
        LOG.info("Cleaned up {} failure records from previous runs", deleted);
      }
    } catch (Exception e) {
      LOG.warn("Failed to cleanup old failure records", e);
    }
  }

  private void runReindexing(JobExecutionContext jobExecutionContext) throws Exception {
    boolean success = false;
    try {
      if (jobData.getEntities() == null || jobData.getEntities().isEmpty()) {
        LOG.info("No entities selected for reindexing, completing immediately");
        jobData.setStatus(EventPublisherJob.Status.COMPLETED);
        jobData.setStats(new Stats());
        success = true;
        return;
      }

      setupEntities();
      cleanupOldFailures();

      LOG.info(
          "Search Index Job Started for Entities: {}, RecreateIndex: {}, DistributedIndexing: {}",
          jobData.getEntities(),
          jobData.getRecreateIndex(),
          jobData.getUseDistributedIndexing());

      if (Boolean.TRUE.equals(jobData.getUseDistributedIndexing())) {
        runDistributedReindexing(jobExecutionContext);
        success = jobData != null && jobData.getStatus() == EventPublisherJob.Status.COMPLETED;
      } else {
        ExecutionResult result = runSingleServerReindexing(jobExecutionContext);
        success = result.isSuccessful();
        updateJobDataFromResult(result);
      }
    } finally {
      finalizeAllEntityReindex(success);
    }
  }

  private ExecutionResult runSingleServerReindexing(JobExecutionContext jobExecutionContext) {
    executor = new SearchIndexExecutor(collectionDAO, searchRepository);

    QuartzProgressListener quartzListener =
        new QuartzProgressListener(jobExecutionContext, jobData, getApp());
    executor.addListener(quartzListener);
    executor.addListener(new LoggingProgressListener());

    if (hasSlackConfig()) {
      String instanceUrl = getInstanceUrl();
      executor.addListener(
          new SlackProgressListener(
              jobData.getSlackBotToken(), jobData.getSlackChannel(), instanceUrl));
    }

    ReindexingJobContext context =
        new QuartzJobContext(
            jobExecutionContext,
            getApp(),
            Boolean.TRUE.equals(jobData.getUseDistributedIndexing()));

    ReindexingConfiguration config = ReindexingConfiguration.from(jobData);

    return executor.execute(config, context);
  }

  private void updateJobDataFromResult(ExecutionResult result) {
    if (result.finalStats() != null) {
      Stats stats = result.finalStats();
      StatsReconciler.reconcile(stats);
      jobData.setStats(stats);
    }

    switch (result.status()) {
      case COMPLETED -> jobData.setStatus(EventPublisherJob.Status.COMPLETED);
      case COMPLETED_WITH_ERRORS -> jobData.setStatus(EventPublisherJob.Status.ACTIVE_ERROR);
      case FAILED -> jobData.setStatus(EventPublisherJob.Status.FAILED);
      case STOPPED -> jobData.setStatus(EventPublisherJob.Status.STOPPED);
    }
  }

  private boolean hasSlackConfig() {
    return jobData.getSlackBotToken() != null
        && !jobData.getSlackBotToken().isEmpty()
        && jobData.getSlackChannel() != null
        && !jobData.getSlackChannel().isEmpty();
  }

  private String getInstanceUrl() {
    try {
      SystemRepository systemRepository = Entity.getSystemRepository();
      if (systemRepository != null) {
        Settings settings = systemRepository.getOMBaseUrlConfigInternal();
        if (settings != null && settings.getConfigValue() != null) {
          OpenMetadataBaseUrlConfiguration urlConfig =
              (OpenMetadataBaseUrlConfiguration) settings.getConfigValue();
          if (urlConfig != null && urlConfig.getOpenMetadataUrl() != null) {
            return urlConfig.getOpenMetadataUrl();
          }
        }
      }
    } catch (Exception e) {
      LOG.debug("Could not get instance URL from SystemSettings", e);
    }
    return "http://localhost:8585";
  }

  // ========== Distributed Mode ==========

  private void runDistributedReindexing(JobExecutionContext jobExecutionContext) throws Exception {
    LOG.info("Starting distributed reindexing for entities: {}", jobData.getEntities());

    Stats stats = initializeTotalRecords(jobData.getEntities());
    jobData.setStats(stats);

    int partitionSize = jobData.getPartitionSize() != null ? jobData.getPartitionSize() : 10000;
    distributedExecutor = new DistributedSearchIndexExecutor(collectionDAO, partitionSize);
    distributedExecutor.performStartupRecovery();

    // Add listeners for distributed mode (same as single-server mode)
    distributedExecutor.addListener(new LoggingProgressListener());
    if (hasSlackConfig()) {
      String instanceUrl = getInstanceUrl();
      distributedExecutor.addListener(
          new SlackProgressListener(
              jobData.getSlackBotToken(), jobData.getSlackChannel(), instanceUrl));
    }

    String createdBy = jobExecutionContext.getJobDetail().getKey().getName();
    SearchIndexJob distributedJob =
        distributedExecutor.createJob(jobData.getEntities(), jobData, createdBy);

    LOG.info(
        "Created distributed job {} with {} total records",
        distributedJob.getId(),
        distributedJob.getTotalRecords());

    this.searchIndexSink =
        searchRepository.createBulkSink(
            jobData.getBatchSize(), jobData.getMaxConcurrentRequests(), jobData.getPayLoadSize());
    this.recreateIndexHandler = searchRepository.createReindexHandler();

    if (Boolean.TRUE.equals(jobData.getRecreateIndex())) {
      recreateContext = recreateIndexHandler.reCreateIndexes(jobData.getEntities());
      // Share staged index mapping with participant servers
      if (recreateContext != null && !recreateContext.isEmpty()) {
        distributedExecutor.updateStagedIndexMapping(recreateContext.getStagedIndexMapping());
      }
    }

    updateJobStatus(EventPublisherJob.Status.RUNNING);
    sendUpdates(jobExecutionContext, true);

    AppRunRecord appRecord = getJobRecord(jobExecutionContext);
    distributedExecutor.setAppContext(appRecord.getAppId(), appRecord.getStartTime());

    distributedExecutor.execute(
        searchIndexSink, recreateContext, Boolean.TRUE.equals(jobData.getRecreateIndex()));
    monitorDistributedJob(jobExecutionContext, distributedJob.getId());

    if (searchIndexSink != null) {
      // Wait for vector embedding tasks to complete before closing
      int pendingVectorTasks = searchIndexSink.getPendingVectorTaskCount();
      if (pendingVectorTasks > 0) {
        LOG.info("Waiting for {} pending vector embedding tasks to complete", pendingVectorTasks);
        boolean vectorComplete = searchIndexSink.awaitVectorCompletion(120);
        if (!vectorComplete) {
          LOG.warn("Vector embedding wait timed out - some tasks may not be reflected in stats");
        }
      }

      // Flush and wait for pending bulk requests
      LOG.info("Flushing sink and waiting for pending bulk requests");
      boolean flushComplete = searchIndexSink.flushAndAwait(60);
      if (!flushComplete) {
        LOG.warn("Sink flush timed out - some requests may not be reflected in stats");
      }

      searchIndexSink.close();
    }

    SearchIndexJob finalJob = distributedExecutor.getJobWithFreshStats();
    if (finalJob != null) {
      // Use actual sink stats for accurate success/failure counts
      // The partition-based stats may be inaccurate because the bulk sink is asynchronous
      StepStats sinkStats = searchIndexSink != null ? searchIndexSink.getStats() : null;
      updateJobDataFromDistributedJob(finalJob, sinkStats);

      // Set vector stats directly from the bulk sink since the sink tracks vector
      // success/failure internally and these may not be fully reflected in server stats
      if (searchIndexSink != null && jobData.getStats() != null) {
        StepStats sinkVectorStats = searchIndexSink.getVectorStats();
        if (sinkVectorStats != null && sinkVectorStats.getTotalRecords() > 0) {
          jobData.getStats().setVectorStats(sinkVectorStats);
        }
      }

      saveServerStatsToJobDataMap(jobExecutionContext, finalJob);
    }

    // Save stats to APP_RUN_STATS for OmAppJobListener to pick up
    // This is required because distributed mode doesn't use QuartzProgressListener
    if (jobData.getStats() != null) {
      jobExecutionContext.getJobDetail().getJobDataMap().put(APP_RUN_STATS, jobData.getStats());
    }

    updateFinalJobStatus();
  }

  private void monitorDistributedJob(
      JobExecutionContext jobExecutionContext, java.util.UUID jobId) {
    CountDownLatch completionLatch = new CountDownLatch(1);
    ScheduledExecutorService monitor =
        Executors.newSingleThreadScheduledExecutor(
            Thread.ofPlatform().name("distributed-monitor").factory());

    try {
      monitor.scheduleAtFixedRate(
          () -> {
            if (stopped) {
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

            updateJobDataFromDistributedJob(job);
          },
          0,
          WEBSOCKET_UPDATE_INTERVAL_MS,
          TimeUnit.MILLISECONDS);

      completionLatch.await();
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      LOG.warn("Distributed job monitoring interrupted");
    } finally {
      monitor.shutdownNow();
    }
  }

  private void updateJobDataFromDistributedJob(SearchIndexJob distributedJob) {
    updateJobDataFromDistributedJob(distributedJob, null);
  }

  private void updateJobDataFromDistributedJob(
      SearchIndexJob distributedJob, StepStats actualSinkStats) {
    Stats stats = jobData.getStats();
    if (stats == null) {
      return;
    }

    // Fetch aggregated server stats once for accurate reader/sink breakdown
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

    // Determine success/failed from best available source
    long successRecords;
    long failedRecords;
    String statsSource;

    if (serverStatsAggr != null && serverStatsAggr.sinkSuccess() > 0) {
      // Use server stats table (most accurate)
      // processFailed = records that read successfully but failed during doc building
      successRecords = serverStatsAggr.sinkSuccess();
      failedRecords =
          serverStatsAggr.readerFailed()
              + serverStatsAggr.sinkFailed()
              + serverStatsAggr.processFailed();
      statsSource = "serverStatsTable";
    } else if (actualSinkStats != null) {
      // Use local sink stats (single server scenario)
      successRecords = actualSinkStats.getSuccessRecords();
      failedRecords = actualSinkStats.getFailedRecords();
      statsSource = "localSink";
    } else {
      // Fallback to partition-based stats
      successRecords = distributedJob.getSuccessRecords();
      failedRecords = distributedJob.getFailedRecords();
      statsSource = "partition-based";
    }

    LOG.debug(
        "Stats source: {}, success={}, failed={}", statsSource, successRecords, failedRecords);

    StepStats jobStats = stats.getJobStats();
    if (jobStats != null) {
      jobStats.setSuccessRecords((int) successRecords);
      jobStats.setFailedRecords((int) failedRecords);
    }

    StepStats readerStats = stats.getReaderStats();
    if (readerStats != null) {
      readerStats.setTotalRecords((int) distributedJob.getTotalRecords());
      long readerFailed = serverStatsAggr != null ? serverStatsAggr.readerFailed() : 0;
      long readerWarnings = serverStatsAggr != null ? serverStatsAggr.readerWarnings() : 0;
      long readerSuccess =
          serverStatsAggr != null
              ? serverStatsAggr.readerSuccess()
              : distributedJob.getTotalRecords() - readerFailed - readerWarnings;
      readerStats.setSuccessRecords((int) readerSuccess);
      readerStats.setFailedRecords((int) readerFailed);
      readerStats.setWarningRecords((int) readerWarnings);
    }

    // Process stats - document building stage
    StepStats processStats = stats.getProcessStats();
    if (processStats != null && serverStatsAggr != null) {
      long processSuccess = serverStatsAggr.processSuccess();
      long processFailed = serverStatsAggr.processFailed();
      processStats.setTotalRecords((int) (processSuccess + processFailed));
      processStats.setSuccessRecords((int) processSuccess);
      processStats.setFailedRecords((int) processFailed);
    }

    StepStats sinkStats = stats.getSinkStats();
    if (sinkStats != null) {
      if (serverStatsAggr != null) {
        // Use actual sink stats from the database
        long sinkSuccess = serverStatsAggr.sinkSuccess();
        long sinkFailed = serverStatsAggr.sinkFailed();

        // sinkTotal = docs submitted to ES = sinkSuccess + sinkFailed
        long actualSinkTotal = sinkSuccess + sinkFailed;

        sinkStats.setTotalRecords((int) actualSinkTotal);
        sinkStats.setSuccessRecords((int) sinkSuccess);
        sinkStats.setFailedRecords((int) sinkFailed);
      } else {
        // Fallback: derive from reader stats (less accurate)
        long readerFailed = 0;
        long sinkTotal = distributedJob.getTotalRecords() - readerFailed;
        sinkStats.setTotalRecords((int) sinkTotal);
        sinkStats.setSuccessRecords((int) successRecords);
        sinkStats.setFailedRecords((int) failedRecords);
      }
    }

    // Vector stats - embedding generation stage
    StepStats vectorStats = stats.getVectorStats();
    if (vectorStats != null && serverStatsAggr != null) {
      long vectorSuccess = serverStatsAggr.vectorSuccess();
      long vectorFailed = serverStatsAggr.vectorFailed();
      vectorStats.setTotalRecords((int) (vectorSuccess + vectorFailed));
      vectorStats.setSuccessRecords((int) vectorSuccess);
      vectorStats.setFailedRecords((int) vectorFailed);
    }

    if (distributedJob.getEntityStats() != null && stats.getEntityStats() != null) {
      for (Map.Entry<String, SearchIndexJob.EntityTypeStats> entry :
          distributedJob.getEntityStats().entrySet()) {
        StepStats entityStats =
            stats.getEntityStats().getAdditionalProperties().get(entry.getKey());
        if (entityStats != null) {
          entityStats.setSuccessRecords((int) entry.getValue().getSuccessRecords());
          entityStats.setFailedRecords((int) entry.getValue().getFailedRecords());
        }
      }
    }

    StatsReconciler.reconcile(stats);

    switch (distributedJob.getStatus()) {
      case COMPLETED -> jobData.setStatus(EventPublisherJob.Status.COMPLETED);
      case COMPLETED_WITH_ERRORS -> jobData.setStatus(EventPublisherJob.Status.ACTIVE_ERROR);
      case FAILED -> jobData.setStatus(EventPublisherJob.Status.FAILED);
      case STOPPING, STOPPED -> jobData.setStatus(EventPublisherJob.Status.STOPPED);
      default -> jobData.setStatus(EventPublisherJob.Status.RUNNING);
    }
  }

  private void saveServerStatsToJobDataMap(
      JobExecutionContext jobExecutionContext, SearchIndexJob distributedJob) {
    try {
      AppRunRecord appRecord = getJobRecord(jobExecutionContext);
      SuccessContext successContext = appRecord.getSuccessContext();
      if (successContext == null) {
        successContext = new SuccessContext();
      }

      if (distributedJob.getServerStats() != null && !distributedJob.getServerStats().isEmpty()) {
        LOG.info(
            "Saving serverStats to job data map: {} servers with data: {}",
            distributedJob.getServerStats().size(),
            distributedJob.getServerStats());
        successContext.withAdditionalProperty("serverStats", distributedJob.getServerStats());
        successContext.withAdditionalProperty(
            "serverCount", distributedJob.getServerStats().size());
        successContext.withAdditionalProperty(
            "distributedJobId", distributedJob.getId().toString());
      } else {
        LOG.warn(
            "No server stats available for distributed job {} - serverStats is {} ",
            distributedJob.getId(),
            distributedJob.getServerStats() == null ? "null" : "empty");
      }

      if (jobData.getStats() != null) {
        successContext.withAdditionalProperty("stats", jobData.getStats());
      }

      appRecord.setSuccessContext(successContext);
      jobExecutionContext
          .getJobDetail()
          .getJobDataMap()
          .put("AppScheduleRun", JsonUtils.pojoToJson(appRecord));

    } catch (Exception e) {
      LOG.error("Failed to save serverStats to job data map", e);
    }
  }

  // ========== Helper Methods ==========

  private void setupEntities() {
    boolean containsAll = jobData.getEntities().contains(ALL);
    if (containsAll) {
      jobData.setEntities(getAll());
    }
  }

  private Set<String> getAll() {
    Set<String> entities =
        new HashSet<>(
            Entity.getEntityList().stream()
                .filter(t -> searchRepository.getEntityIndexMap().containsKey(t))
                .toList());
    entities.addAll(
        TIME_SERIES_ENTITIES.stream()
            .filter(t -> searchRepository.getEntityIndexMap().containsKey(t))
            .toList());
    return entities;
  }

  public Stats initializeTotalRecords(Set<String> entities) {
    Stats stats = new Stats();
    stats.setEntityStats(new org.openmetadata.schema.system.EntityStats());
    stats.setJobStats(new StepStats());
    stats.setReaderStats(new StepStats());
    stats.setProcessStats(new StepStats());
    stats.setSinkStats(new StepStats());
    stats.setVectorStats(new StepStats());

    int total = 0;
    for (String entityType : entities) {
      int entityTotal = getEntityTotal(entityType);
      total += entityTotal;

      StepStats entityStats = new StepStats();
      entityStats.setTotalRecords(entityTotal);
      entityStats.setSuccessRecords(0);
      entityStats.setFailedRecords(0);
      stats.getEntityStats().getAdditionalProperties().put(entityType, entityStats);
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
        return Entity.getEntityRepository(correctedType).getDao().listTotalCount();
      } else {
        ListFilter listFilter = new ListFilter(null);
        EntityTimeSeriesRepository<?> repository;

        if (isDataInsightIndex(correctedType)) {
          listFilter.addQueryParam("entityFQNHash", FullyQualifiedName.buildHash(correctedType));
          repository = Entity.getEntityTimeSeriesRepository(Entity.ENTITY_REPORT_DATA);
        } else {
          repository = Entity.getEntityTimeSeriesRepository(correctedType);
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

  private void updateJobStatus(EventPublisherJob.Status newStatus) {
    if (stopped
        && newStatus != EventPublisherJob.Status.STOP_IN_PROGRESS
        && newStatus != EventPublisherJob.Status.STOPPED) {
      return;
    }
    jobData.setStatus(newStatus);
  }

  private void updateFinalJobStatus() {
    if (stopped) {
      updateJobStatus(EventPublisherJob.Status.STOPPED);
    } else if (hasIncompleteProcessing()) {
      updateJobStatus(EventPublisherJob.Status.ACTIVE_ERROR);
    } else {
      updateJobStatus(EventPublisherJob.Status.COMPLETED);
    }
  }

  private boolean hasIncompleteProcessing() {
    if (jobData == null || jobData.getStats() == null || jobData.getStats().getJobStats() == null) {
      return false;
    }

    StepStats jobStats = jobData.getStats().getJobStats();
    long failed = jobStats.getFailedRecords() != null ? jobStats.getFailedRecords() : 0;
    long processed = jobStats.getSuccessRecords() != null ? jobStats.getSuccessRecords() : 0;
    long total = jobStats.getTotalRecords() != null ? jobStats.getTotalRecords() : 0;

    return failed > 0 || (total > 0 && processed < total);
  }

  private void finalizeAllEntityReindex(boolean finalSuccess) {
    if (recreateIndexHandler == null || recreateContext == null) {
      return;
    }

    // Get already-promoted entities from distributed executor (if running in distributed mode)
    Set<String> promotedEntities = Collections.emptySet();
    if (distributedExecutor != null && distributedExecutor.getEntityTracker() != null) {
      promotedEntities = distributedExecutor.getEntityTracker().getPromotedEntities();
    }

    // Calculate entities that still need finalization
    Set<String> entitiesToFinalize = new HashSet<>(recreateContext.getEntities());
    entitiesToFinalize.removeAll(promotedEntities);

    if (entitiesToFinalize.isEmpty()) {
      LOG.info(
          "All {} entities already promoted during execution, skipping finalizeAllEntityReindex",
          promotedEntities.size());
      recreateContext = null;
      return;
    }

    LOG.info(
        "Finalizing {} remaining entities (already promoted: {})",
        entitiesToFinalize.size(),
        promotedEntities.size());

    try {
      for (String entityType : entitiesToFinalize) {
        try {
          finalizeEntityReindex(entityType, finalSuccess);
        } catch (Exception ex) {
          LOG.error("Failed to finalize reindex for entity: {}", entityType, ex);
        }
      }
    } finally {
      recreateContext = null;
    }
  }

  private void finalizeEntityReindex(String entityType, boolean success) {
    if (recreateIndexHandler == null || recreateContext == null) {
      return;
    }

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
      LOG.error("Failed to finalize index recreation flow", ex);
    }
  }

  private void handleExecutionException(Exception ex) {
    if (searchIndexSink != null) {
      try {
        searchIndexSink.close();
      } catch (Exception e) {
        LOG.error("Error closing search index sink", e);
      }
    }

    if (executor != null && jobData != null) {
      try {
        Stats executorStats = executor.getStats().get();
        if (executorStats != null) {
          jobData.setStats(executorStats);
        }
      } catch (Exception e) {
        LOG.debug("Could not capture executor stats during exception handling", e);
      }
    }

    if (stopped) {
      if (jobData != null) {
        jobData.setStatus(EventPublisherJob.Status.STOPPED);
      }
    } else {
      IndexingError error =
          new IndexingError()
              .withErrorSource(IndexingError.ErrorSource.JOB)
              .withMessage("Reindexing Job Exception: " + ex.getMessage());
      LOG.error("Reindexing Job Failed", ex);

      if (jobData != null) {
        jobData.setStatus(EventPublisherJob.Status.FAILED);
        jobData.setFailure(error);
      }
    }
  }

  private void finalizeJobExecution(JobExecutionContext jobExecutionContext) {
    sendUpdates(jobExecutionContext, true);

    if (stopped && jobExecutionContext != null) {
      AppRunRecord appRecord = getJobRecord(jobExecutionContext);
      appRecord.setStatus(AppRunRecord.Status.STOPPED);
      jobExecutionContext
          .getJobDetail()
          .getJobDataMap()
          .put(APP_SCHEDULE_RUN, JsonUtils.pojoToJson(appRecord));
    }
  }

  private void sendUpdates(JobExecutionContext jobExecutionContext, boolean force) {
    try {
      updateRecordToDbAndNotify(jobExecutionContext);
    } catch (Exception ex) {
      LOG.error("Failed to send updates", ex);
    }
  }

  public void updateRecordToDbAndNotify(JobExecutionContext jobExecutionContext) {
    AppRunRecord appRecord = getJobRecord(jobExecutionContext);
    appRecord.setStatus(AppRunRecord.Status.fromValue(jobData.getStatus().value()));

    if (jobData.getFailure() != null) {
      appRecord.setFailureContext(
          new FailureContext().withAdditionalProperty("failure", jobData.getFailure()));
    }

    if (jobData.getStats() != null) {
      SuccessContext successContext =
          new SuccessContext().withAdditionalProperty("stats", jobData.getStats());

      try {
        String jobIdStr =
            distributedExecutor != null
                ? distributedExecutor.getJobWithFreshStats().getId().toString()
                : getApp().getId().toString();
        int failureCount = collectionDAO.searchIndexFailureDAO().countByJobId(jobIdStr);
        if (failureCount > 0) {
          successContext.withAdditionalProperty("failureRecordCount", failureCount);
        }
      } catch (Exception e) {
        LOG.debug("Could not get failure count", e);
      }

      if (distributedExecutor != null) {
        SearchIndexJob distributedJob = distributedExecutor.getJobWithFreshStats();
        if (distributedJob != null && distributedJob.getServerStats() != null) {
          successContext.withAdditionalProperty("serverStats", distributedJob.getServerStats());
          successContext.withAdditionalProperty(
              "serverCount", distributedJob.getServerStats().size());
          successContext.withAdditionalProperty(
              "distributedJobId", distributedJob.getId().toString());
        }
      }

      appRecord.setSuccessContext(successContext);
    }

    if (WebSocketManager.getInstance() != null) {
      String messageJson = JsonUtils.pojoToJson(appRecord);
      WebSocketManager.getInstance()
          .broadCastMessageToAll(SEARCH_INDEX_JOB_BROADCAST_CHANNEL, messageJson);
    }
  }

  @Override
  public void stop() {
    LOG.info("Reindexing job is being stopped.");
    stopped = true;

    if (executor != null) {
      executor.stop();
    }

    if (distributedExecutor != null) {
      try {
        distributedExecutor.stop();
      } catch (Exception e) {
        LOG.error("Error stopping distributed executor", e);
      }
    }

    if (jobData != null) {
      jobData.setStatus(EventPublisherJob.Status.STOPPED);
    }

    if (jobExecutionContext != null) {
      AppRunRecord appRecord = getJobRecord(jobExecutionContext);
      appRecord.setStatus(AppRunRecord.Status.STOPPED);
      appRecord.setEndTime(System.currentTimeMillis());
      jobExecutionContext
          .getJobDetail()
          .getJobDataMap()
          .put(APP_SCHEDULE_RUN, JsonUtils.pojoToJson(appRecord));
      pushAppStatusUpdates(jobExecutionContext, appRecord, true);
      sendUpdates(jobExecutionContext, true);
    }

    if (searchIndexSink != null) {
      try {
        searchIndexSink.close();
      } catch (Exception e) {
        LOG.error("Error closing search index sink", e);
      }
    }

    LOG.info("Reindexing job stopped successfully.");
  }

  @Override
  protected void validateConfig(Map<String, Object> appConfig) {
    try {
      JsonUtils.convertValue(appConfig, EventPublisherJob.class);
    } catch (IllegalArgumentException e) {
      throw AppException.byMessage(
          Response.Status.BAD_REQUEST, "Invalid App Configuration: " + e.getMessage());
    }
  }
}
