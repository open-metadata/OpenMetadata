/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.jdbi3.locator.ConnectionType.MYSQL;
import static org.openmetadata.service.jdbi3.locator.ConnectionType.POSTGRES;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;
import org.jdbi.v3.sqlobject.CreateSqlObject;
import org.jdbi.v3.sqlobject.config.RegisterRowMapper;
import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.customizer.BindList;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlUpdate;

public interface RdfInfraDAOs {
  @CreateSqlObject
  RdfIndexJobDAO rdfIndexJobDAO();

  @CreateSqlObject
  RdfIndexPartitionDAO rdfIndexPartitionDAO();

  @CreateSqlObject
  RdfReindexLockDAO rdfReindexLockDAO();

  @CreateSqlObject
  RdfIndexServerStatsDAO rdfIndexServerStatsDAO();

  /** DAO for distributed RDF index jobs. */
  interface RdfIndexJobDAO {

    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO rdf_index_job (id, status, jobConfiguration, totalRecords, processedRecords, "
                + "successRecords, failedRecords, stats, createdBy, createdAt, updatedAt) "
                + "VALUES (:id, :status, :jobConfiguration, :totalRecords, :processedRecords, "
                + ":successRecords, :failedRecords, :stats, :createdBy, :createdAt, :updatedAt)",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO rdf_index_job (id, status, jobConfiguration, totalRecords, processedRecords, "
                + "successRecords, failedRecords, stats, createdBy, createdAt, updatedAt) "
                + "VALUES (:id, :status, :jobConfiguration::jsonb, :totalRecords, :processedRecords, "
                + ":successRecords, :failedRecords, :stats::jsonb, :createdBy, :createdAt, :updatedAt)",
        connectionType = POSTGRES)
    void insert(
        @Bind("id") String id,
        @Bind("status") String status,
        @Bind("jobConfiguration") String jobConfiguration,
        @Bind("totalRecords") long totalRecords,
        @Bind("processedRecords") long processedRecords,
        @Bind("successRecords") long successRecords,
        @Bind("failedRecords") long failedRecords,
        @Bind("stats") String stats,
        @Bind("createdBy") String createdBy,
        @Bind("createdAt") long createdAt,
        @Bind("updatedAt") long updatedAt);

    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE rdf_index_job SET status = :status, processedRecords = :processedRecords, "
                + "successRecords = :successRecords, failedRecords = :failedRecords, stats = :stats, "
                + "startedAt = :startedAt, completedAt = :completedAt, updatedAt = :updatedAt, "
                + "errorMessage = :errorMessage WHERE id = :id",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE rdf_index_job SET status = :status, processedRecords = :processedRecords, "
                + "successRecords = :successRecords, failedRecords = :failedRecords, stats = :stats::jsonb, "
                + "startedAt = :startedAt, completedAt = :completedAt, updatedAt = :updatedAt, "
                + "errorMessage = :errorMessage WHERE id = :id",
        connectionType = POSTGRES)
    void update(
        @Bind("id") String id,
        @Bind("status") String status,
        @Bind("processedRecords") long processedRecords,
        @Bind("successRecords") long successRecords,
        @Bind("failedRecords") long failedRecords,
        @Bind("stats") String stats,
        @Bind("startedAt") Long startedAt,
        @Bind("completedAt") Long completedAt,
        @Bind("updatedAt") long updatedAt,
        @Bind("errorMessage") String errorMessage);

    @SqlUpdate("UPDATE rdf_index_job SET updatedAt = :updatedAt WHERE id = :id")
    void touchJob(@Bind("id") String id, @Bind("updatedAt") long updatedAt);

    @SqlQuery("SELECT * FROM rdf_index_job WHERE id = :id")
    @RegisterRowMapper(RdfIndexJobMapper.class)
    RdfIndexJobRecord findById(@Bind("id") String id);

    @SqlQuery("SELECT * FROM rdf_index_job WHERE status IN (<statuses>) ORDER BY createdAt DESC")
    @RegisterRowMapper(RdfIndexJobMapper.class)
    List<RdfIndexJobRecord> findByStatuses(@BindList("statuses") List<String> statuses);

