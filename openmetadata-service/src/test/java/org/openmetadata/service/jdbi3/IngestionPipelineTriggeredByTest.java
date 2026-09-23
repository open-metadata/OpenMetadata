package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatusType;

class IngestionPipelineTriggeredByTest {

  private static PipelineStatus status(PipelineStatusType state, String triggeredBy) {
    return new PipelineStatus()
        .withRunId("run-1")
        .withPipelineState(state)
        .withTriggeredBy(triggeredBy);
  }

  @Test
  void workerReportedStatusKeepsTheTriggeringPrincipalOfTheQueuedRun() {
    PipelineStatus running = status(PipelineStatusType.RUNNING, null);

    IngestionPipelineRepository.carryForwardTriggeredBy(
        running, status(PipelineStatusType.QUEUED, "alice"));

    assertEquals("alice", running.getTriggeredBy());
  }

  @Test
  void anExplicitPrincipalOnTheIncomingStatusWins() {
    PipelineStatus running = status(PipelineStatusType.RUNNING, "bob");

    IngestionPipelineRepository.carryForwardTriggeredBy(
        running, status(PipelineStatusType.QUEUED, "alice"));

    assertEquals("bob", running.getTriggeredBy());
  }

  @Test
  void firstStatusOfARunHasNothingToCarryForward() {
    PipelineStatus queued = status(PipelineStatusType.QUEUED, null);

    IngestionPipelineRepository.carryForwardTriggeredBy(queued, null);

    assertNull(queued.getTriggeredBy());
  }
}
