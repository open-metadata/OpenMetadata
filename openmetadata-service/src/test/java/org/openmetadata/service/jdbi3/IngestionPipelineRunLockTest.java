package org.openmetadata.service.jdbi3;

import static org.awaitility.Awaitility.await;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.ClientErrorException;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.FutureTask;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineServiceClientResponse;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatusType;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.sdk.RunOptions;

/**
 * A run's queued status is recorded only after the orchestrator accepts the trigger, so without
 * serializing the check and the trigger, two requests arriving together would both find the
 * pipeline idle and both start a run.
 */
class IngestionPipelineRunLockTest {

  private static final Duration WAIT = Duration.ofSeconds(10);

  @Test
  void concurrentRunsOfOnePipelineTriggerItOnceAndRejectTheOther() throws Exception {
    IngestionPipeline pipeline =
        new IngestionPipeline()
            .withId(UUID.randomUUID())
            .withName("orders_suite_pipeline")
            .withFullyQualifiedName("orders_suite.orders_suite_pipeline");
    CountDownLatch firstTriggerStarted = new CountDownLatch(1);
    CountDownLatch releaseTrigger = new CountDownLatch(1);
    PipelineServiceClientInterface pipelineServiceClient =
        mock(PipelineServiceClientInterface.class);
    when(pipelineServiceClient.runPipelineWithOptions(any(), any(), any(RunOptions.class)))
        .thenAnswer(
            invocation -> {
              firstTriggerStarted.countDown();
              releaseTrigger.await(WAIT.toSeconds(), TimeUnit.SECONDS);
              return new PipelineServiceClientResponse()
                  .withCode(200)
                  .withRunId(UUID.randomUUID().toString());
            });
    IngestionPipelineRepository repository = repositoryRecordingQueuedRuns(pipelineServiceClient);

    StartedRun first = startRun(repository, pipeline);
    assertTrue(firstTriggerStarted.await(WAIT.toSeconds(), TimeUnit.SECONDS));
    StartedRun second = startRun(repository, pipeline);
    // The second request is parked on the run lock - or, without one, inside its own trigger.
    await().atMost(WAIT).until(second::isParked);
    releaseTrigger.countDown();

    assertEquals(200, first.result().get(WAIT.toSeconds(), TimeUnit.SECONDS).getCode());
    ExecutionException rejection =
        assertThrows(
            ExecutionException.class,
            () -> second.result().get(WAIT.toSeconds(), TimeUnit.SECONDS));
    ClientErrorException conflict =
        assertInstanceOf(ClientErrorException.class, rejection.getCause());
    assertEquals(409, conflict.getResponse().getStatus());
    verify(pipelineServiceClient, times(1))
        .runPipelineWithOptions(any(), any(), any(RunOptions.class));
  }

  private static IngestionPipelineRepository repositoryRecordingQueuedRuns(
      PipelineServiceClientInterface pipelineServiceClient) {
    IngestionPipelineRepository repository =
        mock(IngestionPipelineRepository.class, Mockito.CALLS_REAL_METHODS);
    repository.setPipelineServiceClient(pipelineServiceClient);
    List<PipelineStatus> statuses = new CopyOnWriteArrayList<>();
    doAnswer(invocation -> List.copyOf(statuses)).when(repository).getRecentPipelineStatuses(any());
    doAnswer(
            invocation ->
                statuses.add(
                    new PipelineStatus()
                        .withRunId(invocation.getArgument(2))
                        .withPipelineState(PipelineStatusType.QUEUED)
                        .withTimestamp(System.currentTimeMillis())))
        .when(repository)
        .recordQueuedPipelineStatus(any(), any(), any());
    return repository;
  }

  private record StartedRun(FutureTask<PipelineServiceClientResponse> result, Thread thread) {
    boolean isParked() {
      Thread.State state = thread.getState();
      return state == Thread.State.WAITING || state == Thread.State.TIMED_WAITING;
    }
  }

  private static StartedRun startRun(
      IngestionPipelineRepository repository, IngestionPipeline pipeline) {
    FutureTask<PipelineServiceClientResponse> result =
        new FutureTask<>(
            () ->
                repository.runIngestionPipelineUnlessInProgress(
                    null, pipeline, mock(ServiceEntityInterface.class), RunOptions.NONE));
    Thread thread = new Thread(result);
    thread.start();
    return new StartedRun(result, thread);
  }
}
