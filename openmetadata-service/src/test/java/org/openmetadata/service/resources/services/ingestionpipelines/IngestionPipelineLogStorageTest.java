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

package org.openmetadata.service.resources.services.ingestionpipelines;

import static org.junit.jupiter.api.Assertions.*;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;

import io.minio.BucketExistsArgs;
import io.minio.ListObjectsArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import io.minio.RemoveObjectArgs;
import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.io.OutputStream;
import java.net.URI;
import java.util.*;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.configuration.LogStorageConfiguration;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.api.services.ingestionPipelines.CreateIngestionPipeline;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.ingestionPipelines.AirflowConfig;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.metadataIngestion.DatabaseServiceMetadataPipeline;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.security.credentials.AWSCredentials;
import org.openmetadata.schema.services.connections.database.BigQueryConnection;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.logstorage.S3LogStorage;
import org.openmetadata.service.monitoring.StreamableLogsMetrics;
import org.openmetadata.service.util.TestUtils;

@Slf4j
class IngestionPipelineLogStorageTest extends OpenMetadataApplicationTest {

  static {
    // Ensure MinIO is enabled for this test class
    System.setProperty("enableMinio", "true");
  }

  private static MinioClient minioClient;
  private static DatabaseService databaseService;
  private static IngestionPipeline testPipeline;
  private static S3LogStorage s3LogStorage;
  private static StreamableLogsMetrics metrics;
  private static String minioEndpoint;
  private static boolean initialized = false;

  @BeforeEach
  void cleanupBeforeTest() throws Exception {
    if (initialized && minioClient != null && MINIO_BUCKET != null) {
      try {
        // Clean up any existing test data
        var objects =
            minioClient.listObjects(
                ListObjectsArgs.builder()
                    .bucket(MINIO_BUCKET)
                    .prefix("test-logs/")
                    .recursive(true)
                    .build());

        for (var object : objects) {
          minioClient.removeObject(
              RemoveObjectArgs.builder()
                  .bucket(MINIO_BUCKET)
                  .object(object.get().objectName())
                  .build());
        }
      } catch (Exception e) {
        LOG.warn("Failed to clean up before test: {}", e.getMessage());
      }
    }
  }

  void setupTestData() throws Exception {
    if (initialized) {
      return;
    }
    TestUtils.simulateWork(2000);

    // Use the application's MinIO endpoint if available, otherwise fallback to localhost
    minioEndpoint = getMinioEndpointForTests();
    if (minioEndpoint == null) {
      minioEndpoint = "http://localhost:9000";
    }
    LOG.info("Connecting to MinIO at: {}", minioEndpoint);

    minioClient =
        MinioClient.builder()
            .endpoint(minioEndpoint)
            .credentials(MINIO_ACCESS_KEY, MINIO_SECRET_KEY)
            .build();

    try {
      if (!minioClient.bucketExists(BucketExistsArgs.builder().bucket(MINIO_BUCKET).build())) {
        minioClient.makeBucket(MakeBucketArgs.builder().bucket(MINIO_BUCKET).build());
        LOG.info("Created MinIO bucket: {}", MINIO_BUCKET);
      }
    } catch (Exception e) {
      LOG.error("Failed to create MinIO bucket", e);
      throw new RuntimeException("MinIO setup failed", e);
    }

    // Initialize S3LogStorage with MinIO configuration
    org.openmetadata.schema.security.credentials.AWSCredentials awsCreds =
        new org.openmetadata.schema.security.credentials.AWSCredentials()
            .withAwsAccessKeyId(MINIO_ACCESS_KEY)
            .withAwsSecretAccessKey(MINIO_SECRET_KEY)
            .withAwsRegion("us-east-1")
            .withEndPointURL(java.net.URI.create(minioEndpoint));

    LogStorageConfiguration s3Config =
        new LogStorageConfiguration()
            .withType(LogStorageConfiguration.Type.S_3)
            .withBucketName(MINIO_BUCKET)
            .withAwsConfig(new AWSCredentials().withAwsRegion("us-east-1"))
            .withPrefix("test-logs")
            .withAwsConfig(awsCreds);

    // Initialize metrics
    metrics =
        new StreamableLogsMetrics(new io.micrometer.core.instrument.simple.SimpleMeterRegistry());

    // Create and initialize S3LogStorage
    s3LogStorage = new S3LogStorage();
    Map<String, Object> initConfig = new HashMap<>();
    initConfig.put("config", s3Config);
    initConfig.put("metrics", metrics);
    // For MinIO, pass endpoint and credentials directly
    initConfig.put("endpoint", minioEndpoint);
    initConfig.put("accessKey", MINIO_ACCESS_KEY);
    initConfig.put("secretKey", MINIO_SECRET_KEY);
    s3LogStorage.initialize(initConfig);
    LOG.info("S3LogStorage initialized with MinIO");

    try {
      CreateDatabaseService createService =
          new CreateDatabaseService()
              .withName("test-db-service-logs")
              .withServiceType(CreateDatabaseService.DatabaseServiceType.BigQuery)
              .withConnection(new DatabaseConnection().withConfig(new BigQueryConnection()));

      WebTarget target = getResource("services/databaseServices");
      databaseService =
          TestUtils.post(target, createService, DatabaseService.class, ADMIN_AUTH_HEADERS);
    } catch (Exception e) {
      // If service already exists, fetch it
      if (e.getMessage() != null && e.getMessage().contains("already exists")) {
        WebTarget target = getResource("services/databaseServices/name/test-db-service-logs");
        databaseService = TestUtils.get(target, DatabaseService.class, ADMIN_AUTH_HEADERS);
      } else {
        throw e;
      }
    }
    testPipeline = createTestPipeline();
    initialized = true;
  }

