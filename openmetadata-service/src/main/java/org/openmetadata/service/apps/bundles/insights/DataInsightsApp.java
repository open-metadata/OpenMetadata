package org.openmetadata.service.apps.bundles.insights;

import static org.openmetadata.service.apps.scheduler.AppScheduler.ON_DEMAND_JOB;
import static org.openmetadata.service.apps.scheduler.OmAppJobListener.APP_RUN_STATS;
import static org.openmetadata.service.apps.scheduler.OmAppJobListener.WEBSOCKET_STATUS_CHANNEL;
import static org.openmetadata.service.socket.WebSocketManager.DATA_INSIGHTS_JOB_BROADCAST_CHANNEL;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.getInitialStatsForEntities;

import es.co.elastic.clients.transport.rest5_client.low_level.Rest5Client;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.function.Supplier;
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
import org.openmetadata.schema.system.EntityError;
import org.openmetadata.schema.system.EntityStats;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.AbstractNativeApplication;
import org.openmetadata.service.apps.bundles.insights.search.DataInsightsSearchInterface;
import org.openmetadata.service.apps.bundles.insights.search.elasticsearch.ElasticSearchDataInsightsClient;
import org.openmetadata.service.apps.bundles.insights.search.opensearch.OpenSearchDataInsightsClient;
import org.openmetadata.service.apps.bundles.insights.utils.TimestampUtils;
import org.openmetadata.service.apps.bundles.insights.workflows.WorkflowStats;
import org.openmetadata.service.apps.bundles.insights.workflows.costAnalysis.CostAnalysisWorkflow;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.DataAssetsWorkflow;
import org.openmetadata.service.apps.bundles.insights.workflows.dataQuality.DataQualityWorkflow;
import org.openmetadata.service.apps.bundles.insights.workflows.webAnalytics.WebAnalyticsWorkflow;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.socket.WebSocketManager;
import org.quartz.JobExecutionContext;

@Slf4j
public class DataInsightsApp extends AbstractNativeApplication {
  public static final String DATA_ASSET_INDEX_PREFIX = "di-data-assets";
  private static final String DATA_INSIGHTS_LOG_PREFIX = "[Data Insights]";
  private static final String UNKNOWN_TRIGGER_TYPE = "unknown";
  private static final String PHASE_COMPLETED_LOG =
      "{} Phase completed: phase={}, elapsedMs={}, total={}, success={}, failed={}";
  private static final String PHASE_COMPLETED_WITH_ERRORS_LOG =
      "{} Phase completed with errors: phase={}, elapsedMs={}, total={}, success={}, failed={}, failureCount={}";
  private static final String RUN_COMPLETED_LOG =
      "{} Lifecycle run completed: status={}, elapsedMs={}, total={}, success={}, failed={}";
  private static final String RUN_FAILED_LOG =
      "{} Lifecycle run finished with failure: status={}, elapsedMs={}, total={}, success={}, failed={}";
  private static final String RUN_STOPPED_LOG =
      "{} Lifecycle run stopped: status={}, elapsedMs={}, total={}, success={}, failed={}";
  @Getter private Long timestamp;
  @Getter private int batchSize;

  public record Backfill(String startDate, String endDate) {}

  private record LogSummary(
      long elapsedMs, int totalRecords, int successRecords, int failedRecords) {}

  private CostAnalysisConfig costAnalysisConfig;
  private DataAssetsConfig dataAssetsConfig;
  private DataQualityConfig dataQualityConfig;
  private AppAnalyticsConfig webAnalyticsConfig;

  private Optional<Boolean> recreateDataAssetsIndex;

  @Getter private Optional<Backfill> backfill;
  @Getter EventPublisherJob jobData;
  private volatile boolean stopped = false;
  private volatile DataAssetsWorkflow activeDataAssetsWorkflow;

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
    long runStartedAt = System.currentTimeMillis();
    String runType =
        Optional.ofNullable(
                (String) jobExecutionContext.getJobDetail().getJobDataMap().get("triggerType"))
            .orElse(UNKNOWN_TRIGGER_TYPE);

