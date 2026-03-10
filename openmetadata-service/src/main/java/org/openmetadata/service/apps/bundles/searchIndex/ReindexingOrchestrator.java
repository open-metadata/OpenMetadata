package org.openmetadata.service.apps.bundles.searchIndex;

import static org.openmetadata.service.apps.scheduler.AppScheduler.ON_DEMAND_JOB;
import static org.openmetadata.service.socket.WebSocketManager.SEARCH_INDEX_JOB_BROADCAST_CHANNEL;

import com.fasterxml.jackson.core.type.TypeReference;
import io.micrometer.core.instrument.Timer;
import java.util.Collections;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.configuration.OpenMetadataBaseUrlConfiguration;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.app.FailureContext;
import org.openmetadata.schema.entity.app.SuccessContext;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.searchIndex.listeners.LoggingProgressListener;
import org.openmetadata.service.apps.bundles.searchIndex.listeners.SlackProgressListener;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.SystemRepository;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.socket.WebSocketManager;
import org.slf4j.MDC;

@Slf4j
public class ReindexingOrchestrator {
  private static final String ALL = "all";
  private final CollectionDAO collectionDAO;
  private final SearchRepository searchRepository;
  private final OrchestratorContext context;

  @Getter private EventPublisherJob jobData;
  private volatile boolean stopped = false;
  private volatile IndexingStrategy activeStrategy;
  private volatile Map<String, Object> resultMetadata = Collections.emptyMap();

  public ReindexingOrchestrator(
      CollectionDAO collectionDAO, SearchRepository searchRepository, OrchestratorContext context) {
    this.collectionDAO = collectionDAO;
    this.searchRepository = searchRepository;
    this.context = context;
  }

  public void run(EventPublisherJob initialJobData) {
    this.jobData = initialJobData;
    initializeState();
    initializeJobData();

    String jobId = UUID.randomUUID().toString().substring(0, 8);
    MDC.put("reindexJobId", jobId);

    ReindexingMetrics metrics = ReindexingMetrics.getInstance();
    Timer.Sample timerSample = null;
    if (metrics != null) {
      metrics.recordJobStarted();
      timerSample = metrics.startJobTimer();
    }

    preflightFixes();

    try {
      runReindexing();
    } catch (Exception ex) {
      handleExecutionException(ex);
    } finally {
      finalizeJobExecution();
      cleanupOrphanedIndices();

      if (metrics != null && timerSample != null) {
        EventPublisherJob.Status status = jobData != null ? jobData.getStatus() : null;
        if (status == EventPublisherJob.Status.COMPLETED
            || status == EventPublisherJob.Status.ACTIVE_ERROR) {
          metrics.recordJobCompleted(timerSample);
        } else if (status == EventPublisherJob.Status.STOPPED) {
          metrics.recordJobStopped(timerSample);
        } else {
          metrics.recordJobFailed(timerSample);
        }
      }

      MDC.remove("reindexJobId");
    }
  }

  public void stop() {
    LOG.info("Reindexing job is being stopped.");
    stopped = true;

    IndexingStrategy strategy = this.activeStrategy;
    if (strategy != null) {
      try {
        strategy.stop();
      } catch (Exception e) {
        LOG.error("Error stopping indexing strategy", e);
      }
    }

    if (jobData != null) {
      jobData.setStatus(EventPublisherJob.Status.STOPPED);
    }

    AppRunRecord appRecord = context.getJobRecord();
    appRecord.setStatus(AppRunRecord.Status.STOPPED);
    appRecord.setEndTime(System.currentTimeMillis());
    context.storeRunRecord(JsonUtils.pojoToJson(appRecord));
    context.pushStatusUpdate(appRecord, true);
    sendUpdates();

    LOG.info("Reindexing job stopped successfully.");
  }

  private void initializeState() {
    stopped = false;
    activeStrategy = null;
    resultMetadata = Collections.emptyMap();
  }

  private void initializeJobData() {
    if (jobData == null) {
      jobData = loadJobData();
    }

    String jobName = context.getJobName();
    if (jobName.equals(ON_DEMAND_JOB)) {
      Map<String, Object> jsonAppConfig =
          JsonUtils.convertValue(jobData, new TypeReference<Map<String, Object>>() {});
      context.updateAppConfiguration(jsonAppConfig);
    }
  }

  private EventPublisherJob loadJobData() {
    String appConfigJson = context.getAppConfigJson();
    if (appConfigJson != null) {
      return JsonUtils.readValue(appConfigJson, EventPublisherJob.class);
    }

    Map<String, Object> appConfig = context.getAppConfiguration();
    if (appConfig != null) {
      return JsonUtils.convertValue(appConfig, EventPublisherJob.class);
    }

    LOG.error("Unable to initialize jobData from JobDataMap or App configuration");
    throw new SearchIndexApp.ReindexingException("JobData is not initialized");
  }

  private void preflightFixes() {
    LOG.info("Running preflight fixes before reindexing");
    markStaleRunningJobsStopped();
    cleanupOrphanedIndicesPreFlight();
  }