  @Test
  void testMetricsRecording() throws Exception {
    setupTestData(); // Ensure setup has run
    String pipelineFQN = "test.pipeline.metrics";
    UUID runId = UUID.randomUUID();

    long initialWrites = metrics.getS3WritesCount();
    long initialReads = metrics.getS3ReadsCount();
    s3LogStorage.appendLogs(pipelineFQN, runId, "Test log for metrics\n");
    s3LogStorage.flush();
    TestUtils.simulateWork(1500);

    s3LogStorage.getLogs(pipelineFQN, runId, null, 10);
    s3LogStorage.listRuns(pipelineFQN, 10);
    assertTrue(metrics.getS3WritesCount() > initialWrites, "S3 write count should increase");
    assertTrue(metrics.getS3ReadsCount() > initialReads, "S3 read count should increase");
  }

  @Test
  void testStreamingEndpoint() throws Exception {
    setupTestData();
    if (testPipeline == null) {
      LOG.warn("Skipping streaming endpoint test - pipeline not created");
      return;
    }

    String pipelineFQN = testPipeline.getFullyQualifiedName();
    String runId = UUID.randomUUID().toString();

    WebTarget streamTarget =
        getResource("services/ingestionPipelines/logs/" + pipelineFQN + "/" + runId);

    String logData = "Stream endpoint test log\n";
    Map<String, String> logPayload = Map.of("logs", logData);
    TestUtils.post(
        streamTarget, logPayload, Response.Status.OK.getStatusCode(), ADMIN_AUTH_HEADERS);

    // Give time for async processing
    TestUtils.simulateWork(2000);

    // Read logs back through REST endpoint
    WebTarget getTarget =
        getResource("services/ingestionPipelines/logs/" + pipelineFQN + "/" + runId);
    Map<String, Object> result = TestUtils.get(getTarget, Map.class, ADMIN_AUTH_HEADERS);
    assertNotNull(result.get("logs"));
    assertTrue(result.get("logs").toString().contains("Stream endpoint test log"));
  }

