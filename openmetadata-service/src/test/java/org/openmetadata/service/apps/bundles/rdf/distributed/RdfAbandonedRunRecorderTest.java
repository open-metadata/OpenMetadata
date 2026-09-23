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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.apps.bundles.rdf.distributed.RdfAbandonedRunRecorder.COORDINATOR_GRACE_MS;
import static org.openmetadata.service.apps.bundles.rdf.distributed.RdfAbandonedRunRecorder.finished;
import static org.openmetadata.service.apps.bundles.rdf.distributed.RdfAbandonedRunRecorder.isFinishedWithRunLink;
import static org.openmetadata.service.apps.bundles.rdf.distributed.RdfAbandonedRunRecorder.isLeftUnfinished;

import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.app.FailureContext;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.service.apps.AppRunInterruption;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.IndexJobStatus;

/**
 * The shape the devrel failure had: the coordinating server stopped mid-run, a restarting server
 * marked the run failed, and the other servers finished all 5,695 tables afterwards.
 */
class RdfAbandonedRunRecorderTest {
  private static final long RUN_STARTED = 1_000L;
  private static final long JOB_COMPLETED = 9_000L;
  private static final long RESTARTED_AFTER_COMPLETION = 20_000L;
  private static final int TABLES = 5_695;

  @Test
  void runMarkedInterruptedAfterItsJobFinishedStillGetsTheOutcome() {
    assertTrue(
        isLeftUnfinished(
            interruptedRun(RESTARTED_AFTER_COMPLETION),
            job(IndexJobStatus.COMPLETED),
            RESTARTED_AFTER_COMPLETION));
  }

  @Test
  void runStillUnfinishedLongAfterItsJobEndedHasNoCoordinatorLeft() {
    assertTrue(
        isLeftUnfinished(
            unfinishedRun(),
            job(IndexJobStatus.COMPLETED),
            JOB_COMPLETED + COORDINATOR_GRACE_MS + 1));
  }

  @Test
  void runJustAfterItsJobEndedIsLeftToItsCoordinator() {
    assertFalse(
        isLeftUnfinished(unfinishedRun(), job(IndexJobStatus.COMPLETED), JOB_COMPLETED + 60_000L));
  }

  @Test
  void runItsCoordinatorRecordedIsLeftAlone() {
    final AppRunRecord recorded =
        unfinishedRun().withStatus(AppRunRecord.Status.SUCCESS).withEndTime(JOB_COMPLETED + 5);

    assertFalse(
        isLeftUnfinished(
            recorded, job(IndexJobStatus.COMPLETED), JOB_COMPLETED + COORDINATOR_GRACE_MS + 1));
  }

  @Test
  void runThisRecorderWroteIsNotWrittenAgain() {
    final RdfIndexJob job = job(IndexJobStatus.COMPLETED_WITH_ERRORS);
    final AppRunRecord written = finished(interruptedRun(RESTARTED_AFTER_COMPLETION), job);

    assertFalse(isLeftUnfinished(written, job, JOB_COMPLETED + COORDINATOR_GRACE_MS + 1));
  }

  @Test
  void onlyFinishedJobsLinkedToARunAreRecorded() {
    final RdfIndexJob unlinked = job(IndexJobStatus.COMPLETED);
    unlinked.getJobConfiguration().setTimestamp(null);

    assertTrue(isFinishedWithRunLink(job(IndexJobStatus.COMPLETED)));
    assertFalse(isFinishedWithRunLink(job(IndexJobStatus.RUNNING)));
    assertFalse(isFinishedWithRunLink(unlinked));
  }

  @Test
  void completedRunIsRecordedAsSuccessWithTheFinalStatsAndNoFailure() {
    final AppRunRecord run =
        finished(interruptedRun(RESTARTED_AFTER_COMPLETION), job(IndexJobStatus.COMPLETED));

    assertEquals(AppRunRecord.Status.SUCCESS, run.getStatus());
    assertEquals(JOB_COMPLETED, run.getEndTime());
    assertEquals(JOB_COMPLETED - RUN_STARTED, run.getExecutionTime());
    assertNull(run.getFailureContext());
    assertEquals(TABLES, run.getSuccessContext().getStats().getJobStats().getSuccessRecords());
    assertEquals(
        TABLES,
        run.getSuccessContext()
            .getStats()
            .getEntityStats()
            .getAdditionalProperties()
            .get("table")
            .getSuccessRecords());
  }

