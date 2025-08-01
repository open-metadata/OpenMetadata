package org.openmetadata.service.apps.bundles.insights.workflows.dataAssets;

import static org.openmetadata.schema.system.IndexingError.ErrorSource.READER;
import static org.openmetadata.service.apps.bundles.insights.DataInsightsApp.getDataStreamName;
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
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.applications.configuration.internal.DataAssetsConfig;
import org.openmetadata.schema.service.configuration.elasticsearch.ElasticSearchConfiguration;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.insights.DataInsightsApp;
import org.openmetadata.service.apps.bundles.insights.search.DataInsightsSearchConfiguration;
import org.openmetadata.service.apps.bundles.insights.search.DataInsightsSearchInterface;
import org.openmetadata.service.apps.bundles.insights.utils.TimestampUtils;
import org.openmetadata.service.apps.bundles.insights.workflows.WorkflowStats;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.DataInsightsElasticSearchProcessor;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.DataInsightsEntityEnricherProcessor;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.DataInsightsOpenSearchProcessor;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.ListFilter;
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
  public static final String DATA_STREAM_KEY = "DataStreamKey";
  public static final String ENTITY_TYPE_FIELDS_KEY = "EnityTypeFields";
  private static final String ALL_ENTITIES = "all";
  private final DataAssetsConfig dataAssetsConfig;
  private final int retentionDays = 30;
  private final Long startTimestamp;
  private final Long endTimestamp;
  private final int batchSize;
  private final SearchRepository searchRepository;
  private final CollectionDAO collectionDAO;
  private final List<PaginatedEntitiesSource> sources = new ArrayList<>();
  private final Set<String> entityTypes;
  private final DataInsightsSearchConfiguration dataInsightsSearchConfiguration;
  private final DataInsightsSearchInterface searchInterface;

  private DataInsightsEntityEnricherProcessor entityEnricher;
  private Processor entityProcessor;
  private Sink searchIndexSink;
  @Getter private final WorkflowStats workflowStats = new WorkflowStats("DataAssetsWorkflow");

  public DataAssetsWorkflow(
      DataAssetsConfig dataAssetsConfig,
      Long timestamp,
      int batchSize,
      Optional<DataInsightsApp.Backfill> backfill,
      Set<String> entityTypes,
      CollectionDAO collectionDAO,
      SearchRepository searchRepository,
      DataInsightsSearchInterface searchInterface) {
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
    this.entityTypes = entityTypes;
    this.searchInterface = searchInterface;
    this.dataInsightsSearchConfiguration = searchInterface.readDataInsightsSearchConfiguration();
    this.dataAssetsConfig = dataAssetsConfig;
  }

  private void initialize() {
    Stats stats = getInitialStatsForEntities(entityTypes);
    int totalRecords = stats.getJobStats().getTotalRecords();

    Set<String> entityTypesToProcess = getEntityTypesToProcess();

    entityTypes.stream()
        .filter(
            entityType ->
                dataAssetsConfig.getEntities().equals(Set.of(ALL_ENTITIES))
                    || dataAssetsConfig.getEntities().contains(entityType))
        .filter(
            entityType ->
                entityTypesToProcess.equals(Set.of(ALL_ENTITIES))
                    || entityTypesToProcess.contains(entityType))
        .forEach(
            entityType -> {
              List<String> fields = List.of("*");
              ListFilter filter = getListFilter(entityType);
              PaginatedEntitiesSource source =
                  new PaginatedEntitiesSource(entityType, batchSize, fields, filter)
                      .withName(String.format("[DataAssetsWorkflow] %s", entityType));
              sources.add(source);
            });

    this.entityEnricher = new DataInsightsEntityEnricherProcessor(totalRecords);
    if (searchRepository.getSearchType().equals(ElasticSearchConfiguration.SearchType.OPENSEARCH)) {
      this.entityProcessor = new DataInsightsOpenSearchProcessor(totalRecords);
      this.searchIndexSink =
          new OpenSearchIndexSink(
              searchRepository,
              totalRecords,
              searchRepository.getSearchConfiguration().getPayLoadSize());
    } else {
      this.entityProcessor = new DataInsightsElasticSearchProcessor(totalRecords);
      this.searchIndexSink =
          new ElasticSearchIndexSink(
              searchRepository,
              totalRecords,
              searchRepository.getSearchConfiguration().getPayLoadSize());
    }
  }

  private ListFilter getListFilter(String entityType) {
    ListFilter filter = null;

    // data product does not support soft delete
    if (!entityType.equals("dataProduct")) {
      filter = new ListFilter();
      if (dataAssetsConfig.getServiceFilter() != null) {
        filter =
            filter.addQueryParam("service", dataAssetsConfig.getServiceFilter().getServiceName());
      }
    } else {
      filter = new ListFilter(Include.ALL);
    }

    return filter;
  }

  private Set<String> getEntityTypesToProcess() {
    if (dataAssetsConfig.getServiceFilter() != null) {
      return Entity.getEntityTypeInService(dataAssetsConfig.getServiceFilter().getServiceType());
    } else {
      return Set.of(ALL_ENTITIES);
    }
  }

  public void process() throws SearchIndexException {
    if (!dataAssetsConfig.getEnabled()) {
      return;
    }
    LOG.info("[Data Insights] Processing Data Assets Insights.");
    initialize();
    Map<String, Object> contextData = new HashMap<>();

    contextData.put(START_TIMESTAMP_KEY, startTimestamp);
    contextData.put(END_TIMESTAMP_KEY, endTimestamp);

    for (PaginatedEntitiesSource source : sources) {
      deleteBasedOnDataRetentionPolicy(
          getDataStreamName(searchRepository.getClusterAlias(), source.getEntityType()));
      deleteDataBeforeInserting(
          getDataStreamName(searchInterface.getClusterAlias(), source.getEntityType()));
      contextData.put(
          DATA_STREAM_KEY,
          getDataStreamName(searchInterface.getClusterAlias(), source.getEntityType()));
      contextData.put(ENTITY_TYPE_KEY, source.getEntityType());
      contextData.put(
          ENTITY_TYPE_FIELDS_KEY,
          searchInterface.getEntityAttributeFields(
              dataInsightsSearchConfiguration, source.getEntityType()));

      while (!source.isDone().get()) {
        try {
          processEntity(source.readNext(null), contextData, source);
        } catch (SearchIndexException ex) {
          source.updateStats(
              ex.getIndexingError().getSuccessCount(), ex.getIndexingError().getFailedCount());
          String errorMessage =
              String.format("Failed processing Data from %s: %s", source.getName(), ex);
          workflowStats.addFailure(errorMessage);
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
                    String.format(
                        "Issues in Reading A Batch For Entities: %s", resultList.getErrors()))
                .withFailedEntities(resultList.getErrors()));
      }
      paginatedSource.updateStats(resultList.getData().size(), 0);
    }
  }

  private void deleteBasedOnDataRetentionPolicy(String dataStreamName) throws SearchIndexException {
    long retentionLimitTimestamp =
        TimestampUtils.subtractDays(System.currentTimeMillis(), dataAssetsConfig.getRetention());
    String rangeTermQuery =
        String.format("{ \"@timestamp\": { \"lte\": %s } }", retentionLimitTimestamp);
    try {
      searchRepository.getSearchClient().deleteByQuery(dataStreamName, rangeTermQuery);
    } catch (Exception rx) {
      throw new SearchIndexException(new IndexingError().withMessage(rx.getMessage()));
    }
  }

  private void deleteDataBeforeInserting(String dataStreamName) throws SearchIndexException {
    String rangeTermQuery =
        String.format(
            "{ \"@timestamp\": { \"gte\": %s, \"lte\": %s } }", startTimestamp, endTimestamp);
    try {
      if (dataAssetsConfig.getServiceFilter() == null) {
        searchRepository.getSearchClient().deleteByQuery(dataStreamName, rangeTermQuery);
      } else {
        searchRepository
            .getSearchClient()
            .deleteByRangeAndTerm(
                dataStreamName,
                rangeTermQuery,
                "service.name.keyword",
                dataAssetsConfig.getServiceFilter().getServiceName());
      }
    } catch (Exception rx) {
      throw new SearchIndexException(new IndexingError().withMessage(rx.getMessage()));
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