    try {
      initializeJob();
      LOG.info(
          "{} Lifecycle run started: triggerType={}, batchSize={}, timestamp={}",
          DATA_INSIGHTS_LOG_PREFIX,
          runType,
          batchSize,
          timestamp);

      jobData.setStatus(EventPublisherJob.Status.RUNNING);

      if (!ON_DEMAND_JOB.equals(runType)) {
        backfill = Optional.empty();
        recreateDataAssetsIndex = Optional.empty();
      }

      LOG.info(
          "{} Effective run settings: backfill={}, recreateDataAssetsIndex={}",
          DATA_INSIGHTS_LOG_PREFIX,
          formatBackfill(),
          Boolean.TRUE.equals(recreateDataAssetsIndex.orElse(false)));

      if (Boolean.TRUE.equals(recreateDataAssetsIndex.orElse(false))) {
        long recreatePhaseStartedAt = System.currentTimeMillis();
        LOG.info("{} Phase started: recreateDataAssetsIndex", DATA_INSIGHTS_LOG_PREFIX);
        deleteDataAssetsDataStream();
        createOrUpdateDataAssetsDataStream();
        deleteDataQualityDataIndex();
        createDataQualityDataIndex();
        LOG.info(
            "{} Phase completed: recreateDataAssetsIndex, elapsedMs={}",
            DATA_INSIGHTS_LOG_PREFIX,
            System.currentTimeMillis() - recreatePhaseStartedAt);
      }

      WorkflowStats webAnalyticsStats = runWorkflowPhase("webAnalytics", this::processWebAnalytics);
      updateJobStatsWithWorkflowStats(webAnalyticsStats);

      WorkflowStats costAnalysisStats = runWorkflowPhase("costAnalysis", this::processCostAnalysis);
      updateJobStatsWithWorkflowStats(costAnalysisStats);

      WorkflowStats dataAssetsStats = runWorkflowPhase("dataAssets", this::processDataAssets);
      updateJobStatsWithWorkflowStats(dataAssetsStats);

      WorkflowStats dataQualityStats = runWorkflowPhase("dataQuality", this::processDataQuality);
      updateJobStatsWithWorkflowStats(dataQualityStats);

      recordWorkflowFailures(
          List.of(webAnalyticsStats, costAnalysisStats, dataAssetsStats, dataQualityStats));

      updateJobStatus();
    } catch (Exception ex) {
      LOG.error("{} Lifecycle run failed during execution", DATA_INSIGHTS_LOG_PREFIX, ex);
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
      logFinalRunSummary(runStartedAt);
      sendUpdates(jobExecutionContext);
    }
  }

  private void initializeJob() {
    timestamp = TimestampUtils.getStartOfDayTimestamp(System.currentTimeMillis());
  }

  private WorkflowStats processWebAnalytics() {
    WebAnalyticsWorkflow workflow =
        new WebAnalyticsWorkflow(webAnalyticsConfig, timestamp, batchSize, backfill);
    WorkflowStats workflowStats = workflow.getWorkflowStats();
    workflow.process();
    return workflowStats;
  }

  private WorkflowStats processCostAnalysis() {
    CostAnalysisWorkflow workflow =
        new CostAnalysisWorkflow(costAnalysisConfig, timestamp, batchSize, backfill);
    WorkflowStats workflowStats = workflow.getWorkflowStats();

    try {
      workflow.process();
    } catch (SearchIndexException ex) {
      recordSearchIndexFailure("costAnalysis", workflowStats, ex);
    }

    return workflowStats;
  }

  private WorkflowStats processDataAssets() {
    DataAssetsWorkflow workflow =
        new DataAssetsWorkflow(
            dataAssetsConfig,
            timestamp,
            batchSize,
            backfill,
            dataAssetTypes,
            collectionDAO,
            searchRepository,
            getSearchInterface());
    WorkflowStats workflowStats = workflow.getWorkflowStats();

    this.activeDataAssetsWorkflow = workflow;
    try {
      workflow.process();
    } catch (SearchIndexException ex) {
      recordSearchIndexFailure("dataAssets", workflowStats, ex);
    } finally {
      this.activeDataAssetsWorkflow = null;
    }

    return workflowStats;
  }

  private WorkflowStats processDataQuality() {
    WorkflowStats dataQualityStats = new WorkflowStats("DataQualityWorkflow");
    for (String entityType : dataQualityEntities) {
      DataQualityWorkflow workflow =
          new DataQualityWorkflow(
              dataQualityConfig,
              timestamp,
              batchSize,
              backfill,
              entityType,
              collectionDAO,
              searchRepository);
      WorkflowStats workflowStats = workflow.getWorkflowStats();

      try {
        workflow.process();
      } catch (SearchIndexException ex) {
        recordSearchIndexFailure("dataQuality:" + entityType, workflowStats, ex);
      }
      dataQualityStats.merge(workflowStats);
    }

    return dataQualityStats;
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

  private WorkflowStats runWorkflowPhase(String phaseName, Supplier<WorkflowStats> workflowRunner) {
    long phaseStartedAt = System.currentTimeMillis();
    LOG.info("{} Phase started: {}", DATA_INSIGHTS_LOG_PREFIX, phaseName);
    try {
      WorkflowStats workflowStats = workflowRunner.get();
      logWorkflowPhaseSummary(phaseName, workflowStats, phaseStartedAt);
      return workflowStats;
    } catch (RuntimeException ex) {
      LOG.error("{} Phase failed: {}", DATA_INSIGHTS_LOG_PREFIX, phaseName, ex);
      throw ex;
    }
  }

  private void logWorkflowPhaseSummary(
      String phaseName, WorkflowStats workflowStats, long phaseStartedAt) {
    LogSummary summary = buildLogSummary(workflowStats.getWorkflowStats(), phaseStartedAt);
    if (workflowStats.hasFailed()) {
      logPhaseCompletedWithErrors(phaseName, summary, workflowStats.getFailures().size());
      return;
    }
    logPhaseCompleted(phaseName, summary);
  }

  private void logFinalRunSummary(long runStartedAt) {
    LogSummary summary = buildLogSummary(getJobStats(), runStartedAt);
    EventPublisherJob.Status status = jobData.getStatus();
    if (status == EventPublisherJob.Status.FAILED) {
      logRunFailed(status, summary);
      return;
    }
    if (status == EventPublisherJob.Status.STOPPED) {
      logRunInfo(RUN_STOPPED_LOG, status, summary);
      return;
    }
    logRunInfo(RUN_COMPLETED_LOG, status, summary);
  }

  private void logPhaseCompleted(String phaseName, LogSummary summary) {
    LOG.info(
        PHASE_COMPLETED_LOG,
        DATA_INSIGHTS_LOG_PREFIX,
        phaseName,
        summary.elapsedMs(),
        summary.totalRecords(),
        summary.successRecords(),
        summary.failedRecords());
  }

  private void logPhaseCompletedWithErrors(String phaseName, LogSummary summary, int failureCount) {
    LOG.warn(
        PHASE_COMPLETED_WITH_ERRORS_LOG,
        DATA_INSIGHTS_LOG_PREFIX,
        phaseName,
        summary.elapsedMs(),
        summary.totalRecords(),
        summary.successRecords(),
        summary.failedRecords(),
        failureCount);
  }

  private void logRunFailed(EventPublisherJob.Status status, LogSummary summary) {
    LOG.error(
        RUN_FAILED_LOG,
        DATA_INSIGHTS_LOG_PREFIX,
        status,
        summary.elapsedMs(),
        summary.totalRecords(),
        summary.successRecords(),
        summary.failedRecords());
  }

  private void logRunInfo(String logTemplate, EventPublisherJob.Status status, LogSummary summary) {
    LOG.info(
        logTemplate,
        DATA_INSIGHTS_LOG_PREFIX,
        status,
        summary.elapsedMs(),
        summary.totalRecords(),
        summary.successRecords(),
        summary.failedRecords());
  }

  private void recordWorkflowFailures(List<WorkflowStats> workflowStats) {
    if (workflowStats.stream().noneMatch(WorkflowStats::hasFailed)) {
      return;
    }

    IndexingError indexingError = buildWorkflowFailureError(workflowStats);
    LOG.error(
        "{} Lifecycle run detected workflow failures:{}{}",
        DATA_INSIGHTS_LOG_PREFIX,
        System.lineSeparator(),
        indexingError.getMessage());
    setJobFailedWithWorkflowFailure(indexingError);
  }

  private IndexingError buildWorkflowFailureError(List<WorkflowStats> workflowStats) {
    return new IndexingError()
        .withErrorSource(IndexingError.ErrorSource.JOB)
        .withMessage(buildWorkflowFailureMessage(workflowStats));
  }

  private String buildWorkflowFailureMessage(List<WorkflowStats> workflowStats) {
    StringBuilder errorMessage = new StringBuilder("Errors Found:\n");
    for (WorkflowStats stats : workflowStats) {
      if (stats.hasFailed()) {
        errorMessage.append("\n  ").append(stats.getName()).append("\n");
        for (String failure : stats.getFailures()) {
          errorMessage.append("    - ").append(failure).append("\n");
        }
      }
    }
    return errorMessage.toString();
  }

  private void recordSearchIndexFailure(
      String phaseName, WorkflowStats workflowStats, SearchIndexException ex) {
    LOG.error("{} Phase failed: {}", DATA_INSIGHTS_LOG_PREFIX, phaseName, ex);
    IndexingError indexingError = getSearchIndexError(ex);
    workflowStats.addFailure(formatSearchIndexFailure(phaseName, indexingError));
    setJobFailed(indexingError);
  }

  private IndexingError getSearchIndexError(SearchIndexException ex) {
    if (ex.getIndexingError() != null) {
      return ex.getIndexingError();
    }
    return new IndexingError()
        .withErrorSource(IndexingError.ErrorSource.JOB)
        .withMessage(ExceptionUtils.getMessage(ex));
  }

  private String formatSearchIndexFailure(String phaseName, IndexingError indexingError) {
    return String.format("Failed processing %s: %s", phaseName, indexingError.getMessage());
  }

  private void setJobFailed(IndexingError indexingError) {
    jobData.setStatus(EventPublisherJob.Status.FAILED);
    jobData.setFailure(indexingError);
  }

  private void setJobFailedWithWorkflowFailure(IndexingError workflowFailure) {
    jobData.setStatus(EventPublisherJob.Status.FAILED);
    jobData.setFailure(mergeWithExistingFailure(workflowFailure));
  }

  private IndexingError mergeWithExistingFailure(IndexingError workflowFailure) {
    IndexingError existingFailure = jobData.getFailure();
    if (existingFailure == null) {
      return workflowFailure;
    }
    IndexingError mergedFailure = copyIndexingError(existingFailure);
    mergedFailure.setMessage(
        buildMergedFailureMessage(existingFailure.getMessage(), workflowFailure.getMessage()));
    if (mergedFailure.getErrorSource() == null) {
      mergedFailure.setErrorSource(workflowFailure.getErrorSource());
    }
    return mergedFailure;
  }

  private IndexingError copyIndexingError(IndexingError indexingError) {
    IndexingError copy =
        new IndexingError()
            .withErrorSource(indexingError.getErrorSource())
            .withLastFailedCursor(indexingError.getLastFailedCursor())
            .withMessage(indexingError.getMessage())
            .withFailedEntities(copyFailedEntities(indexingError))
            .withReason(indexingError.getReason())
            .withStackTrace(indexingError.getStackTrace())
            .withSubmittedCount(indexingError.getSubmittedCount())
            .withSuccessCount(indexingError.getSuccessCount())
            .withFailedCount(indexingError.getFailedCount());
    indexingError.getAdditionalProperties().forEach(copy::setAdditionalProperty);
    return copy;
  }

  private List<EntityError> copyFailedEntities(IndexingError indexingError) {
    if (indexingError.getFailedEntities() == null) {
      return null;
    }
    return new ArrayList<>(indexingError.getFailedEntities());
  }

  private String buildMergedFailureMessage(String existingMessage, String workflowMessage) {
    if (existingMessage == null || existingMessage.isBlank()) {
      return workflowMessage;
    }
    if (workflowMessage == null || workflowMessage.isBlank()) {
      return existingMessage;
    }
    return existingMessage + System.lineSeparator() + System.lineSeparator() + workflowMessage;
  }

  private LogSummary buildLogSummary(StepStats stats, long startedAt) {
    if (stats == null) {
      return buildEmptyLogSummary(startedAt);
    }
    long elapsedMs = System.currentTimeMillis() - startedAt;
    return new LogSummary(
        elapsedMs,
        getStepStatValue(stats.getTotalRecords()),
        getStepStatValue(stats.getSuccessRecords()),
        getStepStatValue(stats.getFailedRecords()));
  }

  private LogSummary buildEmptyLogSummary(long startedAt) {
    return new LogSummary(System.currentTimeMillis() - startedAt, 0, 0, 0);
  }

  private StepStats getJobStats() {
    return jobData.getStats() != null ? jobData.getStats().getJobStats() : null;
  }

  private String formatBackfill() {
    return backfill
        .map(value -> String.format("%s..%s", value.startDate(), value.endDate()))
        .orElse("disabled");
  }

  private int getStepStatValue(Integer value) {
    return value == null ? 0 : value;
  }

  @Override
  protected void stop() {
    this.stopped = true;
    DataAssetsWorkflow workflow = this.activeDataAssetsWorkflow;
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
