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

import io.minio.BucketExistsArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.*;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.*;
import org.openmetadata.schema.api.configuration.LogStorageConfiguration;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

@Slf4j
@Testcontainers
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class MinioLogStorageIntegrationTest {

  private static final String MINIO_ACCESS_KEY = "minioadmin";
  private static final String MINIO_SECRET_KEY = "minioadmin";
  private static final String TEST_BUCKET = "test-logs";

  @Container
  private static final GenericContainer<?> minioContainer =
      new GenericContainer<>(DockerImageName.parse("minio/minio:latest"))
          .withExposedPorts(9000)
          .withEnv("MINIO_ROOT_USER", MINIO_ACCESS_KEY)
          .withEnv("MINIO_ROOT_PASSWORD", MINIO_SECRET_KEY)
          .withCommand("server", "/data")
          .waitingFor(Wait.forHttp("/minio/health/live").forPort(9000));

  private S3LogStorage s3LogStorage;
  private MinioClient minioClient;
  private final String testPipelineFQN = "test.service.pipeline";
  private final UUID testRunId = UUID.randomUUID();

  @BeforeEach
  void setUp() throws Exception {
    // Wait for container to be ready
    Thread.sleep(1000);

    // Create MinIO client
    String endpoint =
        String.format("http://%s:%d", minioContainer.getHost(), minioContainer.getMappedPort(9000));

    LOG.info("Setting up MinIO client at: {}", endpoint);

    minioClient =
        MinioClient.builder()
            .endpoint(endpoint)
            .credentials(MINIO_ACCESS_KEY, MINIO_SECRET_KEY)
            .build();

    // Create bucket if it doesn't exist
    if (!minioClient.bucketExists(BucketExistsArgs.builder().bucket(TEST_BUCKET).build())) {
      minioClient.makeBucket(MakeBucketArgs.builder().bucket(TEST_BUCKET).build());
      LOG.info("Created bucket: {}", TEST_BUCKET);
    }

    // Initialize S3LogStorage with MinIO endpoint
    LogStorageConfiguration config =
        new LogStorageConfiguration()
            .withType(LogStorageConfiguration.Type.S_3)
            .withBucketName(TEST_BUCKET)
            .withRegion("us-east-1")
            .withPrefix("logs")
            .withEnableServerSideEncryption(false) // MinIO doesn't need SSE
            .withStorageClass(
                LogStorageConfiguration.StorageClass.STANDARD); // MinIO only supports STANDARD

    // Override endpoint for MinIO
    Map<String, Object> configMap = new HashMap<>();
    configMap.put("config", config);
    configMap.put("endpoint", endpoint); // Custom endpoint for MinIO
    configMap.put("accessKey", MINIO_ACCESS_KEY);
    configMap.put("secretKey", MINIO_SECRET_KEY);

    s3LogStorage = new S3LogStorage();
    s3LogStorage.initialize(configMap);
  }

  @AfterEach
  void tearDown() throws Exception {
    if (s3LogStorage != null) {
      s3LogStorage.close();
    }
  }

  @Test
  @Order(1)
  void testWriteAndReadLogs() throws Exception {
    // Write logs
    String logContent = "Test log line 1\nTest log line 2\nTest log line 3\n";
    s3LogStorage.appendLogs(testPipelineFQN, testRunId, logContent);

    // Read logs back
    Map<String, Object> result = s3LogStorage.getLogs(testPipelineFQN, testRunId, null, 10);

    assertNotNull(result);
    assertEquals(logContent.trim(), result.get("logs"));
    assertNull(result.get("after")); // No more logs
    assertEquals((long) logContent.length(), result.get("total"));
  }

  @Test
  @Order(2)
  void testAppendLogs() throws Exception {
    String firstLog = "First batch of logs\n";
    String secondLog = "Second batch of logs\n";

    // Write first batch
    s3LogStorage.appendLogs(testPipelineFQN, testRunId, firstLog);

    // Append second batch
    s3LogStorage.appendLogs(testPipelineFQN, testRunId, secondLog);

    // Read all logs
    Map<String, Object> result = s3LogStorage.getLogs(testPipelineFQN, testRunId, null, 100);

    String expectedContent = firstLog + secondLog;
    assertEquals(expectedContent.trim(), result.get("logs"));
  }

  @Test
  @Order(3)
  void testLogPagination() throws Exception {
    // Write multiple log lines
    StringBuilder logs = new StringBuilder();
    for (int i = 1; i <= 10; i++) {
      logs.append("Log line ").append(i).append("\n");
    }
    s3LogStorage.appendLogs(testPipelineFQN, testRunId, logs.toString());

    // Read first 3 lines
    Map<String, Object> result1 = s3LogStorage.getLogs(testPipelineFQN, testRunId, null, 3);
    String firstBatch = (String) result1.get("logs");
    assertTrue(firstBatch.contains("Log line 1"));
    assertTrue(firstBatch.contains("Log line 2"));
    assertTrue(firstBatch.contains("Log line 3"));
    assertFalse(firstBatch.contains("Log line 4"));
    assertNotNull(result1.get("after"));

    // Read next 3 lines using cursor
    Map<String, Object> result2 =
        s3LogStorage.getLogs(testPipelineFQN, testRunId, (String) result1.get("after"), 3);
    String secondBatch = (String) result2.get("logs");
    assertTrue(secondBatch.contains("Log line 4"));
    assertTrue(secondBatch.contains("Log line 5"));
    assertTrue(secondBatch.contains("Log line 6"));
  }

  @Test
  @Order(4)
  void testOutputStream() throws Exception {
    // Write using output stream
    try (OutputStream os = s3LogStorage.getLogOutputStream(testPipelineFQN, testRunId)) {
      os.write("Stream line 1\n".getBytes(StandardCharsets.UTF_8));
      os.write("Stream line 2\n".getBytes(StandardCharsets.UTF_8));
    }

    // Read back
    Map<String, Object> result = s3LogStorage.getLogs(testPipelineFQN, testRunId, null, 10);
    String logs = (String) result.get("logs");
    assertTrue(logs.contains("Stream line 1"));
    assertTrue(logs.contains("Stream line 2"));
  }

  @Test
  @Order(5)
  void testInputStream() throws Exception {
    // Write some logs
    String content = "Input stream test content";
    s3LogStorage.appendLogs(testPipelineFQN, testRunId, content);

    // Read using input stream
    try (InputStream is = s3LogStorage.getLogInputStream(testPipelineFQN, testRunId)) {
      String readContent = new String(is.readAllBytes(), StandardCharsets.UTF_8);
      assertEquals(content, readContent);
    }
  }

  @Test
  @Order(6)
  void testListRuns() throws Exception {
    // Create logs for multiple runs
    UUID run1 = UUID.randomUUID();
    UUID run2 = UUID.randomUUID();
    UUID run3 = UUID.randomUUID();

    s3LogStorage.appendLogs(testPipelineFQN, run1, "Run 1 logs");
    s3LogStorage.appendLogs(testPipelineFQN, run2, "Run 2 logs");
    s3LogStorage.appendLogs(testPipelineFQN, run3, "Run 3 logs");

    // List runs
    List<UUID> runs = s3LogStorage.listRuns(testPipelineFQN, 10);

    assertNotNull(runs);
    assertTrue(runs.size() >= 3);
    assertTrue(runs.contains(run1));
    assertTrue(runs.contains(run2));
    assertTrue(runs.contains(run3));
  }

  @Test
  @Order(7)
  void testDeleteLogs() throws Exception {
    // Write logs
    s3LogStorage.appendLogs(testPipelineFQN, testRunId, "Logs to be deleted");

    // Verify logs exist
    assertTrue(s3LogStorage.logsExist(testPipelineFQN, testRunId));

    // Delete logs
    s3LogStorage.deleteLogs(testPipelineFQN, testRunId);

    // Verify logs are deleted
    assertFalse(s3LogStorage.logsExist(testPipelineFQN, testRunId));
  }

  @Test
  @Order(8)
  void testNonExistentLogs() throws Exception {
    UUID nonExistentRunId = UUID.randomUUID();

    // Test reading non-existent logs
    Map<String, Object> result = s3LogStorage.getLogs(testPipelineFQN, nonExistentRunId, null, 10);

    assertNotNull(result);
    assertEquals("", result.get("logs"));
    assertNull(result.get("after"));
    assertEquals(0L, result.get("total"));

    // Test logs exist
    assertFalse(s3LogStorage.logsExist(testPipelineFQN, nonExistentRunId));
  }
}
