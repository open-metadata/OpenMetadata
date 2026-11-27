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

import jakarta.ws.rs.ClientErrorException;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.core.Response;
import java.time.Clock;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.UUID;
import org.openmetadata.schema.api.data.OntologyPackInstallJob;
import org.openmetadata.schema.api.data.OntologyPackInstallJobArguments;
import org.openmetadata.schema.api.data.OntologyPackInstallJobStatus;
import org.openmetadata.schema.api.data.OntologyPackInstallPlan;
import org.openmetadata.schema.api.data.OntologyPackManifest;
import org.openmetadata.schema.jobs.BackgroundJob;
import org.openmetadata.schema.type.OntologyPackModule;
import org.openmetadata.schema.type.OntologyPackSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jobs.JobDAO;

/** Persists a library install job on the background job table and reads its progress back. */
public final class OntologyPackInstallJobManager {
  public static final String HANDLER_NAME = "OntologyPackInstallJobHandler";
  private static final String QUEUED_MESSAGE = "Library install queued.";
  private static final String RUNNING_MESSAGE = "Library install is running.";
  private static final String COMPLETED_MESSAGE = "Library install completed.";
  private static final String CANCEL_REQUESTED_MESSAGE = "Cancellation requested.";
  private static final String CANCELLED_MESSAGE = "Library install cancelled.";
  private final JobDAO jobDao;
  private final Clock clock;

  public OntologyPackInstallJobManager(final JobDAO jobDao, final Clock clock) {
    this.jobDao = jobDao;
    this.clock = clock;
  }

  public static OntologyPackInstallations.PlanLedger ledger(final JobDAO jobDao) {
    return (jobId, ontologyId) -> {
      final BackgroundJob job = jobDao.findOntologyPackInstallJobById(jobId);
      final boolean isForOntology =
          job != null
              && ontologyId
                  .toString()
                  .equals(
                      JsonUtils.convertValue(
                              job.getJobArgs(), OntologyPackInstallJobArguments.class)
                          .getOntologyId()
                          .toString());
      return isForOntology && !nullOrEmpty(job.getResult())
          ? JsonUtils.readValue(job.getResult(), OntologyPackInstallPlan.class)
          : null;
    };
  }

  public OntologyPackInstallJob start(
      final OntologyPackCatalog catalog,
      final UUID ontologyId,
      final String packId,
      final Collection<String> moduleIds,
      final String user) {
    final OntologyPackManifest manifest = catalog.require(packId);
    if (!Boolean.TRUE.equals(manifest.getBundled())) {
      throw new IllegalArgumentException("Ontology pack is not bundled: " + packId);
    }
    final List<OntologyPackModule> modules = catalog.select(manifest, moduleIds);
    final OntologyPackSource source = OntologyPackInstallations.sourcePack(manifest, modules);
    return schedule(
        new OntologyPackInstallJobArguments()
            .withOntologyId(ontologyId)
            .withPackId(source.getPackId())
            .withVersion(source.getVersion())
            .withModuleIds(new LinkedHashSet<>(source.getModuleIds()))
            .withPackDigest(OntologyPackInstallations.packDigest(source, modules)),
        user);
  }

  public OntologyPackInstallJob schedule(
      final OntologyPackInstallJobArguments arguments, final String user) {
    final JobDAO.OntologyPackInstallEnqueue enqueued =
        jobDao.enqueueOntologyPackInstall(
            arguments.getOntologyId().toString(),
            HANDLER_NAME,
            JsonUtils.pojoToJson(arguments),
            user,
            QUEUED_MESSAGE);
    if (enqueued == null) {
      throw new NotFoundException("Ontology '" + arguments.getOntologyId() + "' was not found");
    }
    return enqueued.inserted() ? get(enqueued.jobId()) : sameInstall(arguments, enqueued.jobId());
  }

  /** A repeated start whose response was lost joins the running job instead of failing. */
  private OntologyPackInstallJob sameInstall(
      final OntologyPackInstallJobArguments requested, final long activeId) {
    final OntologyPackInstallJobArguments running = arguments(requireJob(activeId));
    final boolean same =
        requested.getPackId().equals(running.getPackId())
            && requested.getPackDigest().equals(running.getPackDigest());
    if (!same) {
      throw new ClientErrorException(
          "A different library install is already running for this ontology (job " + activeId + ")",
          Response.Status.CONFLICT);
    }
    return get(activeId);
  }

