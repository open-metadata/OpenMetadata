/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.clients.pipeline.k8s;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class IngestionLogHandlerTest {

  @Test
  void testBuildLogResponseSingleChunk() {
    String shortLog = "This is a short log message";
    String taskKey = "ingestion_task";

    Map<String, String> response = IngestionLogHandler.buildLogResponse(shortLog, null, taskKey);

    assertNotNull(response);
    assertEquals(shortLog, response.get(taskKey));
    assertEquals("1", response.get("total"));
    assertFalse(response.containsKey("after")); // No pagination needed
  }

  @Test
  void testBuildLogResponseMultipleChunks() throws Exception {
    // Create a large log that will require multiple chunks
    StringBuilder largeLog = new StringBuilder();
    String logLine =
        "This is a sample log line that contains useful information about the pipeline execution\n";
    int targetBytes =
        IngestionLogHandler.LOG_CHUNK_SIZE * 2 + 1000; // Ensure we get multiple chunks

    while (largeLog.toString().getBytes(StandardCharsets.UTF_8).length < targetBytes) {
      largeLog.append(logLine);
    }

    String taskKey = "profiler_task";

    // Test first chunk
    Map<String, String> firstChunk =
        IngestionLogHandler.buildLogResponse(largeLog.toString(), null, taskKey);

    assertNotNull(firstChunk);
    assertTrue(firstChunk.containsKey(taskKey));
    assertTrue(firstChunk.containsKey("total"));
    assertTrue(firstChunk.containsKey("after"));

    int totalChunks = Integer.parseInt(firstChunk.get("total"));
    assertTrue(totalChunks > 1, "Should have multiple chunks for large log");
    assertEquals("1", firstChunk.get("after"));

    // Test second chunk
    Map<String, String> secondChunk =
        IngestionLogHandler.buildLogResponse(largeLog.toString(), "1", taskKey);

    assertNotNull(secondChunk);
    assertTrue(secondChunk.containsKey(taskKey));
    assertEquals(String.valueOf(totalChunks), secondChunk.get("total"));

    // Content should be different
    assertFalse(firstChunk.get(taskKey).equals(secondChunk.get(taskKey)));

    // Last chunk should not have "after" field
    String lastChunkIndex = String.valueOf(totalChunks - 1);
    Map<String, String> lastChunk =
        IngestionLogHandler.buildLogResponse(largeLog.toString(), lastChunkIndex, taskKey);
    assertFalse(lastChunk.containsKey("after"), "Last chunk should not have 'after' field");
  }

  @Test
  void testBuildLogResponseEmptyLog() {
    String emptyLog = "";
    String taskKey = "lineage_task";

    Map<String, String> response = IngestionLogHandler.buildLogResponse(emptyLog, null, taskKey);

    assertNotNull(response);
    assertEquals("", response.get(taskKey));
    assertEquals("1", response.get("total"));
    assertFalse(response.containsKey("after"));
  }

  @Test
  void testBuildLogResponseNullLog() {
    String taskKey = "test_task";

    Map<String, String> response = IngestionLogHandler.buildLogResponse(null, null, taskKey);

    assertNotNull(response);
    assertEquals("", response.get(taskKey));
    assertEquals("1", response.get("total"));
    assertFalse(response.containsKey("after"));
  }

  @Test
  void testBuildLogResponseInvalidAfter() {
    String log = "Test log message";
    String taskKey = "ingestion_task";

    // Test with after index that's too high
    Map<String, String> response = IngestionLogHandler.buildLogResponse(log, "999", taskKey);

    assertNotNull(response);
    assertEquals("Invalid pagination index", response.get(taskKey));
  }

  @Test
  void testSplitStringByByteSize() throws Exception {
    String input = "Hello, World! This is a test string for byte splitting.";
    int chunkSize = 20;

    List<String> chunks = IngestionLogHandler.splitStringByByteSize(input, chunkSize);

    assertNotNull(chunks);
    assertFalse(chunks.isEmpty());

    // Verify each chunk is within byte limit
    for (String chunk : chunks) {
      assertTrue(
          chunk.getBytes(StandardCharsets.UTF_8).length <= chunkSize,
          "Chunk exceeds byte size limit: " + chunk);
    }

    // Verify all chunks reconstruct original string
    String reconstructed = String.join("", chunks);
    assertEquals(input, reconstructed);
  }

  @Test
  void testSplitStringWithUnicodeCharacters() throws Exception {
    String input = "Hello 世界 🌍 測試"; // Mix of ASCII, Chinese, and emoji
    int chunkSize = 10;

    List<String> chunks = IngestionLogHandler.splitStringByByteSize(input, chunkSize);

    assertNotNull(chunks);
    assertFalse(chunks.isEmpty());

    // Verify each chunk is within byte limit and valid UTF-8
    for (String chunk : chunks) {
      byte[] bytes = chunk.getBytes(StandardCharsets.UTF_8);
      assertTrue(bytes.length <= chunkSize, "Chunk exceeds byte size limit");

      // Verify it's valid UTF-8 by reconstructing
      String reconstructed = new String(bytes, StandardCharsets.UTF_8);
      assertEquals(chunk, reconstructed);
    }

    // Verify all chunks reconstruct original string
    String reconstructed = String.join("", chunks);
    assertEquals(input, reconstructed);
  }

  @Test
  void testSplitEmptyString() throws Exception {
    List<String> chunks = IngestionLogHandler.splitStringByByteSize("", 100);

    assertNotNull(chunks);
    assertEquals(1, chunks.size());
    assertEquals("", chunks.get(0));
  }

  @Test
  void testSplitNullString() throws Exception {
    List<String> chunks = IngestionLogHandler.splitStringByByteSize(null, 100);

    assertNotNull(chunks);
    assertEquals(1, chunks.size());
    assertEquals("", chunks.get(0));
  }

  @Test
  void testLogChunkSizeConstants() {
    // Verify our constants are reasonable
    assertTrue(IngestionLogHandler.LOG_CHUNK_SIZE > 0);
    assertTrue(IngestionLogHandler.LOG_CHUNK_SIZE < 2_000_000); // Less than 2MB
    assertTrue(IngestionLogHandler.LOG_CHUNK_SIZE > 500_000); // Greater than 500KB
  }

  @Test
  void testDifferentTaskKeys() {
    String log = "Test log content";

    // Test different task keys used by different pipeline types
    String[] taskKeys = {
      "ingestion_task",
      "profiler_task",
      "lineage_task",
      "dbt_task",
      "usage_task",
      "test_suite_task",
      "auto_classification_task"
    };

    for (String taskKey : taskKeys) {
      Map<String, String> response = IngestionLogHandler.buildLogResponse(log, null, taskKey);

      assertNotNull(response);
      assertTrue(response.containsKey(taskKey));
      assertEquals(log, response.get(taskKey));
      assertEquals("1", response.get("total"));
    }
  }
}