  private static final String APP_NAME = "SearchIndexingApplication";

  private void markStaleRunningJobsStopped() {
    try {
      AppRunRecord currentRecord = context.getJobRecord();
      if (currentRecord != null && currentRecord.getStartTime() != null) {
        collectionDAO
            .appExtensionTimeSeriesDao()
            .markStaleEntriesStoppedBefore(APP_NAME, currentRecord.getStartTime());
        LOG.info("Preflight: marked stale running jobs as stopped for {}", APP_NAME);
      }
    } catch (Exception e) {
      LOG.warn("Preflight: failed to cleanup stale running jobs: {}", e.getMessage());
    }
  }

  private void cleanupOrphanedIndicesPreFlight() {
    try {
      OrphanedIndexCleaner cleaner = new OrphanedIndexCleaner();
      OrphanedIndexCleaner.CleanupResult result =
          cleaner.cleanupOrphanedIndices(searchRepository.getSearchClient());
      if (result.found() > 0) {
        LOG.info(
            "Preflight: cleaned up {} orphaned rebuild indices (found={}, failed={})",
            result.deleted(),
            result.found(),
            result.failed());
      }
    } catch (Exception e) {
      LOG.warn("Preflight: failed to cleanup orphaned indices: {}", e.getMessage());
    }
  }

  private void runReindexing() throws Exception {
    if (jobData.getEntities() == null || jobData.getEntities().isEmpty()) {
      LOG.info("No entities selected for reindexing, completing immediately");
      jobData.setStatus(EventPublisherJob.Status.COMPLETED);
      jobData.setStats(new Stats());
      return;
    }

    setupEntities();
    cleanupOldFailures();

    LOG.info(
        "Search Index Job Started for Entities: {}, RecreateIndex: {}, DistributedIndexing: {}",
        jobData.getEntities(),
        jobData.getRecreateIndex(),
        jobData.getUseDistributedIndexing());

    activeStrategy = createStrategy();

    activeStrategy.addListener(context.createProgressListener(jobData));
    activeStrategy.addListener(new LoggingProgressListener());

    if (hasSlackConfig()) {
      String instanceUrl = getInstanceUrl();
      activeStrategy.addListener(
          new SlackProgressListener(
              jobData.getSlackBotToken(), jobData.getSlackChannel(), instanceUrl));
    }

    ReindexingJobContext jobContext =
        context.createReindexingContext(Boolean.TRUE.equals(jobData.getUseDistributedIndexing()));

    ReindexingConfiguration config = ReindexingConfiguration.from(jobData);
    long totalEntities = countTotalEntities();
    config = ReindexingConfiguration.applyAutoTuning(config, searchRepository, totalEntities);
    config.applyTo(jobData);
    updateRunRecordConfig(config);

    ExecutionResult result = activeStrategy.execute(config, jobContext);
    updateJobDataFromResult(result);

    if (jobData.getStats() != null) {
      context.storeRunStats(jobData.getStats());
    }

    if (!result.metadata().isEmpty()) {
      saveResultMetadataToJobRecord(result.metadata());
    }
  }

  private IndexingStrategy createStrategy() {
    if (Boolean.TRUE.equals(jobData.getUseDistributedIndexing())) {
      AppRunRecord appRecord = context.getJobRecord();
      return new DistributedIndexingStrategy(
          collectionDAO,
          searchRepository,
          jobData,
          appRecord.getAppId(),
          appRecord.getStartTime(),
          context.getJobName());
    }
    return new SingleServerIndexingStrategy(collectionDAO, searchRepository);
  }

  private void updateJobDataFromResult(ExecutionResult result) {
    if (result.finalStats() != null) {
      Stats stats = result.finalStats();
      StatsReconciler.reconcile(stats);
      jobData.setStats(stats);
    }

    resultMetadata = result.metadata() != null ? result.metadata() : Collections.emptyMap();

    switch (result.status()) {
      case COMPLETED -> jobData.setStatus(EventPublisherJob.Status.COMPLETED);
      case COMPLETED_WITH_ERRORS -> jobData.setStatus(EventPublisherJob.Status.ACTIVE_ERROR);
      case FAILED -> jobData.setStatus(EventPublisherJob.Status.FAILED);
      case STOPPED -> jobData.setStatus(EventPublisherJob.Status.STOPPED);
    }
  }

  private void updateRunRecordConfig(ReindexingConfiguration config) {
    try {
      AppRunRecord appRecord = context.getJobRecord();
      if (appRecord != null) {
        Map<String, Object> configMap = appRecord.getConfig();
        if (configMap != null) {
          configMap.put("batchSize", config.batchSize());
          configMap.put("consumerThreads", config.consumerThreads());
          configMap.put("producerThreads", config.producerThreads());
          configMap.put("queueSize", config.queueSize());
          configMap.put("maxConcurrentRequests", config.maxConcurrentRequests());
          configMap.put("payLoadSize", config.payloadSize());
        }
        context.storeRunRecord(JsonUtils.pojoToJson(appRecord));
      }
    } catch (Exception e) {
      LOG.warn("Failed to update run record with auto-tuned config", e);
    }
  }

