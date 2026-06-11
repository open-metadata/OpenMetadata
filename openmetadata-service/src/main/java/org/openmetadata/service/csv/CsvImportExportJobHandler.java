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

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.io.FilterOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.csv.CsvExportProgressCallback;
import org.openmetadata.csv.CsvImportProgressCallback;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.jobs.BackgroundJob;
import org.openmetadata.schema.search.SearchRequest;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jobs.BackgroundJobException;
import org.openmetadata.service.jobs.JobHandler;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.SearchResultCsvExporter;
import org.openmetadata.service.security.policyevaluator.SubjectContext;
import org.openmetadata.service.socket.WebSocketManager;
import org.openmetadata.service.util.CSVExportMessage;
import org.openmetadata.service.util.CSVImportMessage;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
public class CsvImportExportJobHandler implements JobHandler {
  private final CsvAsyncJobManager jobManager;

  public CsvImportExportJobHandler(CsvAsyncJobManager jobManager) {
    this.jobManager = jobManager;
  }

  @Override
  public void runJob(BackgroundJob job) {
    CsvAsyncJobArgs args = JsonUtils.convertValue(job.getJobArgs(), CsvAsyncJobArgs.class);
    String jobId = String.valueOf(job.getId());
    try {
      jobManager.markRunning(jobId, getStartedMessage(args));
      jobManager.checkpoint(jobId);
      if (args.getOperation() == CsvAsyncJob.Operation.IMPORT) {
        runImport(job, args);
      } else if (args.getSearchExport() != null) {
        runSearchExport(job, args.getSearchExport());
      } else {
        runExport(job, args);
      }
    } catch (CsvJobCancelledException e) {
      handleCancellation(job, args, e);
    } catch (Exception e) {
      handleFailure(job, args, e);
      throw new BackgroundJobException(job.getId(), e.getMessage(), e);
    }
  }

  @Override
  public boolean sendStatusToWebSocket() {
    return false;
  }

  private void runImport(BackgroundJob job, CsvAsyncJobArgs args) throws IOException {
    String jobId = String.valueOf(job.getId());
    sendImportMessage(job.getCreatedBy(), new CSVImportMessage(jobId, "STARTED", null, null));

    CsvImportProgressCallback progressCallback =
        new CsvImportProgressCallback() {
          @Override
          public void onProgress(
              int rowsProcessed, int totalRows, int batchNumber, String message) {
            jobManager.updateProgress(jobId, rowsProcessed, totalRows, message);
            sendImportMessage(
                job.getCreatedBy(),
                new CSVImportMessage(
                    jobId, "IN_PROGRESS", null, null, rowsProcessed, totalRows, message));
          }

          @Override
          public void checkpoint() {
            jobManager.checkpoint(jobId);
          }
        };

    EntityRepository<EntityInterface> repository = getRepository(args.getEntityType());
    CsvImportResult result =
        nullOrEmpty(args.getVersioningEntityType())
            ? repository.importFromCsv(
                args.getTargetFqn(),
                args.getCsv(),
                Boolean.TRUE.equals(args.getDryRun()),
                job.getCreatedBy(),
                Boolean.TRUE.equals(args.getRecursive()),
                progressCallback)
            : repository.importFromCsv(
                args.getTargetFqn(),
                args.getCsv(),
                Boolean.TRUE.equals(args.getDryRun()),
                job.getCreatedBy(),
                Boolean.TRUE.equals(args.getRecursive()),
                args.getVersioningEntityType(),
                progressCallback);

    createBulkImportVersion(args, result, job.getCreatedBy());
    jobManager.completeImportJob(jobId, result, "Import completed.");
    sendImportMessage(job.getCreatedBy(), new CSVImportMessage(jobId, "COMPLETED", result, null));
  }

