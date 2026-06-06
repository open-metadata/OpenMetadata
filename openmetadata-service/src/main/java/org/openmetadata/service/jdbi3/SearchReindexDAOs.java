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
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import lombok.Builder;
import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;
import org.jdbi.v3.sqlobject.CreateSqlObject;
import org.jdbi.v3.sqlobject.config.RegisterRowMapper;
import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.customizer.BindBean;
import org.jdbi.v3.sqlobject.customizer.BindList;
import org.jdbi.v3.sqlobject.statement.SqlBatch;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlUpdate;

public interface SearchReindexDAOs {
  @CreateSqlObject
  SearchIndexJobDAO searchIndexJobDAO();

  @CreateSqlObject
  SearchIndexPartitionDAO searchIndexPartitionDAO();

  @CreateSqlObject
  SearchReindexLockDAO searchReindexLockDAO();

  @CreateSqlObject
  SearchIndexFailureDAO searchIndexFailureDAO();

  @CreateSqlObject
  SearchIndexRetryQueueDAO searchIndexRetryQueueDAO();

  @CreateSqlObject
  SearchIndexServerStatsDAO searchIndexServerStatsDAO();

  /** DAO for distributed search index jobs */
  interface SearchIndexJobDAO {

    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO search_index_job (id, status, jobConfiguration, targetIndexPrefix, totalRecords, "
                + "processedRecords, successRecords, failedRecords, stats, createdBy, createdAt, updatedAt, "
                + "registrationDeadline) "
                + "VALUES (:id, :status, :jobConfiguration, :targetIndexPrefix, :totalRecords, "
                + ":processedRecords, :successRecords, :failedRecords, :stats, :createdBy, :createdAt, :updatedAt, "
                + ":registrationDeadline)",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO search_index_job (id, status, jobConfiguration, targetIndexPrefix, totalRecords, "
                + "processedRecords, successRecords, failedRecords, stats, createdBy, createdAt, updatedAt, "
                + "registrationDeadline) "
                + "VALUES (:id, :status, :jobConfiguration::jsonb, :targetIndexPrefix, :totalRecords, "
                + ":processedRecords, :successRecords, :failedRecords, :stats::jsonb, :createdBy, :createdAt, :updatedAt, "
                + ":registrationDeadline)",
        connectionType = POSTGRES)
    void insert(
        @Bind("id") String id,
        @Bind("status") String status,
        @Bind("jobConfiguration") String jobConfiguration,
        @Bind("targetIndexPrefix") String targetIndexPrefix,
        @Bind("totalRecords") long totalRecords,
        @Bind("processedRecords") long processedRecords,
        @Bind("successRecords") long successRecords,
        @Bind("failedRecords") long failedRecords,
        @Bind("stats") String stats,
        @Bind("createdBy") String createdBy,
        @Bind("createdAt") long createdAt,
        @Bind("updatedAt") long updatedAt,
        @Bind("registrationDeadline") Long registrationDeadline);

    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE search_index_job SET status = :status, processedRecords = :processedRecords, "
                + "successRecords = :successRecords, failedRecords = :failedRecords, stats = :stats, "
                + "startedAt = :startedAt, completedAt = :completedAt, updatedAt = :updatedAt, "
                + "errorMessage = :errorMessage WHERE id = :id",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE search_index_job SET status = :status, processedRecords = :processedRecords, "
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

    @SqlQuery("SELECT * FROM search_index_job WHERE id = :id")
    @RegisterRowMapper(SearchIndexJobMapper.class)
    SearchIndexJobRecord findById(@Bind("id") String id);

    @SqlQuery("SELECT * FROM search_index_job WHERE status IN (<statuses>) ORDER BY createdAt DESC")
    @RegisterRowMapper(SearchIndexJobMapper.class)
    List<SearchIndexJobRecord> findByStatuses(@BindList("statuses") List<String> statuses);

    @SqlQuery(
        "SELECT * FROM search_index_job WHERE status IN (<statuses>) ORDER BY createdAt DESC LIMIT :limit")
    @RegisterRowMapper(SearchIndexJobMapper.class)
    List<SearchIndexJobRecord> findByStatusesWithLimit(
        @BindList("statuses") List<String> statuses, @Bind("limit") int limit);

    @SqlQuery("SELECT * FROM search_index_job ORDER BY createdAt DESC LIMIT :limit")
    @RegisterRowMapper(SearchIndexJobMapper.class)
    List<SearchIndexJobRecord> listRecent(@Bind("limit") int limit);

    @SqlUpdate("DELETE FROM search_index_job WHERE id = :id")
    void delete(@Bind("id") String id);

    @SqlUpdate(
        "DELETE FROM search_index_job WHERE status IN ('COMPLETED', 'FAILED', 'STOPPED') AND completedAt < :before")
    int deleteOldJobs(@Bind("before") long before);

    @SqlUpdate("DELETE FROM search_index_job")
    void deleteAll();

    @SqlUpdate(
        "UPDATE search_index_job SET registeredServerCount = :serverCount, updatedAt = :updatedAt WHERE id = :id")
    void updateRegisteredServerCount(
        @Bind("id") String id,
        @Bind("serverCount") int serverCount,
        @Bind("updatedAt") long updatedAt);

    @SqlQuery("SELECT registrationDeadline FROM search_index_job WHERE id = :id")
    Long getRegistrationDeadline(@Bind("id") String id);

    @SqlQuery("SELECT registeredServerCount FROM search_index_job WHERE id = :id")
    Integer getRegisteredServerCount(@Bind("id") String id);

    /** Get IDs of currently running jobs - lightweight query for polling */
    @SqlQuery("SELECT id FROM search_index_job WHERE status = 'RUNNING'")
    List<String> getRunningJobIds();

    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE search_index_job SET stagedIndexMapping = :stagedIndexMapping, updatedAt = :updatedAt WHERE id = :id",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE search_index_job SET stagedIndexMapping = :stagedIndexMapping::jsonb, updatedAt = :updatedAt WHERE id = :id",
        connectionType = POSTGRES)
    void updateStagedIndexMapping(
        @Bind("id") String id,
        @Bind("stagedIndexMapping") String stagedIndexMapping,
        @Bind("updatedAt") long updatedAt);

    @SqlUpdate("UPDATE search_index_job SET updatedAt = :updatedAt WHERE id = :id")
    void touchJob(@Bind("id") String id, @Bind("updatedAt") long updatedAt);

    /** Row mapper for SearchIndexJobRecord */
    class SearchIndexJobMapper implements RowMapper<SearchIndexJobRecord> {
      @Override
      public SearchIndexJobRecord map(ResultSet rs, StatementContext ctx) throws SQLException {
        return new SearchIndexJobRecord(
            rs.getString("id"),
            rs.getString("status"),
            rs.getString("jobConfiguration"),
            rs.getString("targetIndexPrefix"),
            rs.getString("stagedIndexMapping"),
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
            rs.getString("errorMessage"),
            (Long) rs.getObject("registrationDeadline"),
            (Integer) rs.getObject("registeredServerCount"));
      }
    }

    /** Record for job data from DB */
    record SearchIndexJobRecord(
        String id,
        String status,
        String jobConfiguration,
        String targetIndexPrefix,
        String stagedIndexMapping,
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
        String errorMessage,
        Long registrationDeadline,
        Integer registeredServerCount) {}
  }

