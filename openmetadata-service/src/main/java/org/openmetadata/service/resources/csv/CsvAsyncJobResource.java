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

package org.openmetadata.service.resources.csv;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.DefaultValue;
import jakarta.ws.rs.ForbiddenException;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import java.util.List;
import org.openmetadata.service.csv.CsvAsyncJob;
import org.openmetadata.service.csv.CsvAsyncJobManager;
import org.openmetadata.service.csv.CsvExportPayload;
import org.openmetadata.service.csv.CsvExportSpool;
import org.openmetadata.service.security.DefaultAuthorizer;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

@Path("/v1/csvAsyncJobs")
@Tag(name = "CSV Async Jobs", description = "CSV import and export job status APIs.")
@Produces(MediaType.APPLICATION_JSON)
public class CsvAsyncJobResource {
  private static final String CSV = "text/csv";

  private final CsvAsyncJobManager jobManager = CsvAsyncJobManager.getInstance();

  @GET
  @Operation(operationId = "listCsvAsyncJobs", summary = "List CSV import and export jobs")
  public List<CsvAsyncJob> listJobs(
      @Context SecurityContext securityContext,
      @QueryParam("limit") @DefaultValue("20") int limit) {
    SubjectContext subjectContext = DefaultAuthorizer.getSubjectContext(securityContext);
    return jobManager.listJobs(subjectContext.user().getName(), Math.min(Math.max(limit, 1), 100));
  }

  @GET
  @Path("/{jobId}")
  @Operation(operationId = "getCsvAsyncJob", summary = "Get a CSV import or export job")
  public CsvAsyncJob getJob(
      @Context SecurityContext securityContext, @PathParam("jobId") String jobId) {
    SubjectContext subjectContext = DefaultAuthorizer.getSubjectContext(securityContext);
    CsvAsyncJob job = jobManager.getJob(jobId);
    if (job == null) {
      throw new NotFoundException("CSV job not found: " + jobId);
    }
    validateAccess(subjectContext, job);
    return job;
  }

  @GET
  @Path("/{jobId}/result")
  @Produces(CSV)
  @Operation(
      operationId = "getCsvAsyncJobResult",
      summary = "Download the CSV produced by a completed export job")
  public Response getJobResult(
      @Context SecurityContext securityContext, @PathParam("jobId") String jobId) {
    SubjectContext subjectContext = DefaultAuthorizer.getSubjectContext(securityContext);
    CsvAsyncJob job = jobManager.getJob(jobId);
    if (job == null) {
      throw new NotFoundException("CSV job not found: " + jobId);
    }
    validateAccess(subjectContext, job);
    if (job.getOperation() != CsvAsyncJob.Operation.EXPORT
        || job.getStatus() != CsvAsyncJob.Status.COMPLETED) {
      throw new BadRequestException(
          "CSV job " + jobId + " is not a completed export; it has no downloadable result.");
    }
    return streamResult(jobId, jobManager.getExportResult(jobId));
  }

  /**
   * Results are stored compressed in the job row so any server can serve the download. The two
   * legacy encodings stay readable so jobs that completed before the upgrade still download: a
   * pointer to a node-local spool file, and a plain inline CSV from before spooling existed.
   */
  private Response streamResult(String jobId, String result) {
    if (nullOrEmpty(result)) {
      throw new NotFoundException(
          "The result of CSV job "
              + jobId
              + " is no longer available; it may have been released to reclaim storage. "
              + "Run the export again.");
    }
    final Response response;
    if (CsvExportPayload.isCompressed(result)) {
      response =
          Response.ok(CsvExportPayload.streamOf(() -> CsvExportPayload.decompress(result)), CSV)
              .build();
    } else if (jobManager.isSpoolResultReference(result)) {
      response = streamLegacySpoolFile(jobId);
    } else {
      response = Response.ok(result, CSV).build();
    }
    return response;
  }

  private Response streamLegacySpoolFile(String jobId) {
    if (!CsvExportSpool.exists(jobId)) {
      throw new NotFoundException(
          "The result of CSV job "
              + jobId
              + " is no longer available; it was produced on another server before this release. "
              + "Run the export again.");
    }
    return Response.ok(CsvExportPayload.streamOf(() -> CsvExportSpool.openForRead(jobId)), CSV)
        .build();
  }

  @PUT
  @Path("/{jobId}/cancel")
  @Operation(operationId = "cancelCsvAsyncJob", summary = "Cancel a CSV import or export job")
  public CsvAsyncJob cancelJob(
      @Context SecurityContext securityContext, @PathParam("jobId") String jobId) {
    SubjectContext subjectContext = DefaultAuthorizer.getSubjectContext(securityContext);
    CsvAsyncJob job = jobManager.getJob(jobId);
    if (job == null) {
      throw new NotFoundException("CSV job not found: " + jobId);
    }
    validateAccess(subjectContext, job);
    return jobManager.requestCancel(jobId);
  }

  private void validateAccess(SubjectContext subjectContext, CsvAsyncJob job) {
    boolean canAccessAny = subjectContext.isAdmin() || subjectContext.isBot();
    if (!canAccessAny && !subjectContext.user().getName().equals(job.getCreatedBy())) {
      throw new ForbiddenException("CSV job belongs to another user.");
    }
  }
}
