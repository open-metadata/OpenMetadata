package org.openmetadata.service.jobs;

import static org.openmetadata.service.jdbi3.locator.ConnectionType.MYSQL;
import static org.openmetadata.service.jdbi3.locator.ConnectionType.POSTGRES;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;
import org.jdbi.v3.core.statement.StatementException;
import org.jdbi.v3.sqlobject.config.RegisterRowMapper;
import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.statement.GetGeneratedKeys;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
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

  default Optional<BackgroundJob> fetchPendingJob() throws BackgroundJobException {
    return Optional.ofNullable(fetchPendingJobInternal());
  }

  @ConnectionAwareSqlQuery(
      value =
          "SELECT id,jobType,methodName,jobArgs,status,createdAt,updatedAt,createdBy,runAt FROM background_jobs"
              + " WHERE status = 'PENDING'"
              + " AND COALESCE(runAt, 0) <= UNIX_TIMESTAMP(NOW(3)) * 1000"
              + " ORDER BY createdAt LIMIT 1",
      connectionType = MYSQL)
  @ConnectionAwareSqlQuery(
      value =
          "SELECT id,jobType,methodName,jobArgs,status,createdAt,updatedAt,createdBy,runAt FROM background_jobs"
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

  @SqlQuery(
      "SELECT id, jobType, methodName, jobArgs, status, createdAt, updatedAt, createdBy FROM background_jobs WHERE id = :id")
  @RegisterRowMapper(BackgroundJobMapper.class)
  BackgroundJob getJob(@Bind("id") long id) throws StatementException;

  default Optional<BackgroundJob> fetchJobById(long id) {
    return Optional.ofNullable(getJob(id));
  }

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

        return job;
      } catch (Exception e) {
        throw new BackgroundJobException(jobId, "Failed to fetch/map pending job.", e);
      }
    }
  }
}
