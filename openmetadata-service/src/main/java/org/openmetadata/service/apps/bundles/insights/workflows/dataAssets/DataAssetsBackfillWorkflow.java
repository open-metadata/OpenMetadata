package org.openmetadata.service.apps.bundles.insights.workflows.dataAssets;

import static org.openmetadata.service.apps.bundles.insights.utils.TimestampUtils.MILLISECONDS_IN_A_DAY;

import java.io.IOException;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
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
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.backfill.VersionRecord;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.AbstractDataInsightsBulkProcessor;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.workflows.interfaces.Sink;
import org.openmetadata.service.workflows.searchIndex.PaginatedEntitiesSource;

@Slf4j
public class DataAssetsBackfillWorkflow extends AbstractInsightsWorkflow {

  private final InsightsConfig config;
  private final SearchComponentFactory searchFactory;
  private final CollectionDAO collectionDAO;
  private final SearchRepository searchRepository;

  private DataInsightsSearchInterface searchInterface;
  private DataInsightsEntityEnricher enricher;
  private AbstractDataInsightsBulkProcessor<?> bulkProcessor;
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
    bulkProcessor = searchFactory.createDataInsightsProcessor(totalRecords);
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

    // Use the DI-configured field list rather than "*" to prevent expansion of expensive
    // relationship fields. For example, databaseSchema with "*" triggers
    // DatabaseSchemaRepository.setFields() which fetches all table EntityReferences via
    // findTo(), causing ~15MB/entity heap spikes with large catalogs.
    // getEntityAttributeFields() returns exactly the fields DI charts query against —
    // the same fields the steady-state enricher retains via retainAll() — so no chart
    // data or querying capability is lost.
    List<String> diFields =
        searchInterface.getEntityAttributeFields(
            searchInterface.readDataInsightsSearchConfiguration(), entityType);

    BackfillBatchProcessor processor =
        new BackfillBatchProcessor(
            enricher, bulkProcessor, searchIndexSink, collectionDAO, clusterAlias, entityType,
            diFields);

    // Single pass: fetch version metadata inline per batch — no global BackfillTimeline held.
    PaginatedEntitiesSource source =
        new PaginatedEntitiesSource(entityType, config.batchSize(), diFields);
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
        // Version metadata scoped to this batch only — GC-eligible after processBatch() returns.
        BackfillTimeline batchTimeline =
            fetchVersionsForBatch(batch.getData(), entityType, windowStartTs);
        processor.processBatch(
            new ArrayList<>(batch.getData()), batchTimeline, windowStart, windowEnd, stats());
      }
      if (cursor == null) break;
    }
  }

  /**
   * Fetches and deduplicates version metadata for the given entity batch.
   * Equivalent to BackfillVersionScanner.scan() but scoped to one batch,
   * so the resulting map is GC-eligible as soon as the batch is processed.
   */
  private BackfillTimeline fetchVersionsForBatch(
      List<? extends EntityInterface> batch, String entityType, long windowStartTs) {
    List<String> changedIds = new ArrayList<>();
    for (EntityInterface entity : batch) {
      Long updatedAt = entity.getUpdatedAt();
      if (updatedAt != null && updatedAt >= windowStartTs) {
        changedIds.add(entity.getId().toString());
      }
    }

    Map<UUID, List<VersionRecord>> rawTimeline = new HashMap<>();
    if (!changedIds.isEmpty()) {
      List<CollectionDAO.EntityVersionRecord> rows =
          collectionDAO
              .entityExtensionDAO()
              .getVersionMetadataForEntities(changedIds, entityType + ".version");
      for (CollectionDAO.EntityVersionRecord row : rows) {
        rawTimeline
            .computeIfAbsent(row.entityId(), k -> new ArrayList<>())
            .add(new VersionRecord(row.entityId(), row.extensionKey(), row.updatedAt()));
      }
    }

    // Deduplicate: keep only the latest VersionRecord per entity per day.
    Map<UUID, List<VersionRecord>> timeline = new HashMap<>();
    for (Map.Entry<UUID, List<VersionRecord>> entry : rawTimeline.entrySet()) {
      LinkedHashMap<LocalDate, VersionRecord> dayMap = new LinkedHashMap<>();
      for (VersionRecord v : entry.getValue()) {
        dayMap.putIfAbsent(toLocalDate(v.updatedAt()), v);
      }
      timeline.put(entry.getKey(), new ArrayList<>(dayMap.values()));
    }

    return new BackfillTimeline(timeline, Map.of());
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

  private static LocalDate toLocalDate(long epochMillis) {
    return Instant.ofEpochMilli(epochMillis).atZone(ZoneOffset.UTC).toLocalDate();
  }
}
