package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.createAndRunIngestionPipeline;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatusType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.service.exception.IngestionPipelineDeploymentException;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;

@ExtendWith(MockitoExtension.class)
class RunIngestionPipelineImplTest {

  @Mock private PipelineServiceClientInterface mockPipelineServiceClient;
  @Mock private IngestionPipelineRepository mockRepository;

  private RunIngestionPipelineImpl runIngestionPipelineImpl;
  private IngestionPipeline testPipeline;

  @BeforeEach
  void setUp() {
    runIngestionPipelineImpl = new RunIngestionPipelineImpl(mockPipelineServiceClient);
    testPipeline = createTestPipeline();
  }

  private IngestionPipeline createTestPipeline() {
    IngestionPipeline pipeline = new IngestionPipeline();
    pipeline.setId(UUID.randomUUID());
    pipeline.setDisplayName("Test Pipeline");
    pipeline.setFullyQualifiedName("test.pipeline");

    EntityReference service = new EntityReference();
    service.setName("test-service");
    pipeline.setService(service);

    return pipeline;
  }

  private PipelineStatus createPipelineStatus(PipelineStatusType state) {
    PipelineStatus status = new PipelineStatus();
    status.setPipelineState(state);
    status.setTimestamp(System.currentTimeMillis());
    return status;
  }

  private ResultList<PipelineStatus> createStatusResult(PipelineStatus... statuses) {
    ResultList<PipelineStatus> result = new ResultList<>();
    result.setData(List.of(statuses));
    return result;
  }

  @Test
  void testExecuteSuccessFirstAttempt() throws Exception {
    // Mock repository and entity setup
    when(mockRepository.get(any(), any(UUID.class), any())).thenReturn(testPipeline);
    when(mockRepository.getOpenMetadataApplicationConfig()).thenReturn(null);

    // Should succeed on first attempt without retries
    boolean result = runIngestionPipelineImpl.execute(testPipeline.getId(), false, 3600);

    assertTrue(result);
    // Verify only called once (no retries)
    verify(mockPipelineServiceClient, times(1)).runPipeline(any(), any());
  }

  @Test
  void testExecuteRetriesOnFailure() throws Exception {
    // Mock repository and entity setup
    when(mockRepository.get(any(), any(UUID.class), any())).thenReturn(testPipeline);
    when(mockRepository.getOpenMetadataApplicationConfig()).thenReturn(null);

    // Mock 2 failures, then success
    doThrow(new IngestionPipelineDeploymentException("First failure"))
        .doThrow(new IngestionPipelineDeploymentException("Second failure"))
        .doNothing()
        .when(mockPipelineServiceClient)
        .runPipeline(any(), any());

    long startTime = System.currentTimeMillis();
    boolean result = runIngestionPipelineImpl.execute(testPipeline.getId(), false, 3600);
    long duration = System.currentTimeMillis() - startTime;

    assertTrue(result);
    // Verify 3 attempts total
    verify(mockPipelineServiceClient, times(3)).runPipeline(any(), any());

    // Verify exponential backoff timing: 15s + 30s = ~45s
    // Allow some tolerance for test execution time
    assertTrue(duration >= 45000, "Expected at least 45 seconds for exponential backoff");
    assertTrue(duration < 50000, "Expected less than 50 seconds (allowing for execution overhead)");
  }

  @Test
  void testExecuteFailsAfterMaxRetries() {
    // Mock repository and entity setup
    when(mockRepository.get(any(), any(UUID.class), any())).thenReturn(testPipeline);
    when(mockRepository.getOpenMetadataApplicationConfig()).thenReturn(null);

    // Mock 3 consecutive failures
    doThrow(new IngestionPipelineDeploymentException("Persistent failure"))
        .when(mockPipelineServiceClient)
        .runPipeline(any(), any());

    RuntimeException exception =
        assertThrows(
            RuntimeException.class,
            () -> runIngestionPipelineImpl.execute(testPipeline.getId(), false, 3600));

    // Verify correct exception message
    assertTrue(exception.getMessage().contains("Failed to run pipeline after 3 attempts"));

    // Verify 3 attempts were made
    verify(mockPipelineServiceClient, times(3)).runPipeline(any(), any());
  }

