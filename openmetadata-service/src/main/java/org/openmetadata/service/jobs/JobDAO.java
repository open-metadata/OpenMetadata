package org.openmetadata.service.jobs;

import static org.openmetadata.service.jdbi3.locator.ConnectionType.MYSQL;
import static org.openmetadata.service.jdbi3.locator.ConnectionType.POSTGRES;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;
import org.jdbi.v3.core.statement.StatementException;
import org.jdbi.v3.sqlobject.config.RegisterRowMapper;
import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.customizer.BindList;
import org.jdbi.v3.sqlobject.statement.GetGeneratedKeys;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.jobs.BackgroundJob;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlQuery;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlUpdate;
import org.openmetadata.service.util.jdbi.BindJson;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public interface JobDAO {

  Logger LOG = LoggerFactory.getLogger(JobDAO.class);

  default long insertJob(
      BackgroundJob.JobType jobType, JobHandler handler, String jobArgs, String createdBy) {
    return insertJob(jobType, handler, jobArgs, createdBy, null);
  }

  default long insertJob(
      BackgroundJob.JobType jobType,
      JobHandler handler,
      String jobArgs,
      String createdBy,
      Long runAt) {
    try {
      JsonUtils.readTree(jobArgs);
    } catch (Exception e) {
      throw new IllegalArgumentException("jobArgs must be a valid JSON string");
    }
    return insertJobInternal(
        jobType.name(), handler.getClass().getSimpleName(), jobArgs, createdBy, runAt);
  }

  @ConnectionAwareSqlUpdate(
      value =
          "INSERT INTO background_jobs (jobType, methodName, jobArgs, createdBy, runAt) "
              + "VALUES (:jobType, :methodName, :jobArgs, :createdBy, :runAt)",
      connectionType = MYSQL)
  @ConnectionAwareSqlUpdate(
      value =
          "INSERT INTO background_jobs (jobType, methodName, jobArgs,createdBy,runAt) VALUES (:jobType, :methodName, :jobArgs::jsonb,:createdBy,:runAt) ",
      connectionType = POSTGRES)
  @GetGeneratedKeys
  long insertJobInternal(
      @Bind("jobType") String jobType,
      @Bind("methodName") String methodName,
      @BindJson("jobArgs") String jobArgs,
      @Bind("createdBy") String createdBy,
      @Bind("runAt") Long runAt);

  // Serialize enqueues for the same source through its existing page row. This lets us reuse the
  // background_jobs table without a memory-specific column or index, even across server nodes.
  @Transaction
  default void enqueuePageMemoryJob(
      String pageId, String jobKey, String jobArgs, String createdBy, long runAt, long updatedAt) {
    if (lockPageForMemoryQueue(pageId) == null) {
      return;
    }
    Long pendingId = findPendingMemoryJobId(jobKey);
    if (pendingId == null || reschedulePendingMemoryJob(pendingId, runAt, updatedAt) == 0) {
      insertJobInternal(
          BackgroundJob.JobType.CONTEXT_MEMORY_EXTRACTION.name(),
          "ContextMemoryExtractionJobHandler",
          jobArgs,
          createdBy,
          runAt);
    }
  }

  @SqlQuery("SELECT id FROM knowledge_center WHERE id = :pageId FOR UPDATE")
  String lockPageForMemoryQueue(@Bind("pageId") String pageId);

  @ConnectionAwareSqlQuery(
      value =
          "SELECT id FROM background_jobs WHERE jobType = 'CONTEXT_MEMORY_EXTRACTION' "
              + "AND methodName = 'ContextMemoryExtractionJobHandler' AND status = 'PENDING' "
              + "AND JSON_UNQUOTE(JSON_EXTRACT(jobArgs, '$.jobKey')) = :jobKey "
              + "ORDER BY createdAt LIMIT 1",
      connectionType = MYSQL)
  @ConnectionAwareSqlQuery(
      value =
          "SELECT id FROM background_jobs WHERE jobType = 'CONTEXT_MEMORY_EXTRACTION' "
              + "AND methodName = 'ContextMemoryExtractionJobHandler' AND status = 'PENDING' "
              + "AND jobArgs->>'jobKey' = :jobKey ORDER BY createdAt LIMIT 1",
      connectionType = POSTGRES)
  Long findPendingMemoryJobId(@Bind("jobKey") String jobKey);

  // The file row also serializes startup recovery on multiple servers. A retry may enqueue while
  // its current job is RUNNING, but ordinary recovery only enqueues when no job is in flight.
  @Transaction
  default void enqueueFileMemoryJob(
      String fileId, String jobKey, String jobArgs, String createdBy, boolean includeRunning) {
    if (lockFileForMemoryQueue(fileId) == null
        || countInFlightMemoryJobs(jobKey, includeRunning) > 0) {
      return;
    }
    insertJobInternal(
        BackgroundJob.JobType.CONTEXT_MEMORY_EXTRACTION.name(),
        "ContextMemoryExtractionJobHandler",
        jobArgs,
        createdBy,
        null);
  }

  @SqlQuery("SELECT id FROM context_file WHERE id = :fileId FOR UPDATE")
  String lockFileForMemoryQueue(@Bind("fileId") String fileId);

  @ConnectionAwareSqlQuery(
      value =
          "SELECT COUNT(*) FROM background_jobs WHERE jobType = 'CONTEXT_MEMORY_EXTRACTION' "
              + "AND methodName = 'ContextMemoryExtractionJobHandler' "
              + "AND (status = 'PENDING' OR (:includeRunning = true AND status = 'RUNNING')) "
              + "AND JSON_UNQUOTE(JSON_EXTRACT(jobArgs, '$.jobKey')) = :jobKey",
      connectionType = MYSQL)
  @ConnectionAwareSqlQuery(
      value =
          "SELECT COUNT(*) FROM background_jobs WHERE jobType = 'CONTEXT_MEMORY_EXTRACTION' "
              + "AND methodName = 'ContextMemoryExtractionJobHandler' "
              + "AND (status = 'PENDING' OR (:includeRunning = true AND status = 'RUNNING')) "
              + "AND jobArgs->>'jobKey' = :jobKey",
      connectionType = POSTGRES)
  int countInFlightMemoryJobs(
      @Bind("jobKey") String jobKey, @Bind("includeRunning") boolean includeRunning);

  @ConnectionAwareSqlQuery(
      value =
          "SELECT COUNT(*) FROM background_jobs "
              + "WHERE jobType = 'ONTOLOGY_MEMORY_DERIVATION' "
              + "AND status IN ('PENDING', 'RUNNING') "
              + "AND JSON_SEARCH(jobArgs, 'one', :memoryId, NULL, '$.memoryIds[*]') IS NOT NULL",
      connectionType = MYSQL)
  @ConnectionAwareSqlQuery(
      value =
          "SELECT COUNT(*) FROM background_jobs "
              + "WHERE jobType = 'ONTOLOGY_MEMORY_DERIVATION' "
              + "AND status IN ('PENDING', 'RUNNING') "
              + "AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(jobArgs->'memoryIds') "
              + "AS source(memoryId) WHERE source.memoryId = :memoryId)",
      connectionType = POSTGRES)
  int countInFlightOntologyMemoryJobs(@Bind("memoryId") String memoryId);

  String ONTOLOGY_MEMORY_DERIVATION_HANDLER = "OntologyMemoryDerivationJobHandler";
  String ONTOLOGY_MEMORY_DERIVATION_JOB_TYPE = "ONTOLOGY_MEMORY_DERIVATION";
  int ONTOLOGY_MEMORY_BATCH_LIMIT = 20;
  // A batch only grows while its start is still this far away, so no worker can have read it yet.
  long ONTOLOGY_MEMORY_BATCH_APPEND_MARGIN_MS = 5_000L;

  @Transaction
  default Optional<Long> enqueueOntologyMemoryDerivationJob(
      List<String> memoryIds, String jobArgs, String createdBy) {
    for (String memoryId : memoryIds.stream().distinct().sorted().toList()) {
      if (lockMemoryForOntologyQueue(memoryId) == null
          || countInFlightOntologyMemoryJobs(memoryId) > 0) {
        return Optional.empty();
      }
    }
    return Optional.of(
        insertJobInternal(
            ONTOLOGY_MEMORY_DERIVATION_JOB_TYPE,
            ONTOLOGY_MEMORY_DERIVATION_HANDLER,
            jobArgs,
            createdBy,
            null));
  }

  // Coalesces memories extracted from one source into a single delayed job, so a document that
  // yields many memories costs one derivation instead of one per memory.
  @Transaction
  default Optional<Long> enqueueOntologyMemoryDerivationBatch(
      String memoryId, String batchKey, String jobArgs, String createdBy, long runAt) {
    if (lockMemoryForOntologyQueue(memoryId) == null
        || countInFlightOntologyMemoryJobs(memoryId) > 0) {
      return Optional.empty();
    }
    Long pendingId =
        lockOpenOntologyMemoryBatch(
            batchKey, ONTOLOGY_MEMORY_BATCH_LIMIT, ONTOLOGY_MEMORY_BATCH_APPEND_MARGIN_MS);
    if (pendingId != null && appendToOntologyMemoryBatch(pendingId, memoryId) > 0) {
      return Optional.of(pendingId);
    }
    return Optional.of(
        insertJobInternal(
            ONTOLOGY_MEMORY_DERIVATION_JOB_TYPE,
            ONTOLOGY_MEMORY_DERIVATION_HANDLER,
            jobArgs,
            createdBy,
            runAt));
  }

  @ConnectionAwareSqlQuery(
      value =
          "SELECT id FROM background_jobs WHERE jobType = 'ONTOLOGY_MEMORY_DERIVATION' "
              + "AND status = 'PENDING' "
              + "AND JSON_UNQUOTE(JSON_EXTRACT(jobArgs, '$.batchKey')) = :batchKey "
              + "AND JSON_LENGTH(jobArgs, '$.memoryIds') < :limit "
              + "AND runAt > (UNIX_TIMESTAMP(NOW(3)) * 1000) + :marginMs "
              + "ORDER BY id DESC LIMIT 1 FOR UPDATE",
      connectionType = MYSQL)
  @ConnectionAwareSqlQuery(
      value =
          "SELECT id FROM background_jobs WHERE jobType = 'ONTOLOGY_MEMORY_DERIVATION' "
              + "AND status = 'PENDING' "
              + "AND jobArgs->>'batchKey' = :batchKey "
              + "AND jsonb_array_length(jobArgs->'memoryIds') < :limit "
              + "AND runAt > (EXTRACT(EPOCH FROM NOW()) * 1000) + :marginMs "
              + "ORDER BY id DESC LIMIT 1 FOR UPDATE",
      connectionType = POSTGRES)
  Long lockOpenOntologyMemoryBatch(
      @Bind("batchKey") String batchKey, @Bind("limit") int limit, @Bind("marginMs") long marginMs);

  @ConnectionAwareSqlUpdate(
      value =
          "UPDATE background_jobs SET jobArgs = JSON_ARRAY_APPEND(jobArgs, '$.memoryIds', :memoryId), "
              + "updatedAt = (UNIX_TIMESTAMP(NOW(3)) * 1000) WHERE id = :id AND status = 'PENDING'",
      connectionType = MYSQL)
  @ConnectionAwareSqlUpdate(
      value =
          "UPDATE background_jobs SET jobArgs = jsonb_set(jobArgs, '{memoryIds}', "
              + "(jobArgs->'memoryIds') || to_jsonb(CAST(:memoryId AS text))), "
              + "updatedAt = (EXTRACT(EPOCH FROM NOW()) * 1000) WHERE id = :id AND status = 'PENDING'",
      connectionType = POSTGRES)
  int appendToOntologyMemoryBatch(@Bind("id") long id, @Bind("memoryId") String memoryId);

  @ConnectionAwareSqlQuery(
      value =
          "SELECT id, jobType, methodName, jobArgs, status, createdAt, updatedAt, createdBy, runAt, "
              + "progress, total, result, error, message, cancelRequested, completedAt "
              + "FROM background_jobs WHERE jobType = 'ONTOLOGY_MEMORY_DERIVATION' "
              + "AND status IN ('COMPLETED', 'FAILED') "
              + "AND JSON_SEARCH(jobArgs, 'one', :memoryId, NULL, '$.memoryIds[*]') IS NOT NULL "
              + "ORDER BY id DESC LIMIT 1",
      connectionType = MYSQL)
  @ConnectionAwareSqlQuery(
      value =
          "SELECT id, jobType, methodName, jobArgs, status, createdAt, updatedAt, createdBy, runAt, "
              + "progress, total, result, error, message, cancelRequested, completedAt "
              + "FROM background_jobs WHERE jobType = 'ONTOLOGY_MEMORY_DERIVATION' "
              + "AND status IN ('COMPLETED', 'FAILED') "
              + "AND EXISTS (SELECT 1 FROM jsonb_array_elements_text(jobArgs->'memoryIds') "
              + "AS source(memoryId) WHERE source.memoryId = :memoryId) "
              + "ORDER BY id DESC LIMIT 1",
      connectionType = POSTGRES)
  @RegisterRowMapper(BackgroundJobMapper.class)
  BackgroundJob findLatestFinishedOntologyMemoryJobInternal(@Bind("memoryId") String memoryId);

  default Optional<BackgroundJob> findLatestFinishedOntologyMemoryJob(String memoryId) {
    return Optional.ofNullable(findLatestFinishedOntologyMemoryJobInternal(memoryId));
  }

  @SqlQuery("SELECT id FROM context_memory WHERE id = :memoryId FOR UPDATE")
  String lockMemoryForOntologyQueue(@Bind("memoryId") String memoryId);

  @ConnectionAwareSqlUpdate(
      value =
          "UPDATE background_jobs SET runAt = :runAt, updatedAt = GREATEST(updatedAt + 1, :updatedAt) "
              + "WHERE id = :id AND status = 'PENDING'",
      connectionType = MYSQL)
  @ConnectionAwareSqlUpdate(
      value =
          "UPDATE background_jobs SET runAt = :runAt, updatedAt = GREATEST(updatedAt + 1, :updatedAt) "
              + "WHERE id = :id AND status = 'PENDING'",
      connectionType = POSTGRES)
  int reschedulePendingMemoryJob(
      @Bind("id") long id, @Bind("runAt") long runAt, @Bind("updatedAt") long updatedAt);

  @ConnectionAwareSqlUpdate(
      value =
          "UPDATE background_jobs SET status = 'CANCELLED', updatedAt = :updatedAt, completedAt = :updatedAt "
              + "WHERE jobType = :jobType AND methodName = :methodName AND status = 'PENDING' "
              + "AND JSON_UNQUOTE(JSON_EXTRACT(jobArgs, '$.jobKey')) = :jobKey",
      connectionType = MYSQL)
  @ConnectionAwareSqlUpdate(
      value =
          "UPDATE background_jobs SET status = 'CANCELLED', updatedAt = :updatedAt, completedAt = :updatedAt "
              + "WHERE jobType = :jobType AND methodName = :methodName AND status = 'PENDING' "
              + "AND jobArgs->>'jobKey' = :jobKey",
      connectionType = POSTGRES)
  int cancelPendingPageMemoryJobs(
      @Bind("jobType") String jobType,
      @Bind("methodName") String methodName,
      @Bind("jobKey") String jobKey,
      @Bind("updatedAt") long updatedAt);

  @ConnectionAwareSqlUpdate(
      value =
          "INSERT INTO background_jobs "
              + "(jobType, methodName, jobArgs, createdBy, runAt, progress, total, message) "
              + "VALUES (:jobType, :methodName, :jobArgs, :createdBy, :runAt, :progress, :total, :message)",
      connectionType = MYSQL)
  @ConnectionAwareSqlUpdate(
      value =
          "INSERT INTO background_jobs "
              + "(jobType, methodName, jobArgs, createdBy, runAt, progress, total, message) "
              + "VALUES (:jobType, :methodName, :jobArgs::jsonb, :createdBy, :runAt, :progress, :total, :message)",
      connectionType = POSTGRES)
  @GetGeneratedKeys
  long insertTrackedJobInternal(
      @Bind("jobType") String jobType,
      @Bind("methodName") String methodName,
      @BindJson("jobArgs") String jobArgs,
      @Bind("createdBy") String createdBy,
      @Bind("runAt") Long runAt,
      @Bind("progress") int progress,
      @Bind("total") int total,
      @Bind("message") String message);

  default Optional<BackgroundJob> fetchPendingJob(boolean includeMemoryJobs)
      throws BackgroundJobException {
    return Optional.ofNullable(fetchPendingJobInternal(includeMemoryJobs));
  }

  @ConnectionAwareSqlQuery(
      value =
          "SELECT id, jobType, methodName, jobArgs, status, createdAt, updatedAt, createdBy, runAt, "
              + "progress, total, result, error, message, cancelRequested, completedAt FROM background_jobs"
              + " WHERE status = 'PENDING'"
              + " AND (:includeMemoryJobs = true OR jobType NOT IN "
              + "('CONTEXT_MEMORY_EXTRACTION', 'ONTOLOGY_MEMORY_DERIVATION'))"
              + " AND COALESCE(runAt, 0) <= UNIX_TIMESTAMP(NOW(3)) * 1000"
              + " ORDER BY createdAt LIMIT 1",
      connectionType = MYSQL)
  @ConnectionAwareSqlQuery(
      value =
          "SELECT id, jobType, methodName, jobArgs, status, createdAt, updatedAt, createdBy, runAt, "
              + "progress, total, result, error, message, cancelRequested, completedAt FROM background_jobs"
              + " WHERE status = 'PENDING'"
              + " AND (:includeMemoryJobs = true OR jobType NOT IN "
              + "('CONTEXT_MEMORY_EXTRACTION', 'ONTOLOGY_MEMORY_DERIVATION'))"
              + " AND COALESCE(runAt, 0) <= EXTRACT(EPOCH FROM NOW()) * 1000"
              + " ORDER BY createdAt LIMIT 1",
      connectionType = POSTGRES)
  @RegisterRowMapper(BackgroundJobMapper.class)
  BackgroundJob fetchPendingJobInternal(@Bind("includeMemoryJobs") boolean includeMemoryJobs)
      throws StatementException;

  @ConnectionAwareSqlUpdate(
      value =
          "UPDATE background_jobs SET status = :status, updatedAt = (UNIX_TIMESTAMP(NOW(3)) * 1000) WHERE id = :id",
      connectionType = MYSQL)
  @ConnectionAwareSqlUpdate(
      value =
          "UPDATE background_jobs SET status = :status, updatedAt = (EXTRACT(EPOCH FROM NOW()) * 1000) WHERE id = :id",
      connectionType = POSTGRES)
  void updateJobStatusInternal(@Bind("id") long id, @Bind("status") String status);

  default void updateJobStatus(long id, BackgroundJob.Status status) {
    updateJobStatusInternal(id, status.name());
  }

  // Atomically claims a PENDING job for execution. Returns 0 when another
  // worker thread (or another server in a multi-server deployment) claimed it
  // first, so concurrent pollers never run the same job twice.
  @ConnectionAwareSqlUpdate(
      value =
          "UPDATE background_jobs SET status = 'RUNNING', updatedAt = (UNIX_TIMESTAMP(NOW(3)) * 1000) "
              + "WHERE id = :id AND status = 'PENDING'",
      connectionType = MYSQL)
  @ConnectionAwareSqlUpdate(
      value =
          "UPDATE background_jobs SET status = 'RUNNING', updatedAt = (EXTRACT(EPOCH FROM NOW()) * 1000) "
              + "WHERE id = :id AND status = 'PENDING'",
      connectionType = POSTGRES)
  int claimPendingJob(@Bind("id") long id);

  @SqlQuery(
      "SELECT id, jobType, methodName, jobArgs, status, createdAt, updatedAt, createdBy, runAt, "
          + "progress, total, result, error, message, cancelRequested, completedAt "
          + "FROM background_jobs WHERE id = :id")
  @RegisterRowMapper(BackgroundJobMapper.class)
  BackgroundJob getJob(@Bind("id") long id) throws StatementException;

  default Optional<BackgroundJob> fetchJobById(long id) {
    return Optional.ofNullable(getJob(id));
  }

  // The list intentionally omits `result`: a completed export stores the whole
  // CSV there, so selecting it would make every jobs-tray refresh transfer the
  // concatenation of all recent exports. Clients download a single job's result
  // via GET /csvAsyncJobs/{jobId}/result.
  @SqlQuery(
      "SELECT id, jobType, methodName, jobArgs, status, createdAt, updatedAt, createdBy, runAt, "
          + "progress, total, NULL AS result, error, message, cancelRequested, completedAt "
          + "FROM background_jobs WHERE createdBy = :createdBy "
          + "AND jobType IN ('CSV_IMPORT', 'CSV_EXPORT') ORDER BY createdAt DESC LIMIT :limit")
  @RegisterRowMapper(BackgroundJobMapper.class)
  List<BackgroundJob> listCsvJobsByUser(
      @Bind("createdBy") String createdBy, @Bind("limit") int limit);

  // Omits `result` for the same reason the list query does: a completed export
  // stores the whole CSV there, and this is the endpoint clients poll for status.
  // Downloads read the payload through findCsvJobResultById.
  @SqlQuery(
      "SELECT id, jobType, methodName, jobArgs, status, createdAt, updatedAt, createdBy, runAt, "
          + "progress, total, NULL AS result, error, message, cancelRequested, completedAt "
          + "FROM background_jobs WHERE id = :id AND jobType IN ('CSV_IMPORT', 'CSV_EXPORT')")
  @RegisterRowMapper(BackgroundJobMapper.class)
  BackgroundJob findCsvJobById(@Bind("id") long id);

  @SqlQuery(
      "SELECT id, jobType, methodName, jobArgs, status, createdAt, updatedAt, createdBy, runAt, "
          + "progress, total, NULL AS result, error, message, cancelRequested, completedAt "
          + "FROM background_jobs WHERE createdBy = :createdBy "
          + "AND jobType = 'ONTOLOGY_BULK' ORDER BY createdAt DESC LIMIT :limit")
  @RegisterRowMapper(BackgroundJobMapper.class)
  List<BackgroundJob> listOntologyBulkJobsByUser(
      @Bind("createdBy") String createdBy, @Bind("limit") int limit);

  @SqlQuery(
      "SELECT id, jobType, methodName, jobArgs, status, createdAt, updatedAt, createdBy, runAt, "
          + "progress, total, result, error, message, cancelRequested, completedAt "
          + "FROM background_jobs WHERE id = :id AND jobType = 'ONTOLOGY_BULK'")
  @RegisterRowMapper(BackgroundJobMapper.class)
  BackgroundJob findOntologyBulkJobById(@Bind("id") long id);

  @SqlQuery(
      "SELECT result FROM background_jobs WHERE id = :id "
          + "AND jobType IN ('CSV_IMPORT', 'CSV_EXPORT', 'AUDIT_EXPORT')")
  String findCsvJobResultById(@Bind("id") long id);

  @SqlQuery(
      "SELECT id, jobType, methodName, jobArgs, status, createdAt, updatedAt, createdBy, runAt, "
          + "progress, total, NULL AS result, error, message, cancelRequested, completedAt "
          + "FROM background_jobs WHERE id = :id AND jobType = 'AUDIT_EXPORT'")
  @RegisterRowMapper(BackgroundJobMapper.class)
  BackgroundJob findAuditExportJobById(@Bind("id") long id);

  @SqlUpdate(
      "UPDATE background_jobs SET status = :status, message = :message, "
          + "updatedAt = :updatedAt WHERE id = :id")
  void updateJobStatusWithMessage(
      @Bind("id") long id,
      @Bind("status") String status,
      @Bind("message") String message,
      @Bind("updatedAt") long updatedAt);

  default void updateJobStatusWithMessage(
      long id, BackgroundJob.Status status, String message, long updatedAt) {
    updateJobStatusWithMessage(id, status.name(), message, updatedAt);
  }

  @SqlUpdate(
      "UPDATE background_jobs SET progress = :progress, total = :total, message = :message, "
          + "updatedAt = :updatedAt WHERE id = :id")
  void updateJobProgress(
      @Bind("id") long id,
      @Bind("progress") int progress,
      @Bind("total") int total,
      @Bind("message") String message,
      @Bind("updatedAt") long updatedAt);

  @SqlUpdate(
      "UPDATE background_jobs SET status = :status, result = :result, error = NULL, message = :message, "
          + "progress = :progress, total = :total, updatedAt = :updatedAt, completedAt = :completedAt "
          + "WHERE id = :id")
  void completeJob(
      @Bind("id") long id,
      @Bind("status") String status,
      @Bind("result") String result,
      @Bind("message") String message,
      @Bind("progress") int progress,
      @Bind("total") int total,
      @Bind("updatedAt") long updatedAt,
      @Bind("completedAt") long completedAt);

  @SqlUpdate(
      "UPDATE background_jobs SET status = :status, error = :error, message = :message, "
          + "updatedAt = :updatedAt, completedAt = :completedAt WHERE id = :id")
  void failJob(
      @Bind("id") long id,
      @Bind("status") String status,
      @Bind("error") String error,
      @Bind("message") String message,
      @Bind("updatedAt") long updatedAt,
      @Bind("completedAt") long completedAt);

  @SqlUpdate(
      "UPDATE background_jobs SET cancelRequested = true, message = :message, updatedAt = :updatedAt "
          + "WHERE id = :id AND status IN ('PENDING', 'RUNNING')")
  int requestCancel(
      @Bind("id") long id, @Bind("message") String message, @Bind("updatedAt") long updatedAt);

  @SqlQuery("SELECT cancelRequested FROM background_jobs WHERE id = :id")
  Boolean isCancelRequested(@Bind("id") long id);

  // Workers heartbeat updatedAt, so the cutoff prevents a rolling deployment from failing jobs
  // owned by another server. Only job types managed by GenericBackgroundWorker belong here.
  @SqlUpdate(
      "UPDATE background_jobs SET status = 'FAILED', error = 'Job stopped responding and was marked failed.', "
          + "message = 'Job stopped responding and was marked failed.', updatedAt = :updatedAt, completedAt = :updatedAt "
          + "WHERE jobType IN ('CSV_IMPORT', 'CSV_EXPORT', 'AUDIT_EXPORT', 'ONTOLOGY_BULK', "
          + "'ONTOLOGY_MEMORY_DERIVATION') "
          + "AND status = 'RUNNING' AND updatedAt < :staleBefore")
  int markStaleRunningJobsFailed(
      @Bind("updatedAt") long updatedAt, @Bind("staleBefore") long staleBefore);

  @ConnectionAwareSqlUpdate(
      value =
          "UPDATE background_jobs SET status = 'PENDING', runAt = :updatedAt, updatedAt = :updatedAt "
              + "WHERE status = 'RUNNING' AND id = (SELECT id FROM (SELECT running.id "
              + "FROM background_jobs running LEFT JOIN background_jobs pending "
              + "ON pending.jobType = 'CONTEXT_MEMORY_EXTRACTION' AND pending.status = 'PENDING' "
              + "AND JSON_UNQUOTE(JSON_EXTRACT(pending.jobArgs, '$.jobKey')) = "
              + "JSON_UNQUOTE(JSON_EXTRACT(running.jobArgs, '$.jobKey')) "
              + "WHERE running.jobType = 'CONTEXT_MEMORY_EXTRACTION' AND running.status = 'RUNNING' "
              + "AND running.updatedAt < :staleBefore AND pending.id IS NULL "
              + "ORDER BY running.id LIMIT 1) candidate)",
      connectionType = MYSQL)
  @ConnectionAwareSqlUpdate(
      value =
          "UPDATE background_jobs SET status = 'PENDING', runAt = :updatedAt, updatedAt = :updatedAt "
              + "WHERE status = 'RUNNING' AND id = (SELECT running.id FROM background_jobs running "
              + "WHERE running.jobType = 'CONTEXT_MEMORY_EXTRACTION' AND running.status = 'RUNNING' "
              + "AND running.updatedAt < :staleBefore "
              + "AND NOT EXISTS (SELECT 1 FROM background_jobs pending "
              + "WHERE pending.jobType = 'CONTEXT_MEMORY_EXTRACTION' AND pending.status = 'PENDING' "
              + "AND pending.jobArgs->>'jobKey' = running.jobArgs->>'jobKey') "
              + "ORDER BY running.id LIMIT 1)",
      connectionType = POSTGRES)
  int requeueStaleMemoryJobs(
      @Bind("updatedAt") long updatedAt, @Bind("staleBefore") long staleBefore);

  // A newer PENDING job already covers this source, so an interrupted older run does not need to
  // be requeued. Retire it instead of leaving a stale RUNNING row behind forever.
  @ConnectionAwareSqlUpdate(
      value =
          "UPDATE background_jobs running JOIN background_jobs pending "
              + "ON pending.jobType = 'CONTEXT_MEMORY_EXTRACTION' AND pending.status = 'PENDING' "
              + "AND JSON_UNQUOTE(JSON_EXTRACT(pending.jobArgs, '$.jobKey')) = "
              + "JSON_UNQUOTE(JSON_EXTRACT(running.jobArgs, '$.jobKey')) "
              + "SET running.status = 'CANCELLED', running.updatedAt = :updatedAt, "
              + "running.completedAt = :updatedAt "
              + "WHERE running.jobType = 'CONTEXT_MEMORY_EXTRACTION' AND running.status = 'RUNNING' "
              + "AND running.updatedAt < :staleBefore",
      connectionType = MYSQL)
  @ConnectionAwareSqlUpdate(
      value =
          "UPDATE background_jobs running SET status = 'CANCELLED', updatedAt = :updatedAt, "
              + "completedAt = :updatedAt FROM background_jobs pending "
              + "WHERE running.jobType = 'CONTEXT_MEMORY_EXTRACTION' AND running.status = 'RUNNING' "
              + "AND running.updatedAt < :staleBefore "
              + "AND pending.jobType = 'CONTEXT_MEMORY_EXTRACTION' AND pending.status = 'PENDING' "
              + "AND pending.jobArgs->>'jobKey' = running.jobArgs->>'jobKey'",
      connectionType = POSTGRES)
  int cancelStaleMemoryJobsWithPending(
      @Bind("updatedAt") long updatedAt, @Bind("staleBefore") long staleBefore);

  @SqlUpdate("UPDATE background_jobs SET updatedAt = :updatedAt WHERE id = :id")
  void touchJob(@Bind("id") long id, @Bind("updatedAt") long updatedAt);

  // Retention tier 1 — the hard bound. Ids beyond the newest `keep` exports for
  // this user, whose payload is still held.
  @SqlQuery(
      "SELECT id FROM background_jobs WHERE createdBy = :createdBy "
          + "AND jobType IN ('CSV_EXPORT', 'AUDIT_EXPORT') "
          + "AND result IS NOT NULL ORDER BY id DESC LIMIT :limit OFFSET :keep")
  List<Long> findExportResultsOverUserCap(
      @Bind("createdBy") String createdBy, @Bind("keep") int keep, @Bind("limit") int limit);

  @SqlUpdate("UPDATE background_jobs SET result = NULL WHERE id IN (<ids>)")
  int releaseExportResults(@BindList("ids") List<Long> ids);

  // Retention tier 2 — release payloads past the TTL, keeping the row so the
  // job stays visible in the tray's history.
  @SqlUpdate(
      "UPDATE background_jobs SET result = NULL WHERE jobType IN ('CSV_EXPORT', 'AUDIT_EXPORT') "
          + "AND result IS NOT NULL AND completedAt IS NOT NULL AND completedAt < :cutoff")
  int releaseExpiredExportResults(@Bind("cutoff") long cutoff);

  // Retention tier 3 — prune terminal rows outright. PENDING/RUNNING are never
  // pruned: a PENDING job with a future runAt has not had its turn yet.
  @SqlQuery(
      "SELECT id FROM background_jobs WHERE status IN ('COMPLETED', 'FAILED', 'CANCELLED') "
          + "AND updatedAt < :cutoff ORDER BY id LIMIT :limit")
  List<Long> findJobsToPrune(@Bind("cutoff") long cutoff, @Bind("limit") int limit);

  @SqlUpdate("DELETE FROM background_jobs WHERE id IN (<ids>)")
  int deleteJobsByIds(@BindList("ids") List<Long> ids);

  @SqlUpdate(
      "INSERT INTO background_job_logs (logId, jobId, createdAt, level, message) "
          + "VALUES (:logId, :jobId, :createdAt, :level, :message)")
  void insertLog(
      @Bind("logId") String logId,
      @Bind("jobId") long jobId,
      @Bind("createdAt") long createdAt,
      @Bind("level") String level,
      @Bind("message") String message);

  @SqlQuery(
      "SELECT logId, jobId, createdAt, level, message FROM background_job_logs "
          + "WHERE jobId = :jobId ORDER BY createdAt DESC LIMIT :limit")
  @RegisterRowMapper(BackgroundJobLogMapper.class)
  List<BackgroundJobLog> listLogs(@Bind("jobId") long jobId, @Bind("limit") int limit);

  @Slf4j
  class BackgroundJobMapper implements RowMapper<BackgroundJob> {

    @Override
    public BackgroundJob map(ResultSet rs, StatementContext ctx) throws SQLException {
      long jobId = rs.getLong("id");
      try {
        BackgroundJob job = new BackgroundJob();
        job.setId(jobId);
        job.setJobType(BackgroundJob.JobType.fromValue(rs.getString("jobType")));
        job.setMethodName(rs.getString("methodName"));

        String jobArgsJson = rs.getString("jobArgs");
        Object jobArgs = JsonUtils.readValue(jobArgsJson, Object.class);
        job.setJobArgs(jobArgs);

        job.setStatus(BackgroundJob.Status.fromValue(rs.getString("status")));
        job.setCreatedAt(rs.getLong("createdAt"));
        job.setUpdatedAt(rs.getLong("updatedAt"));
        job.setCreatedBy(rs.getString("createdBy"));
        long runAt = rs.getLong("runAt");
        job.setRunAt(rs.wasNull() ? null : runAt);
        int progress = rs.getInt("progress");
        job.setProgress(rs.wasNull() ? null : progress);
        int total = rs.getInt("total");
        job.setTotal(rs.wasNull() ? null : total);
        job.setResult(rs.getString("result"));
        job.setError(rs.getString("error"));
        job.setMessage(rs.getString("message"));
        boolean cancelRequested = rs.getBoolean("cancelRequested");
        job.setCancelRequested(rs.wasNull() ? null : cancelRequested);
        long completedAt = rs.getLong("completedAt");
        job.setCompletedAt(rs.wasNull() ? null : completedAt);

        return job;
      } catch (Exception e) {
        throw new BackgroundJobException(jobId, "Failed to fetch/map pending job.", e);
      }
    }
  }

  class BackgroundJobLogMapper implements RowMapper<BackgroundJobLog> {
    @Override
    public BackgroundJobLog map(ResultSet rs, StatementContext ctx) throws SQLException {
      BackgroundJobLog log = new BackgroundJobLog();
      log.setLogId(rs.getString("logId"));
      log.setJobId(rs.getLong("jobId"));
      log.setCreatedAt(rs.getLong("createdAt"));
      log.setLevel(BackgroundJobLog.Level.valueOf(rs.getString("level")));
      log.setMessage(rs.getString("message"));
      return log;
    }
  }
}
