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
import static org.openmetadata.service.apps.bundles.rdf.distributed.RdfAbandonedRunRecorder.isAbandoned;
import static org.openmetadata.service.apps.bundles.rdf.distributed.RdfAbandonedRunRecorder.outcome;

import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.app.FailureContext;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.IndexJobStatus;
import org.openmetadata.service.jdbi3.RdfInfraDAOs.RdfReindexLockDAO.RdfReindexLockRecord;

/**
 * The shape the devrel failure had: the coordinating server stopped mid-run, a restarting server
 * marked the run failed, and the other servers finished all 5,695 tables afterwards.
 */
class RdfAbandonedRunRecorderTest {
  private static final String LOCK_KEY = "RDF_REINDEX_LOCK";
  private static final long RUN_STARTED = 1_000L;
  private static final long SERVER_RESTARTED = 4_000L;
  private static final long JOB_COMPLETED = 9_000L;
  private static final int TABLES = 5_695;
  private static final UUID JOB_ID = UUID.randomUUID();

  @Test
  void jobFinishedAfterItsCoordinatorStoppedIsAbandoned() {
    assertTrue(isAbandoned(job(IndexJobStatus.COMPLETED), expiredLock(JOB_ID)));
  }

  @Test
  void coordinatorStillRenewingTheLockIsNotAbandoned() {
    assertFalse(isAbandoned(job(IndexJobStatus.COMPLETED), liveLock()));
  }

  @Test
  void lockReleasedOrHeldForAnotherJobIsNotAbandoned() {
    assertFalse(isAbandoned(job(IndexJobStatus.COMPLETED), null));
    assertFalse(isAbandoned(job(IndexJobStatus.COMPLETED), expiredLock(UUID.randomUUID())));
  }

  @Test
  void unfinishedJobIsNotAbandonedYet() {
    assertFalse(isAbandoned(job(IndexJobStatus.RUNNING), expiredLock(JOB_ID)));
  }

  @Test
  void jobStartedBeforeRunsWereLinkedIsLeftAlone() {
    final RdfIndexJob job = job(IndexJobStatus.COMPLETED);
    job.getJobConfiguration().setTimestamp(null);

    assertFalse(isAbandoned(job, expiredLock(JOB_ID)));
  }

  @Test
  void completedRunIsRecordedAsSuccessWithTheFinalStats() {
    final AppRunRecord run = outcome(job(IndexJobStatus.COMPLETED), interruptedRun()).orElseThrow();

    assertEquals(AppRunRecord.Status.SUCCESS, run.getStatus());
    assertEquals(JOB_COMPLETED, run.getEndTime());
    assertEquals(JOB_COMPLETED - RUN_STARTED, run.getExecutionTime());
    assertNull(run.getFailureContext());
    assertEquals(TABLES, stats(run).getJobStats().getSuccessRecords());
    assertEquals(
        TABLES,
        stats(run).getEntityStats().getAdditionalProperties().get("table").getSuccessRecords());
  }

  @Test
  void completedBlueGreenRunFailsBecauseNothingPromotedIt() {
    final RdfIndexJob job = job(IndexJobStatus.COMPLETED);
    job.getJobConfiguration().setRdfBuildDataset("openmetadata_b");

    final AppRunRecord run = outcome(job, interruptedRun()).orElseThrow();

    assertEquals(AppRunRecord.Status.FAILED, run.getStatus());
    assertTrue(failure(run).contains("'openmetadata_b'"), failure(run));
    assertTrue(failure(run).contains("before promoting it"), failure(run));
  }

  @Test
  void runWithErrorsFailsWithTheJobErrorAndSaysWhyItsCoordinatorDidNotReportIt() {
    final RdfIndexJob job = job(IndexJobStatus.COMPLETED_WITH_ERRORS);
    job.setErrorMessage("3 record(s) failed across 1 partition(s)");

    final String failure = failure(outcome(job, interruptedRun()).orElseThrow());

    assertTrue(failure.contains("coordinating this run stopped before it finished"), failure);
    assertTrue(failure.endsWith("with errors: 3 record(s) failed across 1 partition(s)"), failure);
  }

  @Test
  void runWithErrorsButNoJobMessageStillSaysSo() {
    final String failure =
        failure(outcome(job(IndexJobStatus.FAILED), interruptedRun()).orElseThrow());

    assertTrue(failure.endsWith("remaining partitions with errors."), failure);
  }

  @Test
  void stoppedJobIsRecordedAsStopped() {
    final AppRunRecord run = outcome(job(IndexJobStatus.STOPPED), interruptedRun()).orElseThrow();

    assertEquals(AppRunRecord.Status.STOPPED, run.getStatus());
    assertEquals(JOB_COMPLETED, run.getEndTime());
  }

  @Test
  void runRecordedAfterTheJobFinishedIsLeftAlone() {
    final AppRunRecord alreadyRecorded = interruptedRun().withEndTime(JOB_COMPLETED);

    assertTrue(outcome(job(IndexJobStatus.COMPLETED), alreadyRecorded).isEmpty());
  }

  private static RdfIndexJob job(final IndexJobStatus status) {
    return RdfIndexJob.builder()
        .id(JOB_ID)
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

  /** How the startup cleanup leaves a run whose coordinating server stopped. */
  private static AppRunRecord interruptedRun() {
    return new AppRunRecord()
        .withAppId(UUID.randomUUID())
        .withAppName("RdfIndexApp")
        .withTimestamp(RUN_STARTED)
        .withStartTime(RUN_STARTED)
        .withEndTime(SERVER_RESTARTED)
        .withStatus(AppRunRecord.Status.FAILED)
        .withFailureContext(
            new FailureContext()
                .withFailure(new IndexingError().withMessage("Still running when server started")));
  }

  private static RdfReindexLockRecord expiredLock(final UUID jobId) {
    return new RdfReindexLockRecord(
        LOCK_KEY, jobId.toString(), "stopped-server", RUN_STARTED, RUN_STARTED, RUN_STARTED + 1);
  }

  private static RdfReindexLockRecord liveLock() {
    final long later = System.currentTimeMillis() + 60_000L;
    return new RdfReindexLockRecord(
        LOCK_KEY, JOB_ID.toString(), "running-server", RUN_STARTED, RUN_STARTED, later);
  }

  private static Stats stats(final AppRunRecord run) {
    return run.getSuccessContext().getStats();
  }

  private static String failure(final AppRunRecord run) {
    return run.getFailureContext().getFailure().getMessage();
  }
}
