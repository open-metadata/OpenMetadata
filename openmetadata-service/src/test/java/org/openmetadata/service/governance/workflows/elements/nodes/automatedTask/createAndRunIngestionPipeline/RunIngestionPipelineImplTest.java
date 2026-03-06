package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.createAndRunIngestionPipeline;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockConstruction;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.MockedConstruction;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineServiceClientResponse;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatusType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.IngestionPipelineDeploymentException;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;
import org.openmetadata.service.util.OpenMetadataConnectionBuilder;

@ExtendWith(MockitoExtension.class)
class RunIngestionPipelineImplTest {

  @Mock private PipelineServiceClientInterface mockPipelineServiceClient;
  @Mock private IngestionPipelineRepository mockRepository;
  @Mock private ServiceEntityInterface mockService;

  private RunIngestionPipelineImpl runIngestionPipelineImpl;
  private IngestionPipeline testPipeline;
  private MockedStatic<Entity> mockedEntity;
  private MockedConstruction<OpenMetadataConnectionBuilder> mockedConnectionBuilder;

  @BeforeEach
  void setUp() {
    RunIngestionPipelineImpl.pollingIntervalMillis = 100L;
    RunIngestionPipelineImpl.runRetryIntervalMillis = 0L;

    // Mock Entity static methods
    mockedEntity = mockStatic(Entity.class);
    mockedEntity
        .when(() -> Entity.getEntityRepository(Entity.INGESTION_PIPELINE))
        .thenReturn(mockRepository);
    mockedEntity
        .when(() -> Entity.getEntity((EntityReference) any(), anyString(), any()))
        .thenReturn(mockService);

    // Mock OpenMetadataConnectionBuilder constructor
    mockedConnectionBuilder =
        mockConstruction(
            OpenMetadataConnectionBuilder.class,
            (mock, context) -> {
              when(mock.build()).thenReturn(null); // Return null for the connection
            });

    runIngestionPipelineImpl = new RunIngestionPipelineImpl(mockPipelineServiceClient);
    testPipeline = createTestPipeline();
  }

  @AfterEach
  void tearDown() {
    RunIngestionPipelineImpl.pollingIntervalMillis = 30 * 1_000L;
    RunIngestionPipelineImpl.runRetryIntervalMillis = 15 * 1_000L;
    if (mockedEntity != null) {
      mockedEntity.close();
    }
    if (mockedConnectionBuilder != null) {
      mockedConnectionBuilder.close();
    }
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
    when(mockPipelineServiceClient.runPipeline(any(), any()))
        .thenReturn(new PipelineServiceClientResponse().withCode(200));

    // Should succeed on first attempt without retries - use short timeout for testing
    boolean result = runIngestionPipelineImpl.execute(testPipeline.getId(), false, 10);

    assertTrue(result);
    // Verify only called once (no retries)
    verify(mockPipelineServiceClient, times(1)).runPipeline(any(), any());
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
            () -> runIngestionPipelineImpl.execute(testPipeline.getId(), false, 60));

    assertTrue(
        exception.getMessage().contains("Failed to run pipeline after retries"),
        "Actual exception message: " + exception.getMessage());

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
            mockRepository, testPipeline, System.currentTimeMillis(), 10000);

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
            mockRepository, testPipeline, System.currentTimeMillis(), 10000);

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
    // Mock sequence: RUNNING -> RUNNING -> SUCCESS
    PipelineStatus runningStatus = createPipelineStatus(PipelineStatusType.RUNNING);
    PipelineStatus successStatus = createPipelineStatus(PipelineStatusType.SUCCESS);

    when(mockRepository.listPipelineStatus(anyString(), anyLong(), anyLong()))
        .thenReturn(createStatusResult(runningStatus))
        .thenReturn(createStatusResult(runningStatus))
        .thenReturn(createStatusResult(successStatus));

    long startTime = System.currentTimeMillis();
    boolean result =
        runIngestionPipelineImpl.waitForCompletion(mockRepository, testPipeline, startTime, 5000);

    assertTrue(result);
    verify(mockRepository, times(3)).listPipelineStatus(anyString(), anyLong(), anyLong());
  }

  @Test
  void testWaitForCompletionEmptyStatusList() {
    // Mock empty status list initially, then success
    PipelineStatus successStatus = createPipelineStatus(PipelineStatusType.SUCCESS);
    ResultList<PipelineStatus> emptyList = new ResultList<>();
    emptyList.setData(List.of()); // Explicitly set empty list

    when(mockRepository.listPipelineStatus(anyString(), anyLong(), anyLong()))
        .thenReturn(emptyList) // Empty list triggers RUNNING state
        .thenReturn(createStatusResult(successStatus)); // Then success

    long startTime = System.currentTimeMillis();
    boolean result =
        runIngestionPipelineImpl.waitForCompletion(mockRepository, testPipeline, startTime, 5000);

    assertTrue(result);
    verify(mockRepository, times(2)).listPipelineStatus(anyString(), anyLong(), anyLong());
  }
}