    @SqlQuery(
        "SELECT * FROM rdf_index_job WHERE status IN (<statuses>) ORDER BY createdAt DESC LIMIT :limit")
    @RegisterRowMapper(RdfIndexJobMapper.class)
    List<RdfIndexJobRecord> findByStatusesWithLimit(
        @BindList("statuses") List<String> statuses, @Bind("limit") int limit);

    @SqlQuery("SELECT id FROM rdf_index_job WHERE status IN ('READY', 'RUNNING', 'STOPPING')")
    List<String> getRunningJobIds();

    @SqlUpdate("DELETE FROM rdf_index_job")
    void deleteAll();

    class RdfIndexJobMapper implements RowMapper<RdfIndexJobRecord> {
      @Override
      public RdfIndexJobRecord map(ResultSet rs, StatementContext ctx) throws SQLException {
        return new RdfIndexJobRecord(
            rs.getString("id"),
            rs.getString("status"),
            rs.getString("jobConfiguration"),
            rs.getLong("totalRecords"),
            rs.getLong("processedRecords"),
            rs.getLong("successRecords"),
            rs.getLong("failedRecords"),
            rs.getString("stats"),
            rs.getString("createdBy"),
            rs.getLong("createdAt"),
            (Long) rs.getObject("startedAt"),
            (Long) rs.getObject("completedAt"),
            rs.getLong("updatedAt"),
            rs.getString("errorMessage"));
      }
    }

    record RdfIndexJobRecord(
        String id,
        String status,
        String jobConfiguration,
        long totalRecords,
        long processedRecords,
        long successRecords,
        long failedRecords,
        String stats,
        String createdBy,
        long createdAt,
        Long startedAt,
        Long completedAt,
        long updatedAt,
        String errorMessage) {}
  }

