/*
 *  Copyright 2026 Collate.
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

package org.openmetadata.service.csv;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import org.openmetadata.schema.jobs.BackgroundJob;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jobs.BackgroundJobLog;
import org.openmetadata.service.jobs.JobDAO;

public final class CsvAsyncJobManager {
  public static final String CSV_JOB_HANDLER_NAME = "CsvImportExportJobHandler";
  private static final int DEFAULT_LOG_LIMIT = 100;
  private static final CsvAsyncJobManager INSTANCE = new CsvAsyncJobManager();

  private volatile JobDAO dao;

  private CsvAsyncJobManager() {}

  public static CsvAsyncJobManager getInstance() {
    return INSTANCE;
  }

  public static void initialize(JobDAO dao) {
    INSTANCE.dao = dao;
    INSTANCE.markStaleJobsFailed();
  }

  public CsvAsyncJob createJob(
      CsvAsyncJob.Operation operation,
      String entityType,
      String targetFqn,
      String createdBy,
      boolean dryRun,
      boolean recursive,
      String csv,
      String versioningEntityType) {
    CsvAsyncJobArgs args =
        new CsvAsyncJobArgs()
            .setOperation(operation)
            .setEntityType(entityType)
            .setTargetFqn(targetFqn)
            .setDryRun(dryRun)
            .setRecursive(recursive)
            .setCsv(csv)
            .setVersioningEntityType(versioningEntityType);
    String message =
        operation == CsvAsyncJob.Operation.IMPORT ? "Import queued." : "Export queued.";
    long jobId =
        dao.insertTrackedJobInternal(
            getJobType(operation),
            CSV_JOB_HANDLER_NAME,
            JsonUtils.pojoToJson(args),
            createdBy,
            null,
            0,
            0,
            message);
    addLog(jobId, CsvAsyncJobLog.Level.INFO, message);
    return getJob(String.valueOf(jobId));
  }

  public CsvAsyncJob getJob(String jobId) {
    BackgroundJob backgroundJob = dao.findCsvJobById(parseJobId(jobId));
    return toCsvJob(backgroundJob);
  }

  public List<CsvAsyncJob> listJobs(String createdBy, int limit) {
    return dao.listCsvJobsByUser(createdBy, limit).stream().map(this::toCsvJob).toList();
  }

  public void markRunning(String jobId, String message) {
    long id = parseJobId(jobId);
    dao.updateJobStatusWithMessage(id, BackgroundJob.Status.RUNNING, message, now());
    addLog(id, CsvAsyncJobLog.Level.INFO, message);
  }

  public void updateProgress(String jobId, int progress, int total, String message) {
    long id = parseJobId(jobId);
    dao.updateJobProgress(id, progress, total, message, now());
    addLog(id, CsvAsyncJobLog.Level.INFO, message);
  }

  public void completeImportJob(String jobId, CsvImportResult result, String message) {
    int progress =
        result.getNumberOfRowsProcessed() == null ? 0 : result.getNumberOfRowsProcessed();
    int total = progress;
    completeJob(jobId, JsonUtils.pojoToJson(result), message, progress, total);
  }

  public void completeExportJob(
      String jobId, String csvData, String message, int progress, int total) {
    completeJob(jobId, csvData, message, progress, total);
  }

  public void failJob(String jobId, String error) {
    long id = parseJobId(jobId);
    long now = now();
    dao.failJob(id, BackgroundJob.Status.FAILED.name(), error, error, now, now);
    addLog(id, CsvAsyncJobLog.Level.ERROR, error);
  }

  public void markCancelled(String jobId, String message) {
    long id = parseJobId(jobId);
    long now = now();
    dao.failJob(id, BackgroundJob.Status.CANCELLED.name(), null, message, now, now);
    addLog(id, CsvAsyncJobLog.Level.WARN, message);
  }

  public CsvAsyncJob requestCancel(String jobId) {
    long id = parseJobId(jobId);
    int updated = dao.requestCancel(id, "Cancellation requested.", now());
    if (updated > 0) {
      addLog(id, CsvAsyncJobLog.Level.WARN, "Cancellation requested.");
    }
    return getJob(jobId);
  }

  public void checkpoint(String jobId) {
    if (Boolean.TRUE.equals(dao.isCancelRequested(parseJobId(jobId)))) {
      throw new CsvJobCancelledException(jobId);
    }
  }

  private void completeJob(String jobId, String result, String message, int progress, int total) {
    long id = parseJobId(jobId);
    long now = now();
    dao.completeJob(
        id, BackgroundJob.Status.COMPLETED.name(), result, message, progress, total, now, now);
    addLog(id, CsvAsyncJobLog.Level.INFO, message);
  }

  private CsvAsyncJob toCsvJob(BackgroundJob backgroundJob) {
    if (backgroundJob == null) {
      return null;
    }
    CsvAsyncJobArgs args =
        JsonUtils.convertValue(backgroundJob.getJobArgs(), CsvAsyncJobArgs.class);
    CsvAsyncJob job = new CsvAsyncJob();
    job.setJobId(String.valueOf(backgroundJob.getId()));
    job.setOperation(args.getOperation());
    job.setEntityType(args.getEntityType());
    job.setTargetFqn(args.getTargetFqn());
    job.setCreatedBy(backgroundJob.getCreatedBy());
    job.setStatus(toCsvStatus(backgroundJob));
    job.setProgress(backgroundJob.getProgress());
    job.setTotal(backgroundJob.getTotal());
    job.setDryRun(args.getDryRun());
    job.setRecursive(args.getRecursive());
    job.setResult(backgroundJob.getResult());
    job.setError(backgroundJob.getError());
    job.setMessage(backgroundJob.getMessage());
    job.setCancelRequested(backgroundJob.getCancelRequested());
    job.setCreatedAt(backgroundJob.getCreatedAt());
    job.setUpdatedAt(backgroundJob.getUpdatedAt());
    job.setCompletedAt(backgroundJob.getCompletedAt());
    job.setLogs(getLogs(backgroundJob.getId()));
    return job;
  }

  private CsvAsyncJob.Status toCsvStatus(BackgroundJob backgroundJob) {
    if (Boolean.TRUE.equals(backgroundJob.getCancelRequested())
        && (backgroundJob.getStatus() == BackgroundJob.Status.PENDING
            || backgroundJob.getStatus() == BackgroundJob.Status.RUNNING)) {
      return CsvAsyncJob.Status.CANCELLING;
    }
    return switch (backgroundJob.getStatus()) {
      case PENDING -> CsvAsyncJob.Status.QUEUED;
      case RUNNING -> CsvAsyncJob.Status.RUNNING;
      case COMPLETED -> CsvAsyncJob.Status.COMPLETED;
      case FAILED -> CsvAsyncJob.Status.FAILED;
      case CANCELLED -> CsvAsyncJob.Status.CANCELLED;
    };
  }

  private List<CsvAsyncJobLog> getLogs(long jobId) {
    List<CsvAsyncJobLog> logs =
        dao.listLogs(jobId, DEFAULT_LOG_LIMIT).stream()
            .map(this::toCsvLog)
            .collect(Collectors.toCollection(ArrayList::new));
    Collections.reverse(logs);
    return logs;
  }

  private CsvAsyncJobLog toCsvLog(BackgroundJobLog backgroundJobLog) {
    CsvAsyncJobLog log = new CsvAsyncJobLog();
    log.setLogId(backgroundJobLog.getLogId());
    log.setJobId(String.valueOf(backgroundJobLog.getJobId()));
    log.setCreatedAt(backgroundJobLog.getCreatedAt());
    log.setLevel(CsvAsyncJobLog.Level.valueOf(backgroundJobLog.getLevel().name()));
    log.setMessage(backgroundJobLog.getMessage());
    return log;
  }

  private void addLog(long jobId, CsvAsyncJobLog.Level level, String message) {
    dao.insertLog(UUID.randomUUID().toString(), jobId, now(), level.name(), message);
  }

  private void markStaleJobsFailed() {
    if (dao != null) {
      dao.markStaleRunningCsvJobsFailed(now());
    }
  }

  private String getJobType(CsvAsyncJob.Operation operation) {
    return operation == CsvAsyncJob.Operation.IMPORT
        ? BackgroundJob.JobType.CSV_IMPORT.name()
        : BackgroundJob.JobType.CSV_EXPORT.name();
  }

  private long parseJobId(String jobId) {
    return Long.parseLong(jobId);
  }

  private long now() {
    return System.currentTimeMillis();
  }
}
