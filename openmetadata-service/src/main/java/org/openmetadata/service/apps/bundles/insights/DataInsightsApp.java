package org.openmetadata.service.apps.bundles.insights;

import static org.openmetadata.service.apps.scheduler.AppScheduler.ON_DEMAND_JOB;
import static org.openmetadata.service.apps.scheduler.OmAppJobListener.APP_RUN_STATS;
import static org.openmetadata.service.apps.scheduler.OmAppJobListener.WEBSOCKET_STATUS_CHANNEL;
import static org.openmetadata.service.socket.WebSocketManager.DATA_INSIGHTS_JOB_BROADCAST_CHANNEL;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.getInitialStatsForEntities;

import es.co.elastic.clients.transport.rest5_client.low_level.Rest5Client;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Collectors;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.exception.ExceptionUtils;
import org.openmetadata.schema.dataInsight.custom.DataAssetType;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.app.FailureContext;
import org.openmetadata.schema.entity.app.SuccessContext;
import org.openmetadata.schema.entity.applications.configuration.internal.AppAnalyticsConfig;
import org.openmetadata.schema.entity.applications.configuration.internal.BackfillConfiguration;
import org.openmetadata.schema.entity.applications.configuration.internal.CostAnalysisConfig;
import org.openmetadata.schema.entity.applications.configuration.internal.DataAssetsConfig;
import org.openmetadata.schema.entity.applications.configuration.internal.DataInsightsAppConfig;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.system.EntityStats;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.apps.AbstractNativeApplication;
import org.openmetadata.service.apps.bundles.insights.search.DataInsightsSearchInterface;
import org.openmetadata.service.apps.bundles.insights.search.elasticsearch.ElasticSearchDataInsightsClient;
import org.openmetadata.service.apps.bundles.insights.search.opensearch.OpenSearchDataInsightsClient;
import org.openmetadata.service.apps.bundles.insights.utils.TimestampUtils;
import org.openmetadata.service.apps.bundles.insights.workflows.DataInsightsWorkflow;
import org.openmetadata.service.apps.bundles.insights.workflows.WorkflowStats;
import org.openmetadata.service.apps.bundles.insights.workflows.costAnalysis.CostAnalysisWorkflow;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.DataAssetsWorkflow;
import org.openmetadata.service.apps.bundles.insights.workflows.webAnalytics.WebAnalyticsWorkflow;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.ServerIdentityResolver;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.socket.WebSocketManager;
import org.quartz.JobExecutionContext;

@Slf4j
public class DataInsightsApp extends AbstractNativeApplication {
  public static final String DATA_ASSET_INDEX_PREFIX = "di-data-assets";
  private static final String JOB_LOCK_KEY = "native-app:data-insights";
  private static final long JOB_LOCK_TTL_MILLIS = TimeUnit.MINUTES.toMillis(5);
  private static final long JOB_LOCK_HEARTBEAT_SECONDS = 60;
  @Getter private Long timestamp;
  @Getter private int batchSize;

  public record Backfill(String startDate, String endDate) {}

  private CostAnalysisConfig costAnalysisConfig;
  private DataAssetsConfig dataAssetsConfig;
  private AppAnalyticsConfig webAnalyticsConfig;

  private Optional<Boolean> recreateDataAssetsIndex;

  @Getter private Optional<Backfill> backfill;
  @Getter EventPublisherJob jobData;
  private volatile boolean stopped = false;
  private final AtomicReference<DataInsightsWorkflow> activeWorkflow = new AtomicReference<>();

  /**
   * The entity types this app ingests: every {@link DataAssetType} that no live index aliases into
   * the Data Insights wildcard.
   *
   * <p>The data-quality types are deliberately excluded. They reach {@code di-data-assets-*} through
   * a {@code dataInsightAliases} entry in indexMapping.json that points at the live entity index, so
   * Data Insights reads them without ever writing them. Creating or deleting a datastream for one
   * would target that alias, and therefore live data, because {@link #getDataStreamName} would
   * produce the very name the alias already occupies.
   */
  public Set<String> getDataAssetTypes() {
    return Collections.unmodifiableSet(
        Arrays.stream(DataAssetType.values())
            .map(DataAssetType::value)
            .filter(dataAssetType -> !isAliasedFromLiveIndex(dataAssetType))
            .collect(Collectors.<String, LinkedHashSet<String>>toCollection(LinkedHashSet::new)));
  }

