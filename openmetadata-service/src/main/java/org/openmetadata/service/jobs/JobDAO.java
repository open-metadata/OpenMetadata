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
import org.jdbi.v3.sqlobject.statement.GetGeneratedKeys;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;
import org.openmetadata.schema.jobs.BackgroundJob;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlQuery;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlUpdate;
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
      @Bind("jobArgs") String jobArgs,
      @Bind("createdBy") String createdBy,
      @Bind("runAt") Long runAt);

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
      @Bind("jobArgs") String jobArgs,
      @Bind("createdBy") String createdBy,
      @Bind("runAt") Long runAt,
      @Bind("progress") int progress,
      @Bind("total") int total,
      @Bind("message") String message);

  default Optional<BackgroundJob> fetchPendingJob() throws BackgroundJobException {
    return Optional.ofNullable(fetchPendingJobInternal());
  }

  @ConnectionAwareSqlQuery(
      value =
          "SELECT id, jobType, methodName, jobArgs, status, createdAt, updatedAt, createdBy, runAt, "
              + "progress, total, result, error, message, cancelRequested, completedAt FROM background_jobs"
              + " WHERE status = 'PENDING'"
              + " AND COALESCE(runAt, 0) <= UNIX_TIMESTAMP(NOW(3)) * 1000"
              + " ORDER BY createdAt LIMIT 1",
      connectionType = MYSQL)
  @ConnectionAwareSqlQuery(
      value =
          "SELECT id, jobType, methodName, jobArgs, status, createdAt, updatedAt, createdBy, runAt, "
              + "progress, total, result, error, message, cancelRequested, completedAt FROM background_jobs"
              + " WHERE status = 'PENDING'"
              + " AND COALESCE(runAt, 0) <= EXTRACT(EPOCH FROM NOW()) * 1000"
              + " ORDER BY createdAt LIMIT 1",
      connectionType = POSTGRES)
  @RegisterRowMapper(BackgroundJobMapper.class)
  BackgroundJob fetchPendingJobInternal() throws StatementException;

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

  @SqlQuery(
      "SELECT id, jobType, methodName, jobArgs, status, createdAt, updatedAt, createdBy, runAt, "
          + "progress, total, result, error, message, cancelRequested, completedAt "
          + "FROM background_jobs WHERE id = :id AND jobType IN ('CSV_IMPORT', 'CSV_EXPORT')")
  @RegisterRowMapper(BackgroundJobMapper.class)
  BackgroundJob findCsvJobById(@Bind("id") long id);

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

  @SqlUpdate(
      "UPDATE background_jobs SET status = 'FAILED', error = 'Server restarted before the job completed.', "
          + "message = 'Server restarted before the job completed.', updatedAt = :updatedAt, completedAt = :updatedAt "
          + "WHERE jobType IN ('CSV_IMPORT', 'CSV_EXPORT') AND status = 'RUNNING'")
  int markStaleRunningCsvJobsFailed(@Bind("updatedAt") long updatedAt);

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
