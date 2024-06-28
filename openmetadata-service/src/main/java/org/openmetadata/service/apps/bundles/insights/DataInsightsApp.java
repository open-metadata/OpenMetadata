package org.openmetadata.service.apps.bundles.insights;


import static org.openmetadata.schema.system.IndexingError.ErrorSource.READER;
import static org.openmetadata.service.apps.scheduler.AbstractOmAppJobListener.APP_RUN_STATS;
import static org.openmetadata.service.apps.scheduler.AppScheduler.ON_DEMAND_JOB;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.TIMESTAMP_KEY;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.getTotalRequestToProcess;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.apps.bundles.insights.processors.DataInsightsElasticSearchProcessor;
import org.openmetadata.service.apps.bundles.insights.processors.DataInsightsEntityEnricherProcessor;
import org.openmetadata.service.apps.bundles.insights.processors.DataInsightsOpenSearchProcessor;
import org.openmetadata.service.util.ResultList;
import org.apache.commons.lang.exception.ExceptionUtils;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.EntityTimeSeriesInterface;
import org.openmetadata.schema.analytics.ReportData;
import org.openmetadata.schema.api.services.ingestionPipelines.CreateIngestionPipeline;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.app.FailureContext;
import org.openmetadata.schema.entity.app.SuccessContext;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.entity.services.ingestionPipelines.AirflowConfig;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.metadataIngestion.MetadataToElasticSearchPipeline;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.AbstractNativeApplication;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.elasticsearch.ElasticSearchEntitiesProcessor;
import org.openmetadata.service.search.elasticsearch.ElasticSearchEntityTimeSeriesProcessor;
import org.openmetadata.service.search.elasticsearch.ElasticSearchIndexSink;
import org.openmetadata.service.search.opensearch.OpenSearchEntitiesProcessor;
import org.openmetadata.service.search.opensearch.OpenSearchEntityTimeSeriesProcessor;
import org.openmetadata.service.search.opensearch.OpenSearchIndexSink;
import org.openmetadata.service.socket.WebSocketManager;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.workflows.interfaces.Processor;
import org.openmetadata.service.workflows.interfaces.Sink;
import org.openmetadata.service.workflows.interfaces.Source;
import org.openmetadata.service.workflows.searchIndex.PaginatedEntitiesSource;
import org.openmetadata.service.workflows.searchIndex.PaginatedEntityTimeSeriesSource;
import org.quartz.JobExecutionContext;
import org.openmetadata.schema.system.Stats;

@Slf4j
public class DataInsightsApp extends AbstractNativeApplication {

  private static final String INGESTION_PIPELINE_NAME = "OpenMetadata_dataInsight";
  private static final String SERVICE_NAME = "OpenMetadata";
  private static final String SERVICE_TYPE = "Metadata";
  private static final String PIPELINE_DESCRIPTION = "OpenMetadata DataInsight Pipeline";

  private final List<Source> paginatedSources = new ArrayList<>();

  private Long timestamp;
  // TODO: Find a better way to set this configuration.
  private final int retentionDays = 30;
  private final int batchSize = 500;
  private Processor entityEnricher;
  private Processor entityProcessor;
  private Sink searchIndexSink;
  @Getter EventPublisherJob jobData;
  private volatile boolean stopped = false;

  public DataInsightsApp(CollectionDAO collectionDAO, SearchRepository searchRepository) {
    super(collectionDAO, searchRepository);
  }

  @Override
  public void install() {
    IngestionPipelineRepository ingestionPipelineRepository =
            (IngestionPipelineRepository) Entity.getEntityRepository(Entity.INGESTION_PIPELINE);

    try {
      bindExistingIngestionToApplication(ingestionPipelineRepository);
    } catch (EntityNotFoundException ex) {
      createAndBindIngestionPipeline(ingestionPipelineRepository);
    }
  }

