package org.openmetadata.service.apps.bundles.searchIndex.stats;

import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.CollectionDAO.SearchIndexServerStatsDAO.AggregatedServerStats;
import org.openmetadata.service.jdbi3.CollectionDAO.SearchIndexServerStatsDAO.EntityStats;

/**
 * Manages stats trackers for all entity types within a job. Provides a simple API to get trackers
 * and retrieve aggregated stats from the database.
 *
 * <p>Usage:
 * <pre>
 * JobStatsManager manager = new JobStatsManager(jobId, serverId, dao);
 * EntityStatsTracker tracker = manager.getTracker("table");
 * tracker.recordReader(StatsResult.SUCCESS);
 * // ... later
 * manager.flushAll();
 * AggregatedServerStats totals = manager.getJobStats();
 * </pre>
 */
@Slf4j
public class JobStatsManager {
  @Getter private final String jobId;
  @Getter private final String serverId;
  private final CollectionDAO.SearchIndexServerStatsDAO statsDAO;
  private final ConcurrentMap<String, EntityStatsTracker> trackers = new ConcurrentHashMap<>();

  public JobStatsManager(String jobId, String serverId, CollectionDAO collectionDAO) {
    this.jobId = jobId;
    this.serverId = serverId;
    this.statsDAO = collectionDAO != null ? collectionDAO.searchIndexServerStatsDAO() : null;
  }

  /**
   * Get or create a tracker for the specified entity type. Thread-safe.
   *
   * @param entityType The entity type (e.g., "table", "pipeline")
   * @return The stats tracker for this entity type
   */
  public EntityStatsTracker getTracker(String entityType) {
    return trackers.computeIfAbsent(
        entityType, et -> new EntityStatsTracker(jobId, serverId, et, statsDAO));
  }

  /** Flush all trackers to database. Call this before job completion. */
  public void flushAll() {
    trackers.values().forEach(EntityStatsTracker::flush);
  }

  /**
   * Get aggregated stats for the entire job from the database. This aggregates across all servers
   * and entity types.
   *
   * @return Aggregated stats, or null if DAO is not available
   */
  public AggregatedServerStats getJobStats() {
    if (statsDAO == null) {
      return null;
    }
    return statsDAO.getAggregatedStats(jobId);
  }

  /**
   * Get stats grouped by entity type from the database.
   *
   * @return List of stats per entity type, or empty list if DAO is not available
   */
  public List<EntityStats> getEntityStats() {
    if (statsDAO == null) {
      return List.of();
    }
    return statsDAO.getStatsByEntityType(jobId);
  }

  /** Delete all stats for this job from the database. */
  public void deleteStats() {
    if (statsDAO != null) {
      statsDAO.deleteByJobId(jobId);
    }
    trackers.clear();
  }

  /** Get the number of entity types being tracked. */
  public int getTrackerCount() {
    return trackers.size();
  }
}
