package org.openmetadata.service.apps.bundles.insights;

import static org.openmetadata.service.apps.scheduler.AppScheduler.ON_DEMAND_JOB;
import static org.openmetadata.service.apps.scheduler.OmAppJobListener.APP_RUN_STATS;
import static org.openmetadata.service.apps.scheduler.OmAppJobListener.WEBSOCKET_STATUS_CHANNEL;
import static org.openmetadata.service.socket.WebSocketManager.DATA_INSIGHTS_JOB_BROADCAST_CHANNEL;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.getInitialStatsForEntities;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.exception.ExceptionUtils;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.app.FailureContext;
import org.openmetadata.schema.entity.app.SuccessContext;
import org.openmetadata.schema.entity.applications.configuration.internal.AppAnalyticsConfig;
import org.openmetadata.schema.entity.applications.configuration.internal.BackfillConfiguration;
import org.openmetadata.schema.entity.applications.configuration.internal.CostAnalysisConfig;
import org.openmetadata.schema.entity.applications.configuration.internal.DataAssetsConfig;
import org.openmetadata.schema.entity.applications.configuration.internal.DataInsightsAppConfig;
import org.openmetadata.schema.entity.applications.configuration.internal.DataQualityConfig;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.system.EntityStats;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.AbstractNativeApplication;
import org.openmetadata.service.apps.bundles.insights.config.InsightsConfig;
import org.openmetadata.service.apps.bundles.insights.config.ProcessingPeriod;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.DataAssetsBackfillWorkflow;
import org.openmetadata.service.jdbi3.AppRepository;
import org.openmetadata.service.apps.bundles.insights.search.DataInsightsSearchInterface;
import org.openmetadata.service.apps.bundles.insights.search.IndexLifecycleManager;
import org.openmetadata.service.apps.bundles.insights.search.SearchComponentFactory;
import org.openmetadata.service.apps.bundles.insights.stats.WorkflowResult;
import org.openmetadata.service.apps.bundles.insights.utils.TimestampUtils;
import org.openmetadata.service.apps.bundles.insights.workflow.InsightsWorkflow;
import org.openmetadata.service.apps.bundles.insights.workflow.WorkflowRegistry;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.socket.WebSocketManager;
import org.quartz.JobExecutionContext;

@Slf4j
public class DataInsightsApp extends AbstractNativeApplication {
  public static final String DATA_ASSET_INDEX_PREFIX = "di-data-assets";
  private Long timestamp;
  private int batchSize;

  public record Backfill(String startDate, String endDate) {}

  private App appEntity;
  private CostAnalysisConfig costAnalysisConfig;
  private DataAssetsConfig dataAssetsConfig;
  private DataQualityConfig dataQualityConfig;
  private AppAnalyticsConfig webAnalyticsConfig;

  private Optional<Boolean> recreateDataAssetsIndex;

  private Optional<Backfill> backfill;
  @Getter EventPublisherJob jobData;
  private volatile boolean stopped = false;
  private volatile List<InsightsWorkflow> activeWorkflows;

  public final Set<String> dataAssetTypes =
      Set.of(
          "table",
          "storedProcedure",
          "databaseSchema",
          "database",
          "chart",
          "dashboard",
          "dashboardDataModel",
          "pipeline",
          "topic",
          "container",
          "searchIndex",
          "mlmodel",
          "dataProduct",
          "glossaryTerm",
          "tag",
          "metric");

  public final Set<String> dataQualityEntities =
      Set.of(Entity.TEST_CASE_RESULT, Entity.TEST_CASE_RESOLUTION_STATUS);

  public DataInsightsApp(CollectionDAO collectionDAO, SearchRepository searchRepository) {
    super(collectionDAO, searchRepository);
  }

  private DataInsightsSearchInterface getSearchInterface() {
    return new SearchComponentFactory(searchRepository).createSearchInterface();
  }

  public static String getDataStreamName(String prefix, String dataAssetType) {
    String dataStreamName =
        String.format("%s-%s", DATA_ASSET_INDEX_PREFIX, dataAssetType).toLowerCase();
    if (!(prefix == null || prefix.isEmpty())) {
      dataStreamName = String.format("%s-%s", prefix, dataStreamName);
    }
    return dataStreamName;
  }