  /** DAO for distributed RDF partitions. */
  interface RdfIndexPartitionDAO {

    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO rdf_index_partition (id, jobId, entityType, partitionIndex, rangeStart, rangeEnd, "
                + "estimatedCount, workUnits, priority, status, processingCursor, claimableAt) "
                + "VALUES (:id, :jobId, :entityType, :partitionIndex, :rangeStart, :rangeEnd, "
                + ":estimatedCount, :workUnits, :priority, :status, :cursor, :claimableAt)",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO rdf_index_partition (id, jobId, entityType, partitionIndex, rangeStart, rangeEnd, "
                + "estimatedCount, workUnits, priority, status, processingCursor, claimableAt) "
                + "VALUES (:id, :jobId, :entityType, :partitionIndex, :rangeStart, :rangeEnd, "
                + ":estimatedCount, :workUnits, :priority, :status, :cursor, :claimableAt)",
        connectionType = POSTGRES)
    void insert(
        @Bind("id") String id,
        @Bind("jobId") String jobId,
        @Bind("entityType") String entityType,
        @Bind("partitionIndex") int partitionIndex,
        @Bind("rangeStart") long rangeStart,
        @Bind("rangeEnd") long rangeEnd,
        @Bind("estimatedCount") long estimatedCount,
        @Bind("workUnits") long workUnits,
        @Bind("priority") int priority,
        @Bind("status") String status,
        @Bind("cursor") long cursor,
        @Bind("claimableAt") long claimableAt);

    @SqlUpdate(
        "UPDATE rdf_index_partition SET status = :status, processingCursor = :cursor, "
            + "processedCount = :processedCount, successCount = :successCount, failedCount = :failedCount, "
            + "assignedServer = :assignedServer, claimedAt = :claimedAt, startedAt = :startedAt, "
            + "completedAt = :completedAt, lastUpdateAt = :lastUpdateAt, lastError = :lastError, "
            + "retryCount = :retryCount WHERE id = :id")
    void update(
        @Bind("id") String id,
        @Bind("status") String status,
        @Bind("cursor") long cursor,
        @Bind("processedCount") long processedCount,
        @Bind("successCount") long successCount,
        @Bind("failedCount") long failedCount,
        @Bind("assignedServer") String assignedServer,
        @Bind("claimedAt") Long claimedAt,
        @Bind("startedAt") Long startedAt,
        @Bind("completedAt") Long completedAt,
        @Bind("lastUpdateAt") Long lastUpdateAt,
        @Bind("lastError") String lastError,
        @Bind("retryCount") int retryCount);

    @SqlUpdate(
        "UPDATE rdf_index_partition SET processingCursor = :cursor, processedCount = :processedCount, "
            + "successCount = :successCount, failedCount = :failedCount, lastUpdateAt = :lastUpdateAt "
            + "WHERE id = :id")
    void updateProgress(
        @Bind("id") String id,
        @Bind("cursor") long cursor,
        @Bind("processedCount") long processedCount,
        @Bind("successCount") long successCount,
        @Bind("failedCount") long failedCount,
        @Bind("lastUpdateAt") long lastUpdateAt);

    @SqlUpdate("UPDATE rdf_index_partition SET lastUpdateAt = :lastUpdateAt WHERE id = :id")
    void updateHeartbeat(@Bind("id") String id, @Bind("lastUpdateAt") long lastUpdateAt);

    @SqlQuery("SELECT * FROM rdf_index_partition WHERE id = :id")
    @RegisterRowMapper(RdfIndexPartitionMapper.class)
    RdfIndexPartitionRecord findById(@Bind("id") String id);

    @SqlQuery(
        "SELECT * FROM rdf_index_partition WHERE jobId = :jobId ORDER BY priority DESC, entityType, partitionIndex")
    @RegisterRowMapper(RdfIndexPartitionMapper.class)
    List<RdfIndexPartitionRecord> findByJobId(@Bind("jobId") String jobId);

    @SqlQuery(
        "SELECT COUNT(*) FROM rdf_index_partition WHERE jobId = :jobId AND status = 'PENDING'")
    int countPendingPartitions(@Bind("jobId") String jobId);

    @SqlQuery(
        "SELECT COUNT(*) FROM rdf_index_partition WHERE jobId = :jobId AND status = 'PROCESSING'")
    int countInFlightPartitions(@Bind("jobId") String jobId);

    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE rdf_index_partition p "
                + "JOIN (SELECT id FROM rdf_index_partition WHERE jobId = :jobId AND status = 'PENDING' "
                + "AND claimableAt <= :now "
                + "ORDER BY priority DESC, entityType, partitionIndex LIMIT 1 FOR UPDATE SKIP LOCKED) t ON p.id = t.id "
                + "SET p.status = 'PROCESSING', p.assignedServer = :serverId, p.claimedAt = :now, "
                + "p.startedAt = :now, p.lastUpdateAt = :now",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE rdf_index_partition SET status = 'PROCESSING', "
                + "assignedServer = :serverId, claimedAt = :now, startedAt = :now, lastUpdateAt = :now "
                + "WHERE id = (SELECT id FROM rdf_index_partition WHERE jobId = :jobId AND status = 'PENDING' "
                + "AND claimableAt <= :now "
                + "ORDER BY priority DESC, entityType, partitionIndex LIMIT 1 FOR UPDATE SKIP LOCKED)",
        connectionType = POSTGRES)
    int claimNextPartitionAtomic(
        @Bind("jobId") String jobId, @Bind("serverId") String serverId, @Bind("now") long now);

    @SqlQuery(
        "SELECT * FROM rdf_index_partition WHERE jobId = :jobId AND status = 'PROCESSING' "
            + "AND assignedServer = :serverId AND claimedAt = :claimedAt "
            + "ORDER BY priority DESC, entityType, partitionIndex LIMIT 1")
    @RegisterRowMapper(RdfIndexPartitionMapper.class)
    RdfIndexPartitionRecord findLatestClaimedPartition(
        @Bind("jobId") String jobId,
        @Bind("serverId") String serverId,
        @Bind("claimedAt") long claimedAt);

    @SqlUpdate(
        "UPDATE rdf_index_partition SET status = 'PENDING', assignedServer = NULL, claimedAt = NULL, "
            + "retryCount = retryCount + 1, lastError = 'Reclaimed due to stale heartbeat' "
            + "WHERE jobId = :jobId AND status = 'PROCESSING' AND lastUpdateAt < :staleThreshold "
            + "AND retryCount < :maxRetries")
    int reclaimStalePartitionsForRetry(
        @Bind("jobId") String jobId,
        @Bind("staleThreshold") long staleThreshold,
        @Bind("maxRetries") int maxRetries);