  private boolean isAliasedFromLiveIndex(String dataAssetType) {
    IndexMapping indexMapping = searchRepository.getIndexMapping(dataAssetType);
    return indexMapping != null
        && indexMapping.getDataInsightAliases() != null
        && !indexMapping.getDataInsightAliases().isEmpty();
  }

  public DataInsightsApp(CollectionDAO collectionDAO, SearchRepository searchRepository) {
    super(collectionDAO, searchRepository);
  }

  private DataInsightsSearchInterface getSearchInterface() {
    DataInsightsSearchInterface searchInterface;

    if (searchRepository
        .getSearchType()
        .equals(ElasticSearchConfiguration.SearchType.ELASTICSEARCH)) {
      searchInterface =
          new ElasticSearchDataInsightsClient(
              (Rest5Client) searchRepository.getSearchClient().getLowLevelClient(),
              searchRepository.getClusterAlias());
    } else {
      searchInterface =
          new OpenSearchDataInsightsClient(
              searchRepository.getSearchClient().getHighLevelClient(),
              searchRepository.getClusterAlias());
    }
    return searchInterface;
  }

  public static String getDataStreamName(String prefix, String dataAssetType) {
    String dataStreamName =
        String.format("%s-%s", DATA_ASSET_INDEX_PREFIX, dataAssetType).toLowerCase();
    if (!(prefix == null || prefix.isEmpty())) {
      dataStreamName = String.format("%s-%s", prefix, dataStreamName);
    }
    return dataStreamName;
  }

  public void createOrUpdateDataAssetsDataStream() {
    DataInsightsSearchInterface searchInterface = getSearchInterface();

    ElasticSearchConfiguration config = searchRepository.getSearchConfiguration();
    String language =
        config != null && config.getSearchIndexMappingLanguage() != null
            ? config.getSearchIndexMappingLanguage().value()
            : "en";

    try {
      for (String dataAssetType : getDataAssetTypes()) {
        IndexMapping dataAssetIndex = searchRepository.getIndexMapping(dataAssetType);
        String dataStreamName =
            getDataStreamName(searchRepository.getClusterAlias(), dataAssetType);
        if (!searchInterface.dataAssetDataStreamExists(dataStreamName)) {
          searchInterface.createDataAssetsDataStream(
              dataStreamName,
              dataAssetType,
              dataAssetIndex,
              language,
              dataAssetsConfig.getRetention());
        }
      }
    } catch (IOException ex) {
      LOG.error("Couldn't install DataInsightsApp: Can't initialize ElasticSearch Index.", ex);
    }
  }

  public void deleteDataAssetsDataStream() {
    DataInsightsSearchInterface searchInterface = getSearchInterface();

    try {
      for (String dataAssetType : getDataAssetTypes()) {
        String dataStreamName =
            getDataStreamName(searchRepository.getClusterAlias(), dataAssetType);
        if (searchInterface.dataAssetDataStreamExists(dataStreamName)) {
          searchInterface.deleteDataAssetDataStream(dataStreamName);
        }
      }
    } catch (IOException ex) {
      LOG.error("Couldn't delete DataAssets DataStream", ex);
    }
  }

  @Override
  public void init(App app) {
    super.init(app);
    DataInsightsAppConfig config =
        JsonUtils.convertValue(app.getAppConfiguration(), DataInsightsAppConfig.class);
    JsonUtils.validateJsonSchema(config, DataInsightsAppConfig.class);
    // Get the configuration for the different modules
    costAnalysisConfig = config.getModuleConfiguration().getCostAnalysis();
    dataAssetsConfig = parseDataAssetsConfig(config.getModuleConfiguration().getDataAssets());
    webAnalyticsConfig = config.getModuleConfiguration().getAppAnalytics();

    // Configure batchSize
    batchSize = config.getBatchSize();

    // Configure recreate
    recreateDataAssetsIndex = Optional.ofNullable(config.getRecreateDataAssetsIndex());

    // Configure Backfill
    Optional<BackfillConfiguration> backfillConfig =
        Optional.ofNullable(config.getBackfillConfiguration());

    backfill = Optional.empty();

    if (backfillConfig.isPresent() && backfillConfig.get().getEnabled()) {
      backfill =
          Optional.of(
              new Backfill(backfillConfig.get().getStartDate(), backfillConfig.get().getEndDate()));
    }

    createOrUpdateDataAssetsDataStream();

    jobData = new EventPublisherJob().withStats(new Stats());
  }

