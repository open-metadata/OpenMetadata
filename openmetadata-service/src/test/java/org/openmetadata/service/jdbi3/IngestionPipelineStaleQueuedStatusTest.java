package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatusType;

class IngestionPipelineStaleQueuedStatusTest {

  private static final long CUTOFF = 1_000L;

  private static PipelineStatus status(String runId, PipelineStatusType state, Long timestamp) {
    return new PipelineStatus().withRunId(runId).withPipelineState(state).withTimestamp(timestamp);
  }

  private static List<String> runIdsOf(List<PipelineStatus> statuses) {
    return statuses.stream().map(PipelineStatus::getRunId).toList();
  }

  @Test
  void queuedRunsOlderThanTheCutoffAreHidden() {
    List<PipelineStatus> kept =
        IngestionPipelineRepository.withoutStaleQueuedStatuses(
            List.of(status("never-started", PipelineStatusType.QUEUED, 999L)), CUTOFF);

    assertTrue(kept.isEmpty());
  }

  @Test
  void queuedRunsWithinTheCutoffAreKept() {
    List<PipelineStatus> kept =
        IngestionPipelineRepository.withoutStaleQueuedStatuses(
            List.of(status("just-triggered", PipelineStatusType.QUEUED, 1_000L)), CUTOFF);

    assertEquals(List.of("just-triggered"), runIdsOf(kept));
  }

  @Test
  void terminalRunsAreKeptHoweverOldTheyAre() {
    List<PipelineStatus> statuses =
        List.of(
            status("old-success", PipelineStatusType.SUCCESS, 1L),
            status("old-failure", PipelineStatusType.FAILED, 2L),
            status("old-running", PipelineStatusType.RUNNING, 3L),
            status("stale-queued", PipelineStatusType.QUEUED, 4L));

    List<PipelineStatus> kept =
        IngestionPipelineRepository.withoutStaleQueuedStatuses(statuses, CUTOFF);

    assertEquals(List.of("old-success", "old-failure", "old-running"), runIdsOf(kept));
  }

  @Test
  void queuedRunsWithoutATimestampAreKept() {
    List<PipelineStatus> kept =
        IngestionPipelineRepository.withoutStaleQueuedStatuses(
            List.of(status("no-timestamp", PipelineStatusType.QUEUED, null)), CUTOFF);

    assertEquals(List.of("no-timestamp"), runIdsOf(kept));
  }
}