  private void runExport(BackgroundJob job, CsvAsyncJobArgs args) throws IOException {
    String jobId = String.valueOf(job.getId());
    EntityRepository<EntityInterface> repository = getRepository(args.getEntityType());
    CsvExportProgressCallback progressCallback =
        new CsvExportProgressCallback() {
          @Override
          public void onProgress(int exported, int total, String message) {
            jobManager.updateProgress(jobId, exported, total, message);
            sendExportMessage(
                job.getCreatedBy(),
                new CSVExportMessage(jobId, "IN_PROGRESS", null, null, exported, total, message));
          }

          @Override
          public void checkpoint() {
            jobManager.checkpoint(jobId);
          }
        };

    String csvData =
        repository.exportToCsv(
            args.getTargetFqn(),
            job.getCreatedBy(),
            Boolean.TRUE.equals(args.getRecursive()),
            progressCallback);
    CsvAsyncJob finishedJob = jobManager.getJob(jobId);
    int progress = finishedJob.getProgress() == null ? 0 : finishedJob.getProgress();
    int total = finishedJob.getTotal() == null ? progress : finishedJob.getTotal();
    jobManager.completeExportJob(jobId, csvData, "Export completed.", progress, total);
    // The completion event intentionally omits the CSV — clients download it
    // via GET /csvAsyncJobs/{jobId}/result instead of receiving a potentially
    // huge payload over the websocket.
    sendExportMessage(job.getCreatedBy(), new CSVExportMessage(jobId, "COMPLETED", null, null));
  }

  // Streams matching search documents straight into the spool file — the only
  // export path that never materializes the whole CSV in memory.
  private void runSearchExport(BackgroundJob job, CsvAsyncJobArgs.SearchExportArgs searchExport)
      throws IOException {
    String jobId = String.valueOf(job.getId());
    SubjectContext subjectContext = SubjectContext.getSubjectContext(job.getCreatedBy());
    SearchRequest request =
        SearchResultCsvExporter.buildExportSearchRequest(
            subjectContext,
            searchExport.getQuery(),
            searchExport.getIndex(),
            searchExport.getDeleted(),
            searchExport.getQueryFilter(),
            searchExport.getPostFilter(),
            searchExport.getSortField(),
            searchExport.getSortOrder());
    SearchRepository searchRepository = Entity.getSearchRepository();
    int from = searchExport.getFrom() == null ? 0 : searchExport.getFrom();
    int totalHits = searchRepository.countSearchResults(request, subjectContext);
    Integer size = searchExport.getSize();
    int effectiveTotal =
        Math.max(
            (size != null && size > 0) ? Math.min(size, totalHits - from) : totalHits - from, 0);
    if (effectiveTotal > SearchResultCsvExporter.MAX_EXPORT_ROWS) {
      throw new IllegalArgumentException(
          String.format(
              "Results contain %d rows, max is %d. Please add filters to reduce the result set.",
              effectiveTotal, SearchResultCsvExporter.MAX_EXPORT_ROWS));
    }

    try (OutputStream spool = CsvExportSpool.openForWrite(jobId)) {
      OutputStream progressTracking =
          new RowCountingOutputStream(spool, effectiveTotal, jobId, jobManager);
      searchRepository.exportSearchResultsCsvStream(
          request, subjectContext, effectiveTotal, from, progressTracking);
    }
    jobManager.completeSpooledExportJob(jobId, "Export completed.", effectiveTotal, effectiveTotal);
    sendExportMessage(job.getCreatedBy(), new CSVExportMessage(jobId, "COMPLETED", null, null));
  }

  // Counts CSV rows as they stream by so the job reports live progress and
  // honors cancellation between batches.
  private static final class RowCountingOutputStream extends FilterOutputStream {
    private static final int PROGRESS_EVERY_ROWS = 1000;
    private final int total;
    private final String jobId;
    private final CsvAsyncJobManager jobManager;
    private int rows;
    private int rowsAtLastReport;

    private RowCountingOutputStream(
        OutputStream delegate, int total, String jobId, CsvAsyncJobManager jobManager) {
      super(delegate);
      this.total = total;
      this.jobId = jobId;
      this.jobManager = jobManager;
    }

    @Override
    public void write(int b) throws IOException {
      out.write(b);
      countRows(b);
    }

    @Override
    public void write(byte[] buffer, int offset, int length) throws IOException {
      out.write(buffer, offset, length);
      for (int i = offset; i < offset + length; i++) {
        countRows(buffer[i]);
      }
    }