  @Test
  void testMaxConcurrentStreamsLimit() throws Exception {
    setupTestData();
    // Initialize S3LogStorage with MinIO configuration
    org.openmetadata.schema.security.credentials.AWSCredentials awsCreds =
        new org.openmetadata.schema.security.credentials.AWSCredentials()
            .withAwsAccessKeyId(MINIO_ACCESS_KEY)
            .withAwsSecretAccessKey(MINIO_SECRET_KEY)
            .withAwsRegion("us-east-1")
            .withEndPointURL(new URI(minioEndpoint));

    // Create a storage with low max concurrent streams for testing
    LogStorageConfiguration limitedConfig =
        new LogStorageConfiguration()
            .withType(LogStorageConfiguration.Type.S_3)
            .withBucketName(MINIO_BUCKET)
            .withAwsConfig(new AWSCredentials().withAwsRegion("us-east-1"))
            .withAwsConfig(awsCreds)
            .withPrefix("limited-test")
            .withMaxConcurrentStreams(2); // Very low limit

    S3LogStorage limitedStorage = new S3LogStorage();
    Map<String, Object> initConfig = new HashMap<>();
    initConfig.put("config", limitedConfig);
    initConfig.put("metrics", metrics);
    initConfig.put("endpoint", minioEndpoint);
    initConfig.put("accessKey", MINIO_ACCESS_KEY);
    initConfig.put("secretKey", MINIO_SECRET_KEY);
    limitedStorage.initialize(initConfig);

    // Try to create more streams than allowed
    List<OutputStream> streams = new ArrayList<>();
    for (int i = 0; i < 3; i++) {
      try {
        OutputStream stream =
            limitedStorage.getLogOutputStream("test.pipeline.stream" + i, UUID.randomUUID());
        streams.add(stream);
      } catch (IOException e) {
        // Expected to fail on the 3rd stream
        assertTrue(e.getMessage().contains("Maximum concurrent log streams"));
      }
    }

    // Clean up
    for (OutputStream stream : streams) {
      stream.close();
    }
    limitedStorage.close();
  }

  @AfterAll
  static void cleanup() throws Exception {
    // Clean up S3 bucket contents
    if (minioClient != null && MINIO_BUCKET != null) {
      try {
        // List and delete all objects in the test bucket
        var objects =
            minioClient.listObjects(
                io.minio.ListObjectsArgs.builder().bucket(MINIO_BUCKET).recursive(true).build());

        for (var object : objects) {
          minioClient.removeObject(
              io.minio.RemoveObjectArgs.builder()
                  .bucket(MINIO_BUCKET)
                  .object(object.get().objectName())
                  .build());
        }
        LOG.info("Cleaned up S3 test objects");
      } catch (Exception e) {
        LOG.warn("Failed to clean up S3 objects: {}", e.getMessage());
      }
    }

    // Clean up test pipeline first (before deleting the service it depends on)
    if (testPipeline != null) {
      try {
        WebTarget target = getResource("services/ingestionPipelines/" + testPipeline.getId());
        TestUtils.delete(target, ADMIN_AUTH_HEADERS);
      } catch (Exception e) {
        LOG.warn("Failed to delete test pipeline: {}", e.getMessage());
      }
    }

    // Clean up database service after pipeline is deleted
    if (databaseService != null) {
      try {
        WebTarget target = getResource("services/databaseServices/" + databaseService.getId());
        TestUtils.delete(target, ADMIN_AUTH_HEADERS);
      } catch (Exception e) {
        LOG.warn("Failed to delete database service: {}", e.getMessage());
      }
    }
  }