  @Test
  void completedBlueGreenRunFailsBecauseNothingPromotedIt() {
    final RdfIndexJob job = job(IndexJobStatus.COMPLETED);
    job.getJobConfiguration().setRdfBuildDataset("openmetadata_b");

    final AppRunRecord run = finished(interruptedRun(RESTARTED_AFTER_COMPLETION), job);

    assertEquals(AppRunRecord.Status.FAILED, run.getStatus());
    assertTrue(failure(run).contains("'openmetadata_b'"), failure(run));
    assertTrue(failure(run).contains("before promoting it"), failure(run));
    assertFalse(AppRunInterruption.isInterrupted(run));
  }

  @Test
  void runWithErrorsFailsWithTheJobErrorAndSaysWhyItsCoordinatorDidNotReportIt() {
    final RdfIndexJob job = job(IndexJobStatus.COMPLETED_WITH_ERRORS);
    job.setErrorMessage("3 record(s) failed across 1 partition(s)");

    final String failure = failure(finished(interruptedRun(RESTARTED_AFTER_COMPLETION), job));

    assertTrue(failure.contains("coordinating this run stopped before it finished"), failure);
    assertTrue(failure.endsWith("with errors: 3 record(s) failed across 1 partition(s)"), failure);
  }

  @Test
  void runWithErrorsButNoJobMessageStillSaysSo() {
    final String failure =
        failure(finished(interruptedRun(RESTARTED_AFTER_COMPLETION), job(IndexJobStatus.FAILED)));

    assertTrue(failure.endsWith("remaining partitions with errors."), failure);
  }

  @Test
  void stoppedRunIsRecordedAsStoppedWithoutTheInterruptionFailure() {
    final AppRunRecord run =
        finished(interruptedRun(RESTARTED_AFTER_COMPLETION), job(IndexJobStatus.STOPPED));

    assertEquals(AppRunRecord.Status.STOPPED, run.getStatus());
    assertEquals(JOB_COMPLETED, run.getEndTime());
    assertNull(run.getFailureContext());
    assertEquals(TABLES, run.getSuccessContext().getStats().getJobStats().getSuccessRecords());
  }

  private static RdfIndexJob job(final IndexJobStatus status) {
    return RdfIndexJob.builder()
        .id(UUID.randomUUID())
        .status(status)
        .jobConfiguration(new EventPublisherJob().withTimestamp(RUN_STARTED))
        .totalRecords(TABLES)
        .processedRecords(TABLES)
        .successRecords(TABLES)
        .entityStats(
            Map.of(
                "table",
                RdfIndexJob.EntityTypeStats.builder()
                    .entityType("table")
                    .totalRecords(TABLES)
                    .processedRecords(TABLES)
                    .successRecords(TABLES)
                    .build()))
        .completedAt(JOB_COMPLETED)
        .build();
  }

  private static AppRunRecord unfinishedRun() {
    return new AppRunRecord()
        .withAppId(UUID.randomUUID())
        .withAppName("RdfIndexApp")
        .withTimestamp(RUN_STARTED)
        .withStartTime(RUN_STARTED)
        .withStatus(AppRunRecord.Status.RUNNING);
  }

  /** How the startup cleanup leaves a run whose coordinating server stopped. */
  private static AppRunRecord interruptedRun(final long serverStarted) {
    return unfinishedRun()
        .withStatus(AppRunRecord.Status.FAILED)
        .withEndTime(serverStarted)
        .withFailureContext(
            new FailureContext()
                .withFailure(new IndexingError().withMessage("Still running when server started"))
                .withAdditionalProperty(AppRunInterruption.INTERRUPTED, true));
  }

  private static String failure(final AppRunRecord run) {
    return run.getFailureContext().getFailure().getMessage();
  }
}
