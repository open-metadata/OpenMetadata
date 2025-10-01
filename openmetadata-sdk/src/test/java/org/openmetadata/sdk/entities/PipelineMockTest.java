package org.openmetadata.sdk.entities;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.openmetadata.schema.api.data.CreatePipeline;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.services.dataassets.PipelineService;

/**
 * Mock tests for Pipeline entity operations.
 */
public class PipelineMockTest {

  @Mock private OpenMetadataClient mockClient;
  @Mock private PipelineService mockPipelineService;

  @BeforeEach
  void setUp() {
    MockitoAnnotations.openMocks(this);
    when(mockClient.pipelines()).thenReturn(mockPipelineService);
    org.openmetadata.sdk.entities.Pipeline.setDefaultClient(mockClient);
  }

  @Test
  void testCreatePipeline() {
    // Arrange
    CreatePipeline createRequest = new CreatePipeline();
    createRequest.setName("etl_pipeline");
    createRequest.setService("airflow");
    createRequest.setDisplayName("ETL Pipeline");
    createRequest.setDescription("Daily ETL pipeline for data warehouse");

    Pipeline expectedPipeline = new Pipeline();
    expectedPipeline.setId(UUID.randomUUID());
    expectedPipeline.setName("etl_pipeline");
    expectedPipeline.setFullyQualifiedName("airflow.etl_pipeline");
    expectedPipeline.setDisplayName("ETL Pipeline");

    when(mockPipelineService.create(any(CreatePipeline.class))).thenReturn(expectedPipeline);

    // Act
    Pipeline result = org.openmetadata.sdk.entities.Pipeline.create(createRequest);

    // Assert
    assertNotNull(result);
    assertEquals("etl_pipeline", result.getName());
    assertEquals("ETL Pipeline", result.getDisplayName());
    assertEquals("airflow.etl_pipeline", result.getFullyQualifiedName());
    verify(mockPipelineService).create(any(CreatePipeline.class));
  }

  @Test
  void testRetrievePipeline() {
    // Arrange
    String pipelineId = UUID.randomUUID().toString();
    Pipeline expectedPipeline = new Pipeline();
    expectedPipeline.setId(UUID.fromString(pipelineId));
    expectedPipeline.setName("data_ingestion_pipeline");
    expectedPipeline.setSourceUrl("https://airflow.example.com/dags/data_ingestion");

    when(mockPipelineService.get(pipelineId)).thenReturn(expectedPipeline);

    // Act
    Pipeline result = org.openmetadata.sdk.entities.Pipeline.retrieve(pipelineId);

    // Assert
    assertNotNull(result);
    assertEquals(pipelineId, result.getId().toString());
    assertEquals("data_ingestion_pipeline", result.getName());
    assertEquals("https://airflow.example.com/dags/data_ingestion", result.getSourceUrl());
    verify(mockPipelineService).get(pipelineId);
  }

  @Test
  void testRetrievePipelineWithTasks() {
    // Arrange
    String pipelineId = UUID.randomUUID().toString();
    String fields = "tasks,pipelineStatus,owner";
    Pipeline expectedPipeline = new Pipeline();
    expectedPipeline.setId(UUID.fromString(pipelineId));
    expectedPipeline.setName("complex_pipeline");

    // Mock tasks
    org.openmetadata.schema.type.Task task1 = new org.openmetadata.schema.type.Task();
    task1.setName("extract_data");
    task1.setDisplayName("Extract Data");
    task1.setTaskType("PythonOperator");

    org.openmetadata.schema.type.Task task2 = new org.openmetadata.schema.type.Task();
    task2.setName("transform_data");
    task2.setDisplayName("Transform Data");
    task2.setTaskType("SparkSubmitOperator");

    expectedPipeline.setTasks(List.of(task1, task2));

    when(mockPipelineService.get(pipelineId, fields)).thenReturn(expectedPipeline);

    // Act
    Pipeline result = org.openmetadata.sdk.entities.Pipeline.retrieve(pipelineId, fields);

    // Assert
    assertNotNull(result);
    assertNotNull(result.getTasks());
    assertEquals(2, result.getTasks().size());
    assertEquals("extract_data", result.getTasks().get(0).getName());
    assertEquals("transform_data", result.getTasks().get(1).getName());
    verify(mockPipelineService).get(pipelineId, fields);
  }

  @Test
  void testRetrievePipelineByName() {
    // Arrange
    String fqn = "prefect.workflows.ml_training_pipeline";
    Pipeline expectedPipeline = new Pipeline();
    expectedPipeline.setName("ml_training_pipeline");
    expectedPipeline.setFullyQualifiedName(fqn);

    when(mockPipelineService.getByName(fqn)).thenReturn(expectedPipeline);

    // Act
    Pipeline result = org.openmetadata.sdk.entities.Pipeline.retrieveByName(fqn);

    // Assert
    assertNotNull(result);
    assertEquals(fqn, result.getFullyQualifiedName());
    assertEquals("ml_training_pipeline", result.getName());
    verify(mockPipelineService).getByName(fqn);
  }

  @Test
  void testUpdatePipeline() {
    // Arrange
    Pipeline pipelineToUpdate = new Pipeline();
    pipelineToUpdate.setId(UUID.randomUUID());
    pipelineToUpdate.setName("batch_pipeline");
    pipelineToUpdate.setDescription("Updated batch processing pipeline");
    pipelineToUpdate.setConcurrency(10);

    Pipeline expectedPipeline = new Pipeline();
    expectedPipeline.setId(pipelineToUpdate.getId());
    expectedPipeline.setName(pipelineToUpdate.getName());
    expectedPipeline.setDescription(pipelineToUpdate.getDescription());
    expectedPipeline.setConcurrency(10);

    when(mockPipelineService.update(pipelineToUpdate.getId().toString(), pipelineToUpdate))
        .thenReturn(expectedPipeline);

    // Act
    Pipeline result =
        org.openmetadata.sdk.entities.Pipeline.update(
            pipelineToUpdate.getId().toString(), pipelineToUpdate);

    // Assert
    assertNotNull(result);
    assertEquals("Updated batch processing pipeline", result.getDescription());
    assertEquals(10, result.getConcurrency());
    verify(mockPipelineService).update(pipelineToUpdate.getId().toString(), pipelineToUpdate);
  }

  @Test
  void testDeletePipeline() {
    // Arrange
    String pipelineId = UUID.randomUUID().toString();
    doNothing().when(mockPipelineService).delete(eq(pipelineId), any());

    // Act
    org.openmetadata.sdk.entities.Pipeline.delete(pipelineId);

    // Assert
    verify(mockPipelineService).delete(eq(pipelineId), any());
  }

  @Test
  void testDeletePipelineWithOptions() {
    // Arrange
    String pipelineId = UUID.randomUUID().toString();
    doNothing().when(mockPipelineService).delete(eq(pipelineId), any());

    // Act
    org.openmetadata.sdk.entities.Pipeline.delete(pipelineId, true, true);

    // Assert
    verify(mockPipelineService)
        .delete(
            eq(pipelineId),
            argThat(
                params ->
                    "true".equals(params.get("recursive"))
                        && "true".equals(params.get("hardDelete"))));
  }
}
