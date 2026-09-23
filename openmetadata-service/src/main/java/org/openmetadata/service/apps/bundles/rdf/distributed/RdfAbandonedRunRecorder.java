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
package org.openmetadata.service.apps.bundles.rdf.distributed;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.app.AppExtension;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.app.FailureContext;
import org.openmetadata.schema.entity.app.SuccessContext;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.RdfInfraDAOs.RdfReindexLockDAO.RdfReindexLockRecord;

/**
 * Records how a distributed RDF run ended when the server coordinating it stopped first. Other
 * servers finish its partitions and the job still reaches a terminal state, but only the
 * coordinator writes the run record, so the run would otherwise keep whatever status it had when
 * that server stopped. A stopped coordinator is recognised by the reindex lock it never released;
 * one that finished releases the lock and records the run itself.
 */
@Slf4j
public final class RdfAbandonedRunRecorder {
  private static final String STATUS_EXTENSION = AppExtension.ExtensionType.STATUS.toString();
  private static final String FINISHED_WITH_ERRORS =
      "The server coordinating this run stopped before it finished, and other servers completed"
          + " its remaining partitions with errors";
  private static final String NOT_PROMOTED =
      "The server coordinating this blue/green rebuild stopped before promoting it, so dataset"
          + " '%s' holds the rebuilt graph but queries still use the previous dataset. Run the app"
          + " again to rebuild.";
  private static final RdfDistributedJobStatsAggregator STATS_AGGREGATOR =
      new RdfDistributedJobStatsAggregator();

  private final CollectionDAO.AppExtensionTimeSeries runs;
  private final String appName;

  /** Records runs of {@code appName}, whose jobs this recorder is given. */
  public RdfAbandonedRunRecorder(
      final CollectionDAO.AppExtensionTimeSeries runs, final String appName) {
    this.runs = runs;
    this.appName = appName;
  }

  /** Writes {@code job}'s outcome into its run record if {@code lock} shows its coordinator gone. */
  public void recordIfAbandoned(final RdfIndexJob job, final RdfReindexLockRecord lock) {
    if (isAbandoned(job, lock)) {
      findRun(job.getJobConfiguration().getTimestamp())
          .flatMap(run -> outcome(job, run))
          .ifPresent(this::save);
    }
  }

  static boolean isAbandoned(final RdfIndexJob job, final RdfReindexLockRecord lock) {
    return isFinishedWithRunLink(job) && isHeldByStoppedCoordinator(job, lock);
  }

  /**
   * The run record as the finished job leaves it, or empty when the record was already written
   * after the job finished.
   */
  static Optional<AppRunRecord> outcome(final RdfIndexJob job, final AppRunRecord run) {
    return isWrittenAfterFinishing(run, job) ? Optional.empty() : Optional.of(finished(run, job));
  }

  private static boolean isWrittenAfterFinishing(final AppRunRecord run, final RdfIndexJob job) {
    return run.getEndTime() != null && run.getEndTime() >= job.getCompletedAt();
  }

  private static AppRunRecord finished(final AppRunRecord run, final RdfIndexJob job) {
    final long completedAt = job.getCompletedAt();
    run.withEndTime(completedAt)
        .withExecutionTime(run.getStartTime() == null ? null : completedAt - run.getStartTime())
        .withSuccessContext(new SuccessContext().withStats(STATS_AGGREGATOR.toStats(job)));
    return withFinalStatus(run, job);
  }

  private static boolean isFinishedWithRunLink(final RdfIndexJob job) {
    final EventPublisherJob configuration = job.getJobConfiguration();
    return job.isTerminal()
        && job.getCompletedAt() != null
        && configuration != null
        && configuration.getTimestamp() != null;
  }

  private static boolean isHeldByStoppedCoordinator(
      final RdfIndexJob job, final RdfReindexLockRecord lock) {
    return lock != null && lock.isExpired() && job.getId().toString().equals(lock.jobId());
  }

  private static AppRunRecord withFinalStatus(final AppRunRecord run, final RdfIndexJob job) {
    return switch (job.getStatus()) {
      case COMPLETED -> completed(run, job.getJobConfiguration().getRdfBuildDataset());
      case STOPPED -> run.withStatus(AppRunRecord.Status.STOPPED);
      default -> failed(run, failureMessage(job));
    };
  }

  private static AppRunRecord completed(final AppRunRecord run, final String buildDataset) {
    return buildDataset == null
        ? run.withStatus(AppRunRecord.Status.SUCCESS).withFailureContext(null)
        : failed(run, NOT_PROMOTED.formatted(buildDataset));
  }

  private static AppRunRecord failed(final AppRunRecord run, final String message) {
    return run.withStatus(AppRunRecord.Status.FAILED)
        .withFailureContext(
            new FailureContext()
                .withFailure(
                    new IndexingError()
                        .withErrorSource(IndexingError.ErrorSource.JOB)
                        .withMessage(message)));
  }

  private static String failureMessage(final RdfIndexJob job) {
    return nullOrEmpty(job.getErrorMessage())
        ? FINISHED_WITH_ERRORS + "."
        : FINISHED_WITH_ERRORS + ": " + job.getErrorMessage();
  }

  private Optional<AppRunRecord> findRun(final long timestamp) {
    return runs
        .listAppExtensionInWindowByName(appName, 1, 0, timestamp, timestamp + 1, STATUS_EXTENSION)
        .stream()
        .findFirst()
        .map(json -> JsonUtils.readValue(json, AppRunRecord.class));
  }

  private void save(final AppRunRecord run) {
    runs.update(
        run.getAppId().toString(), JsonUtils.pojoToJson(run), run.getTimestamp(), STATUS_EXTENSION);
    LOG.info(
        "Recorded RDF run {} as {} after the server coordinating it stopped",
        run.getTimestamp(),
        run.getStatus());
  }
}