  /** DAO for distributed search index partitions */
  interface SearchIndexPartitionDAO {

    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO search_index_partition (id, jobId, entityType, partitionIndex, rangeStart, rangeEnd, "
                + "estimatedCount, workUnits, priority, status, processingCursor, claimableAt) "
                + "VALUES (:id, :jobId, :entityType, :partitionIndex, :rangeStart, :rangeEnd, "
                + ":estimatedCount, :workUnits, :priority, :status, :cursor, :claimableAt)",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO search_index_partition (id, jobId, entityType, partitionIndex, rangeStart, rangeEnd, "
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
        "UPDATE search_index_partition SET status = :status, processingCursor = :cursor, "
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
        "UPDATE search_index_partition SET processingCursor = :cursor, processedCount = :processedCount, "
            + "successCount = :successCount, failedCount = :failedCount, lastUpdateAt = :lastUpdateAt "
            + "WHERE id = :id")
    void updateProgress(
        @Bind("id") String id,
        @Bind("cursor") long cursor,
        @Bind("processedCount") long processedCount,
        @Bind("successCount") long successCount,
        @Bind("failedCount") long failedCount,
        @Bind("lastUpdateAt") long lastUpdateAt);

    @SqlUpdate("UPDATE search_index_partition SET lastUpdateAt = :lastUpdateAt WHERE id = :id")
    void updateHeartbeat(@Bind("id") String id, @Bind("lastUpdateAt") long lastUpdateAt);

    @SqlQuery("SELECT * FROM search_index_partition WHERE id = :id")
    @RegisterRowMapper(SearchIndexPartitionMapper.class)
    SearchIndexPartitionRecord findById(@Bind("id") String id);

    @SqlQuery(
        "SELECT * FROM search_index_partition WHERE jobId = :jobId ORDER BY priority DESC, entityType, partitionIndex")
    @RegisterRowMapper(SearchIndexPartitionMapper.class)
    List<SearchIndexPartitionRecord> findByJobId(@Bind("jobId") String jobId);

    @SqlQuery(
        "SELECT * FROM search_index_partition WHERE jobId = :jobId AND status = 'PENDING' "
            + "AND claimableAt <= :now "
            + "ORDER BY priority DESC, entityType, partitionIndex LIMIT 1 FOR UPDATE SKIP LOCKED")
    @RegisterRowMapper(SearchIndexPartitionMapper.class)
    SearchIndexPartitionRecord findNextPendingPartitionForUpdate(
        @Bind("jobId") String jobId, @Bind("now") long now);

    @SqlUpdate(
        "UPDATE search_index_partition SET status = 'PROCESSING', "
            + "assignedServer = :serverId, claimedAt = :now, startedAt = :now, lastUpdateAt = :now "
            + "WHERE id = :partitionId AND status = 'PENDING'")
    int claimPartitionById(
        @Bind("partitionId") String partitionId,
        @Bind("serverId") String serverId,
        @Bind("now") long now);

    /**
     * Atomically claim the next available partition using UPDATE with subquery.
     * MySQL requires a JOIN-based approach since it doesn't allow subquery referencing same table.
     * PostgreSQL can use direct subquery approach.
     * Only claims partitions where claimableAt <= now (for staggered release).
     */
    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE search_index_partition p "
                + "JOIN (SELECT id FROM search_index_partition WHERE jobId = :jobId AND status = 'PENDING' "
                + "AND claimableAt <= :now "
                + "ORDER BY priority DESC, entityType, partitionIndex LIMIT 1 FOR UPDATE SKIP LOCKED) t ON p.id = t.id "
                + "SET p.status = 'PROCESSING', p.assignedServer = :serverId, p.claimedAt = :now, "
                + "p.startedAt = :now, p.lastUpdateAt = :now",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE search_index_partition SET status = 'PROCESSING', "
                + "assignedServer = :serverId, claimedAt = :now, startedAt = :now, lastUpdateAt = :now "
                + "WHERE id = (SELECT id FROM search_index_partition WHERE jobId = :jobId AND status = 'PENDING' "
                + "AND claimableAt <= :now "
                + "ORDER BY priority DESC, entityType, partitionIndex LIMIT 1 FOR UPDATE SKIP LOCKED)",
        connectionType = POSTGRES)
    int claimNextPartitionAtomic(
        @Bind("jobId") String jobId, @Bind("serverId") String serverId, @Bind("now") long now);

    @SqlQuery(
        "SELECT * FROM search_index_partition WHERE jobId = :jobId AND status = 'PROCESSING' "
            + "AND assignedServer = :serverId AND claimedAt = :claimedAt "
            + "ORDER BY priority DESC, entityType, partitionIndex LIMIT 1")
    @RegisterRowMapper(SearchIndexPartitionMapper.class)
    SearchIndexPartitionRecord findLatestClaimedPartition(
        @Bind("jobId") String jobId,
        @Bind("serverId") String serverId,
        @Bind("claimedAt") long claimedAt);

    @SqlQuery(
        "SELECT * FROM search_index_partition WHERE jobId = :jobId AND status = :status "
            + "ORDER BY priority DESC, entityType, partitionIndex")
    @RegisterRowMapper(SearchIndexPartitionMapper.class)
    List<SearchIndexPartitionRecord> findByJobIdAndStatus(
        @Bind("jobId") String jobId, @Bind("status") String status);

    /** Count how many partitions a server currently has in PROCESSING status for a job */
    @SqlQuery(
        "SELECT COUNT(*) FROM search_index_partition "
            + "WHERE jobId = :jobId AND status = 'PROCESSING' AND assignedServer = :serverId")
    int countInFlightPartitions(@Bind("jobId") String jobId, @Bind("serverId") String serverId);

    /** Count total PENDING partitions for a job */
    @SqlQuery(
        "SELECT COUNT(*) FROM search_index_partition WHERE jobId = :jobId AND status = 'PENDING'")
    int countPendingPartitions(@Bind("jobId") String jobId);

    /** Count total partitions for a job */
    @SqlQuery("SELECT COUNT(*) FROM search_index_partition WHERE jobId = :jobId")
    int countTotalPartitions(@Bind("jobId") String jobId);

    /** Count partitions claimed by a specific server (PROCESSING or COMPLETED) */
    @SqlQuery(
        "SELECT COUNT(*) FROM search_index_partition "
            + "WHERE jobId = :jobId AND assignedServer = :serverId")
    int countPartitionsClaimedByServer(
        @Bind("jobId") String jobId, @Bind("serverId") String serverId);

    /** Count distinct servers that have claimed partitions for a job */
    @SqlQuery(
        "SELECT COUNT(DISTINCT assignedServer) FROM search_index_partition "
            + "WHERE jobId = :jobId AND assignedServer IS NOT NULL")
    int countParticipatingServers(@Bind("jobId") String jobId);

    /**
     * Reclaim stale partitions that can still be retried (under max retry limit).
     * Returns the count of partitions reset to PENDING.
     */
    @SqlUpdate(
        "UPDATE search_index_partition SET status = 'PENDING', assignedServer = NULL, claimedAt = NULL, "
            + "retryCount = retryCount + 1, lastError = 'Reclaimed due to stale heartbeat' "
            + "WHERE jobId = :jobId AND status = 'PROCESSING' AND lastUpdateAt < :staleThreshold "
            + "AND retryCount < :maxRetries")
    int reclaimStalePartitionsForRetry(
        @Bind("jobId") String jobId,
        @Bind("staleThreshold") long staleThreshold,
        @Bind("maxRetries") int maxRetries);

    /**
     * Mark stale partitions that have exceeded retry limit as FAILED.
     * Returns the count of partitions marked as failed.
     */
    @SqlUpdate(
        "UPDATE search_index_partition SET status = 'FAILED', "
            + "lastError = 'Exceeded max retries after stale heartbeat', completedAt = :now "
            + "WHERE jobId = :jobId AND status = 'PROCESSING' AND lastUpdateAt < :staleThreshold "
            + "AND retryCount >= :maxRetries")
    int failStalePartitionsExceedingRetries(
        @Bind("jobId") String jobId,
        @Bind("staleThreshold") long staleThreshold,
        @Bind("maxRetries") int maxRetries,
        @Bind("now") long now);

    @SqlUpdate(
        "UPDATE search_index_partition SET status = 'CANCELLED' WHERE jobId = :jobId AND status = 'PENDING'")
    int cancelPendingPartitions(@Bind("jobId") String jobId);

    @SqlUpdate(
        "UPDATE search_index_partition SET status = 'CANCELLED', "
            + "lastError = 'Stopped by user', completedAt = :now, lastUpdateAt = :now "
            + "WHERE jobId = :jobId AND status IN ('PENDING','PROCESSING')")
    int cancelInFlightPartitions(@Bind("jobId") String jobId, @Bind("now") long now);