  public OntologyPackInstallJob get(final long id) {
    return toJob(requireJob(id));
  }

  public OntologyPackInstallJob requestCancel(final long id) {
    requireJob(id);
    jobDao.requestCancel(id, CANCEL_REQUESTED_MESSAGE, now());
    return get(id);
  }

  public OntologyPackInstallJobArguments arguments(final BackgroundJob job) {
    return JsonUtils.convertValue(job.getJobArgs(), OntologyPackInstallJobArguments.class);
  }

  public void markRunning(final long id) {
    jobDao.updateJobStatusWithMessage(id, BackgroundJob.Status.RUNNING, RUNNING_MESSAGE, now());
  }

  public void recordPlan(final long id, final OntologyPackInstallPlan plan, final String message) {
    jobDao.updateJobResult(id, JsonUtils.pojoToJson(plan), now());
    jobDao.updateJobProgress(id, 0, plan.getSliceDigests().size(), message, now());
  }

  public void recordProgress(
      final long id, final OntologyPackInstallPlan plan, final int slicesDone) {
    jobDao.updateJobResult(id, JsonUtils.pojoToJson(plan), now());
    jobDao.updateJobProgress(
        id,
        slicesDone,
        plan.getSliceDigests().size(),
        "Applied %d of %d slices.".formatted(slicesDone, plan.getSliceDigests().size()),
        now());
  }

  public void complete(final long id, final OntologyPackInstallPlan plan) {
    final long completedAt = now();
    final int slices = plan.getSliceDigests().size();
    jobDao.completeJob(
        id,
        BackgroundJob.Status.COMPLETED.name(),
        JsonUtils.pojoToJson(plan),
        COMPLETED_MESSAGE,
        slices,
        slices,
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
      throw new OntologyPackInstallCancelledException(id);
    }
  }

  private BackgroundJob requireJob(final long id) {
    final BackgroundJob job = jobDao.findOntologyPackInstallJobById(id);
    if (job == null) {
      throw new NotFoundException("Library install job '" + id + "' was not found");
    }
    return job;
  }

  private OntologyPackInstallJob toJob(final BackgroundJob backgroundJob) {
    final OntologyPackInstallJobArguments arguments = arguments(backgroundJob);
    final OntologyPackInstallPlan plan =
        nullOrEmpty(backgroundJob.getResult())
            ? null
            : JsonUtils.readValue(backgroundJob.getResult(), OntologyPackInstallPlan.class);
    return new OntologyPackInstallJob()
        .withId(backgroundJob.getId())
        .withOntologyId(arguments.getOntologyId())
        .withPackId(arguments.getPackId())
        .withVersion(arguments.getVersion())
        .withModuleIds(new ArrayList<>(arguments.getModuleIds()))
        .withStatus(status(backgroundJob.getStatus()))
        .withProgress(valueOrZero(backgroundJob.getProgress()))
        .withTotal(valueOrZero(backgroundJob.getTotal()))
        .withMembersApplied(plan == null ? 0 : plan.getMembersApplied())
        .withMemberCount(plan == null ? 0 : plan.getMemberCount())
        .withPlanDigest(plan == null ? null : plan.getPlanDigest())
        .withError(backgroundJob.getError())
        .withMessage(backgroundJob.getMessage())
        .withCancelRequested(Boolean.TRUE.equals(backgroundJob.getCancelRequested()))
        .withCreatedBy(backgroundJob.getCreatedBy())
        .withCreatedAt(backgroundJob.getCreatedAt())
        .withUpdatedAt(backgroundJob.getUpdatedAt())
        .withCompletedAt(backgroundJob.getCompletedAt());
  }

  private static OntologyPackInstallJobStatus status(final BackgroundJob.Status status) {
    return switch (status) {
      case PENDING -> OntologyPackInstallJobStatus.QUEUED;
      case RUNNING -> OntologyPackInstallJobStatus.RUNNING;
      case COMPLETED -> OntologyPackInstallJobStatus.COMPLETED;
      case FAILED -> OntologyPackInstallJobStatus.FAILED;
      case CANCELLED -> OntologyPackInstallJobStatus.CANCELLED;
    };
  }

  private static int valueOrZero(final Integer value) {
    return value == null ? 0 : value;
  }

  private long now() {
    return clock.millis();
  }
}