  @Test
  void testWriteAndReadLogsWithS3Storage() throws Exception {
    setupTestData(); // Ensure setup has run
    String pipelineFQN = "test.pipeline.s3";
    UUID runId = UUID.randomUUID();
    String logContent = "Test log entry at " + new Date() + "\n";

    s3LogStorage.appendLogs(pipelineFQN, runId, logContent);
    for (int i = 1; i <= 5; i++) {
      s3LogStorage.appendLogs(pipelineFQN, runId, "Log line " + i + "\n");
    }
    s3LogStorage.flush();
    TestUtils.simulateWork(1000);
    Map<String, Object> logs = s3LogStorage.getLogs(pipelineFQN, runId, null, 100);

    assertNotNull(logs);
    assertTrue(logs.containsKey("logs"));
    String retrievedLogs = (String) logs.get("logs");
    assertNotNull(retrievedLogs);

    assertTrue(retrievedLogs.contains("Test log entry at"));
    assertTrue(retrievedLogs.contains("Log line 1"));
    assertTrue(retrievedLogs.contains("Log line 5"));
    TestUtils.simulateWork(1000);
    assertTrue(
        metrics.getS3WritesCount() > 0,
        "S3 writes should be recorded. Count: " + metrics.getS3WritesCount());
    assertTrue(
        metrics.getS3ReadsCount() > 0,
        "S3 reads should be recorded. Count: " + metrics.getS3ReadsCount());
  }

  @Test
  void testLogPaginationWithS3() throws Exception {
    setupTestData(); // Ensure setup has run
    String pipelineFQN = "test.pipeline.pagination";
    UUID runId = UUID.randomUUID();

    for (int i = 1; i <= 100; i++) {
      s3LogStorage.appendLogs(pipelineFQN, runId, String.format("Log line %03d\n", i));
    }

    Map<String, Object> firstPage = s3LogStorage.getLogs(pipelineFQN, runId, null, 20);
    assertNotNull(firstPage);
    String firstPageLogs = (String) firstPage.get("logs");
    assertNotNull(firstPageLogs);

    int firstPageLines = firstPageLogs.split("\n").length;
    assertEquals(20, firstPageLines, "First page should have 20 lines");

    assertTrue(firstPageLogs.contains("Log line 001"));
    assertTrue(firstPageLogs.contains("Log line 020"));
    assertFalse(firstPageLogs.contains("Log line 021")); // Should not be in first page

    String afterCursor = (String) firstPage.get("after");
    assertNotNull(afterCursor, "After cursor should be present for pagination");

    Map<String, Object> secondPage = s3LogStorage.getLogs(pipelineFQN, runId, afterCursor, 20);
    String secondPageLogs = (String) secondPage.get("logs");
    assertNotNull(secondPageLogs);

    assertTrue(secondPageLogs.contains("Log line 021"));
    assertTrue(secondPageLogs.contains("Log line 040"));
    assertFalse(secondPageLogs.contains("Log line 020")); // Should not be in second page

    Long total = (Long) firstPage.get("total");
    assertTrue(total > 0, "Total size should be greater than 0");
  }

  @Test
  void testListRunsWithS3() throws Exception {
    setupTestData(); // Ensure setup has run
    String pipelineFQN = "test.pipeline.listruns";

    List<UUID> expectedRunIds = new ArrayList<>();
    for (int i = 1; i <= 5; i++) {
      UUID runId = UUID.randomUUID();
      expectedRunIds.add(runId);
      s3LogStorage.appendLogs(pipelineFQN, runId, "Log for run " + i + "\n");
    }
    s3LogStorage.flush();
    TestUtils.simulateWork(1000);
    List<UUID> actualRunIds = s3LogStorage.listRuns(pipelineFQN, 10);
    assertNotNull(actualRunIds);
    assertEquals(5, actualRunIds.size(), "Should return all 5 runs");
    for (UUID expectedId : expectedRunIds) {
      assertTrue(
          actualRunIds.contains(expectedId), "Run ID " + expectedId + " should be in the list");
    }
    List<UUID> limitedRuns = s3LogStorage.listRuns(pipelineFQN, 3);
    assertEquals(3, limitedRuns.size(), "Should respect limit of 3");
  }