  private DataAssetsConfig parseDataAssetsConfig(DataAssetsConfig config) {
    if (config.getServiceFilter() != null
        && (config.getServiceFilter().getServiceName() == null
            || config.getServiceFilter().getServiceType() == null)) {
      return config.withServiceFilter(null);
    }
    return config;
  }

  @Override
  public void startApp(JobExecutionContext jobExecutionContext) {
    String lockJobId = createJobLockId(jobExecutionContext.getFireInstanceId());
    if (!tryAcquireJobLock(lockJobId)) {
      LOG.info("Skipping Data Insights run because another server holds the job lock");
      finishSkippedRun(jobExecutionContext);
      return;
    }
    ScheduledExecutorService heartbeat = null;
    try {
      stopped = false;
      heartbeat = startLockHeartbeat(lockJobId);
      initializeJob();

      LOG.info("Executing DataInsights Job with JobData: {}", jobData);
      jobData.setStatus(EventPublisherJob.Status.RUNNING);

      String runType =
          (String) jobExecutionContext.getJobDetail().getJobDataMap().get("triggerType");

      if (!runType.equals(ON_DEMAND_JOB)) {
        backfill = Optional.empty();
        recreateDataAssetsIndex = Optional.empty();
      }

      if (recreateDataAssetsIndex.isPresent() && recreateDataAssetsIndex.get().equals(true)) {
        deleteDataAssetsDataStream();
        createOrUpdateDataAssetsDataStream();
      }
      if (finishIfStopped()) {
        return;
      }

      WorkflowStats webAnalyticsStats = processWebAnalytics();
      updateJobStatsWithWorkflowStats(webAnalyticsStats);
      if (finishIfStopped()) {
        return;
      }

      WorkflowStats costAnalysisStats = processCostAnalysis();
      updateJobStatsWithWorkflowStats(costAnalysisStats);
      if (finishIfStopped()) {
        return;
      }

      WorkflowStats dataAssetsStats = processDataAssets();
      updateJobStatsWithWorkflowStats(dataAssetsStats);

      if (webAnalyticsStats.hasFailed()
          || costAnalysisStats.hasFailed()
          || dataAssetsStats.hasFailed()) {
        String errorMessage = "Errors Found:\n";

        for (WorkflowStats stats : List.of(webAnalyticsStats, costAnalysisStats, dataAssetsStats)) {
          if (stats.hasFailed()) {
            errorMessage = String.format("%s\n  %s\n", errorMessage, stats.getName());
            for (String failure : stats.getFailures()) {
              errorMessage = String.format("%s    - %s\n", errorMessage, failure);
            }
          }
        }

        IndexingError indexingError =
            new IndexingError()
                .withErrorSource(IndexingError.ErrorSource.JOB)
                .withMessage(errorMessage);
        LOG.error(indexingError.getMessage());
        jobData.setStatus(EventPublisherJob.Status.FAILED);
        jobData.setFailure(indexingError);
      }

      updateJobStatus();
    } catch (Exception ex) {
      IndexingError indexingError =
          new IndexingError()
              .withErrorSource(IndexingError.ErrorSource.JOB)
              .withMessage(
                  String.format(
                      "Data Insights Job Has Encountered an Exception. %n Job Data: %s, %n  Stack : %s ",
                      jobData.toString(), ExceptionUtils.getStackTrace(ex)));
      LOG.error(indexingError.getMessage());
      jobData.setStatus(EventPublisherJob.Status.FAILED);
      jobData.setFailure(indexingError);
    } finally {
      stopLockHeartbeat(heartbeat);
      releaseJobLock(lockJobId);
      sendUpdates(jobExecutionContext);
    }
  }

