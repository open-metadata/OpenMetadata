package org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.backfill;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.apps.bundles.insights.search.DailyIndex;
import org.openmetadata.service.apps.bundles.insights.stats.StepResult;
import org.openmetadata.service.apps.bundles.insights.stats.WorkflowStatsCollector;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.DataInsightsEntityEnricher;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.AbstractDataInsightsBulkProcessor;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.workflows.interfaces.Sink;
import org.openmetadata.service.workflows.interfaces.TaggedOperation;

@Slf4j
public final class BackfillBatchProcessor {

  // Bounded flush size: 500 × ~20KB = ~10MB peak vs previous 10,000 × ~20KB = ~200MB.
  private static final int BULK_FLUSH_SIZE = 500;

  private final DataInsightsEntityEnricher enricher;
  private final AbstractDataInsightsBulkProcessor<?> bulkProcessor;
  private final Sink searchIndexSink;
  private final CollectionDAO collectionDAO;
  private final String clusterAlias;
  private final String entityType;

  public BackfillBatchProcessor(
      DataInsightsEntityEnricher enricher,
      AbstractDataInsightsBulkProcessor<?> bulkProcessor,
      Sink searchIndexSink,
      CollectionDAO collectionDAO,
      String clusterAlias,
      String entityType) {
    this.enricher = enricher;
    this.bulkProcessor = bulkProcessor;
    this.searchIndexSink = searchIndexSink;
    this.collectionDAO = collectionDAO;
    this.clusterAlias = clusterAlias;
    this.entityType = entityType;
  }

  @SuppressWarnings("unchecked")
  public void processBatch(
      List<EntityInterface> batch,
      BackfillTimeline timeline,
      LocalDate windowStart,
      LocalDate windowEnd,
      WorkflowStatsCollector stats) {

    // 1. Compute spans and collect version keys needed for this batch.
    Map<UUID, List<Span>> entitySpans = new HashMap<>();
    Set<String> versionKeysNeeded = new HashSet<>();

    for (EntityInterface entity : batch) {
      UUID id = entity.getId();
      List<VersionRecord> versions = timeline.versionTimeline().getOrDefault(id, List.of());
      LocalDate createdAt = toLocalDate(entity.getUpdatedAt());

      List<Span> spans =
          new SpanBuilder(entity, versions, createdAt, windowStart, windowEnd).build();
      entitySpans.put(id, spans);

      for (Span span : spans) {
        if (span.extensionKey() != null) {
          versionKeysNeeded.add(id + "|" + span.extensionKey());
        }
      }
    }

    // 2. Batch-fetch historical version snapshots — one DB round-trip per batch.
    Map<UUID, String> versionJsonMap = new HashMap<>();
    if (!versionKeysNeeded.isEmpty()) {
      Map<UUID, String> idToExtension = new HashMap<>();
      for (String key : versionKeysNeeded) {
        String[] parts = key.split("\\|", 2);
        idToExtension.put(UUID.fromString(parts[0]), parts[1]);
      }
      versionJsonMap.putAll(
          collectionDAO.entityExtensionDAO().batchGetByIdAndExtension(idToExtension));
    }

    // 3. Enrich each span ONCE, inject @timestamp per day via string replace.
    //    This eliminates the O(spans × days) HashMap copies from the previous approach.
    List<TaggedOperation<?>> opsBuffer = new ArrayList<>();
    int totalSuccess = 0;
    int totalFailed = 0;
    List<String> errors = new ArrayList<>();

    for (EntityInterface entity : batch) {
      UUID id = entity.getId();
      for (Span span : entitySpans.getOrDefault(id, List.of())) {
        EntityInterface version = resolveVersion(entity, span, versionJsonMap);
        if (version == null) continue;

        String baseDocJson;
        String entityId;
        try {
          Map<String, Object> enrichCtx =
              Map.of(
                  org.openmetadata.service.workflows.searchIndex.ReindexingUtil.ENTITY_TYPE_KEY,
                  entityType);
          Map<String, Object> enriched = enricher.enrichSingle(version, enrichCtx);
          entityId = (String) enriched.get("id");
          // Use 0L as a placeholder: the literal "\"@timestamp\":0" appears exactly once
          // in the serialized JSON and is safely replaced per day below.
          enriched.put("@timestamp", 0L);
          baseDocJson = JsonUtils.pojoToJson(enriched);
          // Allow the Map to be GC'd immediately — we only need the JSON string.
        } catch (Exception e) {
          totalFailed++;
          errors.add(id + ": " + e.getMessage());
          continue;
        }

        for (LocalDate day = span.startDay(); !day.isAfter(span.endDay()); day = day.plusDays(1)) {
          DailyIndex dayIndex = new DailyIndex(clusterAlias, entityType, day);
          long ts = dayIndex.startOfDayTimestamp();

          // O(1) string replace — no new Map, no re-serialization per day.
          String dayJson = baseDocJson.replace("\"@timestamp\":0", "\"@timestamp\":" + ts);

          Object op = bulkProcessor.buildOp(dayIndex.name(), entityId, dayJson);
          opsBuffer.add(new TaggedOperation<>(op, version.getEntityReference()));
          if (opsBuffer.size() >= BULK_FLUSH_SIZE) {
            flush(opsBuffer);
          }
        }
        totalSuccess++;
      }
    }
    flush(opsBuffer);

    stats.record(new StepResult("backfill-" + entityType, totalSuccess, totalFailed, errors));
  }

  private void flush(List<TaggedOperation<?>> ops) {
    if (ops.isEmpty()) return;
    try {
      searchIndexSink.write(new ArrayList<>(ops));
    } catch (SearchIndexException e) {
      LOG.warn("[BackfillBatch] Flush failed for {}: {}", entityType, e.getMessage());
    }
    ops.clear();
  }

  private EntityInterface resolveVersion(
      EntityInterface currentEntity, Span span, Map<UUID, String> versionJsonMap) {
    if (span.currentEntity() != null) return span.currentEntity();
    if (span.extensionKey() == null) return currentEntity;
    String json = versionJsonMap.get(currentEntity.getId());
    if (json == null) {
      LOG.debug(
          "[BackfillBatch] Missing version {} for entity {}",
          span.extensionKey(),
          currentEntity.getId());
      return null;
    }
    try {
      return JsonUtils.readValue(json, currentEntity.getClass());
    } catch (Exception e) {
      LOG.warn(
          "[BackfillBatch] Could not deserialise version for {}: {}",
          currentEntity.getId(),
          e.getMessage());
      return null;
    }
  }

  private static LocalDate toLocalDate(long epochMillis) {
    return Instant.ofEpochMilli(epochMillis).atZone(ZoneOffset.UTC).toLocalDate();
  }
}
