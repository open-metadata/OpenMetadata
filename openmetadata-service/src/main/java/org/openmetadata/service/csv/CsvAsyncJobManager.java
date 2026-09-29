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

import jakarta.ws.rs.BadRequestException;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.jobs.BackgroundJob;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jobs.BackgroundJobLog;
import org.openmetadata.service.jobs.JobDAO;

@Slf4j
public final class CsvAsyncJobManager {
  public static final String CSV_JOB_HANDLER_NAME = "CsvImportExportJobHandler";
  public static final String RESULT_STORAGE_SPOOL = "spool";
  public static final String EXPORT_COMPLETED_MESSAGE = "Export completed.";
  public static final String LINEAGE_ENTITY_TYPE = "lineage";
  public static final String AUDIT_ENTITY_TYPE = "auditLog";
  private static final String EXPORT_QUEUED_MESSAGE = "Export queued.";
  private static final String IMPORT_QUEUED_MESSAGE = "Import queued.";

  /** Exports that are not scoped to a single entity tree. */
  private static final String ALL_TARGETS = "*";

  // Import payloads are carried in the job-args column and parsed in memory, so
  // unbounded CSVs would bloat the jobs table and the server heap. Oversized
  // imports are rejected up front with a 400 instead of failing mid-job.
  public static final int MAX_IMPORT_CSV_BYTES = 20 * 1024 * 1024;
  public static final int MAX_IMPORT_CSV_ROWS = 100_000;
  private static final int DEFAULT_LOG_LIMIT = 100;

  // Retention. The per-user cap is the hard bound on how much export payload the
  // jobs table can ever hold: users x RETAINED_EXPORTS_PER_USER x max result size.
  // The TTL and the row prune bound it further in time.
  public static final int RETAINED_EXPORTS_PER_USER = 5;
  public static final Duration RESULT_TTL = Duration.ofHours(24);
  private static final int CLEANUP_BATCH_SIZE = 500;

  private static final CsvAsyncJobManager INSTANCE = new CsvAsyncJobManager();

  private volatile JobDAO dao;

  private CsvAsyncJobManager() {}

  public static CsvAsyncJobManager getInstance() {
    return INSTANCE;
  }

  public static void initialize(JobDAO dao) {
    INSTANCE.dao = dao;
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
    if (operation == CsvAsyncJob.Operation.IMPORT) {
      validateImportPayload(csv);
    }
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
        operation == CsvAsyncJob.Operation.IMPORT ? IMPORT_QUEUED_MESSAGE : EXPORT_QUEUED_MESSAGE;
    return insertJob(args, createdBy, jobTypeOf(operation), message);
  }

  public CsvAsyncJob createSearchExportJob(
      String indexName, String createdBy, CsvAsyncJobArgs.SearchExportArgs searchExport) {
    return insertExportJob(
        exportArgs(indexName, ALL_TARGETS).setSearchExport(searchExport),
        createdBy,
        BackgroundJob.JobType.CSV_EXPORT);
  }

  public CsvAsyncJob createLineageExportJob(
      String createdBy, CsvAsyncJobArgs.LineageExportArgs lineageExport) {
    return insertExportJob(
        exportArgs(LINEAGE_ENTITY_TYPE, lineageExport.getFqn()).setLineageExport(lineageExport),
        createdBy,
        BackgroundJob.JobType.CSV_EXPORT);
  }

  public CsvAsyncJob createAuditExportJob(
      String createdBy, CsvAsyncJobArgs.AuditExportArgs auditExport) {
    return insertExportJob(
        exportArgs(AUDIT_ENTITY_TYPE, ALL_TARGETS).setAuditExport(auditExport),
        createdBy,
        BackgroundJob.JobType.AUDIT_EXPORT);
  }

  private static CsvAsyncJobArgs exportArgs(String entityType, String targetFqn) {
    return new CsvAsyncJobArgs()
        .setOperation(CsvAsyncJob.Operation.EXPORT)
        .setEntityType(entityType)
        .setTargetFqn(targetFqn)
        .setDryRun(false)
        .setRecursive(false);
  }

  /** Audit export jobs are typed separately so they stay out of the CSV jobs tray. */
  public CsvAsyncJob getAuditExportJob(String jobId) {
    Long id = lookupIdOrNull(jobId);
    return id == null ? null : toCsvJob(dao.findAuditExportJobById(id));
  }

  /**
   * The stored export payload. Read only when serving a download — {@link #getJob} deliberately
   * leaves it out so status polling does not transfer the whole export on every tick.
   */
  public String getExportResult(String jobId) {
    Long id = lookupIdOrNull(jobId);
    return id == null ? null : dao.findCsvJobResultById(id);
  }

  private CsvAsyncJob insertExportJob(
      CsvAsyncJobArgs args, String createdBy, BackgroundJob.JobType jobType) {
    return insertJob(args, createdBy, jobType, EXPORT_QUEUED_MESSAGE);
  }

  private CsvAsyncJob insertJob(
      CsvAsyncJobArgs args, String createdBy, BackgroundJob.JobType jobType, String message) {
    long jobId =
        dao.insertTrackedJobInternal(
            jobType.name(),
            CSV_JOB_HANDLER_NAME,
            JsonUtils.pojoToJson(args),
            createdBy,
            null,
            0,
            0,
            message);
    addLog(jobId, CsvAsyncJobLog.Level.INFO, message);
    return findJobOfType(String.valueOf(jobId), jobType);
  }

