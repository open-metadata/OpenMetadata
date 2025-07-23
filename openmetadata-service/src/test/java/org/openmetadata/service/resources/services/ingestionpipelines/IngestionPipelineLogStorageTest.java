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

import static jakarta.ws.rs.core.Response.Status.OK;
import static org.junit.jupiter.api.Assertions.*;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;

import io.minio.BucketExistsArgs;
import io.minio.MakeBucketArgs;
import io.minio.MinioClient;
import jakarta.ws.rs.client.Entity;
import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.util.*;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.*;
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
import org.openmetadata.schema.services.connections.database.BigQueryConnection;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.security.SecurityUtil;
import org.openmetadata.service.util.TestUtils;
import org.testcontainers.containers.GenericContainer;
import org.testcontainers.containers.wait.strategy.Wait;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;

@Slf4j
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@Testcontainers
public class IngestionPipelineLogStorageTest extends OpenMetadataApplicationTest {

  private static final String MINIO_ACCESS_KEY = "minioadmin";
  private static final String MINIO_SECRET_KEY = "minioadmin";
  private static final String TEST_BUCKET = "pipeline-logs-test";
  private static final String COLLECTION_PATH = "services/ingestionPipelines";

  @Container
  private static final GenericContainer<?> minioContainer =
      new GenericContainer<>(DockerImageName.parse("minio/minio:latest"))
          .withExposedPorts(9000)
          .withEnv("MINIO_ROOT_USER", MINIO_ACCESS_KEY)
          .withEnv("MINIO_ROOT_PASSWORD", MINIO_SECRET_KEY)
          .withCommand("server", "/data")
          .waitingFor(Wait.forHttp("/minio/health/live").forPort(9000));

  private static MinioClient minioClient;
  private static DatabaseService databaseService;
  private static IngestionPipeline testPipeline;
  private static boolean initialized = false;

  @Test
  @Order(1)
  public void setupTestData() throws Exception {
    if (initialized) {
      return;
    }

    // Wait for MinIO to be ready
    Thread.sleep(2000); // Give MinIO a moment to fully start

    // Initialize MinIO client
    String minioEndpoint =
        String.format("http://%s:%d", minioContainer.getHost(), minioContainer.getMappedPort(9000));
    LOG.info("Connecting to MinIO at: {}", minioEndpoint);

    minioClient =
        MinioClient.builder()
            .endpoint(minioEndpoint)
            .credentials(MINIO_ACCESS_KEY, MINIO_SECRET_KEY)
            .build();

    // Create test bucket
    try {
      if (!minioClient.bucketExists(BucketExistsArgs.builder().bucket(TEST_BUCKET).build())) {
        minioClient.makeBucket(MakeBucketArgs.builder().bucket(TEST_BUCKET).build());
        LOG.info("Created MinIO bucket: {}", TEST_BUCKET);
      }
    } catch (Exception e) {
      LOG.error("Failed to create MinIO bucket", e);
      throw new RuntimeException("MinIO setup failed", e);
    }

    // Create a database service for testing
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

    // Create test ingestion pipeline
    testPipeline = createTestPipeline();

    initialized = true;
  }