  private void createIndexInternal(String entityType) throws IOException {
    IndexMapping resultIndexType = searchRepository.getIndexMapping(entityType);
    if (!searchRepository.indexExists(resultIndexType)) {
      LOG.info("[Data Insights] Creating Index for Entity Type: '{}'", entityType);
      searchRepository.createIndex(resultIndexType);
    }
    DataInsightsSearchInterface searchInterface = getSearchInterface();
    if (!searchInterface.dataAssetDataStreamExists(
        getDataStreamName(searchRepository.getClusterAlias(), entityType))) {
      LOG.info("[Data Insights] Creating Index for Entity Type: '{}'", entityType);
      searchRepository
          .getSearchClient()
          .addIndexAlias(
              resultIndexType, getDataStreamName(searchRepository.getClusterAlias(), entityType));
    }
  }

  private void deleteIndexInternal(String entityType) {
    IndexMapping resultIndexType = searchRepository.getIndexMapping(entityType);
    if (searchRepository.indexExists(resultIndexType)) {
      LOG.info("[Data Insights] Deleting Index for Entity Type: '{}'", entityType);
      searchRepository.deleteIndex(resultIndexType);
    }
  }

  public void createDataQualityDataIndex() {
    try {
      createIndexInternal(Entity.TEST_CASE_RESULT);
      createIndexInternal(Entity.TEST_CASE_RESOLUTION_STATUS);
    } catch (IOException ex) {
      LOG.error(
          "Couldn't install DataInsightsApp: Can't initialize ElasticSearch Index for DataQuality.",
          ex);
    }
  }

  public void deleteDataQualityDataIndex() {
    deleteIndexInternal(Entity.TEST_CASE_RESULT);
    deleteIndexInternal(Entity.TEST_CASE_RESOLUTION_STATUS);
  }