    @SqlUpdate(
        "UPDATE rdf_index_partition SET status = 'FAILED', "
            + "lastError = 'Exceeded max retries after stale heartbeat', completedAt = :now "
            + "WHERE jobId = :jobId AND status = 'PROCESSING' AND lastUpdateAt < :staleThreshold "
            + "AND retryCount >= :maxRetries")
    int failStalePartitionsExceedingRetries(
        @Bind("jobId") String jobId,
        @Bind("staleThreshold") long staleThreshold,
        @Bind("maxRetries") int maxRetries,
        @Bind("now") long now);

    @SqlUpdate(
        "UPDATE rdf_index_partition SET status = 'CANCELLED' WHERE jobId = :jobId AND status = 'PENDING'")
    int cancelPendingPartitions(@Bind("jobId") String jobId);

    @SqlUpdate(
        "UPDATE rdf_index_partition SET status = 'CANCELLED', "
            + "lastError = 'Stopped by user', completedAt = :now, lastUpdateAt = :now "
            + "WHERE jobId = :jobId AND status IN ('PENDING','PROCESSING')")
    int cancelInFlightPartitions(@Bind("jobId") String jobId, @Bind("now") long now);

    @SqlQuery(
        "SELECT COUNT(*) FROM rdf_index_partition "
            + "WHERE jobId = :jobId AND status = 'PROCESSING' AND assignedServer = :serverId")
    int countInFlightPartitionsForServer(
        @Bind("jobId") String jobId, @Bind("serverId") String serverId);

    @SqlQuery("SELECT COUNT(*) FROM rdf_index_partition WHERE jobId = :jobId AND status = :status")
    int countPartitionsByStatus(@Bind("jobId") String jobId, @Bind("status") String status);

    /**
     * Status-guarded variant of {@link #update}: only writes if the row is still
     * PROCESSING. Workers use this on completion so that a concurrent Stop
     * (which moves the row to CANCELLED) isn't overwritten back to
     * COMPLETED/FAILED, which would make the Stop button look unreliable.
     * Returns the number of rows updated (0 means the row was no longer
     * PROCESSING and the caller should skip side effects like server-stat
     * increments).
     */
    @SqlUpdate(
        "UPDATE rdf_index_partition SET status = :status, processingCursor = :cursor, "
            + "processedCount = :processedCount, successCount = :successCount, failedCount = :failedCount, "
            + "assignedServer = :assignedServer, claimedAt = :claimedAt, startedAt = :startedAt, "
            + "completedAt = :completedAt, lastUpdateAt = :lastUpdateAt, lastError = :lastError, "
            + "retryCount = :retryCount WHERE id = :id AND status = 'PROCESSING'")
    int updateIfProcessing(
        @Bind("id") String id,
        @Bind("status") String status,
        @Bind("cursor") long cursor,
        @Bind("processedCount") long processedCount,
        @Bind("successCount") long successCount,
        @Bind("failedCount") long failedCount,
        @Bind("assignedServer") String assignedServer,
        @Bind("claimedAt") Long claimedAt,
        @Bind("startedAt") Long startedAt,
        @Bind("completedAt") Long completedAt,
        @Bind("lastUpdateAt") Long lastUpdateAt,
        @Bind("lastError") String lastError,
        @Bind("retryCount") int retryCount);

    @SqlUpdate(
        "UPDATE rdf_index_partition SET status = :status, assignedServer = NULL, claimedAt = NULL, "
            + "lastError = :reason, lastUpdateAt = :updatedAt, completedAt = :completedAt "
            + "WHERE jobId = :jobId AND status = 'PROCESSING' AND assignedServer = :serverId")
    int releaseProcessingPartitions(
        @Bind("jobId") String jobId,
        @Bind("serverId") String serverId,
        @Bind("status") String status,
        @Bind("reason") String reason,
        @Bind("updatedAt") long updatedAt,
        @Bind("completedAt") Long completedAt);

