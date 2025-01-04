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
import org.jdbi.v3.sqlobject.statement.SqlUpdate;
import org.openmetadata.schema.jobs.BackgroundJob;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlUpdate;
import org.openmetadata.service.util.JsonUtils;

public interface JobDAO {

  default long insertJob(
      BackgroundJob.JobType jobType, JobHandler handler, String jobArgs, String createdBy) {
    try {
      JsonUtils.readTree(jobArgs);
    } catch (Exception e) {
      throw new IllegalArgumentException("jobArgs must be a valid JSON string");
    }
    return insertJobInternal(
        jobType.name(), handler.getClass().getSimpleName(), jobArgs, createdBy);
  }

  @ConnectionAwareSqlUpdate(
      value =
          "INSERT INTO background_jobs (job_type, method_name, job_args, created_by) "
              + "VALUES (:jobType, :methodName, :jobArgs, :createdBy)",
      connectionType = MYSQL)
  @ConnectionAwareSqlUpdate(
      value =
          "INSERT INTO background_jobs (job_type, method_name, job_args,created_by) VALUES (:jobType, :methodName, :jobArgs::jsonb,:createdBy) ",
      connectionType = POSTGRES)
  @GetGeneratedKeys
  long insertJobInternal(
      @Bind("jobType") String jobType,
      @Bind("methodName") String methodName,
      @Bind("jobArgs") String jobArgs,
      @Bind("createdBy") String createdBy);

  default Optional<BackgroundJob> fetchPendingJob() {
    return Optional.ofNullable(fetchPendingJobInternal());
  }

  @SqlQuery(
      "SELECT id,job_type,method_name,job_args,status,created_at,updated_at,created_by  FROM background_jobs WHERE status = 'PENDING' ORDER BY created_at LIMIT 1")
  @RegisterRowMapper(BackgroundJobMapper.class)
  BackgroundJob fetchPendingJobInternal() throws StatementException;

  @SqlUpdate("UPDATE background_jobs SET status = :status, updated_at = NOW() WHERE id = :id")
  void updateJobStatusInternal(@Bind("id") long id, @Bind("status") String status);

  default void updateJobStatus(long id, BackgroundJob.Status status) {
    updateJobStatusInternal(id, status.name());
  }

  @SqlQuery(
      "SELECT id, job_type, method_name, job_args, status, created_at, updated_at, created_by FROM background_jobs WHERE id = :id")
  @RegisterRowMapper(BackgroundJobMapper.class)
  BackgroundJob getJob(@Bind("id") long id) throws StatementException;

  default Optional<BackgroundJob> fetchJobById(long id) {
    return Optional.ofNullable(getJob(id));
  }

  @Slf4j
  class BackgroundJobMapper implements RowMapper<BackgroundJob> {
    @Override
    public BackgroundJob map(ResultSet rs, StatementContext ctx) throws SQLException {
      BackgroundJob job = new BackgroundJob();
      job.setId(rs.getLong("id"));
      job.setJobType(BackgroundJob.JobType.fromValue(rs.getString("job_type")));
      job.setMethodName(rs.getString("method_name"));
      String jobArgsJson = rs.getString("job_args");
      Object jobArgs = JsonUtils.readValue(jobArgsJson, Object.class);
      job.setJobArgs(jobArgs);
      job.setStatus(BackgroundJob.Status.fromValue(rs.getString("status")));
      job.setCreatedAt(rs.getTimestamp("created_at"));
      job.setUpdatedAt(rs.getTimestamp("updated_at"));
      job.setCreatedBy(rs.getString("created_by"));
      return job;
    }
  }
}
