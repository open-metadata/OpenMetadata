package org.openmetadata.service.apps.bundles.insights;

import static org.openmetadata.service.apps.scheduler.AbstractOmAppJobListener.APP_RUN_STATS;
import static org.openmetadata.service.apps.scheduler.AppScheduler.ON_DEMAND_JOB;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.getTotalRequestToProcess;

import es.org.elasticsearch.client.RestClient;
import java.io.IOException;
import java.util.Map;
import java.util.Optional;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang.exception.ExceptionUtils;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.app.FailureContext;
import org.openmetadata.schema.entity.app.SuccessContext;
import org.openmetadata.schema.entity.applications.configuration.internal.BackfillConfiguration;
import org.openmetadata.schema.entity.applications.configuration.internal.DataInsightsAppConfig;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.service.apps.AbstractNativeApplication;
import org.openmetadata.service.apps.bundles.insights.search.DataInsightsSearchInterface;
import org.openmetadata.service.apps.bundles.insights.search.elasticsearch.ElasticSearchDataInsightsClient;
import org.openmetadata.service.apps.bundles.insights.search.opensearch.OpenSearchDataInsightsClient;
import org.openmetadata.service.apps.bundles.insights.utils.TimestampUtils;
import org.openmetadata.service.apps.bundles.insights.workflows.WorkflowStats;
import org.openmetadata.service.apps.bundles.insights.workflows.costAnalysis.CostAnalysisWorkflow;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.DataAssetsWorkflow;
import org.openmetadata.service.apps.bundles.insights.workflows.webAnalytics.WebAnalyticsWorkflow;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.socket.WebSocketManager;
import org.openmetadata.service.util.JsonUtils;
import org.quartz.JobExecutionContext;

@Slf4j
public class DataInsightsApp extends AbstractNativeApplication {
  public static final String REPORT_DATA_TYPE_KEY = "ReportDataType";
  @Getter private Long timestamp;
  @Getter private int batchSize;

  public record Backfill(String startDate, String endDate) {}

  @Getter private Optional<Backfill> backfill;
  @Getter EventPublisherJob jobData;
  private volatile boolean stopped = false;

  public DataInsightsApp(CollectionDAO collectionDAO, SearchRepository searchRepository) {
    super(collectionDAO, searchRepository);
  }

  private void createDataAssetsDataStream() {
    DataInsightsSearchInterface searchInterface;

    if (searchRepository
        .getSearchType()
        .equals(ElasticSearchConfiguration.SearchType.ELASTICSEARCH)) {
      searchInterface =
          new ElasticSearchDataInsightsClient(
              (RestClient) searchRepository.getSearchClient().getLowLevelClient());
    } else {
      searchInterface =
          new OpenSearchDataInsightsClient(
              (os.org.opensearch.client.RestClient)
                  searchRepository.getSearchClient().getLowLevelClient());
    }

    try {
      if (!searchInterface.dataAssetDataStreamExists("di-data-assets")) {
        searchInterface.createDataAssetsDataStream();
      }
    } catch (IOException ex) {
      LOG.error("Couldn't install DataInsightsApp: Can't initialize ElasticSearch Index.");
    }
  }

  @Override
  public void init(App app) {
    super.init(app);
    createDataAssetsDataStream();
    DataInsightsAppConfig config =
        JsonUtils.convertValue(app.getAppConfiguration(), DataInsightsAppConfig.class);

    // Configure batchSize
    batchSize = config.getBatchSize();

    // Configure Backfill
    Optional<BackfillConfiguration> backfillConfig =
        Optional.ofNullable(config.getBackfillConfiguration());

    backfill = Optional.empty();

    if (backfillConfig.isPresent() && backfillConfig.get().getEnabled()) {
      backfill =
          Optional.of(
              new Backfill(backfillConfig.get().getStartDate(), backfillConfig.get().getEndDate()));
    }

    jobData = new EventPublisherJob().withStats(new Stats());
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
      }

      processWebAnalytics(jobExecutionContext);
      processCostAnalysis(jobExecutionContext);
      processDataAssets(jobExecutionContext);