  @Test
  void testWaitForCompletionSuccess() {
    // Mock successful pipeline status
    PipelineStatus successStatus = createPipelineStatus(PipelineStatusType.SUCCESS);
    when(mockRepository.listPipelineStatus(anyString(), anyLong(), anyLong()))
        .thenReturn(createStatusResult(successStatus));

    boolean result =
        runIngestionPipelineImpl.waitForCompletion(
            mockRepository, testPipeline, System.currentTimeMillis(), 60000);

    assertTrue(result);
    verify(mockRepository, times(1)).listPipelineStatus(anyString(), anyLong(), anyLong());
  }

  @Test
  void testWaitForCompletionFailure() {
    // Mock failed pipeline status
    PipelineStatus failedStatus = createPipelineStatus(PipelineStatusType.FAILED);
    when(mockRepository.listPipelineStatus(anyString(), anyLong(), anyLong()))
        .thenReturn(createStatusResult(failedStatus));

    boolean result =
        runIngestionPipelineImpl.waitForCompletion(
            mockRepository, testPipeline, System.currentTimeMillis(), 60000);

    assertFalse(result);
    verify(mockRepository, times(1)).listPipelineStatus(anyString(), anyLong(), anyLong());
  }

  @Test
  void testWaitForCompletionTimeout() {
    long startTime = System.currentTimeMillis();
    // Short timeout to make test fast
    long timeoutMillis = 100;

    // Mock always running status (will cause timeout)
    PipelineStatus runningStatus = createPipelineStatus(PipelineStatusType.RUNNING);
    when(mockRepository.listPipelineStatus(anyString(), anyLong(), anyLong()))
        .thenReturn(createStatusResult(runningStatus));

    boolean result =
        runIngestionPipelineImpl.waitForCompletion(
            mockRepository, testPipeline, startTime, timeoutMillis);

    assertFalse(result);
  }

  @Test
  void testWaitForCompletionPollingForRunningState() {
    // This test will take ~60 seconds due to 30-second polling
    // Mock sequence: RUNNING -> RUNNING -> SUCCESS
    PipelineStatus runningStatus = createPipelineStatus(PipelineStatusType.RUNNING);
    PipelineStatus successStatus = createPipelineStatus(PipelineStatusType.SUCCESS);

    when(mockRepository.listPipelineStatus(anyString(), anyLong(), anyLong()))
        .thenReturn(createStatusResult(runningStatus))
        .thenReturn(createStatusResult(runningStatus))
        .thenReturn(createStatusResult(successStatus));

    long startTime = System.currentTimeMillis();
    boolean result =
        runIngestionPipelineImpl.waitForCompletion(
            mockRepository, testPipeline, startTime, 300000); // 5 minute timeout
    long duration = System.currentTimeMillis() - startTime;

    assertTrue(result);
    // Should have taken ~60 seconds (2 * 30s polling intervals)
    assertTrue(duration >= 60000, "Expected at least 60 seconds for 2 polling intervals");
    verify(mockRepository, times(3)).listPipelineStatus(anyString(), anyLong(), anyLong());
  }

  @Test
  void testWaitForCompletionEmptyStatusList() {
    // Mock empty status list initially, then success
    PipelineStatus successStatus = createPipelineStatus(PipelineStatusType.SUCCESS);

    when(mockRepository.listPipelineStatus(anyString(), anyLong(), anyLong()))
        .thenReturn(new ResultList<>()) // Empty list
        .thenReturn(createStatusResult(successStatus));

    long startTime = System.currentTimeMillis();
    boolean result =
        runIngestionPipelineImpl.waitForCompletion(mockRepository, testPipeline, startTime, 60000);

    assertTrue(result);
    verify(mockRepository, times(2)).listPipelineStatus(anyString(), anyLong(), anyLong());
  }
}