    /**
     * Status-guarded update: only mutates the row when it is still PROCESSING. Used by
     * completion / failure paths so a late-arriving worker write cannot revert a CANCELLED
     * row (set by requestStop) back to COMPLETED/FAILED. Returns the number of rows
     * updated — 0 means another writer (typically requestStop) already moved the row to
     * a terminal state and the caller should treat its update as a no-op.
     */
    @SqlUpdate(
        "UPDATE search_index_partition SET status = :status, processingCursor = :cursor, "
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

    @SqlQuery(
        "SELECT * FROM search_index_partition WHERE jobId = :jobId AND status = 'PROCESSING' "
            + "AND lastUpdateAt < :staleThreshold")
    @RegisterRowMapper(SearchIndexPartitionMapper.class)
    List<SearchIndexPartitionRecord> findStalePartitions(
        @Bind("jobId") String jobId, @Bind("staleThreshold") long staleThreshold);

    @SqlQuery(
        "SELECT entityType, "
            + "SUM(estimatedCount) as totalRecords, "
            + "SUM(processedCount) as processedRecords, "
            + "SUM(successCount) as successRecords, "
            + "SUM(failedCount) as failedRecords, "
            + "COUNT(*) as totalPartitions, "
            + "SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completedPartitions, "
            + "SUM(CASE WHEN status = 'FAILED' THEN 1 ELSE 0 END) as failedPartitions "
            + "FROM search_index_partition WHERE jobId = :jobId GROUP BY entityType")
    @RegisterRowMapper(EntityStatsMapper.class)
    List<EntityStatsRecord> getEntityStats(@Bind("jobId") String jobId);

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
            + "FROM search_index_partition WHERE jobId = :jobId")
    @RegisterRowMapper(AggregatedStatsMapper.class)
    AggregatedStatsRecord getAggregatedStats(@Bind("jobId") String jobId);

    @SqlUpdate("DELETE FROM search_index_partition WHERE jobId = :jobId")
    void deleteByJobId(@Bind("jobId") String jobId);

    @SqlUpdate("DELETE FROM search_index_partition")
    void deleteAll();

    @SqlQuery(
        "SELECT assignedServer, "
            + "SUM(processedCount) as processedRecords, "
            + "SUM(successCount) as successRecords, "
            + "SUM(failedCount) as failedRecords, "
            + "COUNT(*) as totalPartitions, "
            + "SUM(CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END) as completedPartitions, "
            + "SUM(CASE WHEN status = 'PROCESSING' THEN 1 ELSE 0 END) as processingPartitions "
            + "FROM search_index_partition WHERE jobId = :jobId AND assignedServer IS NOT NULL "
            + "GROUP BY assignedServer")
    @RegisterRowMapper(ServerStatsMapper.class)
    List<ServerStatsRecord> getServerStats(@Bind("jobId") String jobId);