  @Test
  void testMultipartUploadForLargeLogs() throws Exception {
    setupTestData(); // Ensure setup has run
    String pipelineFQN = "test.pipeline.multipart";
    UUID runId = UUID.randomUUID();
    StringBuilder largeLogs = new StringBuilder();
    String line =
        "This is a test log line that will be repeated many times to create large content. ";
    int linesNeeded = (6 * 1024 * 1024) / line.length(); // ~6MB

    for (int i = 0; i < linesNeeded; i++) {
      largeLogs.append(line).append(i).append("\n");
    }

    s3LogStorage.appendLogs(pipelineFQN, runId, largeLogs.toString());
    s3LogStorage.flush();
    TestUtils.simulateWork(2000);

    Map<String, Object> logs = s3LogStorage.getLogs(pipelineFQN, runId, null, 100);
    assertNotNull(logs);
    String retrievedLogs = (String) logs.get("logs");
    assertNotNull(retrievedLogs);
    assertTrue(retrievedLogs.length() > 0);
    String objectKey =
        String.format(
            "test-logs/%s/%s/logs.txt", pipelineFQN.replaceAll("[^a-zA-Z0-9_-]", "_"), runId);
    assertTrue(checkS3ObjectExists(objectKey), "S3 object should exist at: " + objectKey);
  }

  private boolean checkS3ObjectExists(String key) {
    try {
      minioClient.statObject(
          io.minio.StatObjectArgs.builder().bucket(MINIO_BUCKET).object(key).build());
      return true;
    } catch (Exception e) {
      return false;
    }
  }

  @Test
  void testDeleteLogs() throws Exception {
    setupTestData();
    String pipelineFQN = "test.pipeline.delete";
    UUID runId = UUID.randomUUID();

    s3LogStorage.appendLogs(pipelineFQN, runId, "Logs to be deleted\n");
    s3LogStorage.flush();
    TestUtils.simulateWork(1000);

    assertTrue(s3LogStorage.logsExist(pipelineFQN, runId));
    s3LogStorage.deleteLogs(pipelineFQN, runId);
    TestUtils.simulateWork(500);
    assertFalse(s3LogStorage.logsExist(pipelineFQN, runId));
    Map<String, Object> logs = s3LogStorage.getLogs(pipelineFQN, runId, null, 10);
    assertEquals("", logs.get("logs"));
  }

  @Test
  void testS3ConnectionFailure() throws Exception {
    LogStorageConfiguration badConfig =
        new LogStorageConfiguration()
            .withType(LogStorageConfiguration.Type.S_3)
            .withBucketName("non-existent-bucket")
            .withAwsConfig(new AWSCredentials().withAwsRegion("us-east-1"))
            .withPrefix("test-logs");

    S3LogStorage badStorage = new S3LogStorage();
    Map<String, Object> initConfig = new HashMap<>();
    initConfig.put("config", badConfig);
    initConfig.put("endpoint", "http://invalid-endpoint:9999");
    assertThrows(IOException.class, () -> badStorage.initialize(initConfig));
  }

  @Test
  void testLogBufferExpiration() throws Exception {
    setupTestData();
    String pipelineFQN = "test.pipeline.buffer";
    UUID runId = UUID.randomUUID();

    s3LogStorage.appendLogs(pipelineFQN, runId, "Buffered log entry\n");
    TestUtils.simulateWork(6000); // Longer than buffer timeout
    Map<String, Object> logs = s3LogStorage.getLogs(pipelineFQN, runId, null, 10);
    assertTrue(logs.get("logs").toString().contains("Buffered log entry"));
  }

  @Test
  void testEmptyLogsHandling() throws Exception {
    setupTestData();
    String pipelineFQN = "test.pipeline.empty";
    UUID runId = UUID.randomUUID();
    Map<String, Object> logs = s3LogStorage.getLogs(pipelineFQN, runId, null, 10);
    assertNotNull(logs);
    assertEquals("", logs.get("logs"));
    assertNull(logs.get("after"));
    assertEquals(0L, logs.get("total"));
  }

