/*
 *  Copyright 2025 Collate
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

package org.openmetadata.service.logstorage;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.io.IOException;
import java.io.InputStream;
import java.util.*;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.MockedStatic;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.exception.UnhandledServerException;

@ExtendWith(MockitoExtension.class)
public class LogStorageTest {

  @Mock private PipelineServiceClientInterface mockPipelineServiceClient;

  private DefaultLogStorage defaultLogStorage;
  private MockedStatic<Entity> entityMock;
  private final String testPipelineFQN = "service.database.pipeline";
  private final UUID testRunId = UUID.randomUUID();

  @BeforeEach
  void setUp() throws IOException {
    defaultLogStorage = new DefaultLogStorage();
    Map<String, Object> config = new HashMap<>();
    config.put("pipelineServiceClient", mockPipelineServiceClient);
    defaultLogStorage.initialize(config);
    // The storage loads the real pipeline so the runner can locate its run by service.
    entityMock = mockStatic(Entity.class);
    entityMock
        .when(
            () ->
                Entity.getEntityByName(
                    eq(Entity.INGESTION_PIPELINE),
                    eq(testPipelineFQN),
                    anyString(),
                    any(Include.class)))
        .thenReturn(new IngestionPipeline().withFullyQualifiedName(testPipelineFQN));
  }

  @AfterEach
  void tearDown() {
    entityMock.close();
  }

  @Test
  void getLogsPassesThePipelineServiceToTheRunner() {
    // Regression: a name-only pipeline made Argo's label selector NPE, and the catch in getLogs
    // turned that into "no logs", so every Argo log fetch silently returned empty.
    IngestionPipeline withService =
        new IngestionPipeline()
            .withFullyQualifiedName(testPipelineFQN)
            .withService(
                new EntityReference().withName("service").withType(Entity.DATABASE_SERVICE));
    entityMock
        .when(
            () ->
                Entity.getEntityByName(
                    eq(Entity.INGESTION_PIPELINE),
                    eq(testPipelineFQN),
                    anyString(),
                    any(Include.class)))
        .thenReturn(withService);
    when(mockPipelineServiceClient.getLastIngestionLogs(any(IngestionPipeline.class), isNull()))
        .thenReturn(Map.of("ingestion_task", "content", "total", "1"));

    defaultLogStorage.getLogs(testPipelineFQN, testRunId, null, 10);

    ArgumentCaptor<IngestionPipeline> sent = ArgumentCaptor.forClass(IngestionPipeline.class);
    verify(mockPipelineServiceClient).getLastIngestionLogs(sent.capture(), isNull());
    assertNotNull(sent.getValue().getService(), "runner cannot locate the run without the service");
    assertEquals("service", sent.getValue().getService().getName());
  }

  @Test
  void getLogsSurfacesAnUnknownPipelineInsteadOfReportingNoLogs() {
    // A wrong FQN is the caller's error. Swallowing it into empty logs sends the user hunting a
    // runner outage that is not there.
    entityMock
        .when(
            () ->
                Entity.getEntityByName(
                    eq(Entity.INGESTION_PIPELINE),
                    eq(testPipelineFQN),
                    anyString(),
                    any(Include.class)))
        .thenThrow(new EntityNotFoundException("pipeline not found"));

    assertThrows(
        EntityNotFoundException.class,
        () -> defaultLogStorage.getLogs(testPipelineFQN, testRunId, null, 10));
  }

  @Test
  void getLogsReadsContentKeyedByTaskName() {
    // Runners key content by task name (TYPE_TO_TASK); only "total" and "after" are fixed, so a
    // literal "logs" key came back empty for every real response.
    when(mockPipelineServiceClient.getLastIngestionLogs(any(IngestionPipeline.class), isNull()))
        .thenReturn(Map.of("lineage_task", "InvalidPrivateKeyException: bad PEM", "total", "1"));

    Map<String, Object> result = defaultLogStorage.getLogs(testPipelineFQN, testRunId, null, 10);

    assertEquals("InvalidPrivateKeyException: bad PEM", result.get("logs"));
    assertEquals("1", result.get("total"));
  }

  @Test
  void getLogsPreservesPipelineServiceErrorsOutsideLogContent() {
    when(mockPipelineServiceClient.getLastIngestionLogs(any(IngestionPipeline.class), isNull()))
        .thenReturn(
            Map.of(
                PipelineServiceClientInterface.LOGS_ERROR_KEY,
                "Kubernetes pod status could not be parsed"));

    Map<String, Object> result = defaultLogStorage.getLogs(testPipelineFQN, testRunId, null, 10);

    assertEquals(
        "Kubernetes pod status could not be parsed",
        result.get(PipelineServiceClientInterface.LOGS_ERROR_KEY));
    assertFalse(result.containsKey("logs"));
  }

  @Test
  void getLogsSurfacesAPipelineServiceFailure() {
    // An unreachable pipeline service used to be reported as a run with no logs, which reads as
    // "this run produced nothing" rather than "we could not reach the runner".
    when(mockPipelineServiceClient.getLastIngestionLogs(any(IngestionPipeline.class), isNull()))
        .thenThrow(new RuntimeException("pipeline service unreachable"));

    assertThrows(
        UnhandledServerException.class,
        () -> defaultLogStorage.getLogs(testPipelineFQN, testRunId, null, 10));
  }

  @Test
  void getLogsIsDeterministicWhenTheRunnerSendsMoreThanOneTask() {
    // A response carries one task today, so map order never mattered. Order by key anyway: picking
    // an arbitrary entry would make the log text change between identical calls.
    when(mockPipelineServiceClient.getLastIngestionLogs(any(IngestionPipeline.class), isNull()))
        .thenReturn(Map.of("lineage_task", "second", "ingestion_task", "first", "total", "2"));

    Map<String, Object> result = defaultLogStorage.getLogs(testPipelineFQN, testRunId, null, 10);

    assertEquals("first\nsecond", result.get("logs"));
  }

  @Test
  void getLogsReturnsEmptyStringWhenTheRunnerSendsOnlyPagingKeys() {
    when(mockPipelineServiceClient.getLastIngestionLogs(any(IngestionPipeline.class), isNull()))
        .thenReturn(Map.of("total", "0"));

    Map<String, Object> result = defaultLogStorage.getLogs(testPipelineFQN, testRunId, null, 10);

    assertEquals("", result.get("logs"));
  }

  @Test
  void testDefaultLogStorageInitialization() {
    assertNotNull(defaultLogStorage);
    assertEquals("default", defaultLogStorage.getStorageType());
  }

  @Test
  void testDefaultLogStorageGetLogs() {
    // Setup mock response
    Map<String, String> mockLogs = new HashMap<>();
    mockLogs.put("logs", "Test log content\nLine 2\nLine 3");
    mockLogs.put("after", "3");
    mockLogs.put("total", "100");

    when(mockPipelineServiceClient.getLastIngestionLogs(any(IngestionPipeline.class), isNull()))
        .thenReturn(mockLogs);

    // Test getting logs
    Map<String, Object> result = defaultLogStorage.getLogs(testPipelineFQN, testRunId, null, 10);

    assertNotNull(result);
    assertEquals("Test log content\nLine 2\nLine 3", result.get("logs"));
    assertEquals("3", result.get("after"));
    assertEquals("100", result.get("total"));

    // Verify pipeline service client was called
    verify(mockPipelineServiceClient).getLastIngestionLogs(any(IngestionPipeline.class), isNull());
  }

  @Test
  void testDefaultLogStorageGetLogsWithPagination() {
    // Setup mock response
    Map<String, String> mockLogs = new HashMap<>();
    mockLogs.put("logs", "Line 4\nLine 5");
    mockLogs.put("after", "5");
    mockLogs.put("total", "100");

    when(mockPipelineServiceClient.getLastIngestionLogs(any(IngestionPipeline.class), eq("3")))
        .thenReturn(mockLogs);

    // Test getting logs with cursor
    Map<String, Object> result = defaultLogStorage.getLogs(testPipelineFQN, testRunId, "3", 10);

    assertNotNull(result);
    assertEquals("Line 4\nLine 5", result.get("logs"));
    assertEquals("5", result.get("after"));

    // Verify pipeline service client was called with cursor
    verify(mockPipelineServiceClient).getLastIngestionLogs(any(IngestionPipeline.class), eq("3"));
  }

  @Test
  void testDefaultLogStorageGetInputStream() throws IOException {
    // Setup mock response
    Map<String, String> mockLogs = new HashMap<>();
    mockLogs.put("logs", "Stream test content");

    when(mockPipelineServiceClient.getLastIngestionLogs(any(IngestionPipeline.class), isNull()))
        .thenReturn(mockLogs);

    // Test getting input stream
    InputStream stream = defaultLogStorage.getLogInputStream(testPipelineFQN, testRunId);

    assertNotNull(stream);
    String content = new String(stream.readAllBytes());
    assertEquals("Stream test content", content);
  }

  @Test
  void testDefaultLogStorageAppendLogsNotSupported() {
    // Test that append logs throws unsupported operation
    assertThrows(
        UnsupportedOperationException.class,
        () -> defaultLogStorage.appendLogs(testPipelineFQN, testRunId, "New log content"));
  }

  @Test
  void testDefaultLogStorageGetLatestRunId() {
    // Setup mock pipeline status
    PipelineStatus status = new PipelineStatus();
    status.setRunId(testRunId.toString());

    when(mockPipelineServiceClient.getQueuedPipelineStatus(any(IngestionPipeline.class)))
        .thenReturn(Collections.singletonList(status));

    // Test getting latest run ID
    UUID latestRunId = defaultLogStorage.getLatestRunId(testPipelineFQN);

    assertNotNull(latestRunId);
    assertEquals(testRunId, latestRunId);
  }

  @Test
  void testDefaultLogStorageListRuns() {
    // Setup mock pipeline status
    PipelineStatus status = new PipelineStatus();
    status.setRunId(testRunId.toString());

    when(mockPipelineServiceClient.getQueuedPipelineStatus(any(IngestionPipeline.class)))
        .thenReturn(Collections.singletonList(status));

    // Test listing runs
    List<UUID> runs = defaultLogStorage.listRuns(testPipelineFQN, 10);

    assertNotNull(runs);
    assertEquals(1, runs.size());
    assertEquals(testRunId, runs.get(0));
  }

  @Test
  void testDefaultLogStorageLogsExist() {
    // Setup mock response with logs
    Map<String, String> mockLogs = new HashMap<>();
    mockLogs.put("logs", "Some log content");

    when(mockPipelineServiceClient.getLastIngestionLogs(any(IngestionPipeline.class), isNull()))
        .thenReturn(mockLogs);

    // Test logs exist
    assertTrue(defaultLogStorage.logsExist(testPipelineFQN, testRunId));

    // Setup mock response with empty logs
    mockLogs.put("logs", "");
    when(mockPipelineServiceClient.getLastIngestionLogs(any(IngestionPipeline.class), isNull()))
        .thenReturn(mockLogs);

    // Test logs don't exist
    assertFalse(defaultLogStorage.logsExist(testPipelineFQN, testRunId));
  }

  @Test
  void testDefaultLogStorageDeleteOperationsNoOp() {
    // Test that delete operations don't throw exceptions (they're no-ops)
    assertDoesNotThrow(() -> defaultLogStorage.deleteLogs(testPipelineFQN, testRunId));
    assertDoesNotThrow(() -> defaultLogStorage.deleteAllLogs(testPipelineFQN));
  }

  @Test
  void testDefaultLogStorageCloseStreamNoOp() {
    // Test that close stream operation doesn't throw exceptions (it's a no-op)
    assertDoesNotThrow(() -> defaultLogStorage.closeStream(testPipelineFQN, testRunId));
  }

  @Test
  void testLogStorageFactoryCreateDefault() throws IOException {
    LogStorageInterface storage = LogStorageFactory.create(null, mockPipelineServiceClient, null);

    assertNotNull(storage);
    assertInstanceOf(DefaultLogStorage.class, storage);
    assertEquals("default", storage.getStorageType());
  }

  @Test
  void testLogStorageFactoryInvalidType() {
    assertThrows(
        IOException.class,
        () -> {
          Map<String, Object> config = new HashMap<>();
          config.put("pipelineServiceClient", null);
          DefaultLogStorage storage = new DefaultLogStorage();
          storage.initialize(config);
        });
  }
}