  public void createOrUpdateDataAssetsDataStream() {
    DataInsightsSearchInterface searchInterface = getSearchInterface();

    ElasticSearchConfiguration config = searchRepository.getSearchConfiguration();
    String language =
        config != null && config.getSearchIndexMappingLanguage() != null
            ? config.getSearchIndexMappingLanguage().value()
            : "en";

    try {
      for (String dataAssetType : dataAssetTypes) {
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
      for (String dataAssetType : dataAssetTypes) {
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
    this.appEntity = app;
    DataInsightsAppConfig config =
        JsonUtils.convertValue(app.getAppConfiguration(), DataInsightsAppConfig.class);
    JsonUtils.validateJsonSchema(config, DataInsightsAppConfig.class);
    // Get the configuration for the different modules
    costAnalysisConfig = config.getModuleConfiguration().getCostAnalysis();
    dataAssetsConfig = parseDataAssetsConfig(config.getModuleConfiguration().getDataAssets());
    dataQualityConfig = config.getModuleConfiguration().getDataQuality();
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
    createDataQualityDataIndex();

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
    try {
      timestamp = TimestampUtils.getStartOfDayTimestamp(System.currentTimeMillis());
      jobData.setStatus(EventPublisherJob.Status.RUNNING);
      LOG.info("Executing DataInsights Job with JobData: {}", jobData);

      InsightsConfig config = resolveConfig(jobExecutionContext);
      SearchComponentFactory searchFactory = new SearchComponentFactory(searchRepository);

      if (config.shouldRecreateDataAssets()) {
        new IndexLifecycleManager(searchFactory.createSearchInterface(), config.dataAssetTypes())
            .deleteAll();
        deleteDataQualityDataIndex();
        createDataQualityDataIndex();
      }

      List<InsightsWorkflow> workflows =
          WorkflowRegistry.createWorkflows(config, searchFactory, collectionDAO, searchRepository);

      this.activeWorkflows = workflows;

      List<WorkflowResult> results = new ArrayList<>();
      DataAssetsBackfillWorkflow backfillWorkflow = null;
      for (InsightsWorkflow workflow : workflows) {
        if (stopped) break;
        if (workflow instanceof DataAssetsBackfillWorkflow w) {
          backfillWorkflow = w;
        }
        results.add(workflow.execute());
      }
      this.activeWorkflows = null;

      if (backfillWorkflow != null) {
        persistBackfillProgress(jobExecutionContext, backfillWorkflow.getCompletedEntityTypes());
      }

      updateJobFromResults(results);
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
      sendUpdates(jobExecutionContext);
    }
  }

  private InsightsConfig resolveConfig(JobExecutionContext ctx) {
    String runType = (String) ctx.getJobDetail().getJobDataMap().get("triggerType");
    if (!ON_DEMAND_JOB.equals(runType)) {
      backfill = Optional.empty();
      recreateDataAssetsIndex = Optional.empty();
    }

    ProcessingPeriod steadyState = ProcessingPeriod.forSteadyState(timestamp, 30);
    Optional<ProcessingPeriod> backfillPeriod =
        backfill.map(b -> ProcessingPeriod.forBackfill(b.startDate(), b.endDate(), timestamp, 30));
    boolean recreate =
        recreateDataAssetsIndex.isPresent() && Boolean.TRUE.equals(recreateDataAssetsIndex.get());

    Optional<Set<String>> completedTypes = readBackfillCompletedTypes();
    Optional<Long> lastRunTs = readLastRunTimestamp();

    return new InsightsConfig(
        dataAssetsConfig,
        costAnalysisConfig,
        dataQualityConfig,
        webAnalyticsConfig,
        batchSize,
        recreate,
        backfillPeriod,
        steadyState,
        dataAssetTypes,
        dataQualityEntities,
        completedTypes,
        lastRunTs);
  }

  @SuppressWarnings("unchecked")
  private Optional<Set<String>> readBackfillCompletedTypes() {
    if (appEntity == null) return Optional.empty();
    try {
      AppRepository appRepository =
          (AppRepository) Entity.getEntityRepository(Entity.APPLICATION);
      Optional<AppRunRecord> lastRun = appRepository.getLatestAppRunsOptional(appEntity);
      if (lastRun.isEmpty() || lastRun.get().getSuccessContext() == null) return Optional.empty();
      Object raw =
          lastRun.get().getSuccessContext().getAdditionalProperties().get("backfillProgress");
      if (!(raw instanceof java.util.Map<?, ?> map)) return Optional.empty();
      Object types = map.get("completedEntityTypes");
      if (!(types instanceof java.util.Collection<?> col)) return Optional.empty();
      return Optional.of(
          col.stream().map(Object::toString).collect(java.util.stream.Collectors.toSet()));
    } catch (Exception e) {
      LOG.warn("[DataInsights] Could not read backfill progress from last run: {}", e.getMessage());
      return Optional.empty();
    }
  }

  private Optional<Long> readLastRunTimestamp() {
    if (appEntity == null) return Optional.empty();
    try {
      AppRepository appRepository =
          (AppRepository) Entity.getEntityRepository(Entity.APPLICATION);
      Optional<AppRunRecord> lastRun = appRepository.getLatestAppRunsOptional(appEntity);
      return lastRun
          .filter(r -> r.getStartTime() != null)
          .map(AppRunRecord::getStartTime);
    } catch (Exception e) {
      LOG.warn("[DataInsights] Could not read last run timestamp: {}", e.getMessage());
      return Optional.empty();
    }
  }

  private void persistBackfillProgress(
      JobExecutionContext jobExecutionContext, Set<String> completedTypes) {
    try {
      AppRunRecord appRecord = getJobRecord(jobExecutionContext);
      SuccessContext ctx =
          appRecord.getSuccessContext() != null
              ? appRecord.getSuccessContext()
              : new SuccessContext();
      ctx.withAdditionalProperty(
          "backfillProgress",
          java.util.Map.of("completedEntityTypes", completedTypes));
      appRecord.setSuccessContext(ctx);
      pushAppStatusUpdates(jobExecutionContext, appRecord, true);
    } catch (Exception e) {
      LOG.warn("[DataInsights] Could not persist backfill progress: {}", e.getMessage());
    }
  }

  private void updateJobFromResults(List<WorkflowResult> results) {
    IndexingError firstFailure = null;
    for (WorkflowResult result : results) {
      result.stepStats().forEach((stepName, stepStats) -> updateStats(stepName, stepStats));
      if (result.failed() && firstFailure == null && !result.failures().isEmpty()) {
        firstFailure = result.failures().getFirst();
      }
    }
    if (firstFailure != null) {
      jobData.setStatus(EventPublisherJob.Status.FAILED);
      jobData.setFailure(firstFailure);
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
    List<InsightsWorkflow> active = this.activeWorkflows;
    if (active != null) {
      active.forEach(InsightsWorkflow::stop);
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

    // Persist the run start time so the next run can use it as lastRunTimestamp for delta queries
    if (timestamp != null) {
      appRecord.setStartTime(timestamp);
    }

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
