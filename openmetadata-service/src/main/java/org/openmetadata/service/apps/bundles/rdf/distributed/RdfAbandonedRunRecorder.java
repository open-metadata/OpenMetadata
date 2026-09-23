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

import java.util.EnumSet;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import java.util.function.LongSupplier;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.app.AppExtension;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.app.FailureContext;
import org.openmetadata.schema.entity.app.SuccessContext;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.apps.AppRunInterruption;
import org.openmetadata.service.jdbi3.CollectionDAO;

/**
 * Records how a distributed RDF run ended when the server coordinating it stopped before writing
 * the run record. Other servers finish its partitions and the job still reaches a terminal state,
 * but only the coordinator records the run, so the run would otherwise keep whatever status it had
 * when that server stopped. The run record itself shows this: a restarting server marks it
 * interrupted, and a coordinator that stopped without a restart leaves it unfinished.
 */
@Slf4j
public final class RdfAbandonedRunRecorder {
  /**
   * Longer than anything a live coordinator still does after its job finishes (promotion, and
   * compaction's 10-minute wait), so a run still unfinished after it has no coordinator left.
   */
  static final long COORDINATOR_GRACE_MS = TimeUnit.HOURS.toMillis(1);

  private static final String STATUS_EXTENSION = AppExtension.ExtensionType.STATUS.toString();
  private static final Set<AppRunRecord.Status> FINISHED =
      EnumSet.of(
          AppRunRecord.Status.SUCCESS,
          AppRunRecord.Status.COMPLETED,
          AppRunRecord.Status.FAILED,
          AppRunRecord.Status.STOPPED);
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
  private final LongSupplier clock;

  /** Records runs of {@code appName}, whose jobs this recorder is given. */
  public RdfAbandonedRunRecorder(
      final CollectionDAO.AppExtensionTimeSeries runs, final String appName) {
    this(runs, appName, System::currentTimeMillis);
  }

  RdfAbandonedRunRecorder(
      final CollectionDAO.AppExtensionTimeSeries runs,
      final String appName,
      final LongSupplier clock) {
    this.runs = runs;
    this.appName = appName;
    this.clock = clock;
  }

  /** Writes finished {@code job}'s outcome into its run record if its coordinator never did. */
  public void recordIfAbandoned(final RdfIndexJob job) {
    if (isFinishedWithRunLink(job)) {
      findRun(job.getJobConfiguration().getTimestamp())
          .filter(run -> isLeftUnfinished(run, job, clock.getAsLong()))
          .map(run -> finished(run, job))
          .ifPresent(this::save);
    }
  }

  static boolean isFinishedWithRunLink(final RdfIndexJob job) {
    final EventPublisherJob configuration = job.getJobConfiguration();
    return job.isTerminal()
        && job.getCompletedAt() != null
        && configuration != null
        && configuration.getTimestamp() != null;
  }

  /**
   * Whether the run never got its outcome: marked interrupted, or still unfinished well after its
   * job ended. A run its coordinator recorded, or one this recorder wrote, is neither.
   */
  static boolean isLeftUnfinished(final AppRunRecord run, final RdfIndexJob job, final long now) {
    return AppRunInterruption.isInterrupted(run)
        || (!FINISHED.contains(run.getStatus())
            && now - job.getCompletedAt() > COORDINATOR_GRACE_MS);
  }

  /** The run record as its finished job leaves it; any interruption failure is dropped. */
  static AppRunRecord finished(final AppRunRecord run, final RdfIndexJob job) {
    final long completedAt = job.getCompletedAt();
    run.withEndTime(completedAt)
        .withExecutionTime(run.getStartTime() == null ? null : completedAt - run.getStartTime())
        .withSuccessContext(new SuccessContext().withStats(STATS_AGGREGATOR.toStats(job)))
        .withFailureContext(null);
    return withFinalStatus(run, job);
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
        ? run.withStatus(AppRunRecord.Status.SUCCESS)
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
