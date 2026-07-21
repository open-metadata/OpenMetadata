/*
 *  Copyright 2026 Collate
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

package org.openmetadata.service.ontology;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.NotFoundException;
import java.time.Clock;
import org.openmetadata.schema.api.data.OntologyBulkJob;
import org.openmetadata.schema.api.data.OntologyBulkJobArguments;
import org.openmetadata.schema.api.data.OntologyBulkJobList;
import org.openmetadata.schema.api.data.OntologyBulkJobStatus;
import org.openmetadata.schema.api.data.OntologyBulkRequest;
import org.openmetadata.schema.api.data.OntologyBulkResultArtifact;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.jobs.BackgroundJob;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jobs.JobDAO;

public final class OntologyBulkJobManager implements OntologyBulkExecutionService.JobScheduler {
  public static final String HANDLER_NAME = "OntologyBulkJobHandler";
  private static final String QUEUED_MESSAGE = "Ontology bulk operation queued.";
  private static final String RUNNING_MESSAGE = "Ontology bulk operation is running.";
  private static final String COMPLETED_MESSAGE = "Ontology bulk operation completed.";
  private static final String CANCEL_REQUESTED_MESSAGE = "Cancellation requested.";
  private static final String CANCELLED_MESSAGE = "Ontology bulk operation cancelled.";
  private final JobDAO jobDao;
  private final Clock clock;

  public OntologyBulkJobManager(final JobDAO jobDao, final Clock clock) {
    this.jobDao = jobDao;
    this.clock = clock;
  }

  @Override
  public OntologyBulkJob schedule(
      final Glossary glossary,
      final OntologyBulkRequest request,
      final int totalRows,
      final String user) {
    final OntologyBulkJobArguments arguments =
        new OntologyBulkJobArguments()
            .withRequest(request)
            .withGlossary(glossary.getEntityReference());
    final long id = insert(arguments, totalRows, user);
    return get(id);
  }

  public OntologyBulkJob get(final long id) {
    return toJob(requireBackgroundJob(id));
  }

  public OntologyBulkJobList list(final String user, final int limit) {
    return new OntologyBulkJobList()
        .withJobs(
            jobDao.listOntologyBulkJobsByUser(user, limit).stream().map(this::toJob).toList());
  }

  public OntologyBulkJob requestCancel(final long id) {
    requireBackgroundJob(id);
    jobDao.requestCancel(id, CANCEL_REQUESTED_MESSAGE, now());
    return get(id);
  }

  public OntologyBulkResultArtifact artifact(final long id) {
    final BackgroundJob job = requireBackgroundJob(id);
    requireCompletedArtifact(job);
    return JsonUtils.readValue(job.getResult(), OntologyBulkResultArtifact.class);
  }

  public void markRunning(final long id) {
    jobDao.updateJobStatusWithMessage(id, BackgroundJob.Status.RUNNING, RUNNING_MESSAGE, now());
  }

  public void complete(final long id, final OntologyBulkResultArtifact artifact, final int total) {
    final long completedAt = now();
    jobDao.completeJob(
        id,
        BackgroundJob.Status.COMPLETED.name(),
        JsonUtils.pojoToJson(artifact),
        COMPLETED_MESSAGE,
        total,
        total,
        completedAt,
        completedAt);
  }

  public void fail(final long id, final String error) {
    final long completedAt = now();
    jobDao.failJob(id, BackgroundJob.Status.FAILED.name(), error, error, completedAt, completedAt);
  }

  public void cancel(final long id) {
    final long completedAt = now();
    jobDao.failJob(
        id,
        BackgroundJob.Status.CANCELLED.name(),
        null,
        CANCELLED_MESSAGE,
        completedAt,
        completedAt);
  }

  public void checkpoint(final long id) {
    if (Boolean.TRUE.equals(jobDao.isCancelRequested(id))) {
      throw new OntologyBulkJobCancelledException(id);
    }
  }

  public int markStaleJobsFailed() {
    return jobDao.markStaleRunningOntologyBulkJobsFailed(now());
  }

  OntologyBulkJobArguments arguments(final BackgroundJob job) {
    return JsonUtils.convertValue(job.getJobArgs(), OntologyBulkJobArguments.class);
  }

  private long insert(
      final OntologyBulkJobArguments arguments, final int totalRows, final String user) {
    return jobDao.insertTrackedJobInternal(
        BackgroundJob.JobType.ONTOLOGY_BULK.name(),
        HANDLER_NAME,
        JsonUtils.pojoToJson(arguments),
        user,
        null,
        0,
        totalRows,
        QUEUED_MESSAGE);
  }

  private BackgroundJob requireBackgroundJob(final long id) {
    final BackgroundJob job = jobDao.findOntologyBulkJobById(id);
    if (job == null) {
      throw new NotFoundException("Ontology bulk job '" + id + "' was not found");
    }
    return job;
  }

  private OntologyBulkJob toJob(final BackgroundJob backgroundJob) {
    final OntologyBulkJobArguments arguments = arguments(backgroundJob);
    return new OntologyBulkJob()
        .withId(backgroundJob.getId())
        .withOperation(arguments.getRequest().getOperation())
        .withStatus(status(backgroundJob.getStatus()))
        .withGlossary(arguments.getGlossary())
        .withDryRun(arguments.getRequest().getDryRun())
        .withProgress(valueOrZero(backgroundJob.getProgress()))
        .withTotal(valueOrZero(backgroundJob.getTotal()))
        .withResult(result(backgroundJob.getResult()))
        .withError(backgroundJob.getError())
        .withMessage(backgroundJob.getMessage())
        .withCancelRequested(Boolean.TRUE.equals(backgroundJob.getCancelRequested()))
        .withCreatedBy(backgroundJob.getCreatedBy())
        .withCreatedAt(backgroundJob.getCreatedAt())
        .withUpdatedAt(backgroundJob.getUpdatedAt())
        .withCompletedAt(backgroundJob.getCompletedAt());
  }

  private static OntologyBulkJobStatus status(final BackgroundJob.Status status) {
    return switch (status) {
      case PENDING -> OntologyBulkJobStatus.QUEUED;
      case RUNNING -> OntologyBulkJobStatus.RUNNING;
      case COMPLETED -> OntologyBulkJobStatus.COMPLETED;
      case FAILED -> OntologyBulkJobStatus.FAILED;
      case CANCELLED -> OntologyBulkJobStatus.CANCELLED;
    };
  }

  private static OntologyBulkResultArtifact result(final String result) {
    return nullOrEmpty(result)
        ? null
        : JsonUtils.readValue(result, OntologyBulkResultArtifact.class);
  }

  private static int valueOrZero(final Integer value) {
    return value == null ? 0 : value;
  }

  private static void requireCompletedArtifact(final BackgroundJob job) {
    final boolean isUnavailable =
        job.getStatus() != BackgroundJob.Status.COMPLETED || nullOrEmpty(job.getResult());
    if (isUnavailable) {
      throw new BadRequestException(
          "Ontology bulk job '" + job.getId() + "' has no completed result artifact");
    }
  }

  private long now() {
    return clock.millis();
  }
}
