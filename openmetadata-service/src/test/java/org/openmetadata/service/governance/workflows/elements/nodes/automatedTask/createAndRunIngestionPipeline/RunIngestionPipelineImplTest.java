package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.createAndRunIngestionPipeline;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mockConstruction;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.MockedConstruction;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
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
    when(mockRepository.get(any(), any(UUID.class), any())).thenReturn(testPipeline);
    when(mockRepository.getOpenMetadataApplicationConfig()).thenReturn(null);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedConstruction<OpenMetadataConnectionBuilder> ignored =
            mockConstruction(
                OpenMetadataConnectionBuilder.class,
                (mock, ctx) -> when(mock.build()).thenReturn(null))) {
      entityMock
          .when(() -> Entity.getEntityRepository(Entity.INGESTION_PIPELINE))
          .thenReturn(mockRepository);
      entityMock
          .when(() -> Entity.getEntity(any(EntityReference.class), anyString(), any()))
          .thenReturn(null);

      boolean result = runIngestionPipelineImpl.execute(testPipeline.getId(), false, 3600);

      assertTrue(result);
      verify(mockPipelineServiceClient, times(1)).runPipeline(any(), any());
    }
  }

  @Test
  void testExecuteRetriesOnFailure() throws Exception {
    when(mockRepository.get(any(), any(UUID.class), any())).thenReturn(testPipeline);
    when(mockRepository.getOpenMetadataApplicationConfig()).thenReturn(null);

    doThrow(new IngestionPipelineDeploymentException("First failure"))
        .doThrow(new IngestionPipelineDeploymentException("Second failure"))
        .doReturn(null)
        .when(mockPipelineServiceClient)
        .runPipeline(any(), any());

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedConstruction<OpenMetadataConnectionBuilder> ignored =
            mockConstruction(
                OpenMetadataConnectionBuilder.class,
                (mock, ctx) -> when(mock.build()).thenReturn(null))) {
      entityMock
          .when(() -> Entity.getEntityRepository(Entity.INGESTION_PIPELINE))
          .thenReturn(mockRepository);
      entityMock
          .when(() -> Entity.getEntity(any(EntityReference.class), anyString(), any()))
          .thenReturn(null);

      long startTime = System.currentTimeMillis();
      boolean result = runIngestionPipelineImpl.execute(testPipeline.getId(), false, 3600);
      long duration = System.currentTimeMillis() - startTime;

      assertTrue(result);
      verify(mockPipelineServiceClient, times(3)).runPipeline(any(), any());

      assertTrue(duration >= 30000, "Expected at least 30 seconds for 2 retry waits");
      assertTrue(
          duration < 35000, "Expected less than 35 seconds (allowing for execution overhead)");
    }
  }

  @Test
  void testExecuteFailsAfterMaxRetries() {
    when(mockRepository.get(any(), any(UUID.class), any())).thenReturn(testPipeline);
    when(mockRepository.getOpenMetadataApplicationConfig()).thenReturn(null);

    doThrow(new IngestionPipelineDeploymentException("Persistent failure"))
        .when(mockPipelineServiceClient)
        .runPipeline(any(), any());

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class);
        MockedConstruction<OpenMetadataConnectionBuilder> ignored =
            mockConstruction(
                OpenMetadataConnectionBuilder.class,
                (mock, ctx) -> when(mock.build()).thenReturn(null))) {
      entityMock
          .when(() -> Entity.getEntityRepository(Entity.INGESTION_PIPELINE))
          .thenReturn(mockRepository);
      entityMock
          .when(() -> Entity.getEntity(any(EntityReference.class), anyString(), any()))
          .thenReturn(null);

      RuntimeException exception =
          assertThrows(
              RuntimeException.class,
              () -> runIngestionPipelineImpl.execute(testPipeline.getId(), false, 3600));

      assertTrue(exception.getMessage().contains("Failed to run pipeline after retries"));
      verify(mockPipelineServiceClient, times(3)).runPipeline(any(), any());
    }
  }

  @Test
  void testWaitForCompletionSuccess() {
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
    long timeoutMillis = 100;

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
    PipelineStatus runningStatus = createPipelineStatus(PipelineStatusType.RUNNING);
    PipelineStatus successStatus = createPipelineStatus(PipelineStatusType.SUCCESS);

    when(mockRepository.listPipelineStatus(anyString(), anyLong(), anyLong()))
        .thenReturn(createStatusResult(runningStatus))
        .thenReturn(createStatusResult(runningStatus))
        .thenReturn(createStatusResult(successStatus));

    long startTime = System.currentTimeMillis();
    boolean result =
        runIngestionPipelineImpl.waitForCompletion(mockRepository, testPipeline, startTime, 300000);
    long duration = System.currentTimeMillis() - startTime;

    assertTrue(result);
    assertTrue(duration >= 60000, "Expected at least 60 seconds for 2 polling intervals");
    verify(mockRepository, times(3)).listPipelineStatus(anyString(), anyLong(), anyLong());
  }

  @Test
  void testWaitForCompletionEmptyStatusList() {
    PipelineStatus successStatus = createPipelineStatus(PipelineStatusType.SUCCESS);

    when(mockRepository.listPipelineStatus(anyString(), anyLong(), anyLong()))
        .thenReturn(createStatusResult())
        .thenReturn(createStatusResult(successStatus));

    long startTime = System.currentTimeMillis();
    boolean result =
        runIngestionPipelineImpl.waitForCompletion(mockRepository, testPipeline, startTime, 60000);

    assertTrue(result);
    verify(mockRepository, times(2)).listPipelineStatus(anyString(), anyLong(), anyLong());
  }
}
