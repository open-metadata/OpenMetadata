package org.openmetadata.service.apps.bundles.insights;

import static org.openmetadata.service.apps.scheduler.AppScheduler.ON_DEMAND_JOB;
import static org.openmetadata.service.apps.scheduler.OmAppJobListener.APP_RUN_STATS;
import static org.openmetadata.service.apps.scheduler.OmAppJobListener.WEBSOCKET_STATUS_CHANNEL;
import static org.openmetadata.service.socket.WebSocketManager.DATA_INSIGHTS_JOB_BROADCAST_CHANNEL;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.getInitialStatsForEntities;

import es.org.elasticsearch.client.RestClient;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang.exception.ExceptionUtils;
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
  public static final String REPORT_DATA_TYPE_KEY = "ReportDataType";
  public static final String DATA_ASSET_INDEX_PREFIX = "di-data-assets";
  @Getter private Long timestamp;
  @Getter private int batchSize;

  public record Backfill(String startDate, String endDate) {}

  private CostAnalysisConfig costAnalysisConfig;
  private DataAssetsConfig dataAssetsConfig;
  private DataQualityConfig dataQualityConfig;
  private AppAnalyticsConfig webAnalyticsConfig;

  private Optional<Boolean> recreateDataAssetsIndex;

  @Getter private Optional<Backfill> backfill;
  @Getter EventPublisherJob jobData;
  private volatile boolean stopped = false;

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
          "tag");

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
              (RestClient) searchRepository.getSearchClient().getLowLevelClient(),
              searchRepository.getClusterAlias());
    } else {
      searchInterface =
          new OpenSearchDataInsightsClient(
              (os.org.opensearch.client.RestClient)
                  searchRepository.getSearchClient().getLowLevelClient(),
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
      LOG.info(String.format("[Data Insights] Creating Index for Entity Type: '%s'", entityType));
      searchRepository.createIndex(resultIndexType);
    }
    DataInsightsSearchInterface searchInterface = getSearchInterface();
    if (!searchInterface.dataAssetDataStreamExists(
        getDataStreamName(searchRepository.getClusterAlias(), entityType))) {
      LOG.info(String.format("[Data Insights] Creating Index for Entity Type: '%s'", entityType));
      searchRepository
          .getSearchClient()
          .addIndexAlias(
              resultIndexType, getDataStreamName(searchRepository.getClusterAlias(), entityType));
    }
  }

  private void deleteIndexInternal(String entityType) {
    IndexMapping resultIndexType = searchRepository.getIndexMapping(entityType);
    if (searchRepository.indexExists(resultIndexType)) {
      LOG.info(String.format("[Data Insights] Deleting Index for Entity Type: '%s'", entityType));
      searchRepository.deleteIndex(resultIndexType);
    }
  }

  private void createDataQualityDataIndex() {
    try {
      createIndexInternal(Entity.TEST_CASE_RESULT);
      createIndexInternal(Entity.TEST_CASE_RESOLUTION_STATUS);
    } catch (IOException ex) {
      LOG.error(
          "Couldn't install DataInsightsApp: Can't initialize ElasticSearch Index for DataQuality.",
          ex);
    }
  }

  private void deleteDataQualityDataIndex() {
    deleteIndexInternal(Entity.TEST_CASE_RESULT);
    deleteIndexInternal(Entity.TEST_CASE_RESOLUTION_STATUS);
  }

  private void createOrUpdateDataAssetsDataStream() {
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

  private void deleteDataAssetsDataStream() {
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
    try {
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
        deleteDataQualityDataIndex();
        createDataQualityDataIndex();
      }

      WorkflowStats webAnalyticsStats = processWebAnalytics();
      updateJobStatsWithWorkflowStats(webAnalyticsStats);

      WorkflowStats costAnalysisStats = processCostAnalysis();
      updateJobStatsWithWorkflowStats(costAnalysisStats);

      WorkflowStats dataAssetsStats = processDataAssets();
      updateJobStatsWithWorkflowStats(dataAssetsStats);

      WorkflowStats dataQualityStats = processDataQuality();
      updateJobStatsWithWorkflowStats(dataQualityStats);

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

    try {
      workflow.process();
    } catch (SearchIndexException ex) {
      jobData.setStatus(EventPublisherJob.Status.FAILED);
      jobData.setFailure(ex.getIndexingError());
    }

    return workflowStats;
  }

  private WorkflowStats processCostAnalysis() {
    CostAnalysisWorkflow workflow =
        new CostAnalysisWorkflow(costAnalysisConfig, timestamp, batchSize, backfill);
    WorkflowStats workflowStats = workflow.getWorkflowStats();

    try {
      workflow.process();
    } catch (SearchIndexException ex) {
      jobData.setStatus(EventPublisherJob.Status.FAILED);
      jobData.setFailure(ex.getIndexingError());
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

    try {
      workflow.process();
    } catch (SearchIndexException ex) {
      jobData.setStatus(EventPublisherJob.Status.FAILED);
      jobData.setFailure(ex.getIndexingError());
    }

    return workflowStats;
  }

  private WorkflowStats processDataQuality() {
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

      try {
        workflow.process();
      } catch (SearchIndexException ex) {
        jobData.setStatus(EventPublisherJob.Status.FAILED);
        jobData.setFailure(ex.getIndexingError());
      }
    }

    return DataQualityWorkflow.getWorkflowStats();
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