    @SqlQuery(
        "SELECT entityType, "
            + "SUM(estimatedCount) as totalRecords, "
            + "SUM(processedCount) as processedRecords, "
            + "SUM(successCount) as successRecords, "
            + "SUM(failedCount) as failedRecords, "
            + "COUNT(*) as totalPartitions, "
            + "SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completedPartitions, "
            + "SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failedPartitions "
            + "FROM rdf_index_partition WHERE jobId = :jobId GROUP BY entityType")
    @RegisterRowMapper(RdfEntityStatsMapper.class)
    List<RdfEntityStatsRecord> getEntityStats(@Bind("jobId") String jobId);

    @SqlQuery(
        "SELECT "
            + "SUM(estimatedCount) as totalRecords, "
            + "SUM(processedCount) as processedRecords, "
            + "SUM(successCount) as successRecords, "
            + "SUM(failedCount) as failedRecords, "
            + "COUNT(*) as totalPartitions, "
            + "SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completedPartitions, "
            + "SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failedPartitions, "
            + "SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pendingPartitions, "
            + "SUM(CASE WHEN status = 'PROCESSING' THEN 1 ELSE 0 END) as processingPartitions "
            + "FROM rdf_index_partition WHERE jobId = :jobId")
    @RegisterRowMapper(RdfAggregatedStatsMapper.class)
    RdfAggregatedStatsRecord getAggregatedStats(@Bind("jobId") String jobId);

    @SqlQuery(
        "SELECT assignedServer, "
            + "SUM(processedCount) as processedRecords, "
            + "SUM(successCount) as successRecords, "
            + "SUM(failedCount) as failedRecords, "
            + "COUNT(*) as totalPartitions, "
            + "SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completedPartitions, "
            + "SUM(CASE WHEN status = 'PROCESSING' THEN 1 ELSE 0 END) as processingPartitions "
            + "FROM rdf_index_partition WHERE jobId = :jobId AND assignedServer IS NOT NULL "
            + "GROUP BY assignedServer")
    @RegisterRowMapper(RdfServerStatsMapper.class)
    List<RdfServerPartitionStatsRecord> getServerStats(@Bind("jobId") String jobId);

    @SqlQuery(
        "SELECT DISTINCT assignedServer FROM rdf_index_partition "
            + "WHERE jobId = :jobId AND assignedServer IS NOT NULL")
    List<String> getAssignedServers(@Bind("jobId") String jobId);

    @SqlQuery(
        "SELECT lastError FROM rdf_index_partition "
            + "WHERE jobId = :jobId AND lastError IS NOT NULL "
            + "ORDER BY lastUpdateAt DESC LIMIT :limit")
    List<String> findRecentPartitionErrors(@Bind("jobId") String jobId, @Bind("limit") int limit);

    @SqlUpdate("DELETE FROM rdf_index_partition")
    void deleteAll();

    class RdfIndexPartitionMapper implements RowMapper<RdfIndexPartitionRecord> {
      @Override
      public RdfIndexPartitionRecord map(ResultSet rs, StatementContext ctx) throws SQLException {
        return new RdfIndexPartitionRecord(
            rs.getString("id"),
            rs.getString("jobId"),
            rs.getString("entityType"),
            rs.getInt("partitionIndex"),
            rs.getLong("rangeStart"),
            rs.getLong("rangeEnd"),
            rs.getLong("estimatedCount"),
            rs.getLong("workUnits"),
            rs.getInt("priority"),
            rs.getString("status"),
            rs.getLong("processingCursor"),
            rs.getLong("processedCount"),
            rs.getLong("successCount"),
            rs.getLong("failedCount"),
            rs.getString("assignedServer"),
            (Long) rs.getObject("claimedAt"),
            (Long) rs.getObject("startedAt"),
            (Long) rs.getObject("completedAt"),
            (Long) rs.getObject("lastUpdateAt"),
            rs.getString("lastError"),
            rs.getInt("retryCount"),
            rs.getLong("claimableAt"));
      }
    }

    class RdfEntityStatsMapper implements RowMapper<RdfEntityStatsRecord> {
      @Override
      public RdfEntityStatsRecord map(ResultSet rs, StatementContext ctx) throws SQLException {
        return new RdfEntityStatsRecord(
            rs.getString("entityType"),
            rs.getLong("totalRecords"),
            rs.getLong("processedRecords"),
            rs.getLong("successRecords"),
            rs.getLong("failedRecords"),
            rs.getInt("totalPartitions"),
            rs.getInt("completedPartitions"),
            rs.getInt("failedPartitions"));
      }
    }