  /**
   * Each job type has its own lookup, and they do not overlap: {@link #getJob} filters to
   * CSV_IMPORT/CSV_EXPORT, so reading an audit export through it yields null.
   */
  private CsvAsyncJob findJobOfType(String jobId, BackgroundJob.JobType jobType) {
    return jobType == BackgroundJob.JobType.AUDIT_EXPORT ? getAuditExportJob(jobId) : getJob(jobId);
  }

  public CsvAsyncJob getJob(String jobId) {
    Long id = lookupIdOrNull(jobId);
    return id == null ? null : toCsvJob(dao.findCsvJobById(id));
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

  // The compressed CSV lives in the job row so any server can serve the download —
  // the node that ran the export is rarely the one the load balancer routes the
  // download to. The list query selects NULL AS result, so this never bloats the tray.
  public void completeExportJob(
      String jobId, String createdBy, String csvData, int progress, int total) {
    completeCompressedExportJob(
        jobId, createdBy, CsvExportPayload.compress(csvData), progress, total);
  }

  // For exports that stream into a compressing buffer (e.g. search-result exports)
  // instead of materializing the CSV as a string first.
  public void completeCompressedExportJob(
      String jobId, String createdBy, String encodedResult, int progress, int total) {
    completeJob(jobId, encodedResult, EXPORT_COMPLETED_MESSAGE, progress, total);
    enforceResultCap(createdBy);
  }

  /** True for legacy jobs whose CSV was written to a local file before results moved into the row. */
  public boolean isSpoolResultReference(String result) {
    boolean isSpooled = false;
    if (result != null && result.trim().startsWith("{")) {
      try {
        Map<?, ?> reference = JsonUtils.readValue(result, Map.class);
        isSpooled = RESULT_STORAGE_SPOOL.equals(reference.get("storage"));
      } catch (RuntimeException e) {
        LOG.debug("Job result column does not hold a spool reference", e);
      }
    }
    return isSpooled;
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

  private void validateImportPayload(String csv) {
    if (csv != null) {
      int payloadBytes = csv.getBytes(StandardCharsets.UTF_8).length;
      if (payloadBytes > MAX_IMPORT_CSV_BYTES) {
        throw new BadRequestException(
            String.format(
                "CSV import payload is %d bytes; the maximum allowed is %d bytes.",
                payloadBytes, MAX_IMPORT_CSV_BYTES));
      }
      long rowCount = csv.chars().filter(character -> character == '\n').count();
      if (rowCount > MAX_IMPORT_CSV_ROWS) {
        throw new BadRequestException(
            String.format(
                "CSV import payload has %d rows; the maximum allowed is %d rows.",
                rowCount, MAX_IMPORT_CSV_ROWS));
      }
    }
  }

  private void addLog(long jobId, CsvAsyncJobLog.Level level, String message) {
    dao.insertLog(UUID.randomUUID().toString(), jobId, now(), level.name(), message);
  }

  /**
   * One pass of retention for CSV and audit export jobs. Safe to run concurrently from every
   * server: each statement is either idempotent or scoped to rows no live worker owns.
   *
   * <p>Table-wide row pruning lives in {@link
   * org.openmetadata.service.jobs.BackgroundJobCleanupScheduler}, since {@code background_jobs} is
   * shared with other job types.
   */
  public void runCleanupOnce() {
    if (dao == null) {
      return;
    }
    long now = now();
    releaseExpiredResults(now);
    // Ages out files left by jobs that completed before results moved into the
    // job row. Once those have expired this call, and the spool, can go.
    CsvExportSpool.sweepExpired();
  }

  private void releaseExpiredResults(long now) {
    int released = dao.releaseExpiredExportResults(now - RESULT_TTL.toMillis());
    if (released > 0) {
      LOG.info("Released {} expired CSV export results", released);
    }
  }

  /**
   * Releases the payload of this user's older exports so a busy user cannot pin an unbounded amount
   * of CSV in the jobs table. The rows survive; only the downloadable result goes.
   */
  private void enforceResultCap(String createdBy) {
    List<Long> ids =
        dao.findExportResultsOverUserCap(createdBy, RETAINED_EXPORTS_PER_USER, CLEANUP_BATCH_SIZE);
    if (!ids.isEmpty()) {
      dao.releaseExportResults(ids);
      LOG.debug("Released {} export results over the per-user cap for {}", ids.size(), createdBy);
    }
  }

  private BackgroundJob.JobType jobTypeOf(CsvAsyncJob.Operation operation) {
    return operation == CsvAsyncJob.Operation.IMPORT
        ? BackgroundJob.JobType.CSV_IMPORT
        : BackgroundJob.JobType.CSV_EXPORT;
  }

  private long parseJobId(String jobId) {
    return Long.parseLong(jobId);
  }

  /**
   * Job ids arrive from request paths, so anything that is not a {@code background_jobs} primary key
   * — non-numeric, or numeric but wider than a long — simply matches no row. Returning null lets the
   * resource answer 404 instead of letting {@code NumberFormatException} surface as a 500. Internal
   * callers keep using {@link #parseJobId}, where a bad id is a programming error worth throwing on.
   */
  private static Long lookupIdOrNull(String jobId) {
    Long id;
    try {
      id = Long.parseLong(jobId);
    } catch (NumberFormatException e) {
      id = null;
    }
    return id;
  }

  private long now() {
    return System.currentTimeMillis();
  }
}
