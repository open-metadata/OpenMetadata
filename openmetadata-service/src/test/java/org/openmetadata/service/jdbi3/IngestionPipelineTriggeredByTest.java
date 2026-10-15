package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;

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
  void workerStatusUpdateKeepsThePrincipalRecordedWhenTheRunWasQueued() {
    PipelineStatus running = status(PipelineStatusType.RUNNING, null);

    IngestionPipelineRepository.keepRecordedTriggeredBy(
        running, status(PipelineStatusType.QUEUED, "alice"));

    assertEquals("alice", running.getTriggeredBy());
  }

  @Test
  void aRecordedPrincipalCannotBeOverwritten() {
    PipelineStatus running = status(PipelineStatusType.RUNNING, "mallory");

    IngestionPipelineRepository.keepRecordedTriggeredBy(
        running, status(PipelineStatusType.QUEUED, "alice"));

    assertEquals("alice", running.getTriggeredBy());
  }

  @Test
  void queuedStatusRecordsItsPrincipalEvenIfTheWorkerReportedFirst() {
    PipelineStatus queued = status(PipelineStatusType.QUEUED, "alice");

    IngestionPipelineRepository.keepRecordedTriggeredBy(
        queued, status(PipelineStatusType.RUNNING, null));

    assertEquals("alice", queued.getTriggeredBy());
  }
}