    class RdfAggregatedStatsMapper implements RowMapper<RdfAggregatedStatsRecord> {
      @Override
      public RdfAggregatedStatsRecord map(ResultSet rs, StatementContext ctx) throws SQLException {
        return new RdfAggregatedStatsRecord(
            rs.getLong("totalRecords"),
            rs.getLong("processedRecords"),
            rs.getLong("successRecords"),
            rs.getLong("failedRecords"),
            rs.getInt("totalPartitions"),
            rs.getInt("completedPartitions"),
            rs.getInt("failedPartitions"),
            rs.getInt("pendingPartitions"),
            rs.getInt("processingPartitions"));
      }
    }

    class RdfServerStatsMapper implements RowMapper<RdfServerPartitionStatsRecord> {
      @Override
      public RdfServerPartitionStatsRecord map(ResultSet rs, StatementContext ctx)
          throws SQLException {
        return new RdfServerPartitionStatsRecord(
            rs.getString("assignedServer"),
            rs.getLong("processedRecords"),
            rs.getLong("successRecords"),
            rs.getLong("failedRecords"),
            rs.getInt("totalPartitions"),
            rs.getInt("completedPartitions"),
            rs.getInt("processingPartitions"));
      }
    }

    record RdfIndexPartitionRecord(
        String id,
        String jobId,
        String entityType,
        int partitionIndex,
        long rangeStart,
        long rangeEnd,
        long estimatedCount,
        long workUnits,
        int priority,
        String status,
        long cursor,
        long processedCount,
        long successCount,
        long failedCount,
        String assignedServer,
        Long claimedAt,
        Long startedAt,
        Long completedAt,
        Long lastUpdateAt,
        String lastError,
        int retryCount,
        long claimableAt) {}

    record RdfEntityStatsRecord(
        String entityType,
        long totalRecords,
        long processedRecords,
        long successRecords,
        long failedRecords,
        int totalPartitions,
        int completedPartitions,
        int failedPartitions) {}

    record RdfAggregatedStatsRecord(
        long totalRecords,
        long processedRecords,
        long successRecords,
        long failedRecords,
        int totalPartitions,
        int completedPartitions,
        int failedPartitions,
        int pendingPartitions,
        int processingPartitions) {}

    record RdfServerPartitionStatsRecord(
        String serverId,
        long processedRecords,
        long successRecords,
        long failedRecords,
        int totalPartitions,
        int completedPartitions,
        int processingPartitions) {}
  }

  /** DAO for RDF distributed reindex lock. */
  interface RdfReindexLockDAO {

    @ConnectionAwareSqlUpdate(
        value =
            "INSERT IGNORE INTO rdf_reindex_lock (lockKey, jobId, serverId, acquiredAt, lastHeartbeat, expiresAt) "
                + "VALUES (:lockKey, :jobId, :serverId, :acquiredAt, :lastHeartbeat, :expiresAt)",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO rdf_reindex_lock (lockKey, jobId, serverId, acquiredAt, lastHeartbeat, expiresAt) "
                + "VALUES (:lockKey, :jobId, :serverId, :acquiredAt, :lastHeartbeat, :expiresAt) "
                + "ON CONFLICT (lockKey) DO NOTHING",
        connectionType = POSTGRES)
    int insertIfNotExists(
        @Bind("lockKey") String lockKey,
        @Bind("jobId") String jobId,
        @Bind("serverId") String serverId,
        @Bind("acquiredAt") long acquiredAt,
        @Bind("lastHeartbeat") long lastHeartbeat,
        @Bind("expiresAt") long expiresAt);

    @SqlUpdate(
        "UPDATE rdf_reindex_lock SET lastHeartbeat = :lastHeartbeat, expiresAt = :expiresAt "
            + "WHERE lockKey = :lockKey AND jobId = :jobId")
    int updateHeartbeat(
        @Bind("lockKey") String lockKey,
        @Bind("jobId") String jobId,
        @Bind("lastHeartbeat") long lastHeartbeat,
        @Bind("expiresAt") long expiresAt);

    @SqlQuery("SELECT * FROM rdf_reindex_lock WHERE lockKey = :lockKey")
    @RegisterRowMapper(RdfReindexLockMapper.class)
    RdfReindexLockRecord findByKey(@Bind("lockKey") String lockKey);

