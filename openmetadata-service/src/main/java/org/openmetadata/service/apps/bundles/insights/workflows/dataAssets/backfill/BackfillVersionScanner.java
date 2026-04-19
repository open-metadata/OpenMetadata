package org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.backfill;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.workflows.searchIndex.PaginatedEntitiesSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public record BackfillVersionScanner(
    String entityType, long windowStartTs, int batchSize, CollectionDAO collectionDAO) {

  private static final Logger LOG = LoggerFactory.getLogger(BackfillVersionScanner.class);

  public BackfillTimeline scan() {
    Map<UUID, List<VersionRecord>> rawTimeline = new HashMap<>();
    Map<LocalDate, Set<UUID>> creationsPerDay = new HashMap<>();

    PaginatedEntitiesSource source =
        new PaginatedEntitiesSource(entityType, batchSize, List.of("id", "updatedAt", "createdAt"));
    String cursor = null;

    while (true) {
      ResultList<? extends EntityInterface> batch;
      try {
        batch = source.readNextKeyset(cursor);
      } catch (Exception ex) {
        LOG.warn("[BackfillScanner] Error reading batch for {}: {}", entityType, ex.getMessage());
        break;
      }
      cursor = batch.getPaging().getAfter();

      List<String> changedIds = new ArrayList<>();
      for (EntityInterface entity : batch.getData()) {
        Long updatedAt = entity.getUpdatedAt();
        if (updatedAt != null && updatedAt >= windowStartTs) {
          changedIds.add(entity.getId().toString());
          LocalDate createdDay = toLocalDate(updatedAt);
          creationsPerDay.computeIfAbsent(createdDay, k -> new HashSet<>()).add(entity.getId());
        }
      }

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

      if (cursor == null) break;
    }

    // Deduplicate: keep only the latest VersionRecord per entity per day
    Map<UUID, List<VersionRecord>> timeline = new HashMap<>();
    for (Map.Entry<UUID, List<VersionRecord>> entry : rawTimeline.entrySet()) {
      LinkedHashMap<LocalDate, VersionRecord> dayMap = new LinkedHashMap<>();
      for (VersionRecord v : entry.getValue()) {
        dayMap.putIfAbsent(toLocalDate(v.updatedAt()), v);
      }
      timeline.put(entry.getKey(), new ArrayList<>(dayMap.values()));
    }

    LOG.info(
        "[BackfillScanner] {}: {} entities with changes, {} creation days",
        entityType,
        timeline.size(),
        creationsPerDay.size());

    return new BackfillTimeline(timeline, creationsPerDay);
  }

  private static LocalDate toLocalDate(long epochMillis) {
    return Instant.ofEpochMilli(epochMillis).atZone(ZoneOffset.UTC).toLocalDate();
  }
}