  private void saveResultMetadataToJobRecord(Map<String, Object> metadata) {
    try {
      AppRunRecord appRecord = context.getJobRecord();
      SuccessContext successContext = appRecord.getSuccessContext();
      if (successContext == null) {
        successContext = new SuccessContext();
      }

      for (Map.Entry<String, Object> entry : metadata.entrySet()) {
        successContext.withAdditionalProperty(entry.getKey(), entry.getValue());
      }

      if (jobData.getStats() != null) {
        successContext.withAdditionalProperty("stats", jobData.getStats());
      }

      appRecord.setSuccessContext(successContext);
      context.storeRunRecord(JsonUtils.pojoToJson(appRecord));
    } catch (Exception e) {
      LOG.error("Failed to save result metadata to job record", e);
    }
  }

  private void handleExecutionException(Exception ex) {
    IndexingStrategy strategy = this.activeStrategy;
    if (strategy != null && jobData != null) {
      try {
        strategy.getStats().ifPresent(jobData::setStats);
      } catch (Exception e) {
        LOG.debug("Could not capture strategy stats during exception handling", e);
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

  private void finalizeJobExecution() {
    sendUpdates();

    if (stopped) {
      AppRunRecord appRecord = context.getJobRecord();
      appRecord.setStatus(AppRunRecord.Status.STOPPED);
      context.storeRunRecord(JsonUtils.pojoToJson(appRecord));
    }
  }

  private void sendUpdates() {
    try {
      updateRecordToDbAndNotify();
    } catch (Exception ex) {
      LOG.error("Failed to send updates", ex);
    }
  }

  private void updateRecordToDbAndNotify() {
    AppRunRecord appRecord = context.getJobRecord();
    appRecord.setStatus(AppRunRecord.Status.fromValue(jobData.getStatus().value()));

    if (jobData.getFailure() != null) {
      appRecord.setFailureContext(
          new FailureContext().withAdditionalProperty("failure", jobData.getFailure()));
    }

    if (jobData.getStats() != null) {
      SuccessContext successContext =
          new SuccessContext().withAdditionalProperty("stats", jobData.getStats());

      String distributedJobId = (String) resultMetadata.get("distributedJobId");

      try {
        UUID appId = context.getAppId();
        String jobIdStr =
            distributedJobId != null ? distributedJobId : (appId != null ? appId.toString() : null);
        if (jobIdStr != null) {
          int failureCount = collectionDAO.searchIndexFailureDAO().countByJobId(jobIdStr);
          if (failureCount > 0) {
            successContext.withAdditionalProperty("failureRecordCount", failureCount);
          }
        }
      } catch (Exception e) {
        LOG.debug("Could not get failure count", e);
      }

      Object serverStats = resultMetadata.get("serverStats");
      if (serverStats != null) {
        successContext.withAdditionalProperty("serverStats", serverStats);
        successContext.withAdditionalProperty("serverCount", resultMetadata.get("serverCount"));
        successContext.withAdditionalProperty("distributedJobId", distributedJobId);
      }

      appRecord.setSuccessContext(successContext);
    }

    if (WebSocketManager.getInstance() != null) {
      String messageJson = JsonUtils.pojoToJson(appRecord);
      WebSocketManager.getInstance()
          .broadCastMessageToAll(SEARCH_INDEX_JOB_BROADCAST_CHANNEL, messageJson);
    }
  }

  private void cleanupOldFailures() {
    try {
      int deleted = collectionDAO.searchIndexFailureDAO().deleteAll();
      if (deleted > 0) {
        LOG.info("Cleaned up {} failure records from previous runs", deleted);
      }
    } catch (Exception e) {
      LOG.warn("Failed to cleanup old failure records", e);
    }
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
        SearchIndexApp.TIME_SERIES_ENTITIES.stream()
            .filter(t -> searchRepository.getEntityIndexMap().containsKey(t))
            .toList());
    return entities;
  }

  private boolean hasSlackConfig() {
    return jobData.getSlackBotToken() != null
        && !jobData.getSlackBotToken().isEmpty()
        && jobData.getSlackChannel() != null
        && !jobData.getSlackChannel().isEmpty();
  }

  private long countTotalEntities() {
    long total = 0;
    for (String entityType : jobData.getEntities()) {
      try {
        if (!SearchIndexApp.TIME_SERIES_ENTITIES.contains(entityType)) {
          total +=
              Entity.getEntityRepository(entityType)
                  .getDao()
                  .listCount(
                      new org.openmetadata.service.jdbi3.ListFilter(
                          org.openmetadata.schema.type.Include.ALL));
        }
      } catch (Exception e) {
        LOG.debug("Could not count entities for {}: {}", entityType, e.getMessage());
      }
    }
    return total;
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
}