    @SqlUpdate("DELETE FROM rdf_reindex_lock WHERE lockKey = :lockKey")
    void delete(@Bind("lockKey") String lockKey);

    @SqlUpdate("DELETE FROM rdf_reindex_lock WHERE lockKey = :lockKey AND jobId = :jobId")
    int deleteByKeyAndJob(@Bind("lockKey") String lockKey, @Bind("jobId") String jobId);

    @SqlUpdate("DELETE FROM rdf_reindex_lock WHERE expiresAt < :now")
    int deleteExpiredLocks(@Bind("now") long now);

    @SqlUpdate(
        "UPDATE rdf_reindex_lock SET jobId = :toJobId, serverId = :serverId, "
            + "lastHeartbeat = :heartbeat, expiresAt = :expiresAt "
            + "WHERE lockKey = :lockKey AND jobId = :fromJobId")
    int updateLockOwner(
        @Bind("lockKey") String lockKey,
        @Bind("fromJobId") String fromJobId,
        @Bind("toJobId") String toJobId,
        @Bind("serverId") String serverId,
        @Bind("heartbeat") long heartbeat,
        @Bind("expiresAt") long expiresAt);

    default boolean tryAcquireLock(
        String lockKey, String jobId, String serverId, long acquiredAt, long expiresAt) {
      deleteExpiredLocks(System.currentTimeMillis());
      int inserted = insertIfNotExists(lockKey, jobId, serverId, acquiredAt, acquiredAt, expiresAt);
      if (inserted > 0) {
        return true;
      }

      RdfReindexLockRecord existing = findByKey(lockKey);
      if (existing != null && existing.isExpired()) {
        delete(lockKey);
        inserted = insertIfNotExists(lockKey, jobId, serverId, acquiredAt, acquiredAt, expiresAt);
        return inserted > 0;
      }
      return false;
    }

    default void releaseLock(String lockKey, String jobId) {
      deleteByKeyAndJob(lockKey, jobId);
    }

    default boolean transferLock(
        String lockKey,
        String fromJobId,
        String toJobId,
        String serverId,
        long heartbeat,
        long expiresAt) {
      return updateLockOwner(lockKey, fromJobId, toJobId, serverId, heartbeat, expiresAt) > 0;
    }

    class RdfReindexLockMapper implements RowMapper<RdfReindexLockRecord> {
      @Override
      public RdfReindexLockRecord map(ResultSet rs, StatementContext ctx) throws SQLException {
        return new RdfReindexLockRecord(
            rs.getString("lockKey"),
            rs.getString("jobId"),
            rs.getString("serverId"),
            rs.getLong("acquiredAt"),
            rs.getLong("lastHeartbeat"),
            rs.getLong("expiresAt"));
      }
    }

    record RdfReindexLockRecord(
        String lockKey,
        String jobId,
        String serverId,
        long acquiredAt,
        long lastHeartbeat,
        long expiresAt) {

      public boolean isExpired() {
        return System.currentTimeMillis() > expiresAt;
      }
    }
  }

  /** DAO for RDF per-server distributed stats. */
  interface RdfIndexServerStatsDAO {

    record ServerStatsRecord(
        String id,
        String jobId,
        String serverId,
        String entityType,
        long processedRecords,
        long successRecords,
        long failedRecords,
        int partitionsCompleted,
        int partitionsFailed,
        long lastUpdatedAt) {}