    /** Row mapper for partition records */
    class SearchIndexPartitionMapper implements RowMapper<SearchIndexPartitionRecord> {
      @Override
      public SearchIndexPartitionRecord map(ResultSet rs, StatementContext ctx)
          throws SQLException {
        return new SearchIndexPartitionRecord(
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

    /** Row mapper for entity stats */
    class EntityStatsMapper implements RowMapper<EntityStatsRecord> {
      @Override
      public EntityStatsRecord map(ResultSet rs, StatementContext ctx) throws SQLException {
        return new EntityStatsRecord(
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

    /** Row mapper for aggregated stats */
    class AggregatedStatsMapper implements RowMapper<AggregatedStatsRecord> {
      @Override
      public AggregatedStatsRecord map(ResultSet rs, StatementContext ctx) throws SQLException {
        return new AggregatedStatsRecord(
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

    /** Record for partition data from DB */
    record SearchIndexPartitionRecord(
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

    /** Record for entity stats aggregation */
    record EntityStatsRecord(
        String entityType,
        long totalRecords,
        long processedRecords,
        long successRecords,
        long failedRecords,
        int totalPartitions,
        int completedPartitions,
        int failedPartitions) {}

    /** Record for overall job stats aggregation */
    record AggregatedStatsRecord(
        long totalRecords,
        long processedRecords,
        long successRecords,
        long failedRecords,
        int totalPartitions,
        int completedPartitions,
        int failedPartitions,
        int pendingPartitions,
        int processingPartitions) {}

    /** Record for per-server stats aggregation */
    record ServerStatsRecord(
        String serverId,
        long processedRecords,
        long successRecords,
        long failedRecords,
        int totalPartitions,
        int completedPartitions,
        int processingPartitions) {}

    /** Row mapper for server stats */
    class ServerStatsMapper implements RowMapper<ServerStatsRecord> {
      @Override
      public ServerStatsRecord map(ResultSet rs, StatementContext ctx) throws SQLException {
        return new ServerStatsRecord(
            rs.getString("assignedServer"),
            rs.getLong("processedRecords"),
            rs.getLong("successRecords"),
            rs.getLong("failedRecords"),
            rs.getInt("totalPartitions"),
            rs.getInt("completedPartitions"),
            rs.getInt("processingPartitions"));
      }
    }

    /**
     * Record for partition quota statistics used in fair distribution.
     * Includes both partition-count and work-based metrics for fair load balancing.
     *
     * <p>Work-based distribution ensures servers with high-record partitions don't
     * monopolize the workload, even if partition counts appear balanced.
     */
    record PartitionQuotaStats(
        int inFlightCount,
        int totalPartitions,
        int claimedByServer,
        int participatingServers,
        int pendingPartitions,
        long totalWorkUnits,
        long workClaimedByServer,
        long pendingWorkUnits) {}

    /** Row mapper for partition quota stats */
    class PartitionQuotaStatsMapper implements RowMapper<PartitionQuotaStats> {
      @Override
      public PartitionQuotaStats map(ResultSet rs, StatementContext ctx) throws SQLException {
        return new PartitionQuotaStats(
            rs.getInt("inFlightCount"),
            rs.getInt("totalPartitions"),
            rs.getInt("claimedByServer"),
            rs.getInt("participatingServers"),
            rs.getInt("pendingPartitions"),
            rs.getLong("totalWorkUnits"),
            rs.getLong("workClaimedByServer"),
            rs.getLong("pendingWorkUnits"));
      }
    }

    /**
     * Get all quota-related statistics in a single query for fair partition distribution.
     * Includes both partition-count and work-based metrics.
     */
    @SqlQuery(
        "SELECT "
            + "SUM(CASE WHEN status = 'PROCESSING' AND assignedServer = :serverId THEN 1 ELSE 0 END) as inFlightCount, "
            + "COUNT(*) as totalPartitions, "
            + "SUM(CASE WHEN assignedServer = :serverId THEN 1 ELSE 0 END) as claimedByServer, "
            + "COUNT(DISTINCT CASE WHEN assignedServer IS NOT NULL THEN assignedServer END) as participatingServers, "
            + "SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) as pendingPartitions, "
            + "COALESCE(SUM(workUnits), 0) as totalWorkUnits, "
            + "COALESCE(SUM(CASE WHEN assignedServer = :serverId THEN workUnits ELSE 0 END), 0) as workClaimedByServer, "
            + "COALESCE(SUM(CASE WHEN status = 'PENDING' THEN workUnits ELSE 0 END), 0) as pendingWorkUnits "
            + "FROM search_index_partition WHERE jobId = :jobId")
    @RegisterRowMapper(PartitionQuotaStatsMapper.class)
    PartitionQuotaStats getQuotaStats(
        @Bind("jobId") String jobId, @Bind("serverId") String serverId);

    /** Get distinct servers that have claimed partitions for a job */
    @SqlQuery(
        "SELECT DISTINCT assignedServer FROM search_index_partition "
            + "WHERE jobId = :jobId AND assignedServer IS NOT NULL")
    List<String> getAssignedServers(@Bind("jobId") String jobId);
  }

  /** DAO for distributed reindex lock */
  interface SearchReindexLockDAO {

    @SqlUpdate(
        "INSERT INTO search_reindex_lock (lockKey, jobId, serverId, acquiredAt, lastHeartbeat, expiresAt) "
            + "VALUES (:lockKey, :jobId, :serverId, :acquiredAt, :lastHeartbeat, :expiresAt)")
    void insert(
        @Bind("lockKey") String lockKey,
        @Bind("jobId") String jobId,
        @Bind("serverId") String serverId,
        @Bind("acquiredAt") long acquiredAt,
        @Bind("lastHeartbeat") long lastHeartbeat,
        @Bind("expiresAt") long expiresAt);

    @ConnectionAwareSqlUpdate(
        value =
            "INSERT IGNORE INTO search_reindex_lock (lockKey, jobId, serverId, acquiredAt, lastHeartbeat, expiresAt) "
                + "VALUES (:lockKey, :jobId, :serverId, :acquiredAt, :lastHeartbeat, :expiresAt)",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO search_reindex_lock (lockKey, jobId, serverId, acquiredAt, lastHeartbeat, expiresAt) "
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
        "UPDATE search_reindex_lock SET lastHeartbeat = :lastHeartbeat, expiresAt = :expiresAt "
            + "WHERE lockKey = :lockKey AND jobId = :jobId")
    int updateHeartbeat(
        @Bind("lockKey") String lockKey,
        @Bind("jobId") String jobId,
        @Bind("lastHeartbeat") long lastHeartbeat,
        @Bind("expiresAt") long expiresAt);

    @SqlQuery("SELECT * FROM search_reindex_lock WHERE lockKey = :lockKey")
    @RegisterRowMapper(SearchReindexLockMapper.class)
    SearchReindexLockRecord findByKey(@Bind("lockKey") String lockKey);

    @SqlUpdate("DELETE FROM search_reindex_lock WHERE lockKey = :lockKey")
    void delete(@Bind("lockKey") String lockKey);

    @SqlUpdate("DELETE FROM search_reindex_lock WHERE lockKey = :lockKey AND jobId = :jobId")
    int deleteByKeyAndJob(@Bind("lockKey") String lockKey, @Bind("jobId") String jobId);

    @SqlUpdate("DELETE FROM search_reindex_lock WHERE expiresAt < :now")
    int deleteExpiredLocks(@Bind("now") long now);

    /**
     * Try to acquire a lock using atomic INSERT with conflict handling. Returns true if lock was
     * acquired.
     *
     * <p>Uses database-level atomicity to prevent race conditions:
     * <ul>
     *   <li>PostgreSQL: INSERT ... ON CONFLICT DO NOTHING
     *   <li>MySQL: INSERT IGNORE
     * </ul>
     *
     * <p>If the insert fails due to a conflict, we check if the existing lock is expired and retry
     * once after cleaning it up.
     */
    default boolean tryAcquireLock(
        String lockKey, String jobId, String serverId, long acquiredAt, long expiresAt) {
      // First delete any expired locks
      deleteExpiredLocks(System.currentTimeMillis());

      // Atomically try to insert the lock - returns 1 if inserted, 0 if conflict
      int inserted = insertIfNotExists(lockKey, jobId, serverId, acquiredAt, acquiredAt, expiresAt);
      if (inserted > 0) {
        return true; // Lock acquired successfully
      }

      // Insert failed due to conflict - check if existing lock is expired
      SearchReindexLockRecord existing = findByKey(lockKey);
      if (existing != null && existing.isExpired()) {
        // Lock is expired, delete it and retry once
        delete(lockKey);
        inserted = insertIfNotExists(lockKey, jobId, serverId, acquiredAt, acquiredAt, expiresAt);
        return inserted > 0;
      }

      // Lock is held by another active job
      return false;
    }

    /** Release a lock for a specific job */
    default void releaseLock(String lockKey, String jobId) {
      deleteByKeyAndJob(lockKey, jobId);
    }

    @SqlUpdate(
        "UPDATE search_reindex_lock SET jobId = :toJobId, serverId = :serverId, "
            + "lastHeartbeat = :heartbeat, expiresAt = :expiresAt "
            + "WHERE lockKey = :lockKey AND jobId = :fromJobId")
    int updateLockOwner(
        @Bind("lockKey") String lockKey,
        @Bind("fromJobId") String fromJobId,
        @Bind("toJobId") String toJobId,
        @Bind("serverId") String serverId,
        @Bind("heartbeat") long heartbeat,
        @Bind("expiresAt") long expiresAt);

    /** Atomically transfer a lock from one job to another */
    default boolean transferLock(
        String lockKey,
        String fromJobId,
        String toJobId,
        String serverId,
        long heartbeat,
        long expiresAt) {
      int updated = updateLockOwner(lockKey, fromJobId, toJobId, serverId, heartbeat, expiresAt);
      return updated > 0;
    }

    /** Refresh a lock's heartbeat and expiration */
    default boolean refreshLock(
        String lockKey, String jobId, String serverId, long heartbeat, long expiresAt) {
      int updated = updateHeartbeat(lockKey, jobId, heartbeat, expiresAt);
      return updated > 0;
    }

    /** Clean up expired locks */
    default int cleanupExpiredLocks(long expirationThreshold) {
      return deleteExpiredLocks(expirationThreshold);
    }

    /** Get lock info for a specific lock key */
    default LockInfo getLockInfo(String lockKey) {
      SearchReindexLockRecord record = findByKey(lockKey);
      if (record == null) {
        return null;
      }
      return new LockInfo(
          record.lockKey(),
          record.jobId(),
          record.serverId(),
          record.acquiredAt(),
          record.lastHeartbeat(),
          record.expiresAt());
    }

    /** Simple record for lock information */
    record LockInfo(
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

    /** Row mapper for lock records */
    class SearchReindexLockMapper implements RowMapper<SearchReindexLockRecord> {
      @Override
      public SearchReindexLockRecord map(ResultSet rs, StatementContext ctx) throws SQLException {
        return new SearchReindexLockRecord(
            rs.getString("lockKey"),
            rs.getString("jobId"),
            rs.getString("serverId"),
            rs.getLong("acquiredAt"),
            rs.getLong("lastHeartbeat"),
            rs.getLong("expiresAt"));
      }
    }

    /** Record for lock data from DB */
    record SearchReindexLockRecord(
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

  /** DAO for search index failure records */
  interface SearchIndexFailureDAO {

    /** Bean class for @BindBean compatibility (records use id() not getId()) */
    @lombok.Getter
    @lombok.AllArgsConstructor
    class SearchIndexFailureRecord {
      private final String id;
      private final String jobId;
      private final String serverId;
      private final String entityType;
      private final String entityId;
      private final String entityFqn;
      private final String failureStage;
      private final String errorMessage;
      private final String stackTrace;
      private final long timestamp;
    }

    @SqlUpdate(
        "INSERT INTO search_index_failures (id, jobId, serverId, entityType, entityId, entityFqn, "
            + "failureStage, errorMessage, stackTrace, timestamp) "
            + "VALUES (:id, :jobId, :serverId, :entityType, :entityId, :entityFqn, "
            + ":failureStage, :errorMessage, :stackTrace, :timestamp)")
    void insert(
        @Bind("id") String id,
        @Bind("jobId") String jobId,
        @Bind("serverId") String serverId,
        @Bind("entityType") String entityType,
        @Bind("entityId") String entityId,
        @Bind("entityFqn") String entityFqn,
        @Bind("failureStage") String failureStage,
        @Bind("errorMessage") String errorMessage,
        @Bind("stackTrace") String stackTrace,
        @Bind("timestamp") long timestamp);

    @SqlBatch(
        "INSERT INTO search_index_failures (id, jobId, serverId, entityType, entityId, entityFqn, "
            + "failureStage, errorMessage, stackTrace, timestamp) "
            + "VALUES (:id, :jobId, :serverId, :entityType, :entityId, :entityFqn, "
            + ":failureStage, :errorMessage, :stackTrace, :timestamp)")
    void insertBatch(@BindBean List<SearchIndexFailureRecord> failures);

    @SqlQuery(
        "SELECT * FROM search_index_failures WHERE serverId = :serverId "
            + "ORDER BY timestamp DESC LIMIT :limit OFFSET :offset")
    @RegisterRowMapper(SearchIndexFailureMapper.class)
    List<SearchIndexFailureRecord> findByServerId(
        @Bind("serverId") String serverId, @Bind("limit") int limit, @Bind("offset") int offset);

    @SqlQuery("SELECT COUNT(*) FROM search_index_failures WHERE serverId = :serverId")
    int countByServerId(@Bind("serverId") String serverId);

    @SqlQuery(
        "SELECT * FROM search_index_failures WHERE jobId = :jobId "
            + "ORDER BY timestamp DESC LIMIT :limit OFFSET :offset")
    @RegisterRowMapper(SearchIndexFailureMapper.class)
    List<SearchIndexFailureRecord> findByJobId(
        @Bind("jobId") String jobId, @Bind("limit") int limit, @Bind("offset") int offset);

    @SqlQuery("SELECT COUNT(*) FROM search_index_failures WHERE jobId = :jobId")
    int countByJobId(@Bind("jobId") String jobId);

    /**
     * Count only real failures for a job, excluding {@code READER_RELATIONSHIP_WARNING} rows —
     * stale-relationship warnings are recorded for visibility but are not failures.
     */
    @SqlQuery(
        "SELECT COUNT(*) FROM search_index_failures WHERE jobId = :jobId "
            + "AND failureStage <> 'READER_RELATIONSHIP_WARNING'")
    int countFailuresByJobId(@Bind("jobId") String jobId);

    @SqlUpdate("DELETE FROM search_index_failures WHERE timestamp < :cutoffTime")
    int deleteOlderThan(@Bind("cutoffTime") long cutoffTime);

    @SqlUpdate("DELETE FROM search_index_failures WHERE jobId = :jobId")
    int deleteByJobId(@Bind("jobId") String jobId);

    @SqlUpdate("DELETE FROM search_index_failures")
    int deleteAll();

    @SqlQuery("SELECT COUNT(*) FROM search_index_failures")
    int countAll();

    @SqlQuery(
        "SELECT * FROM search_index_failures ORDER BY timestamp DESC LIMIT :limit OFFSET :offset")
    @RegisterRowMapper(SearchIndexFailureMapper.class)
    List<SearchIndexFailureRecord> findAll(@Bind("limit") int limit, @Bind("offset") int offset);

    @SqlQuery("SELECT COUNT(*) FROM search_index_failures WHERE entityType = :entityType")
    int countByEntityType(@Bind("entityType") String entityType);

    @SqlQuery(
        "SELECT * FROM search_index_failures WHERE entityType = :entityType "
            + "ORDER BY timestamp DESC LIMIT :limit OFFSET :offset")
    @RegisterRowMapper(SearchIndexFailureMapper.class)
    List<SearchIndexFailureRecord> findByEntityType(
        @Bind("entityType") String entityType,
        @Bind("limit") int limit,
        @Bind("offset") int offset);

    class SearchIndexFailureMapper implements RowMapper<SearchIndexFailureRecord> {
      @Override
      public SearchIndexFailureRecord map(ResultSet rs, StatementContext ctx) throws SQLException {
        return new SearchIndexFailureRecord(
            rs.getString("id"),
            rs.getString("jobId"),
            rs.getString("serverId"),
            rs.getString("entityType"),
            rs.getString("entityId"),
            rs.getString("entityFqn"),
            rs.getString("failureStage"),
            rs.getString("errorMessage"),
            rs.getString("stackTrace"),
            rs.getLong("timestamp"));
      }
    }
  }

  /** DAO for incremental search retry queue records. */
  interface SearchIndexRetryQueueDAO {

    @lombok.Getter
    @lombok.AllArgsConstructor
    class SearchIndexRetryRecord {
      private final String entityId;
      private final String entityFqn;
      private final String failureReason;
      private final String status;
      private final String entityType;
      private final int retryCount;
      private final java.sql.Timestamp claimedAt;
    }

    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO search_index_retry_queue (entityId, entityFqn, failureReason, status, entityType) "
                + "VALUES (:entityId, :entityFqn, :failureReason, :status, :entityType) "
                + "ON DUPLICATE KEY UPDATE failureReason = VALUES(failureReason), status = VALUES(status), entityType = VALUES(entityType)",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO search_index_retry_queue (entityId, entityFqn, failureReason, status, entityType) "
                + "VALUES (:entityId, :entityFqn, :failureReason, :status, :entityType) "
                + "ON CONFLICT (entityId, entityFqn) DO UPDATE SET "
                + "failureReason = EXCLUDED.failureReason, status = EXCLUDED.status, entityType = EXCLUDED.entityType",
        connectionType = POSTGRES)
    void upsert(
        @Bind("entityId") String entityId,
        @Bind("entityFqn") String entityFqn,
        @Bind("failureReason") String failureReason,
        @Bind("status") String status,
        @Bind("entityType") String entityType);

    @SqlQuery(
        "SELECT entityId, entityFqn, failureReason, status, entityType, retryCount, claimedAt "
            + "FROM search_index_retry_queue WHERE status = :status LIMIT :limit")
    @RegisterRowMapper(SearchIndexRetryRecordMapper.class)
    List<SearchIndexRetryRecord> findByStatus(
        @Bind("status") String status, @Bind("limit") int limit);

    @SqlQuery(
        "SELECT entityId, entityFqn, failureReason, status, entityType, retryCount, claimedAt "
            + "FROM search_index_retry_queue WHERE status IN (<statuses>) LIMIT :limit")
    @RegisterRowMapper(SearchIndexRetryRecordMapper.class)
    List<SearchIndexRetryRecord> findByStatuses(
        @BindList("statuses") List<String> statuses, @Bind("limit") int limit);

    @SqlUpdate(
        "UPDATE search_index_retry_queue SET status = :newStatus "
            + "WHERE entityId = :entityId AND entityFqn = :entityFqn AND status = :currentStatus")
    int updateStatusIfCurrent(
        @Bind("entityId") String entityId,
        @Bind("entityFqn") String entityFqn,
        @Bind("currentStatus") String currentStatus,
        @Bind("newStatus") String newStatus);

    @SqlUpdate(
        "UPDATE search_index_retry_queue SET status = :status, failureReason = :failureReason "
            + "WHERE entityId = :entityId AND entityFqn = :entityFqn")
    int updateFailureAndStatus(
        @Bind("entityId") String entityId,
        @Bind("entityFqn") String entityFqn,
        @Bind("failureReason") String failureReason,
        @Bind("status") String status);

    @SqlUpdate(
        "UPDATE search_index_retry_queue SET status = :status "
            + "WHERE entityId = :entityId AND entityFqn = :entityFqn")
    int updateStatus(
        @Bind("entityId") String entityId,
        @Bind("entityFqn") String entityFqn,
        @Bind("status") String status);

    @SqlUpdate(
        "DELETE FROM search_index_retry_queue WHERE entityId = :entityId AND entityFqn = :entityFqn")
    int deleteByEntity(@Bind("entityId") String entityId, @Bind("entityFqn") String entityFqn);

    @SqlUpdate("DELETE FROM search_index_retry_queue WHERE status IN (<statuses>)")
    int deleteByStatuses(@BindList("statuses") List<String> statuses);

    @SqlQuery("SELECT COUNT(*) FROM search_index_retry_queue WHERE status = :status")
    int countByStatus(@Bind("status") String status);

    @SqlUpdate(
        "UPDATE search_index_retry_queue SET status = 'IN_PROGRESS', claimedAt = NOW() "
            + "WHERE entityId = :entityId AND entityFqn = :entityFqn AND status = :currentStatus")
    int claimRecord(
        @Bind("entityId") String entityId,
        @Bind("entityFqn") String entityFqn,
        @Bind("currentStatus") String currentStatus);

    @SqlUpdate(
        "UPDATE search_index_retry_queue SET status = 'PENDING', claimedAt = NULL "
            + "WHERE status = 'IN_PROGRESS' AND claimedAt < :cutoff")
    int recoverStaleInProgress(@Bind("cutoff") java.sql.Timestamp cutoff);

    @SqlUpdate(
        "UPDATE search_index_retry_queue SET status = :status, failureReason = :failureReason, "
            + "retryCount = retryCount + 1, claimedAt = NULL "
            + "WHERE entityId = :entityId AND entityFqn = :entityFqn")
    int updateFailureAndRetryCount(
        @Bind("entityId") String entityId,
        @Bind("entityFqn") String entityFqn,
        @Bind("failureReason") String failureReason,
        @Bind("status") String status);

    default List<SearchIndexRetryRecord> claimPending(int batchSize) {
      int fetchSize = Math.max(batchSize * 5, batchSize);
      List<SearchIndexRetryRecord> candidates =
          new ArrayList<>(
              findByStatuses(List.of("PENDING", "PENDING_RETRY_1", "PENDING_RETRY_2"), fetchSize));
      // Shuffle so concurrent worker threads attempt different rows first,
      // reducing wasted optimistic-lock failures on the same candidates.
      Collections.shuffle(candidates);
      List<SearchIndexRetryRecord> claimed = new ArrayList<>();
      for (SearchIndexRetryRecord candidate : candidates) {
        if (claimed.size() >= batchSize) {
          break;
        }
        int updated =
            claimRecord(candidate.getEntityId(), candidate.getEntityFqn(), candidate.getStatus());
        if (updated == 1) {
          claimed.add(candidate);
        }
      }
      return claimed;
    }

    @SqlQuery(
        "SELECT entityId, entityFqn, failureReason, status, entityType, retryCount, claimedAt "
            + "FROM search_index_retry_queue ORDER BY retryCount DESC, claimedAt DESC "
            + "LIMIT :limit OFFSET :offset")
    @RegisterRowMapper(SearchIndexRetryRecordMapper.class)
    List<SearchIndexRetryRecord> listAll(@Bind("limit") int limit, @Bind("offset") int offset);

    @SqlQuery("SELECT COUNT(*) FROM search_index_retry_queue")
    int countAll();

    class SearchIndexRetryRecordMapper implements RowMapper<SearchIndexRetryRecord> {
      @Override
      public SearchIndexRetryRecord map(ResultSet rs, StatementContext ctx) throws SQLException {
        return new SearchIndexRetryRecord(
            rs.getString("entityId"),
            rs.getString("entityFqn"),
            rs.getString("failureReason"),
            rs.getString("status"),
            rs.getString("entityType"),
            rs.getInt("retryCount"),
            rs.getTimestamp("claimedAt"));
      }
    }
  }

  /** DAO for search index per-server stats in distributed mode */
  interface SearchIndexServerStatsDAO {

    record ServerStatsRecord(
        String id,
        String jobId,
        String serverId,
        String entityType,
        long readerSuccess,
        long readerFailed,
        long readerWarnings,
        long sinkSuccess,
        long sinkFailed,
        long processSuccess,
        long processFailed,
        long vectorSuccess,
        long vectorFailed,
        long readerTimeMs,
        long processTimeMs,
        long sinkTimeMs,
        long vectorTimeMs,
        int partitionsCompleted,
        int partitionsFailed,
        long lastUpdatedAt) {}

    record AggregatedServerStats(
        long readerSuccess,
        long readerFailed,
        long readerWarnings,
        long sinkSuccess,
        long sinkFailed,
        long processSuccess,
        long processFailed,
        long vectorSuccess,
        long vectorFailed,
        long readerTimeMs,
        long processTimeMs,
        long sinkTimeMs,
        long vectorTimeMs,
        int partitionsCompleted,
        int partitionsFailed) {}

    record EntityStats(
        String entityType,
        long readerSuccess,
        long readerFailed,
        long readerWarnings,
        long sinkSuccess,
        long sinkFailed,
        long processSuccess,
        long processFailed,
        long vectorSuccess,
        long vectorFailed,
        long readerTimeMs,
        long processTimeMs,
        long sinkTimeMs,
        long vectorTimeMs) {}

    /**
     * Increment stats using delta values. This is the primary method for updating stats -
     * it adds the delta values to existing values, creating the row if it doesn't exist.
     */
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO search_index_server_stats (id, jobId, serverId, entityType, "
                + "readerSuccess, readerFailed, readerWarnings, sinkSuccess, sinkFailed, "
                + "processSuccess, processFailed, vectorSuccess, vectorFailed, "
                + "readerTimeMs, processTimeMs, sinkTimeMs, vectorTimeMs, "
                + "partitionsCompleted, partitionsFailed, lastUpdatedAt) "
                + "VALUES (:id, :jobId, :serverId, :entityType, "
                + ":readerSuccess, :readerFailed, :readerWarnings, :sinkSuccess, :sinkFailed, "
                + ":processSuccess, :processFailed, :vectorSuccess, :vectorFailed, "
                + ":readerTimeMs, :processTimeMs, :sinkTimeMs, :vectorTimeMs, "
                + ":partitionsCompleted, :partitionsFailed, :lastUpdatedAt) "
                + "ON DUPLICATE KEY UPDATE "
                + "readerSuccess = readerSuccess + VALUES(readerSuccess), "
                + "readerFailed = readerFailed + VALUES(readerFailed), "
                + "readerWarnings = readerWarnings + VALUES(readerWarnings), "
                + "sinkSuccess = sinkSuccess + VALUES(sinkSuccess), "
                + "sinkFailed = sinkFailed + VALUES(sinkFailed), "
                + "processSuccess = processSuccess + VALUES(processSuccess), "
                + "processFailed = processFailed + VALUES(processFailed), "
                + "vectorSuccess = vectorSuccess + VALUES(vectorSuccess), "
                + "vectorFailed = vectorFailed + VALUES(vectorFailed), "
                + "readerTimeMs = readerTimeMs + VALUES(readerTimeMs), "
                + "processTimeMs = processTimeMs + VALUES(processTimeMs), "
                + "sinkTimeMs = sinkTimeMs + VALUES(sinkTimeMs), "
                + "vectorTimeMs = vectorTimeMs + VALUES(vectorTimeMs), "
                + "partitionsCompleted = partitionsCompleted + VALUES(partitionsCompleted), "
                + "partitionsFailed = partitionsFailed + VALUES(partitionsFailed), "
                + "lastUpdatedAt = VALUES(lastUpdatedAt)",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO search_index_server_stats (id, jobId, serverId, entityType, "
                + "readerSuccess, readerFailed, readerWarnings, sinkSuccess, sinkFailed, "
                + "processSuccess, processFailed, vectorSuccess, vectorFailed, "
                + "readerTimeMs, processTimeMs, sinkTimeMs, vectorTimeMs, "
                + "partitionsCompleted, partitionsFailed, lastUpdatedAt) "
                + "VALUES (:id, :jobId, :serverId, :entityType, "
                + ":readerSuccess, :readerFailed, :readerWarnings, :sinkSuccess, :sinkFailed, "
                + ":processSuccess, :processFailed, :vectorSuccess, :vectorFailed, "
                + ":readerTimeMs, :processTimeMs, :sinkTimeMs, :vectorTimeMs, "
                + ":partitionsCompleted, :partitionsFailed, :lastUpdatedAt) "
                + "ON CONFLICT (jobId, serverId, entityType) DO UPDATE SET "
                + "readerSuccess = search_index_server_stats.readerSuccess + EXCLUDED.readerSuccess, "
                + "readerFailed = search_index_server_stats.readerFailed + EXCLUDED.readerFailed, "
                + "readerWarnings = search_index_server_stats.readerWarnings + EXCLUDED.readerWarnings, "
                + "sinkSuccess = search_index_server_stats.sinkSuccess + EXCLUDED.sinkSuccess, "
                + "sinkFailed = search_index_server_stats.sinkFailed + EXCLUDED.sinkFailed, "
                + "processSuccess = search_index_server_stats.processSuccess + EXCLUDED.processSuccess, "
                + "processFailed = search_index_server_stats.processFailed + EXCLUDED.processFailed, "
                + "vectorSuccess = search_index_server_stats.vectorSuccess + EXCLUDED.vectorSuccess, "
                + "vectorFailed = search_index_server_stats.vectorFailed + EXCLUDED.vectorFailed, "
                + "readerTimeMs = search_index_server_stats.readerTimeMs + EXCLUDED.readerTimeMs, "
                + "processTimeMs = search_index_server_stats.processTimeMs + EXCLUDED.processTimeMs, "
                + "sinkTimeMs = search_index_server_stats.sinkTimeMs + EXCLUDED.sinkTimeMs, "
                + "vectorTimeMs = search_index_server_stats.vectorTimeMs + EXCLUDED.vectorTimeMs, "
                + "partitionsCompleted = search_index_server_stats.partitionsCompleted + EXCLUDED.partitionsCompleted, "
                + "partitionsFailed = search_index_server_stats.partitionsFailed + EXCLUDED.partitionsFailed, "
                + "lastUpdatedAt = EXCLUDED.lastUpdatedAt",
        connectionType = POSTGRES)
    void incrementStats(
        @Bind("id") String id,
        @Bind("jobId") String jobId,
        @Bind("serverId") String serverId,
        @Bind("entityType") String entityType,
        @Bind("readerSuccess") long readerSuccess,
        @Bind("readerFailed") long readerFailed,
        @Bind("readerWarnings") long readerWarnings,
        @Bind("sinkSuccess") long sinkSuccess,
        @Bind("sinkFailed") long sinkFailed,
        @Bind("processSuccess") long processSuccess,
        @Bind("processFailed") long processFailed,
        @Bind("vectorSuccess") long vectorSuccess,
        @Bind("vectorFailed") long vectorFailed,
        @Bind("readerTimeMs") long readerTimeMs,
        @Bind("processTimeMs") long processTimeMs,
        @Bind("sinkTimeMs") long sinkTimeMs,
        @Bind("vectorTimeMs") long vectorTimeMs,
        @Bind("partitionsCompleted") int partitionsCompleted,
        @Bind("partitionsFailed") int partitionsFailed,
        @Bind("lastUpdatedAt") long lastUpdatedAt);

    /**
     * Replace stats with absolute values. Used by distributed coordinator to persist
     * aggregate stats for the server.
     */
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO search_index_server_stats (id, jobId, serverId, entityType, "
                + "readerSuccess, readerFailed, readerWarnings, sinkSuccess, sinkFailed, "
                + "processSuccess, processFailed, vectorSuccess, vectorFailed, "
                + "readerTimeMs, processTimeMs, sinkTimeMs, vectorTimeMs, "
                + "partitionsCompleted, partitionsFailed, lastUpdatedAt) "
                + "VALUES (:id, :jobId, :serverId, :entityType, "
                + ":readerSuccess, :readerFailed, :readerWarnings, :sinkSuccess, :sinkFailed, "
                + ":processSuccess, :processFailed, :vectorSuccess, :vectorFailed, "
                + ":readerTimeMs, :processTimeMs, :sinkTimeMs, :vectorTimeMs, "
                + ":partitionsCompleted, :partitionsFailed, :lastUpdatedAt) "
                + "ON DUPLICATE KEY UPDATE "
                + "readerSuccess = VALUES(readerSuccess), "
                + "readerFailed = VALUES(readerFailed), "
                + "readerWarnings = VALUES(readerWarnings), "
                + "sinkSuccess = VALUES(sinkSuccess), "
                + "sinkFailed = VALUES(sinkFailed), "
                + "processSuccess = VALUES(processSuccess), "
                + "processFailed = VALUES(processFailed), "
                + "vectorSuccess = VALUES(vectorSuccess), "
                + "vectorFailed = VALUES(vectorFailed), "
                + "readerTimeMs = VALUES(readerTimeMs), "
                + "processTimeMs = VALUES(processTimeMs), "
                + "sinkTimeMs = VALUES(sinkTimeMs), "
                + "vectorTimeMs = VALUES(vectorTimeMs), "
                + "partitionsCompleted = VALUES(partitionsCompleted), "
                + "partitionsFailed = VALUES(partitionsFailed), "
                + "lastUpdatedAt = VALUES(lastUpdatedAt)",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO search_index_server_stats (id, jobId, serverId, entityType, "
                + "readerSuccess, readerFailed, readerWarnings, sinkSuccess, sinkFailed, "
                + "processSuccess, processFailed, vectorSuccess, vectorFailed, "
                + "readerTimeMs, processTimeMs, sinkTimeMs, vectorTimeMs, "
                + "partitionsCompleted, partitionsFailed, lastUpdatedAt) "
                + "VALUES (:id, :jobId, :serverId, :entityType, "
                + ":readerSuccess, :readerFailed, :readerWarnings, :sinkSuccess, :sinkFailed, "
                + ":processSuccess, :processFailed, :vectorSuccess, :vectorFailed, "
                + ":readerTimeMs, :processTimeMs, :sinkTimeMs, :vectorTimeMs, "
                + ":partitionsCompleted, :partitionsFailed, :lastUpdatedAt) "
                + "ON CONFLICT (jobId, serverId, entityType) DO UPDATE SET "
                + "readerSuccess = EXCLUDED.readerSuccess, "
                + "readerFailed = EXCLUDED.readerFailed, "
                + "readerWarnings = EXCLUDED.readerWarnings, "
                + "sinkSuccess = EXCLUDED.sinkSuccess, "
                + "sinkFailed = EXCLUDED.sinkFailed, "
                + "processSuccess = EXCLUDED.processSuccess, "
                + "processFailed = EXCLUDED.processFailed, "
                + "vectorSuccess = EXCLUDED.vectorSuccess, "
                + "vectorFailed = EXCLUDED.vectorFailed, "
                + "readerTimeMs = EXCLUDED.readerTimeMs, "
                + "processTimeMs = EXCLUDED.processTimeMs, "
                + "sinkTimeMs = EXCLUDED.sinkTimeMs, "
                + "vectorTimeMs = EXCLUDED.vectorTimeMs, "
                + "partitionsCompleted = EXCLUDED.partitionsCompleted, "
                + "partitionsFailed = EXCLUDED.partitionsFailed, "
                + "lastUpdatedAt = EXCLUDED.lastUpdatedAt",
        connectionType = POSTGRES)
    void replaceStats(
        @Bind("id") String id,
        @Bind("jobId") String jobId,
        @Bind("serverId") String serverId,
        @Bind("entityType") String entityType,
        @Bind("readerSuccess") long readerSuccess,
        @Bind("readerFailed") long readerFailed,
        @Bind("readerWarnings") long readerWarnings,
        @Bind("sinkSuccess") long sinkSuccess,
        @Bind("sinkFailed") long sinkFailed,
        @Bind("processSuccess") long processSuccess,
        @Bind("processFailed") long processFailed,
        @Bind("vectorSuccess") long vectorSuccess,
        @Bind("vectorFailed") long vectorFailed,
        @Bind("readerTimeMs") long readerTimeMs,
        @Bind("processTimeMs") long processTimeMs,
        @Bind("sinkTimeMs") long sinkTimeMs,
        @Bind("vectorTimeMs") long vectorTimeMs,
        @Bind("partitionsCompleted") int partitionsCompleted,
        @Bind("partitionsFailed") int partitionsFailed,
        @Bind("lastUpdatedAt") long lastUpdatedAt);

    @SqlQuery("SELECT * FROM search_index_server_stats WHERE jobId = :jobId")
    @RegisterRowMapper(ServerStatsMapper.class)
    List<ServerStatsRecord> findByJobId(@Bind("jobId") String jobId);

    @SqlQuery(
        "SELECT * FROM search_index_server_stats WHERE jobId = :jobId AND serverId = :serverId AND entityType = :entityType")
    @RegisterRowMapper(ServerStatsMapper.class)
    ServerStatsRecord findByJobIdServerIdEntityType(
        @Bind("jobId") String jobId,
        @Bind("serverId") String serverId,
        @Bind("entityType") String entityType);

    /** Get aggregated stats across all servers and entity types for a job */
    @SqlQuery(
        "SELECT "
            + "COALESCE(SUM(readerSuccess), 0) as readerSuccess, "
            + "COALESCE(SUM(readerFailed), 0) as readerFailed, "
            + "COALESCE(SUM(readerWarnings), 0) as readerWarnings, "
            + "COALESCE(SUM(sinkSuccess), 0) as sinkSuccess, "
            + "COALESCE(SUM(sinkFailed), 0) as sinkFailed, "
            + "COALESCE(SUM(processSuccess), 0) as processSuccess, "
            + "COALESCE(SUM(processFailed), 0) as processFailed, "
            + "COALESCE(SUM(vectorSuccess), 0) as vectorSuccess, "
            + "COALESCE(SUM(vectorFailed), 0) as vectorFailed, "
            + "COALESCE(SUM(readerTimeMs), 0) as readerTimeMs, "
            + "COALESCE(SUM(processTimeMs), 0) as processTimeMs, "
            + "COALESCE(SUM(sinkTimeMs), 0) as sinkTimeMs, "
            + "COALESCE(SUM(vectorTimeMs), 0) as vectorTimeMs, "
            + "COALESCE(SUM(partitionsCompleted), 0) as partitionsCompleted, "
            + "COALESCE(SUM(partitionsFailed), 0) as partitionsFailed "
            + "FROM search_index_server_stats WHERE jobId = :jobId")
    @RegisterRowMapper(AggregatedServerStatsMapper.class)
    AggregatedServerStats getAggregatedStats(@Bind("jobId") String jobId);

    /** Get stats grouped by entity type for a job */
    @SqlQuery(
        "SELECT entityType, "
            + "COALESCE(SUM(readerSuccess), 0) as readerSuccess, "
            + "COALESCE(SUM(readerFailed), 0) as readerFailed, "
            + "COALESCE(SUM(readerWarnings), 0) as readerWarnings, "
            + "COALESCE(SUM(sinkSuccess), 0) as sinkSuccess, "
            + "COALESCE(SUM(sinkFailed), 0) as sinkFailed, "
            + "COALESCE(SUM(processSuccess), 0) as processSuccess, "
            + "COALESCE(SUM(processFailed), 0) as processFailed, "
            + "COALESCE(SUM(vectorSuccess), 0) as vectorSuccess, "
            + "COALESCE(SUM(vectorFailed), 0) as vectorFailed, "
            + "COALESCE(SUM(readerTimeMs), 0) as readerTimeMs, "
            + "COALESCE(SUM(processTimeMs), 0) as processTimeMs, "
            + "COALESCE(SUM(sinkTimeMs), 0) as sinkTimeMs, "
            + "COALESCE(SUM(vectorTimeMs), 0) as vectorTimeMs "
            + "FROM search_index_server_stats WHERE jobId = :jobId "
            + "GROUP BY entityType")
    @RegisterRowMapper(EntityStatsMapper.class)
    List<EntityStats> getStatsByEntityType(@Bind("jobId") String jobId);

    /**
     * Per-server timing breakdown. Sums every counter and timing column for each serverId,
     * letting the UI show "is one node dragging the cluster" for distributed runs.
     */
    record ServerTimingStats(
        String serverId,
        long readerSuccess,
        long sinkSuccess,
        long processSuccess,
        long vectorSuccess,
        long readerTimeMs,
        long processTimeMs,
        long sinkTimeMs,
        long vectorTimeMs) {}

    @SqlQuery(
        "SELECT serverId, "
            + "COALESCE(SUM(readerSuccess), 0) as readerSuccess, "
            + "COALESCE(SUM(sinkSuccess), 0) as sinkSuccess, "
            + "COALESCE(SUM(processSuccess), 0) as processSuccess, "
            + "COALESCE(SUM(vectorSuccess), 0) as vectorSuccess, "
            + "COALESCE(SUM(readerTimeMs), 0) as readerTimeMs, "
            + "COALESCE(SUM(processTimeMs), 0) as processTimeMs, "
            + "COALESCE(SUM(sinkTimeMs), 0) as sinkTimeMs, "
            + "COALESCE(SUM(vectorTimeMs), 0) as vectorTimeMs "
            + "FROM search_index_server_stats WHERE jobId = :jobId "
            + "GROUP BY serverId")
    @RegisterRowMapper(ServerTimingStatsMapper.class)
    List<ServerTimingStats> getStatsByServer(@Bind("jobId") String jobId);

    class ServerTimingStatsMapper implements RowMapper<ServerTimingStats> {
      @Override
      public ServerTimingStats map(ResultSet rs, StatementContext ctx) throws SQLException {
        return new ServerTimingStats(
            rs.getString("serverId"),
            rs.getLong("readerSuccess"),
            rs.getLong("sinkSuccess"),
            rs.getLong("processSuccess"),
            rs.getLong("vectorSuccess"),
            rs.getLong("readerTimeMs"),
            rs.getLong("processTimeMs"),
            rs.getLong("sinkTimeMs"),
            rs.getLong("vectorTimeMs"));
      }
    }

    @SqlUpdate("DELETE FROM search_index_server_stats WHERE jobId = :jobId")
    void deleteByJobId(@Bind("jobId") String jobId);

    @SqlUpdate("DELETE FROM search_index_server_stats")
    void deleteAll();

    class ServerStatsMapper implements RowMapper<ServerStatsRecord> {
      @Override
      public ServerStatsRecord map(ResultSet rs, StatementContext ctx) throws SQLException {
        return new ServerStatsRecord(
            rs.getString("id"),
            rs.getString("jobId"),
            rs.getString("serverId"),
            rs.getString("entityType"),
            rs.getLong("readerSuccess"),
            rs.getLong("readerFailed"),
            rs.getLong("readerWarnings"),
            rs.getLong("sinkSuccess"),
            rs.getLong("sinkFailed"),
            rs.getLong("processSuccess"),
            rs.getLong("processFailed"),
            rs.getLong("vectorSuccess"),
            rs.getLong("vectorFailed"),
            rs.getLong("readerTimeMs"),
            rs.getLong("processTimeMs"),
            rs.getLong("sinkTimeMs"),
            rs.getLong("vectorTimeMs"),
            rs.getInt("partitionsCompleted"),
            rs.getInt("partitionsFailed"),
            rs.getLong("lastUpdatedAt"));
      }
    }

    class AggregatedServerStatsMapper implements RowMapper<AggregatedServerStats> {
      @Override
      public AggregatedServerStats map(ResultSet rs, StatementContext ctx) throws SQLException {
        return new AggregatedServerStats(
            rs.getLong("readerSuccess"),
            rs.getLong("readerFailed"),
            rs.getLong("readerWarnings"),
            rs.getLong("sinkSuccess"),
            rs.getLong("sinkFailed"),
            rs.getLong("processSuccess"),
            rs.getLong("processFailed"),
            rs.getLong("vectorSuccess"),
            rs.getLong("vectorFailed"),
            rs.getLong("readerTimeMs"),
            rs.getLong("processTimeMs"),
            rs.getLong("sinkTimeMs"),
            rs.getLong("vectorTimeMs"),
            rs.getInt("partitionsCompleted"),
            rs.getInt("partitionsFailed"));
      }
    }

    class EntityStatsMapper implements RowMapper<EntityStats> {
      @Override
      public EntityStats map(ResultSet rs, StatementContext ctx) throws SQLException {
        return new EntityStats(
            rs.getString("entityType"),
            rs.getLong("readerSuccess"),
            rs.getLong("readerFailed"),
            rs.getLong("readerWarnings"),
            rs.getLong("sinkSuccess"),
            rs.getLong("sinkFailed"),
            rs.getLong("processSuccess"),
            rs.getLong("processFailed"),
            rs.getLong("vectorSuccess"),
            rs.getLong("vectorFailed"),
            rs.getLong("readerTimeMs"),
            rs.getLong("processTimeMs"),
            rs.getLong("sinkTimeMs"),
            rs.getLong("vectorTimeMs"));
      }
    }
  }

  @Builder
  record ActivityStreamRow(
      String id,
      String eventType,
      String entityType,
      String entityId,
      String entityFqnHash,
      String about,
      String aboutFqnHash,
      String actorId,
      String actorName,
      Long timestamp,
      String summary,
      String fieldName,
      String oldValue,
      String newValue,
      String domains,
      String json) {}
}