  static String createJobLockId(String fireInstanceId) {
    // search_reindex_lock.jobId is VARCHAR(36), while Quartz fire instance IDs are unbounded.
    UUID lockJobId =
        fireInstanceId == null
            ? UUID.randomUUID()
            : UUID.nameUUIDFromBytes(fireInstanceId.getBytes(StandardCharsets.UTF_8));
    return lockJobId.toString();
  }

  private boolean tryAcquireJobLock(String jobId) {
    long now = System.currentTimeMillis();
    try {
      return collectionDAO
          .searchReindexLockDAO()
          .tryAcquireLock(
              JOB_LOCK_KEY,
              jobId,
              ServerIdentityResolver.getInstance().getServerId(),
              now,
              now + JOB_LOCK_TTL_MILLIS);
    } catch (RuntimeException e) {
      LOG.error("Unable to acquire the Data Insights job lock", e);
      return false;
    }
  }

  private ScheduledExecutorService startLockHeartbeat(String jobId) {
    ScheduledExecutorService heartbeat =
        Executors.newSingleThreadScheduledExecutor(
            Thread.ofVirtual().name("data-insights-lock-heartbeat").factory());
    heartbeat.scheduleAtFixedRate(
        () -> refreshJobLock(jobId),
        JOB_LOCK_HEARTBEAT_SECONDS,
        JOB_LOCK_HEARTBEAT_SECONDS,
        TimeUnit.SECONDS);
    return heartbeat;
  }

  private void refreshJobLock(String jobId) {
    long now = System.currentTimeMillis();
    try {
      boolean refreshed =
          collectionDAO
              .searchReindexLockDAO()
              .refreshLock(
                  JOB_LOCK_KEY,
                  jobId,
                  ServerIdentityResolver.getInstance().getServerId(),
                  now,
                  now + JOB_LOCK_TTL_MILLIS);
      if (!refreshed) {
        LOG.error("Data Insights job lock was lost; stopping this run");
        stop();
      }
    } catch (RuntimeException e) {
      LOG.error("Unable to refresh the Data Insights job lock; stopping this run", e);
      stop();
    }
  }

  private void stopLockHeartbeat(ScheduledExecutorService heartbeat) {
    if (heartbeat != null) {
      heartbeat.shutdownNow();
    }
  }

  private boolean finishIfStopped() {
    if (!stopped) {
      return false;
    }
    updateJobStatus();
    return true;
  }

  private void finishSkippedRun(JobExecutionContext jobExecutionContext) {
    jobData.setStatus(EventPublisherJob.Status.STOPPED);
    sendUpdates(jobExecutionContext);
  }

  private void releaseJobLock(String jobId) {
    try {
      collectionDAO.searchReindexLockDAO().releaseLock(JOB_LOCK_KEY, jobId);
    } catch (RuntimeException e) {
      LOG.warn("Unable to release the Data Insights job lock {}", jobId, e);
    }
  }

  private void initializeJob() {
    timestamp = TimestampUtils.getStartOfDayTimestamp(System.currentTimeMillis());
  }

  private WorkflowStats processWebAnalytics() {
    return processWorkflow(
        new WebAnalyticsWorkflow(webAnalyticsConfig, timestamp, batchSize, backfill));
  }

  private WorkflowStats processCostAnalysis() {
    return processWorkflow(
        new CostAnalysisWorkflow(costAnalysisConfig, timestamp, batchSize, backfill));
  }

  private WorkflowStats processDataAssets() {
    return processWorkflow(
        new DataAssetsWorkflow(
            dataAssetsConfig,
            timestamp,
            batchSize,
            backfill,
            getDataAssetTypes(),
            collectionDAO,
            searchRepository,
            getSearchInterface()));
  }

  private WorkflowStats processWorkflow(DataInsightsWorkflow workflow) {
    WorkflowStats workflowStats = workflow.getWorkflowStats();
    activateWorkflow(workflow);
    try {
      if (!stopped) {
        workflow.process();
      }
    } catch (SearchIndexException ex) {
      jobData.setStatus(EventPublisherJob.Status.FAILED);
      jobData.setFailure(ex.getIndexingError());
    } finally {
      activeWorkflow.compareAndSet(workflow, null);
    }
    return workflowStats;
  }

