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
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.io.IOException;
import java.io.InputStream;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.sdk.PipelineServiceClientInterface;

@ExtendWith(MockitoExtension.class)
public class LogStorageTest {

  @Mock private PipelineServiceClientInterface mockPipelineServiceClient;

  private DefaultLogStorage defaultLogStorage;
  private final String testPipelineFQN = "service.database.pipeline";
  private final UUID testRunId = UUID.randomUUID();

  @BeforeEach
  void setUp() throws IOException {
    defaultLogStorage = new DefaultLogStorage();
    Map<String, Object> config = new HashMap<>();
    config.put("pipelineServiceClient", mockPipelineServiceClient);
    defaultLogStorage.initialize(config);
  }

  @Test
  void testDefaultLogStorageInitialization() {
    assertNotNull(defaultLogStorage);
    assertEquals("default", defaultLogStorage.getStorageType());
  }

  @Test
  void testDefaultLogStorageGetLogs() throws IOException {
    // Setup mock response
    Map<String, String> mockLogs = new HashMap<>();
    mockLogs.put("logs", "Test log content\nLine 2\nLine 3");
    mockLogs.put("after", "3");
    mockLogs.put("total", "100");

    when(mockPipelineServiceClient.getLastIngestionLogs(any(IngestionPipeline.class), anyString()))
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
  void testDefaultLogStorageGetLogsWithPagination() throws IOException {
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
        () -> {
          defaultLogStorage.appendLogs(testPipelineFQN, testRunId, "New log content");
        });
  }

  @Test
  void testDefaultLogStorageGetOutputStreamNotSupported() {
    // Test that get output stream throws unsupported operation
    assertThrows(
        UnsupportedOperationException.class,
        () -> {
          defaultLogStorage.getLogOutputStream(testPipelineFQN, testRunId);
        });
  }

  @Test
  void testDefaultLogStorageGetLatestRunId() throws IOException {
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
  void testDefaultLogStorageListRuns() throws IOException {
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
  void testDefaultLogStorageLogsExist() throws IOException {
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
  void testDefaultLogStorageDeleteOperationsNoOp() throws IOException {
    // Test that delete operations don't throw exceptions (they're no-ops)
    assertDoesNotThrow(() -> defaultLogStorage.deleteLogs(testPipelineFQN, testRunId));
    assertDoesNotThrow(() -> defaultLogStorage.deleteAllLogs(testPipelineFQN));
  }

  @Test
  void testLogStorageFactoryCreateDefault() throws IOException {
    LogStorageInterface storage = LogStorageFactory.create(null, mockPipelineServiceClient);

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
