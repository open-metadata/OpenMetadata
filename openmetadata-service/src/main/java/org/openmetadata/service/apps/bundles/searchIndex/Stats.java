package org.openmetadata.service.apps.bundles.searchIndex;

import java.util.concurrent.ConcurrentHashMap;
import lombok.Getter;
import org.openmetadata.schema.system.StepStats;

@Getter
public class Stats {
  private final StepStats jobStats = new StepStats();
  private final ConcurrentHashMap<String, StepStats> entityStats = new ConcurrentHashMap<>();

  public void updateEntityStats(String entityType, StepStats stats) {
    entityStats.merge(
        entityType,
        stats,
        (existingStats, newStats) -> {
          existingStats.setSuccessRecords(
              existingStats.getSuccessRecords() + newStats.getSuccessRecords());
          existingStats.setFailedRecords(
              existingStats.getFailedRecords() + newStats.getFailedRecords());
          existingStats.setTotalRecords(
              existingStats.getTotalRecords() + newStats.getTotalRecords());
          return existingStats;
        });
  }
}