  void activateWorkflow(DataInsightsWorkflow workflow) {
    activeWorkflow.set(workflow);
    if (stopped) {
      workflow.stop();
    }
  }

  private void updateJobStatsWithWorkflowStats(WorkflowStats workflowStats) {
    for (Map.Entry<String, StepStats> entry : workflowStats.getWorkflowStepStats().entrySet()) {
      String stepName = entry.getKey();
      StepStats stats = entry.getValue();
      updateStats(stepName, stats);
    }
  }

  private void updateJobStatus() {
    if (stopped) {
      jobData.setStatus(EventPublisherJob.Status.STOPPED);
    } else {
      if (jobData.getFailure() != null) {
        jobData.setStatus(EventPublisherJob.Status.FAILED);
      } else {
        jobData.setStatus(EventPublisherJob.Status.COMPLETED);
      }
    }
  }

  @Override
  protected void stop() {
    this.stopped = true;
    DataInsightsWorkflow workflow = activeWorkflow.get();
    if (workflow != null) {
      workflow.stop();
    }
  }

  public void updateStats(String entityType, StepStats currentEntityStats) {
    // Job Level Stats
    Stats jobDataStats = jobData.getStats();

    // Update Entity Level Stats
    EntityStats entityLevelStats = jobDataStats.getEntityStats();
    if (entityLevelStats == null) {
      entityLevelStats =
          new EntityStats()
              .withAdditionalProperty(
                  entityType,
                  new StepStats()
                      .withTotalRecords(null)
                      .withFailedRecords(null)
                      .withSuccessRecords(null));
    }
    entityLevelStats.withAdditionalProperty(entityType, currentEntityStats);

    // Total Stats
    StepStats stats = jobData.getStats().getJobStats();
    if (stats == null) {
      stats =
          new StepStats()
              .withTotalRecords(
                  getInitialStatsForEntities(jobData.getEntities())
                      .getJobStats()
                      .getTotalRecords());
    }

    stats.setTotalRecords(
        entityLevelStats.getAdditionalProperties().values().stream()
            .mapToInt(StepStats::getTotalRecords)
            .sum());

    stats.setSuccessRecords(
        entityLevelStats.getAdditionalProperties().values().stream()
            .mapToInt(StepStats::getSuccessRecords)
            .sum());
    stats.setFailedRecords(
        entityLevelStats.getAdditionalProperties().values().stream()
            .mapToInt(StepStats::getFailedRecords)
            .sum());

    // Update for the Job
    jobDataStats.setJobStats(stats);
    jobDataStats.setEntityStats(entityLevelStats);

    jobData.setStats(jobDataStats);
  }

  public void updateRecordToDbAndNotify(JobExecutionContext jobExecutionContext) {
    AppRunRecord appRecord = getJobRecord(jobExecutionContext);

    // Update Run Record with Status
    appRecord.setStatus(AppRunRecord.Status.fromValue(jobData.getStatus().value()));

    // Update Error
    if (jobData.getFailure() != null) {
      appRecord.setFailureContext(
          new FailureContext().withAdditionalProperty("failure", jobData.getFailure()));
    }

    // Update Stats
    if (jobData.getStats() != null) {
      appRecord.setSuccessContext(
          new SuccessContext().withAdditionalProperty("stats", jobData.getStats()));
    }

    if (WebSocketManager.getInstance() != null) {
      WebSocketManager.getInstance()
          .broadCastMessageToAll(
              DATA_INSIGHTS_JOB_BROADCAST_CHANNEL, JsonUtils.pojoToJson(appRecord));
    }

    pushAppStatusUpdates(jobExecutionContext, appRecord, true);
  }

  private void sendUpdates(JobExecutionContext jobExecutionContext) {
    try {
      // store job details in Database
      jobExecutionContext.getJobDetail().getJobDataMap().put(APP_RUN_STATS, jobData.getStats());
      jobExecutionContext
          .getJobDetail()
          .getJobDataMap()
          .put(WEBSOCKET_STATUS_CHANNEL, DATA_INSIGHTS_JOB_BROADCAST_CHANNEL);
      // Update Record to db
      updateRecordToDbAndNotify(jobExecutionContext);
    } catch (Exception ex) {
      LOG.error("Failed to send updated stats with WebSocket", ex);
    }
  }
}
