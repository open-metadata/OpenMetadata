package org.openmetadata.service.apps.bundles.insights.workflows.dataAssets;

import static org.openmetadata.schema.system.IndexingError.ErrorSource.READER;
import static org.openmetadata.service.apps.bundles.insights.utils.TimestampUtils.END_TIMESTAMP_KEY;
import static org.openmetadata.service.apps.bundles.insights.utils.TimestampUtils.START_TIMESTAMP_KEY;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.ENTITY_TYPE_KEY;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.getTotalRequestToProcess;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.service.apps.bundles.insights.DataInsightsApp;
import org.openmetadata.service.apps.bundles.insights.utils.TimestampUtils;
import org.openmetadata.service.apps.bundles.insights.workflows.WorkflowStats;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.DataInsightsElasticSearchProcessor;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.DataInsightsEntityEnricherProcessor;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.DataInsightsOpenSearchProcessor;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.elasticsearch.ElasticSearchIndexSink;
import org.openmetadata.service.search.opensearch.OpenSearchIndexSink;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.workflows.interfaces.Processor;
import org.openmetadata.service.workflows.interfaces.Sink;
import org.openmetadata.service.workflows.interfaces.Source;
import org.openmetadata.service.workflows.searchIndex.PaginatedEntitiesSource;

@Slf4j
public class DataAssetsWorkflow {
  public static final String DATA_ASSETS_DATA_STREAM = "di-data-assets";
  private final int retentionDays = 30;
  private final Long startTimestamp;
  private final Long endTimestamp;
  private final int batchSize;
  private final SearchRepository searchRepository;
  private final CollectionDAO collectionDAO;
  private final List<PaginatedEntitiesSource> sources = new ArrayList<>();
  private final Set<String> entityTypes =
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

  private DataInsightsEntityEnricherProcessor entityEnricher;
  private Processor entityProcessor;
  private Sink searchIndexSink;
  @Getter private final WorkflowStats workflowStats = new WorkflowStats();

  public DataAssetsWorkflow(
      Long timestamp,
      int batchSize,
      Optional<DataInsightsApp.Backfill> backfill,
      CollectionDAO collectionDAO,
      SearchRepository searchRepository) {
    if (backfill.isPresent()) {
      Long oldestPossibleTimestamp =
          TimestampUtils.getStartOfDayTimestamp(
              TimestampUtils.subtractDays(timestamp, retentionDays));

      this.endTimestamp =
          TimestampUtils.getEndOfDayTimestamp(
              Collections.max(
                  List.of(TimestampUtils.getTimestampFromDateString(backfill.get().endDate()))));
      this.startTimestamp =
          TimestampUtils.getStartOfDayTimestamp(
              Collections.max(
                  List.of(
                      TimestampUtils.getTimestampFromDateString(backfill.get().startDate()),
                      oldestPossibleTimestamp)));

      if (oldestPossibleTimestamp.equals(TimestampUtils.getStartOfDayTimestamp(endTimestamp))) {
        LOG.warn(
            "Backfill won't happen because the set date is before the limit of {}",
            oldestPossibleTimestamp);
      }
    } else {
      this.endTimestamp = TimestampUtils.getEndOfDayTimestamp(TimestampUtils.addDays(timestamp, 1));
      this.startTimestamp =
          TimestampUtils.getStartOfDayTimestamp(TimestampUtils.subtractDays(timestamp, 1));
    }

    this.batchSize = batchSize;
    this.searchRepository = searchRepository;
    this.collectionDAO = collectionDAO;
  }

  private void initialize() {
    int totalRecords = getTotalRequestToProcess(entityTypes, collectionDAO);

    entityTypes.forEach(
        entityType -> {
          List<String> fields = List.of("*");
          PaginatedEntitiesSource source =
              new PaginatedEntitiesSource(entityType, batchSize, fields)
                  .withName(String.format("PaginatedEntitiesSource-%s", entityType));
          sources.add(source);
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

  public void process() throws SearchIndexException {
    initialize();
    Map<String, Object> contextData = new HashMap<>();

    contextData.put(START_TIMESTAMP_KEY, startTimestamp);
    contextData.put(END_TIMESTAMP_KEY, endTimestamp);

    deleteDataBeforeInserting();

    for (PaginatedEntitiesSource source : sources) {
      contextData.put(ENTITY_TYPE_KEY, source.getEntityType());

      while (!source.isDone()) {
        try {
          processEntity(source.readNext(null), contextData, source);
        } catch (SearchIndexException ex) {
          source.updateStats(
              ex.getIndexingError().getSuccessCount(), ex.getIndexingError().getFailedCount());
          String errorMessage = String.format("Failed processing Data from %s", source.getName());
          workflowStats.addFailure(errorMessage);
          break;
        } finally {
          updateWorkflowStats(source.getName(), source.getStats());
        }
      }
    }
  }

  private void processEntity(
      ResultList<? extends EntityInterface> resultList,
      Map<String, Object> contextData,
      Source<?> paginatedSource)
      throws SearchIndexException {
    if (!resultList.getData().isEmpty()) {
      searchIndexSink.write(
          entityProcessor.process(entityEnricher.process(resultList, contextData), contextData),
          contextData);
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

  private void deleteDataBeforeInserting() throws SearchIndexException {
    try {
      searchRepository
          .getSearchClient()
          .deleteByQuery(
              DATA_ASSETS_DATA_STREAM,
              String.format(
                  "{\"@timestamp\": {\"gte\": %s, \"lte\": %s}}", startTimestamp, endTimestamp));
    } catch (Exception rx) {
      SearchIndexException exception =
          new SearchIndexException(new IndexingError().withMessage(rx.getMessage()));
      throw exception;
    }
  }

  private void updateWorkflowStats(String stepName, StepStats newStepStats) {
    workflowStats.updateWorkflowStepStats(stepName, newStepStats);

    int currentSuccess =
        workflowStats.getWorkflowStepStats().values().stream()
            .mapToInt(StepStats::getSuccessRecords)
            .sum();
    int currentFailed =
        workflowStats.getWorkflowStepStats().values().stream()
            .mapToInt(StepStats::getFailedRecords)
            .sum();

    workflowStats.updateWorkflowStats(currentSuccess, currentFailed);
  }
}
