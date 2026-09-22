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
package org.openmetadata.service.logstorage.stream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatusType;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;
import org.openmetadata.service.logstorage.stream.IngestionLogStreamManager.LogStreamRequest;
import org.openmetadata.service.logstorage.stream.IngestionLogTailer.RunState;

/**
 * When a live stream is allowed to close.
 *
 * <p>Getting this wrong is expensive in both directions: closing on a run that is still going
 * truncates the log a user is watching, and never closing leaves a connection polling a backend for
 * as long as the tab stays open.
 */
class IngestionLogStreamFactoryTest {

  private static final String RUN_ID = "11111111-1111-1111-1111-111111111111";

  @ParameterizedTest
  @EnumSource(
      value = PipelineStatusType.class,
      names = {"SUCCESS", "FAILED", "PARTIAL_SUCCESS", "STOPPED"})
  void aRunInATerminalStateIsFinished(PipelineStatusType state) {
    assertEquals(
        RunState.FINISHED,
        IngestionLogStreamFactory.stateOf(List.of(status(RUN_ID, state)), RUN_ID));
  }

  @ParameterizedTest
  @EnumSource(
      value = PipelineStatusType.class,
      names = {"RUNNING", "QUEUED"})
  void aRunStillGoingIsNotFinished(PipelineStatusType state) {
    assertEquals(
        RunState.RUNNING,
        IngestionLogStreamFactory.stateOf(List.of(status(RUN_ID, state)), RUN_ID));
  }

  @Test
  void aRunWithNoRecordedStatusIsUnknownRatherThanFinished() {
    assertEquals(RunState.UNKNOWN, IngestionLogStreamFactory.stateOf(List.of(), RUN_ID));
    assertEquals(RunState.UNKNOWN, IngestionLogStreamFactory.stateOf(null, RUN_ID));
  }

  @Test
  void aRunThatAgedOutOfTheRecentWindowIsUnknown() {
    List<PipelineStatus> otherRuns =
        List.of(
            status("22222222-2222-2222-2222-222222222222", PipelineStatusType.RUNNING),
            status("33333333-3333-3333-3333-333333333333", PipelineStatusType.SUCCESS));

    assertEquals(RunState.UNKNOWN, IngestionLogStreamFactory.stateOf(otherRuns, RUN_ID));
  }

  @Test
  void aStreamThatNamedNoRunFollowsTheLatestStatus() {
    List<PipelineStatus> newestFirst =
        List.of(
            status("22222222-2222-2222-2222-222222222222", PipelineStatusType.RUNNING),
            status(RUN_ID, PipelineStatusType.SUCCESS));

    assertEquals(
        RunState.RUNNING,
        IngestionLogStreamFactory.stateOf(newestFirst, null),
        "an unnamed run must track the newest status, not an older finished one");
  }

  @Test
  void theRunUnderStreamIsNotConfusedWithANewerRunOfTheSamePipeline() {
    List<PipelineStatus> newestFirst =
        List.of(
            status("22222222-2222-2222-2222-222222222222", PipelineStatusType.RUNNING),
            status(RUN_ID, PipelineStatusType.SUCCESS));

    assertEquals(
        RunState.FINISHED,
        IngestionLogStreamFactory.stateOf(newestFirst, RUN_ID),
        "a finished run must close even while a newer run of the same pipeline is going");
  }

  /**
   * Object storage keys a run by its UUID, but the {@code runId} on the stream endpoint is free
   * text. Asking storage for a run it cannot key used to fail the whole request instead of falling
   * through to the pipeline service, which is the backend that actually holds such a run's log.
   */
  @Test
  void aRunNotNamedByUuidIsTailedFromThePipelineServiceRatherThanFailing() {
    IngestionPipelineRepository repository = mock(IngestionPipelineRepository.class);
    when(repository.isS3LogStorageEnabled()).thenReturn(true);
    PipelineServiceClientInterface client = mock(PipelineServiceClientInterface.class);
    IngestionLogStreamFactory factory = new IngestionLogStreamFactory(repository, client);
    IngestionPipeline pipeline =
        new IngestionPipeline()
            .withFullyQualifiedName("svc.pipeline")
            .withEnableStreamableLogs(true);

    LogStreamRequest request = factory.request(pipeline, "scheduled__2026-08-10T00:00:00", null);

    assertInstanceOf(PipelineServiceLogTailSource.class, request.run().source());
  }

  private static PipelineStatus status(String runId, PipelineStatusType state) {
    return new PipelineStatus().withRunId(runId).withPipelineState(state);
  }
}