  @Test
  void testConcurrentWrites() throws Exception {
    setupTestData(); // Ensure setup has run
    String pipelineFQN = "test.pipeline.concurrent";
    UUID runId = UUID.randomUUID();

    int threadCount = 10;
    int logsPerThread = 10;
    List<Thread> threads = new ArrayList<>();

    for (int t = 0; t < threadCount; t++) {
      final int threadId = t;
      Thread thread =
          new Thread(
              () -> {
                for (int i = 0; i < logsPerThread; i++) {
                  try {
                    s3LogStorage.appendLogs(
                        pipelineFQN, runId, String.format("Thread %d - Log %d\n", threadId, i));
                  } catch (IOException e) {
                    fail("Failed to write logs: " + e.getMessage());
                  }
                }
              });
      threads.add(thread);
      thread.start();
    }

    for (Thread thread : threads) {
      thread.join();
    }

    Map<String, Object> logs = s3LogStorage.getLogs(pipelineFQN, runId, null, 1000);
    String allLogs = (String) logs.get("logs");
    assertNotNull(allLogs);

    int totalLines = allLogs.split("\n").length;
    assertEquals(
        threadCount * logsPerThread, totalLines, "All logs from all threads should be present");

    for (int t = 0; t < threadCount; t++) {
      for (int i = 0; i < logsPerThread; i++) {
        String expectedLog = String.format("Thread %d - Log %d", t, i);
        assertTrue(allLogs.contains(expectedLog), "Log '" + expectedLog + "' should be present");
      }
    }
  }

  @Test
  void testCloseLogStream() throws Exception {
    setupTestData(); // Ensure setup has run
    if (testPipeline == null) {
      LOG.warn("Skipping close log stream test - pipeline not created");
      return;
    }
    String pipelineFQN = testPipeline.getFullyQualifiedName();
    UUID runId = UUID.randomUUID();

    // First, write some logs to create an active stream
    Map<String, Object> logData = Map.of("logs", "Test log content for close stream");
    WebTarget writeTarget =
        getResource("services/ingestionPipelines/logs/" + pipelineFQN + "/" + runId);
    TestUtils.post(writeTarget, logData, Response.Status.OK.getStatusCode(), ADMIN_AUTH_HEADERS);

    // Now close the stream
    WebTarget closeTarget =
        getResource("services/ingestionPipelines/logs/" + pipelineFQN + "/" + runId + "/close");
    Map<String, Object> closeResponse =
        TestUtils.post(
            closeTarget, "", Map.class, Response.Status.OK.getStatusCode(), ADMIN_AUTH_HEADERS);

    // Verify the response indicates success
    assertTrue(closeResponse.containsKey("message"));
    assertEquals("Log stream closed successfully", closeResponse.get("message"));
  }

  private static IngestionPipeline createTestPipeline() throws IOException {
    try {
      DatabaseServiceMetadataPipeline sourceConfig =
          new DatabaseServiceMetadataPipeline()
              .withType(
                  DatabaseServiceMetadataPipeline.DatabaseMetadataConfigType.DATABASE_METADATA);

      CreateIngestionPipeline createRequest =
          new CreateIngestionPipeline()
              .withName("test-pipeline-logs")
              .withDisplayName("Test Pipeline for Logs")
              .withDescription("Test pipeline for log storage")
              .withPipelineType(PipelineType.METADATA)
              .withService(
                  new EntityReference().withId(databaseService.getId()).withType("databaseService"))
              .withSourceConfig(new SourceConfig().withConfig(sourceConfig))
              .withAirflowConfig(
                  new AirflowConfig()
                      .withScheduleInterval("0 0 * * *")
                      .withStartDate(new Date())
                      .withRetries(3)
                      .withRetryDelay(300));

      WebTarget target = getResource("services/ingestionPipelines");
      return TestUtils.post(target, createRequest, IngestionPipeline.class, ADMIN_AUTH_HEADERS);
    } catch (Exception e) {
      // If pipeline already exists, fetch it
      if (e.getMessage() != null && e.getMessage().contains("already exists")) {
        String fqn = databaseService.getFullyQualifiedName() + ".test-pipeline-logs";
        WebTarget target = getResource("services/ingestionPipelines/name/" + fqn);
        return TestUtils.get(target, IngestionPipeline.class, ADMIN_AUTH_HEADERS);
      } else {
        throw new IOException("Failed to create test pipeline", e);
      }
    }
  }
}
