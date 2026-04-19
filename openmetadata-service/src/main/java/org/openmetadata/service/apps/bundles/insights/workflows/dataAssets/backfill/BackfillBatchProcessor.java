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
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.DataAssetsWorkflow;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.DataInsightsEntityEnricherProcessor;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.workflows.interfaces.Processor;
import org.openmetadata.service.workflows.interfaces.Sink;
import org.openmetadata.service.workflows.interfaces.TaggedOperation;

@Slf4j
public final class BackfillBatchProcessor {

  private static final int BULK_FLUSH_SIZE = 10_000;

  private final DataInsightsEntityEnricherProcessor enricher;
  private final Processor entityProcessor;
  private final Sink searchIndexSink;
  private final CollectionDAO collectionDAO;
  private final String clusterAlias;
  private final String entityType;

  public BackfillBatchProcessor(
      DataInsightsEntityEnricherProcessor enricher,
      Processor entityProcessor,
      Sink searchIndexSink,
      CollectionDAO collectionDAO,
      String clusterAlias,
      String entityType) {
    this.enricher = enricher;
    this.entityProcessor = entityProcessor;
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

    // 1. Compute spans and collect version keys needed
    Map<UUID, List<Span>> entitySpans = new HashMap<>();
    Set<String> versionKeysNeeded = new HashSet<>();

    for (EntityInterface entity : batch) {
      UUID id = entity.getId();
      List<VersionRecord> versions = timeline.versionTimeline().getOrDefault(id, List.of());
      LocalDate createdAt = toLocalDate(entity.getUpdatedAt()); // best proxy available

      List<Span> spans =
          new SpanBuilder(entity, versions, createdAt, windowStart, windowEnd).build();
      entitySpans.put(id, spans);

      for (Span span : spans) {
        if (span.extensionKey() != null) {
          versionKeysNeeded.add(id + "|" + span.extensionKey());
        }
      }
    }

    // 2. Batch-fetch historical version snapshots from entity_extension
    Map<UUID, String> versionJsonMap = new HashMap<>();
    if (!versionKeysNeeded.isEmpty()) {
      Map<UUID, String> idToExtension = new HashMap<>();
      for (String key : versionKeysNeeded) {
        String[] parts = key.split("\\|", 2);
        idToExtension.put(UUID.fromString(parts[0]), parts[1]);
      }
      versionJsonMap.putAll(collectionDAO.entityExtensionDAO().batchGetByIdAndExtension(idToExtension));
    }

    // 3. Enrich each span once, write to every day in the span
    List<TaggedOperation<?>> opsBuffer = new ArrayList<>();
    int totalSuccess = 0;
    int totalFailed = 0;
    List<String> errors = new ArrayList<>();

    for (EntityInterface entity : batch) {
      UUID id = entity.getId();
      for (Span span : entitySpans.getOrDefault(id, List.of())) {
        EntityInterface version = resolveVersion(entity, span, versionJsonMap);
        if (version == null) continue;

        Map<String, Object> enriched;
        try {
          List<Map<String, Object>> enrichedList = enricher.enrichSingle(version, Map.of());
          if (enrichedList.isEmpty()) continue;
          enriched = enrichedList.get(0);
        } catch (Exception e) {
          totalFailed++;
          errors.add(id + ": " + e.getMessage());
          continue;
        }

        for (LocalDate day = span.startDay(); !day.isAfter(span.endDay()); day = day.plusDays(1)) {
          Map<String, Object> doc = new HashMap<>(enriched);
          doc.put("@timestamp", day.atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli());

          DailyIndex dayIndex = new DailyIndex(clusterAlias, entityType, day);
          Map<String, Object> contextData = Map.of(DataAssetsWorkflow.DATA_STREAM_KEY, dayIndex.name());

          try {
            List<?> ops = (List<?>) entityProcessor.process(List.of(doc), contextData);
            for (Object op : ops) {
              opsBuffer.add(new TaggedOperation<>(op, version.getEntityReference()));
            }
            if (opsBuffer.size() >= BULK_FLUSH_SIZE) {
              flush(opsBuffer);
            }
          } catch (SearchIndexException e) {
            totalFailed++;
            errors.add(id + ": " + e.getMessage());
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
      LOG.debug("[BackfillBatch] Missing version {} for entity {}", span.extensionKey(), currentEntity.getId());
      return null;
    }
    try {
      return JsonUtils.readValue(json, currentEntity.getClass());
    } catch (Exception e) {
      LOG.warn("[BackfillBatch] Could not deserialise version for {}: {}", currentEntity.getId(), e.getMessage());
      return null;
    }
  }

  private static LocalDate toLocalDate(long epochMillis) {
    return Instant.ofEpochMilli(epochMillis).atZone(ZoneOffset.UTC).toLocalDate();
  }
}