    record AggregatedServerStats(
        long processedRecords,
        long successRecords,
        long failedRecords,
        int partitionsCompleted,
        int partitionsFailed) {}

    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO rdf_index_server_stats (id, jobId, serverId, entityType, processedRecords, "
                + "successRecords, failedRecords, partitionsCompleted, partitionsFailed, lastUpdatedAt) "
                + "VALUES (:id, :jobId, :serverId, :entityType, :processedRecords, :successRecords, "
                + ":failedRecords, :partitionsCompleted, :partitionsFailed, :lastUpdatedAt) "
                + "ON DUPLICATE KEY UPDATE "
                + "processedRecords = processedRecords + VALUES(processedRecords), "
                + "successRecords = successRecords + VALUES(successRecords), "
                + "failedRecords = failedRecords + VALUES(failedRecords), "
                + "partitionsCompleted = partitionsCompleted + VALUES(partitionsCompleted), "
                + "partitionsFailed = partitionsFailed + VALUES(partitionsFailed), "
                + "lastUpdatedAt = VALUES(lastUpdatedAt)",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO rdf_index_server_stats (id, jobId, serverId, entityType, processedRecords, "
                + "successRecords, failedRecords, partitionsCompleted, partitionsFailed, lastUpdatedAt) "
                + "VALUES (:id, :jobId, :serverId, :entityType, :processedRecords, :successRecords, "
                + ":failedRecords, :partitionsCompleted, :partitionsFailed, :lastUpdatedAt) "
                + "ON CONFLICT (jobId, serverId, entityType) DO UPDATE SET "
                + "processedRecords = rdf_index_server_stats.processedRecords + EXCLUDED.processedRecords, "
                + "successRecords = rdf_index_server_stats.successRecords + EXCLUDED.successRecords, "
                + "failedRecords = rdf_index_server_stats.failedRecords + EXCLUDED.failedRecords, "
                + "partitionsCompleted = rdf_index_server_stats.partitionsCompleted + EXCLUDED.partitionsCompleted, "
                + "partitionsFailed = rdf_index_server_stats.partitionsFailed + EXCLUDED.partitionsFailed, "
                + "lastUpdatedAt = EXCLUDED.lastUpdatedAt",
        connectionType = POSTGRES)
    void incrementStats(
        @Bind("id") String id,
        @Bind("jobId") String jobId,
        @Bind("serverId") String serverId,
        @Bind("entityType") String entityType,
        @Bind("processedRecords") long processedRecords,
        @Bind("successRecords") long successRecords,
        @Bind("failedRecords") long failedRecords,
        @Bind("partitionsCompleted") int partitionsCompleted,
        @Bind("partitionsFailed") int partitionsFailed,
        @Bind("lastUpdatedAt") long lastUpdatedAt);

    @SqlQuery("SELECT * FROM rdf_index_server_stats WHERE jobId = :jobId")
    @RegisterRowMapper(RdfServerStatsRecordMapper.class)
    List<ServerStatsRecord> findByJobId(@Bind("jobId") String jobId);

    @SqlQuery(
        "SELECT "
            + "COALESCE(SUM(processedRecords), 0) as processedRecords, "
            + "COALESCE(SUM(successRecords), 0) as successRecords, "
            + "COALESCE(SUM(failedRecords), 0) as failedRecords, "
            + "COALESCE(SUM(partitionsCompleted), 0) as partitionsCompleted, "
            + "COALESCE(SUM(partitionsFailed), 0) as partitionsFailed "
            + "FROM rdf_index_server_stats WHERE jobId = :jobId")
    @RegisterRowMapper(RdfAggregatedServerStatsMapper.class)
    AggregatedServerStats getAggregatedStats(@Bind("jobId") String jobId);

    @SqlUpdate("DELETE FROM rdf_index_server_stats")
    void deleteAll();

    class RdfServerStatsRecordMapper implements RowMapper<ServerStatsRecord> {
      @Override
      public ServerStatsRecord map(ResultSet rs, StatementContext ctx) throws SQLException {
        return new ServerStatsRecord(
            rs.getString("id"),
            rs.getString("jobId"),
            rs.getString("serverId"),
            rs.getString("entityType"),
            rs.getLong("processedRecords"),
            rs.getLong("successRecords"),
            rs.getLong("failedRecords"),
            rs.getInt("partitionsCompleted"),
            rs.getInt("partitionsFailed"),
            rs.getLong("lastUpdatedAt"));
      }
    }

    class RdfAggregatedServerStatsMapper implements RowMapper<AggregatedServerStats> {
      @Override
      public AggregatedServerStats map(ResultSet rs, StatementContext ctx) throws SQLException {
        return new AggregatedServerStats(
            rs.getLong("processedRecords"),
            rs.getLong("successRecords"),
            rs.getLong("failedRecords"),
            rs.getInt("partitionsCompleted"),
            rs.getInt("partitionsFailed"));
      }
    }
  }
}
