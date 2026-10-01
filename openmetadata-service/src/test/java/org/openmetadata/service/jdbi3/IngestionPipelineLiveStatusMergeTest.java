package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatusType;

class IngestionPipelineLiveStatusMergeTest {

  private static PipelineStatus status(String runId, PipelineStatusType state) {
    return new PipelineStatus().withRunId(runId).withPipelineState(state);
  }

  private static List<String> describe(List<PipelineStatus> statuses) {
    return statuses.stream().map(s -> s.getRunId() + ":" + s.getPipelineState().value()).toList();
  }

  @Test
  void liveQueuedEntryYieldsToTheStoredRowForTheSameRun() {
    List<PipelineStatus> merged =
        IngestionPipelineRepository.mergeLiveStatuses(
            List.of(status("run-1", PipelineStatusType.QUEUED)),
            List.of(status("run-1", PipelineStatusType.RUNNING)));

    assertEquals(List.of("run-1:running"), describe(merged));
  }

  @Test
  void liveTerminalEntryReplacesTheStoredRowForTheSameRun() {
    List<PipelineStatus> merged =
        IngestionPipelineRepository.mergeLiveStatuses(
            List.of(status("run-1", PipelineStatusType.FAILED)),
            List.of(status("run-1", PipelineStatusType.RUNNING)));

    assertEquals(List.of("run-1:failed"), describe(merged));
  }

  @Test
  void storedTerminalRowIsKeptOverALiveTerminalEntry() {
    // The worker's own row carries step summaries the runner's bookkeeping entry lacks.
    List<PipelineStatus> merged =
        IngestionPipelineRepository.mergeLiveStatuses(
            List.of(status("run-1", PipelineStatusType.SUCCESS)),
            List.of(status("run-1", PipelineStatusType.PARTIAL_SUCCESS)));

    assertEquals(List.of("run-1:partialSuccess"), describe(merged));
  }

  @Test
  void runsOnlyOneSideKnowsAboutAreAllKept() {
    List<PipelineStatus> merged =
        IngestionPipelineRepository.mergeLiveStatuses(
            List.of(status("queued-run", PipelineStatusType.QUEUED)),
            List.of(
                status("old-run", PipelineStatusType.SUCCESS),
                status(null, PipelineStatusType.RUNNING)));

    assertEquals(List.of("queued-run:queued", "old-run:success", "null:running"), describe(merged));
  }

  @Test
  void liveEntriesWithoutARunIdAreKept() {
    List<PipelineStatus> merged =
        IngestionPipelineRepository.mergeLiveStatuses(
            List.of(status(null, PipelineStatusType.QUEUED)),
            List.of(status("run-1", PipelineStatusType.RUNNING)));

    assertEquals(List.of("null:queued", "run-1:running"), describe(merged));
  }
}
