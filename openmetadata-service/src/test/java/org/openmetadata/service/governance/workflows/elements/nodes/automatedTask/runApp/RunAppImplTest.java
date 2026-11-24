package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.runApp;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.atMost;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.app.App;
import org.openmetadata.schema.entity.app.AppRunRecord;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatusType;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.jdbi3.AppRepository;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;

/**
 * Waiting for a run reads its status from the database. The repositories are the database boundary
 * here, so the tests count those reads: a wait that never pauses issues thousands within the
 * timeout instead of one per poll interval.
 */
class RunAppImplTest {
  private static final long POLL_MILLIS = 50;
  private static final long TIMEOUT_MILLIS = 400;
  private static final int MAX_READS = (int) (TIMEOUT_MILLIS / POLL_MILLIS) + 2;

  private final RunAppImpl runApp = new RunAppImpl(POLL_MILLIS);
  private final App app = new App().withName("DataInsightsApplication");

  @Test
  void appRunNotRecordedPollsOncePerIntervalUntilTimeout() {
    AppRepository repository = mock(AppRepository.class);
    when(repository.getLatestAppRunsAfterStartTime(any(), anyLong())).thenReturn(null);

    boolean succeeded =
        runApp.waitForCompletion(repository, app, System.currentTimeMillis(), TIMEOUT_MILLIS);

    assertFalse(succeeded);
    verify(repository, atMost(MAX_READS)).getLatestAppRunsAfterStartTime(any(), anyLong());
  }

  @Test
  void appRunReadFailureIsRetriedAtTheNextPoll() {
    AppRepository repository = mock(AppRepository.class);
    when(repository.getLatestAppRunsAfterStartTime(any(), anyLong()))
        .thenThrow(new IllegalStateException("not recorded yet"))
        .thenReturn(appRun(AppRunRecord.Status.SUCCESS));

    assertTrue(
        runApp.waitForCompletion(repository, app, System.currentTimeMillis(), TIMEOUT_MILLIS));
  }

  @Test
  void failedAppRunIsNotASuccess() {
    AppRepository repository = mock(AppRepository.class);
    when(repository.getLatestAppRunsAfterStartTime(any(), anyLong()))
        .thenReturn(appRun(AppRunRecord.Status.FAILED));

    assertFalse(
        runApp.waitForCompletion(repository, app, System.currentTimeMillis(), TIMEOUT_MILLIS));
  }

  @Test
  void interruptedWaitStopsAndKeepsTheInterrupt() {
    AppRepository repository = mock(AppRepository.class);
    when(repository.getLatestAppRunsAfterStartTime(any(), anyLong())).thenReturn(null);
    Thread.currentThread().interrupt();
    try {
      assertFalse(runApp.waitForCompletion(repository, app, System.currentTimeMillis(), 60_000));
      assertTrue(Thread.currentThread().isInterrupted());
    } finally {
      Thread.interrupted();
    }
  }

  @Test
  void pipelineWithoutStatusPollsOncePerIntervalUntilTimeout() {
    IngestionPipelineRepository repository = mock(IngestionPipelineRepository.class);
    when(repository.listPipelineStatus(anyString(), anyLong(), anyLong()))
        .thenReturn(new ResultList<>(List.of()));

    boolean succeeded =
        runApp.waitForCompletion(
            repository, pipeline(), System.currentTimeMillis(), TIMEOUT_MILLIS);

    assertFalse(succeeded);
    verify(repository, atMost(MAX_READS)).listPipelineStatus(anyString(), anyLong(), anyLong());
  }

  @Test
  void pipelineRunningThenPartialSuccessIsASuccess() {
    IngestionPipelineRepository repository = mock(IngestionPipelineRepository.class);
    when(repository.listPipelineStatus(anyString(), anyLong(), anyLong()))
        .thenReturn(pipelineStatus(PipelineStatusType.RUNNING))
        .thenReturn(pipelineStatus(PipelineStatusType.PARTIAL_SUCCESS));

    assertTrue(
        runApp.waitForCompletion(
            repository, pipeline(), System.currentTimeMillis(), TIMEOUT_MILLIS));
  }

  private static AppRunRecord appRun(AppRunRecord.Status status) {
    return new AppRunRecord().withStatus(status).withExecutionTime(1L);
  }

  private static IngestionPipeline pipeline() {
    return new IngestionPipeline().withFullyQualifiedName("service.pipeline");
  }

  private static ResultList<PipelineStatus> pipelineStatus(PipelineStatusType state) {
    return new ResultList<>(List.of(new PipelineStatus().withPipelineState(state)));
  }
}
