package org.openmetadata.service.apps.bundles.insights.workflows.dataAssets;

import java.io.IOException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.utils.ResultList;
import static org.openmetadata.service.apps.bundles.insights.utils.TimestampUtils.MILLISECONDS_IN_A_DAY;

import java.util.Collections;
import java.util.HashSet;
import java.util.Set;

import org.openmetadata.service.apps.bundles.insights.config.InsightsConfig;
import org.openmetadata.service.apps.bundles.insights.config.ProcessingPeriod;
import org.openmetadata.service.apps.bundles.insights.search.DailyIndex;
import org.openmetadata.service.apps.bundles.insights.search.DataInsightsSearchInterface;
import org.openmetadata.service.apps.bundles.insights.search.SearchComponentFactory;
import org.openmetadata.service.apps.bundles.insights.workflow.AbstractInsightsWorkflow;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.backfill.BackfillBatchProcessor;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.backfill.BackfillTimeline;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.backfill.BackfillVersionScanner;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.DataInsightsEntityEnricher;
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
  private DataInsightsEntityEnricher enricher;
  private Processor entityProcessor;
  private Sink searchIndexSink;
  private final Set<String> completedEntityTypes = Collections.synchronizedSet(new HashSet<>());

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
    enricher = new DataInsightsEntityEnricher(totalRecords);
    entityProcessor = searchFactory.createDataInsightsProcessor(totalRecords);
    searchIndexSink = searchFactory.createIndexSink(totalRecords);

    preCreateDailyIndices();
  }

  @Override
  protected void run() throws Exception {
    ProcessingPeriod period = config.backfillPeriod().orElse(config.steadyStatePeriod());

    LocalDate windowEnd = LocalDate.ofEpochDay(period.endTimestamp() / MILLISECONDS_IN_A_DAY);
    LocalDate windowStart = LocalDate.ofEpochDay(period.startTimestamp() / MILLISECONDS_IN_A_DAY);

    Set<String> alreadyDone = config.backfillCompletedTypes().orElse(Set.of());

    for (String entityType : config.dataAssetTypes()) {
      if (stopped) break;
      if (alreadyDone.contains(entityType)) {
        LOG.info("[BackfillWorkflow] Skipping already completed entity type: {}", entityType);
        completedEntityTypes.add(entityType);
        continue;
      }
      processEntityType(entityType, windowStart, windowEnd, period.startTimestamp());
      completedEntityTypes.add(entityType);
    }
  }

  public Set<String> getCompletedEntityTypes() {
    return Collections.unmodifiableSet(completedEntityTypes);
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

  private void preCreateDailyIndices() throws IOException {
    ProcessingPeriod period = config.backfillPeriod().orElse(config.steadyStatePeriod());
    LocalDate end = LocalDate.ofEpochDay(period.endTimestamp() / MILLISECONDS_IN_A_DAY);
    LocalDate start = LocalDate.ofEpochDay(period.startTimestamp() / MILLISECONDS_IN_A_DAY);
    String clusterAlias = searchInterface.getClusterAlias();

    int created = 0;
    for (String entityType : config.dataAssetTypes()) {
      for (LocalDate day = start; !day.isAfter(end); day = day.plusDays(1)) {
        DailyIndex index = new DailyIndex(clusterAlias, entityType, day);
        if (!searchInterface.dailyIndexExists(index)) {
          searchInterface.createDailyIndex(index);
          created++;
        }
      }
    }
    LOG.info("[BackfillWorkflow] Pre-created {} daily indices", created);
    searchInterface.waitForYellow();
  }
}
