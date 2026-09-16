package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatusType;

class IngestionPipelineRunInProgressTest {

  private static final long QUEUED_CUTOFF = 1_000L;
  private static final long RUNNING_CUTOFF = 2_000L;

  private static boolean inProgress(PipelineStatusType state, Long timestamp) {
    PipelineStatus status =
        new PipelineStatus().withRunId("run").withPipelineState(state).withTimestamp(timestamp);
    return IngestionPipelineRepository.hasRunInProgress(
        List.of(status), QUEUED_CUTOFF, RUNNING_CUTOFF);
  }

  @Test
  void aQueuedRunWithinItsTimeoutIsInProgress() {
    assertTrue(inProgress(PipelineStatusType.QUEUED, QUEUED_CUTOFF));
  }

  @Test
  void aQueuedRunPastItsTimeoutNeverStartedAndIsNotInProgress() {
    assertFalse(inProgress(PipelineStatusType.QUEUED, QUEUED_CUTOFF - 1));
  }

  @Test
  void aRunningRunWithinItsTimeoutIsInProgress() {
    assertTrue(inProgress(PipelineStatusType.RUNNING, RUNNING_CUTOFF));
  }

  @Test
  void aRunningRunPastItsTimeoutLostItsWorkerAndIsNotInProgress() {
    assertFalse(inProgress(PipelineStatusType.RUNNING, RUNNING_CUTOFF - 1));
  }

  @Test
  void theRunningCutoffIsIndependentOfTheQueuedOne() {
    assertFalse(inProgress(PipelineStatusType.RUNNING, QUEUED_CUTOFF));
  }

  @Test
  void finishedRunsAreNotInProgressHoweverRecent() {
    for (PipelineStatusType state :
        List.of(
            PipelineStatusType.SUCCESS,
            PipelineStatusType.FAILED,
            PipelineStatusType.PARTIAL_SUCCESS,
            PipelineStatusType.STOPPED)) {
      assertFalse(inProgress(state, Long.MAX_VALUE), state.value());
    }
  }

  @Test
  void aRunWithoutATimestampCannotBeAgedOutSoItIsNotInProgress() {
    assertFalse(inProgress(PipelineStatusType.RUNNING, null));
  }

  @Test
  void anyActiveRunAmongRecentOnesCounts() {
    List<PipelineStatus> statuses =
        List.of(
            new PipelineStatus()
                .withPipelineState(PipelineStatusType.SUCCESS)
                .withTimestamp(5_000L),
            new PipelineStatus()
                .withPipelineState(PipelineStatusType.RUNNING)
                .withTimestamp(3_000L));

    assertTrue(
        IngestionPipelineRepository.hasRunInProgress(statuses, QUEUED_CUTOFF, RUNNING_CUTOFF));
  }
}