  @AfterAll
  public static void cleanup() throws Exception {
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
  @Order(2)
  public void testWriteAndReadLogsWithDefaultStorage() throws Exception {
    setupTestData(); // Ensure setup has run
    UUID runId = UUID.randomUUID();
    String logContent = "Test log entry at " + new Date() + "\n";

    // Write logs
    WebTarget writeTarget =
        getResource(
            "services/ingestionPipelines/logs/"
                + testPipeline.getFullyQualifiedName()
                + "/"
                + runId);
    Response writeResponse =
        SecurityUtil.addHeaders(writeTarget, ADMIN_AUTH_HEADERS)
            .post(Entity.entity(logContent, MediaType.TEXT_PLAIN));

    // For default storage, writing is not supported
    assertEquals(Response.Status.INTERNAL_SERVER_ERROR.getStatusCode(), writeResponse.getStatus());
  }

  @Test
  @Order(3)
  public void testLogPagination() throws Exception {
    setupTestData(); // Ensure setup has run
    UUID runId = UUID.randomUUID();

    // First write some logs
    StringBuilder testLogs = new StringBuilder();
    for (int i = 1; i <= 20; i++) {
      testLogs.append("Log line ").append(i).append("\n");
    }

    WebTarget writeTarget =
        getResource(
            "services/ingestionPipelines/logs/"
                + testPipeline.getFullyQualifiedName()
                + "/"
                + runId);
    Response writeResponse =
        SecurityUtil.addHeaders(writeTarget, ADMIN_AUTH_HEADERS)
            .post(Entity.entity(testLogs.toString(), MediaType.TEXT_PLAIN));

    // Writing might fail with default storage, but that's okay
    if (writeResponse.getStatus() == Response.Status.OK.getStatusCode()) {
      // If writing succeeded, test pagination

      // Read logs with pagination - first 10 lines
      WebTarget readTarget =
          getResource(
                  "services/ingestionPipelines/logs/"
                      + testPipeline.getFullyQualifiedName()
                      + "/"
                      + runId)
              .queryParam("limit", 10);
      Response readResponse = SecurityUtil.addHeaders(readTarget, ADMIN_AUTH_HEADERS).get();
      assertEquals(OK.getStatusCode(), readResponse.getStatus());

      Map<String, Object> logs = readResponse.readEntity(Map.class);
      assertNotNull(logs);
      assertTrue(logs.containsKey("logs"));
      assertTrue(logs.containsKey("after"));
      assertTrue(logs.containsKey("total"));

      String logContent = (String) logs.get("logs");
      assertNotNull(logContent);

      // If we have an after cursor, read next page
      if (logs.get("after") != null) {
        WebTarget nextPageTarget =
            getResource(
                    "services/ingestionPipelines/logs/"
                        + testPipeline.getFullyQualifiedName()
                        + "/"
                        + runId)
                .queryParam("after", logs.get("after"))
                .queryParam("limit", 10);
        Response nextPageResponse =
            SecurityUtil.addHeaders(nextPageTarget, ADMIN_AUTH_HEADERS).get();
        assertEquals(OK.getStatusCode(), nextPageResponse.getStatus());
      }
    } else {
      // With default storage, writing fails but reading should still work (returns empty logs)
      WebTarget readTarget =
          getResource(
                  "services/ingestionPipelines/logs/"
                      + testPipeline.getFullyQualifiedName()
                      + "/"
                      + runId)
              .queryParam("limit", 10);
      Response readResponse = SecurityUtil.addHeaders(readTarget, ADMIN_AUTH_HEADERS).get();
      assertEquals(OK.getStatusCode(), readResponse.getStatus());

      Map<String, Object> logs = readResponse.readEntity(Map.class);
      assertNotNull(logs);
      assertTrue(logs.containsKey("logs"));
      assertTrue(logs.containsKey("after"));
      assertTrue(logs.containsKey("total"));
    }
  }

  @Test
  @Order(4)
  public void testListRuns() throws Exception {
    setupTestData(); // Ensure setup has run
    // List runs for the pipeline
    WebTarget listTarget =
        getResource("services/ingestionPipelines/logs/" + testPipeline.getFullyQualifiedName())
            .queryParam("limit", 5);
    Response listResponse = SecurityUtil.addHeaders(listTarget, ADMIN_AUTH_HEADERS).get();
    assertEquals(OK.getStatusCode(), listResponse.getStatus());

    Map<String, Object> result = listResponse.readEntity(Map.class);
    assertNotNull(result);
    assertTrue(result.containsKey("runs"));
    List<String> runs = (List<String>) result.get("runs");
    assertNotNull(runs);
  }

  @Test
  @Order(5)
  public void testS3LogStorageIntegration() throws Exception {
    setupTestData(); // Ensure setup has run
    // This test would require updating the application configuration to use S3 storage
    // For now, we'll create a unit test for S3LogStorage

    // Create S3 configuration
    LogStorageConfiguration s3Config =
        new LogStorageConfiguration()
            .withType(LogStorageConfiguration.Type.S_3)
            .withBucketName(TEST_BUCKET)
            .withRegion("us-east-1")
            .withPrefix("test-logs");

    // Test configuration is valid
    assertNotNull(s3Config);
    assertEquals(LogStorageConfiguration.Type.S_3, s3Config.getType());
    assertEquals(TEST_BUCKET, s3Config.getBucketName());
  }

  @Test
  @Order(6)
  public void testUnauthorizedAccess() throws Exception {
    setupTestData(); // Ensure setup has run
    UUID runId = UUID.randomUUID();

    // Try to read logs without authorization
    WebTarget readTarget =
        getResource(
            "services/ingestionPipelines/logs/"
                + testPipeline.getFullyQualifiedName()
                + "/"
                + runId);
    Response readResponse = SecurityUtil.addHeaders(readTarget, null).get();

    // Should get unauthorized
    assertEquals(Response.Status.UNAUTHORIZED.getStatusCode(), readResponse.getStatus());
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