      updateJobStatus();
    } catch (Exception ex) {
      IndexingError indexingError =
          new IndexingError()
              .withErrorSource(IndexingError.ErrorSource.JOB)
              .withMessage(
                  String.format(
                      "Reindexing Job Has Encountered an Exception. %n Job Data: %s, %n  Stack : %s ",
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

  private void processWebAnalytics(JobExecutionContext jobExecutionContext) {
    WebAnalyticsWorkflow workflow = new WebAnalyticsWorkflow(timestamp, batchSize, backfill);
    try {
      workflow.process();
    } catch (SearchIndexException ex) {
      jobData.setStatus(EventPublisherJob.Status.FAILED);
      jobData.setFailure(ex.getIndexingError());
    } finally {
      WorkflowStats workflowStats = workflow.getWorkflowStats();
      for (Map.Entry<String, StepStats> entry : workflowStats.getWorkflowStepStats().entrySet()) {
        String stepName = entry.getKey();
        StepStats stats = entry.getValue();
        updateStats(stepName, stats);
      }
      sendUpdates(jobExecutionContext);
    }
  }

  private void processCostAnalysis(JobExecutionContext jobExecutionContext) {
    // TODO: Actually implement Backfill
    CostAnalysisWorkflow workflow = new CostAnalysisWorkflow(timestamp, batchSize, backfill);
    try {
      workflow.process();
    } catch (SearchIndexException ex) {
      jobData.setStatus(EventPublisherJob.Status.FAILED);
      jobData.setFailure(ex.getIndexingError());
    } finally {
      WorkflowStats workflowStats = workflow.getWorkflowStats();
      for (Map.Entry<String, StepStats> entry : workflowStats.getWorkflowStepStats().entrySet()) {
        String stepName = entry.getKey();
        StepStats stats = entry.getValue();
        updateStats(stepName, stats);
      }
      sendUpdates(jobExecutionContext);
    }
  }

  private void processDataAssets(JobExecutionContext jobExecutionContext) {
    DataAssetsWorkflow workflow =
        new DataAssetsWorkflow(timestamp, batchSize, backfill, collectionDAO, searchRepository);
    try {
      workflow.process();
    } catch (SearchIndexException ex) {
      jobData.setStatus(EventPublisherJob.Status.FAILED);
      jobData.setFailure(ex.getIndexingError());
    } finally {
      WorkflowStats workflowStats = workflow.getWorkflowStats();
      for (Map.Entry<String, StepStats> entry : workflowStats.getWorkflowStepStats().entrySet()) {
        String stepName = entry.getKey();
        StepStats stats = entry.getValue();
        updateStats(stepName, stats);
      }
      sendUpdates(jobExecutionContext);
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
    StepStats entityLevelStats = jobDataStats.getEntityStats();
    if (entityLevelStats == null) {
      entityLevelStats =
          new StepStats().withTotalRecords(null).withFailedRecords(null).withSuccessRecords(null);
    }
    entityLevelStats.withAdditionalProperty(entityType, currentEntityStats);

    // Total Stats
    StepStats stats = jobData.getStats().getJobStats();
    if (stats == null) {
      stats =
          new StepStats()
              .withTotalRecords(getTotalRequestToProcess(jobData.getEntities(), collectionDAO));
    }

    stats.setTotalRecords(
        entityLevelStats.getAdditionalProperties().values().stream()
            .map(s -> (StepStats) s)
            .mapToInt(StepStats::getTotalRecords)
            .sum());

    stats.setSuccessRecords(
        entityLevelStats.getAdditionalProperties().values().stream()
            .map(s -> (StepStats) s)
            .mapToInt(StepStats::getSuccessRecords)
            .sum());
    stats.setFailedRecords(
        entityLevelStats.getAdditionalProperties().values().stream()
            .map(s -> (StepStats) s)
            .mapToInt(StepStats::getFailedRecords)
            .sum());

    // Update for the Job
    jobDataStats.setJobStats(stats);
    jobDataStats.setEntityStats(entityLevelStats);

    jobData.setStats(jobDataStats);
  }

  public void updateRecordToDb(JobExecutionContext jobExecutionContext) {
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

    pushAppStatusUpdates(jobExecutionContext, appRecord, true);
  }

  private void sendUpdates(JobExecutionContext jobExecutionContext) {
    try {
      // store job details in Database
      jobExecutionContext.getJobDetail().getJobDataMap().put(APP_RUN_STATS, jobData.getStats());
      // Update Record to db
      updateRecordToDb(jobExecutionContext);
      if (WebSocketManager.getInstance() != null) {
        WebSocketManager.getInstance()
            .broadCastMessageToAll(
                WebSocketManager.JOB_STATUS_BROADCAST_CHANNEL, JsonUtils.pojoToJson(jobData));
      }
    } catch (Exception ex) {
      LOG.error("Failed to send updated stats with WebSocket", ex);
    }
  }
}