    private void countRows(int b) {
      if (b == '\n') {
        rows++;
        if (rows - rowsAtLastReport >= PROGRESS_EVERY_ROWS) {
          rowsAtLastReport = rows;
          jobManager.updateProgress(
              jobId, Math.min(rows, total), total, "Exported " + rows + " rows.");
          jobManager.checkpoint(jobId);
        }
      }
    }
  }

  private void createBulkImportVersion(
      CsvAsyncJobArgs args, CsvImportResult result, String updatedBy) {
    String effectiveVersioningEntityType =
        nullOrEmpty(args.getVersioningEntityType())
            ? args.getEntityType()
            : args.getVersioningEntityType();
    if (result.getStatus() == ApiStatus.ABORTED
        || result.getNumberOfRowsProcessed() == null
        || result.getNumberOfRowsProcessed() <= 1
        || Boolean.TRUE.equals(args.getDryRun())) {
      return;
    }
    EntityRepository<EntityInterface> versioningRepo = getRepository(effectiveVersioningEntityType);
    if (!versioningRepo.supportsBulkImportVersioning()) {
      return;
    }
    versioningRepo.createChangeEventForBulkOperation(
        versioningRepo.getByName(
            null,
            args.getTargetFqn(),
            new Fields(versioningRepo.getAllowedFields(), ""),
            Include.NON_DELETED,
            false),
        result,
        updatedBy);
  }

  private void handleCancellation(
      BackgroundJob job, CsvAsyncJobArgs args, CsvJobCancelledException exception) {
    String jobId = String.valueOf(job.getId());
    jobManager.markCancelled(jobId, exception.getMessage());
    if (args.getOperation() == CsvAsyncJob.Operation.IMPORT) {
      CsvImportResult result =
          new CsvImportResult()
              .withDryRun(Boolean.TRUE.equals(args.getDryRun()))
              .withStatus(ApiStatus.ABORTED)
              .withAbortReason(exception.getMessage());
      sendImportMessage(job.getCreatedBy(), new CSVImportMessage(jobId, "COMPLETED", result, null));
    } else {
      sendExportMessage(
          job.getCreatedBy(), new CSVExportMessage(jobId, "FAILED", null, exception.getMessage()));
    }
  }

  private void handleFailure(BackgroundJob job, CsvAsyncJobArgs args, Exception exception) {
    String jobId = String.valueOf(job.getId());
    String message = exception.getMessage() == null ? exception.toString() : exception.getMessage();
    LOG.error("CSV {} job {} failed", args.getOperation(), jobId, exception);
    jobManager.failJob(jobId, message);
    if (args.getOperation() == CsvAsyncJob.Operation.IMPORT) {
      sendImportMessage(job.getCreatedBy(), new CSVImportMessage(jobId, "FAILED", null, message));
    } else {
      sendExportMessage(job.getCreatedBy(), new CSVExportMessage(jobId, "FAILED", null, message));
    }
  }

  @SuppressWarnings("unchecked")
  private EntityRepository<EntityInterface> getRepository(String entityType) {
    return (EntityRepository<EntityInterface>) Entity.getEntityRepository(entityType);
  }

  private String getStartedMessage(CsvAsyncJobArgs args) {
    return args.getOperation() == CsvAsyncJob.Operation.IMPORT
        ? "Import started."
        : "Export started.";
  }

  private void sendImportMessage(String username, CSVImportMessage message) {
    sendMessage(username, WebSocketManager.CSV_IMPORT_CHANNEL, message);
  }

  private void sendExportMessage(String username, CSVExportMessage message) {
    sendMessage(username, WebSocketManager.CSV_EXPORT_CHANNEL, message);
  }

  private void sendMessage(String username, String channel, Object message) {
    UUID userId = getUserId(username);
    if (userId != null) {
      WebSocketManager.getInstance().sendToOne(userId, channel, JsonUtils.pojoToJson(message));
    }
  }

  private UUID getUserId(String username) {
    try {
      User user =
          Entity.getCollectionDAO()
              .userDAO()
              .findEntityByName(FullyQualifiedName.quoteName(username));
      return user.getId();
    } catch (EntityNotFoundException e) {
      LOG.error("User not found {}", username, e);
      return null;
    }
  }
}
