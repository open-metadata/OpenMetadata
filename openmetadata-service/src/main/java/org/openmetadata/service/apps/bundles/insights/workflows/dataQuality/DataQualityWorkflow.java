package org.openmetadata.service.apps.bundles.insights.workflows.dataQuality;

import static org.openmetadata.service.apps.bundles.insights.utils.TimestampUtils.END_TIMESTAMP_KEY;
import static org.openmetadata.service.apps.bundles.insights.utils.TimestampUtils.START_TIMESTAMP_KEY;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.ENTITY_TYPE_KEY;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.getInitialStatsForEntities;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityTimeSeriesInterface;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.apps.bundles.insights.config.InsightsConfig;
import org.openmetadata.service.apps.bundles.insights.config.ProcessingPeriod;
import org.openmetadata.service.apps.bundles.insights.search.SearchComponentFactory;
import org.openmetadata.service.apps.bundles.insights.stats.StepResult;
import org.openmetadata.service.apps.bundles.insights.workflow.AbstractInsightsWorkflow;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.workflows.interfaces.Processor;
import org.openmetadata.service.workflows.interfaces.Sink;
import org.openmetadata.service.workflows.interfaces.TaggedOperation;
import org.openmetadata.service.workflows.searchIndex.PaginatedEntityTimeSeriesSource;

@Slf4j
public class DataQualityWorkflow extends AbstractInsightsWorkflow {

  private final InsightsConfig config;
  private final CollectionDAO collectionDAO;
  private final SearchComponentFactory searchFactory;
  private final SearchRepository searchRepository;

  public DataQualityWorkflow(
      InsightsConfig config, CollectionDAO collectionDAO, SearchComponentFactory searchFactory) {
    super("DataQualityWorkflow");
    this.config = config;
    this.collectionDAO = collectionDAO;
    this.searchFactory = searchFactory;
    this.searchRepository = searchFactory.getSearchRepository();
  }

  @Override
  protected boolean isEnabled() {
    return config.dataQualityConfig() != null
        && Boolean.TRUE.equals(config.dataQualityConfig().getEnabled());
  }

  @Override
  protected void initialize() {}

  @Override
  protected void run() throws Exception {
    for (String entityType : config.dataQualityEntities()) {
      if (stopped) break;
      processEntityType(entityType);
    }
  }

  private void processEntityType(String entityType) {
    ProcessingPeriod period = config.backfillPeriod().orElse(config.steadyStatePeriod());
    long startTs = period.startTimestamp();
    long endTs = period.endTimestamp();

    int totalRecords =
        getInitialStatsForEntities(Set.of(entityType)).getJobStats().getTotalRecords();

    PaginatedEntityTimeSeriesSource source =
        new PaginatedEntityTimeSeriesSource(
            entityType, config.batchSize(), List.of("*"), startTs, endTs);

    Processor entityProcessor = searchFactory.createEntityTimeSeriesProcessor(totalRecords);
    Sink searchIndexSink = searchFactory.createIndexSink(totalRecords);

    String indexName = getIndexNameByType(entityType);
    try {
      searchRepository
          .getSearchClient()
          .deleteByRangeQuery(indexName, "@timestamp", null, startTs, null, endTs);
    } catch (Exception ex) {
      LOG.warn(
          "[DataQualityWorkflow] Could not clear index {} before insert: {}",
          indexName,
          ex.getMessage());
    }

    Map<String, Object> contextData = new HashMap<>();
    contextData.put(START_TIMESTAMP_KEY, startTs);
    contextData.put(END_TIMESTAMP_KEY, endTs);
    contextData.put(ENTITY_TYPE_KEY, entityType);

    int totalSuccess = 0;
    int totalFailed = 0;
    List<String> errors = new ArrayList<>();
    String keysetCursor = null;

    while (true) {
      try {
        ResultList<? extends EntityTimeSeriesInterface> resultList =
            source.readNextKeyset(keysetCursor);
        keysetCursor = resultList.getPaging().getAfter();
        if (!resultList.getData().isEmpty()) {
          List<TaggedOperation<?>> taggedOps = new ArrayList<>();
          for (EntityTimeSeriesInterface entity : resultList.getData()) {
            @SuppressWarnings("unchecked")
            Object op = entityProcessor.process(entity, contextData);
            taggedOps.add(new TaggedOperation<>(op, entity.getEntityReference()));
          }
          searchIndexSink.write(taggedOps);
          totalSuccess += resultList.getData().size();
          source.updateStats(resultList.getData().size(), 0);
        }
        if (keysetCursor == null) break;
      } catch (SearchIndexException ex) {
        totalFailed +=
            ex.getIndexingError().getFailedCount() != null
                ? ex.getIndexingError().getFailedCount()
                : 1;
        errors.add(entityType + ": " + ex.getMessage());
        source.updateStats(
            ex.getIndexingError().getSuccessCount() != null
                ? ex.getIndexingError().getSuccessCount()
                : 0,
            ex.getIndexingError().getFailedCount() != null
                ? ex.getIndexingError().getFailedCount()
                : 1);
        break;
      }
    }

    stats().record(new StepResult("data-quality-" + entityType, totalSuccess, totalFailed, errors));
  }

  private String getIndexNameByType(String entityType) {
    IndexMapping indexMapping = searchRepository.getIndexMapping(entityType);
    return indexMapping.getIndexName(searchRepository.getClusterAlias());
  }
}
