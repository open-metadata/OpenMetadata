package org.openmetadata.service.apps.bundles.insights.workflows.dataAssets;

import java.io.IOException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.apps.bundles.insights.config.InsightsConfig;
import org.openmetadata.service.apps.bundles.insights.config.ProcessingPeriod;
import org.openmetadata.service.apps.bundles.insights.search.DailyIndex;
import org.openmetadata.service.apps.bundles.insights.search.DataInsightsSearchInterface;
import org.openmetadata.service.apps.bundles.insights.search.SearchComponentFactory;
import org.openmetadata.service.apps.bundles.insights.workflow.AbstractInsightsWorkflow;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.backfill.BackfillBatchProcessor;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.backfill.BackfillTimeline;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.backfill.BackfillVersionScanner;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.DataInsightsEntityEnricherProcessor;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.workflows.interfaces.Processor;
import org.openmetadata.service.workflows.interfaces.Sink;
import org.openmetadata.service.workflows.searchIndex.PaginatedEntitiesSource;

@Slf4j
public class DataAssetsBackfillWorkflow extends AbstractInsightsWorkflow {

  private static final int RETENTION_DAYS = 30;

  private final InsightsConfig config;
  private final SearchComponentFactory searchFactory;
  private final CollectionDAO collectionDAO;
  private final SearchRepository searchRepository;

  private DataInsightsSearchInterface searchInterface;
  private DataInsightsEntityEnricherProcessor enricher;
  private Processor entityProcessor;
  private Sink searchIndexSink;

  public DataAssetsBackfillWorkflow(
      InsightsConfig config,
      SearchComponentFactory searchFactory,
      CollectionDAO collectionDAO,
      SearchRepository searchRepository) {
    super("DataAssetsBackfillWorkflow");
    this.config = config;
    this.searchFactory = searchFactory;
    this.collectionDAO = collectionDAO;
    this.searchRepository = searchRepository;
  }

  @Override
  protected boolean isEnabled() {
    return true;
  }

  @Override
  protected void initialize() throws IOException {
    searchInterface = searchFactory.createSearchInterface();
    int totalRecords = config.dataAssetTypes().size() * 1000;
    enricher = new DataInsightsEntityEnricherProcessor(totalRecords);
    entityProcessor = searchFactory.createDataInsightsProcessor(totalRecords);
    searchIndexSink = searchFactory.createIndexSink(totalRecords);

    preCrateDailyIndices();
  }

  @Override
  protected void run() throws Exception {
    ProcessingPeriod period =
        config.backfillPeriod().orElse(config.steadyStatePeriod());

    LocalDate windowEnd =
        LocalDate.ofEpochDay(period.endTimestamp() / 86_400_000L);
    LocalDate windowStart =
        LocalDate.ofEpochDay(period.startTimestamp() / 86_400_000L);

    for (String entityType : config.dataAssetTypes()) {
      if (stopped) break;
      processEntityType(entityType, windowStart, windowEnd, period.startTimestamp());
    }
  }

  private void processEntityType(
      String entityType, LocalDate windowStart, LocalDate windowEnd, long windowStartTs) {
    String clusterAlias = searchInterface.getClusterAlias();
    LOG.info("[BackfillWorkflow] Processing entity type: {}", entityType);

    BackfillTimeline timeline =
        new BackfillVersionScanner(entityType, windowStartTs, config.batchSize(), collectionDAO)
            .scan();

    BackfillBatchProcessor processor =
        new BackfillBatchProcessor(
            enricher, entityProcessor, searchIndexSink, collectionDAO, clusterAlias, entityType);

    PaginatedEntitiesSource source =
        new PaginatedEntitiesSource(entityType, config.batchSize(), List.of("*"));
    String cursor = null;

    while (true) {
      ResultList<? extends EntityInterface> batch;
      try {
        batch = source.readNextKeyset(cursor);
      } catch (Exception ex) {
        LOG.warn("[BackfillWorkflow] Error reading {}: {}", entityType, ex.getMessage());
        break;
      }
      cursor = batch.getPaging().getAfter();

      if (!batch.getData().isEmpty()) {
        processor.processBatch(
            new ArrayList<>(batch.getData()), timeline, windowStart, windowEnd, stats());
      }
      if (cursor == null) break;
    }
  }

  private void preCrateDailyIndices() throws IOException {
    ProcessingPeriod period = config.backfillPeriod().orElse(config.steadyStatePeriod());
    LocalDate end = LocalDate.ofEpochDay(period.endTimestamp() / 86_400_000L);
    LocalDate start = LocalDate.ofEpochDay(period.startTimestamp() / 86_400_000L);
    String clusterAlias = searchInterface.getClusterAlias();

    int created = 0;
    for (String entityType : config.dataAssetTypes()) {
      for (LocalDate day = start; !day.isAfter(end); day = day.plusDays(1)) {
        DailyIndex index = new DailyIndex(clusterAlias, entityType, day);
        if (!searchInterface.dailyIndexExists(index)) {
          // Index template auto-applies mappings on first write; no explicit create needed.
          // The write itself will create the index with correct mappings.
          created++;
        }
      }
    }
    LOG.info("[BackfillWorkflow] Pre-checked {} daily indices", created);
  }
}