  private void bindExistingIngestionToApplication(
          IngestionPipelineRepository ingestionPipelineRepository) {
    // Check if the Pipeline Already Exists
    String fqn = FullyQualifiedName.add(SERVICE_NAME, INGESTION_PIPELINE_NAME);
    IngestionPipeline storedPipeline =
            ingestionPipelineRepository.getByName(
                    null, fqn, ingestionPipelineRepository.getFields("id"));

    // Init Application Code for Some Initialization
    List<CollectionDAO.EntityRelationshipRecord> records =
            collectionDAO
                    .relationshipDAO()
                    .findTo(
                            getApp().getId(),
                            Entity.APPLICATION,
                            Relationship.HAS.ordinal(),
                            Entity.INGESTION_PIPELINE);

    if (records.isEmpty()) {
      // Add Ingestion Pipeline to Application
      collectionDAO
              .relationshipDAO()
              .insert(
                      getApp().getId(),
                      storedPipeline.getId(),
                      Entity.APPLICATION,
                      Entity.INGESTION_PIPELINE,
                      Relationship.HAS.ordinal());
    }
  }

  private void createAndBindIngestionPipeline(
          IngestionPipelineRepository ingestionPipelineRepository) {
    // Pipeline needs to be created
    EntityRepository<?> serviceRepository =
            Entity.getServiceEntityRepository(ServiceType.fromValue(SERVICE_TYPE));
    EntityReference service =
            serviceRepository
                    .getByName(null, SERVICE_NAME, serviceRepository.getFields("id"))
                    .getEntityReference();

    CreateIngestionPipeline createPipelineRequest =
            new CreateIngestionPipeline()
                    .withName(INGESTION_PIPELINE_NAME)
                    .withDisplayName(INGESTION_PIPELINE_NAME)
                    .withDescription(PIPELINE_DESCRIPTION)
                    .withPipelineType(PipelineType.DATA_INSIGHT)
                    // We're configuring Data Insights to use ES as a sink, so we apply ES in the config
                    .withSourceConfig(new SourceConfig().withConfig(new MetadataToElasticSearchPipeline()))
                    .withAirflowConfig(
                            new AirflowConfig()
                                    .withScheduleInterval(getApp().getAppSchedule().getCronExpression()))
                    .withService(service);

    // Get Pipeline
    IngestionPipeline dataInsightPipeline =
            getIngestionPipeline(
                    createPipelineRequest, String.format("%sBot", getApp().getName()), "admin")
                    .withProvider(ProviderType.USER);
    ingestionPipelineRepository.setFullyQualifiedName(dataInsightPipeline);
    ingestionPipelineRepository.initializeEntity(dataInsightPipeline);

    // Add Ingestion Pipeline to Application
    collectionDAO
            .relationshipDAO()
            .insert(
                    getApp().getId(),
                    dataInsightPipeline.getId(),
                    Entity.APPLICATION,
                    Entity.INGESTION_PIPELINE,
                    Relationship.HAS.ordinal());
  }
  @Override
  public void init(App app) {
    super.init(app);
    EventPublisherJob request = JsonUtils.convertValue(app.getAppConfiguration(), EventPublisherJob.class)
            .withStats(new Stats());
    request.setEntities(
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
                    "tag"
            )
    );
    request.setBatchSize((int) batchSize / retentionDays);
    jobData = request;
  }

  @Override
  public void startApp(JobExecutionContext jobExecutionContext) {
    try {
      initializeJob();
      LOG.info("Executing DataInsights Job with JobData: {}", jobData);
      jobData.setStatus(EventPublisherJob.Status.RUNNING);

//      String runType = (String) jobExecutionContext.getJobDetail().getJobDataMap().get("triggerType");
//
//      if (!runType.equals(ON_DEMAND_JOB)) {
//        jobData.setRecreateIndex(false);
//      }
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

  private Long getStartOfDayTimestamp(Long timestamp) {
    return (long) ((int) (timestamp / 1000 / 60 / 60 / 24)) * 1000 * 60 * 60 * 24;
  }
  private Long timestampSubtractDays(Long timestamp, int days) {
    return timestamp - 1000L * 60 * 60 * 24 * days;
  }

  private void initializeJob() {
    this.timestamp = getStartOfDayTimestamp(System.currentTimeMillis());
    int totalRecords = getTotalRequestToProcess(jobData.getEntities(), collectionDAO);
    this.jobData.setStats(
            new Stats()
                    .withJobStats(
                            new StepStats()
                                    .withTotalRecords(totalRecords)
                                    .withFailedRecords(0)
                                    .withSuccessRecords(0)));
    jobData
            .getEntities()
            .forEach(
                    entityType -> {
                      List<String> fields = List.of("*");
                      PaginatedEntitiesSource source =
                              new PaginatedEntitiesSource(entityType, jobData.getBatchSize(), fields);
                      if (!CommonUtil.nullOrEmpty(jobData.getAfterCursor())) {
                        source.setCursor(jobData.getAfterCursor());
                      }
                      paginatedSources.add(source);
                    });
    this.entityEnricher = new DataInsightsEntityEnricherProcessor(totalRecords);
    if (searchRepository.getSearchType().equals(ElasticSearchConfiguration.SearchType.OPENSEARCH)) {
      this.entityProcessor = new DataInsightsOpenSearchProcessor(totalRecords);
      this.searchIndexSink = new OpenSearchIndexSink(searchRepository, totalRecords);
    } else {
      this.entityProcessor = new DataInsightsElasticSearchProcessor(totalRecords);
      this.searchIndexSink = new ElasticSearchIndexSink(searchRepository, totalRecords);
    }
  }
  private void processDataAssets(JobExecutionContext jobExecutionContext) throws SearchIndexException {
    Map<String, Object> contextData = new HashMap<>();
    // TODO: Logic to shift between Reindex and Regular Ingestion.
    // Toggle between 1-2 Days and retentionDays
    Long initialTimestamp = timestampSubtractDays(timestamp, 2);
    contextData.put("initialTimestamp", initialTimestamp);
    contextData.put(TIMESTAMP_KEY, timestamp);

    // TODO: This logic might be better moved to another place
    try {
      searchRepository.getSearchClient().deleteByQuery("di-data-assets", String.format("{\"@timestamp\": {\"gte\": %s, \"lte\": %s}}", initialTimestamp, timestamp));
    } catch (Exception rx) {
      SearchIndexException exception = new SearchIndexException(
              new IndexingError()
                      .withMessage(
                              rx.getMessage())
      );
      jobData.setFailure(exception.getIndexingError());
      throw exception;
    }
    // ---

    for (Source paginatedSource : paginatedSources) {
      List<String> entityName = new ArrayList<>();
      contextData.put("entityType", paginatedSource.getEntityType());
      Object resultList;
      while (!stopped && !paginatedSource.isDone()) {
        try {
          resultList = paginatedSource.readNext(null);
          processEntity((ResultList<? extends EntityInterface>) resultList, contextData, paginatedSource);
        } catch (SearchIndexException rx) {
          jobData.setStatus(EventPublisherJob.Status.FAILED);
          jobData.setFailure(rx.getIndexingError());
          paginatedSource.updateStats(
                  rx.getIndexingError().getSuccessCount(), rx.getIndexingError().getFailedCount());
        } finally {
          updateStats(paginatedSource.getEntityType(), paginatedSource.getStats());
          sendUpdates(jobExecutionContext);
        }
      }
    }
  }
  private void processEntity(
          ResultList<? extends EntityInterface> resultList,
          Map<String, Object> contextData,
          Source paginatedSource)
          throws SearchIndexException {
    if (!resultList.getData().isEmpty()) {
      searchIndexSink.write(entityProcessor.process(entityEnricher.process(resultList, contextData), contextData), contextData);
      if (!resultList.getErrors().isEmpty()) {
        throw new SearchIndexException(
                new IndexingError()
                        .withErrorSource(READER)
                        .withLastFailedCursor(paginatedSource.getLastFailedCursor())
                        .withSubmittedCount(paginatedSource.getBatchSize())
                        .withSuccessCount(resultList.getData().size())
                        .withFailedCount(resultList.getErrors().size())
                        .withMessage(
                                "Issues in Reading A Batch For Entities. Check Errors Corresponding to Entities.")
                        .withFailedEntities(resultList.getErrors()));
      }
      paginatedSource.updateStats(resultList.getData().size(), 0);
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


