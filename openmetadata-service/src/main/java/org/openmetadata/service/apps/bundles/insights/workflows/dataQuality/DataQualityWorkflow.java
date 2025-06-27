package org.openmetadata.service.apps.bundles.insights.workflows.dataQuality;

import static org.openmetadata.service.apps.bundles.insights.utils.TimestampUtils.END_TIMESTAMP_KEY;
import static org.openmetadata.service.apps.bundles.insights.utils.TimestampUtils.START_TIMESTAMP_KEY;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.ENTITY_TYPE_KEY;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.getInitialStatsForEntities;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityTimeSeriesInterface;
import org.openmetadata.schema.entity.applications.configuration.internal.DataQualityConfig;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.apps.bundles.insights.DataInsightsApp;
import org.openmetadata.service.apps.bundles.insights.utils.TimestampUtils;
import org.openmetadata.service.apps.bundles.insights.workflows.WorkflowStats;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.elasticsearch.ElasticSearchEntityTimeSeriesProcessor;
import org.openmetadata.service.search.elasticsearch.ElasticSearchIndexSink;
import org.openmetadata.service.search.opensearch.OpenSearchEntityTimeSeriesProcessor;
import org.openmetadata.service.search.opensearch.OpenSearchIndexSink;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.workflows.interfaces.Processor;
import org.openmetadata.service.workflows.interfaces.Sink;
import org.openmetadata.service.workflows.interfaces.Source;
import org.openmetadata.service.workflows.searchIndex.PaginatedEntityTimeSeriesSource;

@Slf4j
public class DataQualityWorkflow {
  public static final String DATA_STREAM_KEY = "DataStreamKey";
  private final int retentionDays = 30;
  private final Long startTimestamp;
  private final Long endTimestamp;
  private final int batchSize;
  private final DataQualityConfig dataQualityConfig;

  private final SearchRepository searchRepository;
  private final CollectionDAO collectionDAO;
  private final List<PaginatedEntityTimeSeriesSource> sources = new ArrayList<>();

  String entityType;

  Processor entityProcessor;
  Sink searchIndexSink;

  @Getter
  private static final WorkflowStats workflowStats = new WorkflowStats("DataQualityWorkflow");

  public DataQualityWorkflow(
      DataQualityConfig dataQualityConfig,
      Long timestamp,
      int batchSize,
      Optional<DataInsightsApp.Backfill> backfill,
      String entityType,
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
      this.endTimestamp = TimestampUtils.getEndOfDayTimestamp(timestamp);
      this.startTimestamp =
          TimestampUtils.getStartOfDayTimestamp(TimestampUtils.subtractDays(timestamp, 1));
    }

    this.batchSize = batchSize;
    this.searchRepository = searchRepository;
    this.collectionDAO = collectionDAO;
    this.entityType = entityType;
    this.dataQualityConfig = dataQualityConfig;
  }

  public String getIndexNameByType(String entityType) {
    IndexMapping indexMapping = searchRepository.getIndexMapping(entityType);
    return indexMapping.getIndexName(searchRepository.getClusterAlias());
  }

  private void initialize() {
    int totalRecords =
        getInitialStatsForEntities(Set.of(entityType)).getJobStats().getTotalRecords();

    List<String> fields = List.of("*");
    PaginatedEntityTimeSeriesSource source =
        new PaginatedEntityTimeSeriesSource(
            entityType, batchSize, fields, startTimestamp, endTimestamp);
    sources.add(source);

    if (searchRepository.getSearchType().equals(ElasticSearchConfiguration.SearchType.OPENSEARCH)) {
      this.entityProcessor = new OpenSearchEntityTimeSeriesProcessor(totalRecords);
      this.searchIndexSink =
          new OpenSearchIndexSink(
              searchRepository,
              totalRecords,
              searchRepository.getElasticSearchConfiguration().getPayLoadSize());
    } else {
      this.entityProcessor = new ElasticSearchEntityTimeSeriesProcessor(totalRecords);
      this.searchIndexSink =
          new ElasticSearchIndexSink(
              searchRepository,
              totalRecords,
              searchRepository.getElasticSearchConfiguration().getPayLoadSize());
    }
  }

  private void deleteDataBeforeInserting(String indexName) throws SearchIndexException {
    try {
      searchRepository
          .getSearchClient()
          .deleteByQuery(
              indexName,
              String.format(
                  "{\"@timestamp\": {\"gte\": %s, \"lte\": %s}}", startTimestamp, endTimestamp));
    } catch (Exception rx) {
      throw new SearchIndexException(new IndexingError().withMessage(rx.getMessage()));
    }
  }

  public void process() throws SearchIndexException {
    if (!dataQualityConfig.getEnabled()) {
      return;
    }
    LOG.info("[Data Insights] Processing Data Quality Insights.");
    initialize();
    Map<String, Object> contextData = new HashMap<>();

    contextData.put(START_TIMESTAMP_KEY, startTimestamp);
    contextData.put(END_TIMESTAMP_KEY, endTimestamp);

    for (PaginatedEntityTimeSeriesSource source : sources) {

      deleteDataBeforeInserting(getIndexNameByType(source.getEntityType()));
      contextData.put(ENTITY_TYPE_KEY, entityType);

      while (!source.isDone().get()) {
        try {
          processEntity(source.readNext(null), contextData, source);
        } catch (SearchIndexException ex) {
          source.updateStats(
              ex.getIndexingError().getSuccessCount(), ex.getIndexingError().getFailedCount());
          String errorMessage =
              String.format("Failed processing Data from %s: %s", source.getEntityType(), ex);
          workflowStats.addFailure(errorMessage);
        } finally {
          updateWorkflowStats("[DataQualityWorkflow] " + source.getEntityType(), source.getStats());
        }
      }
    }
  }

  private void processEntity(
      ResultList<? extends EntityTimeSeriesInterface> resultList,
      Map<String, Object> contextData,
      Source<?> paginatedSource)
      throws SearchIndexException {
    if (!resultList.getData().isEmpty()) {
      searchIndexSink.write(entityProcessor.process(resultList, contextData), contextData);
      paginatedSource.updateStats(resultList.getData().size(), 0);
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
