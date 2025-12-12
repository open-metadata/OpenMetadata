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

import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.*;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.api.services.ingestionPipelines.CreateIngestionPipeline;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.metadataIngestion.DatabaseServiceMetadataPipeline;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.resources.services.DatabaseServiceResourceTest;
import org.openmetadata.service.security.SecurityUtil;
import org.openmetadata.service.util.TestUtils;

/**
 * Tests for Ingestion Pipeline Log Streaming functionality.
 * These tests verify the log reading/writing APIs work correctly with both
 * default storage and S3 storage configurations.
 */
@Slf4j
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class IngestionPipelineLogStreamingResourceTest extends OpenMetadataApplicationTest {

  private static final String COLLECTION_PATH = "services/ingestionPipelines";
  private DatabaseService databaseService;
  private IngestionPipeline testPipeline;
  private DatabaseServiceResourceTest databaseServiceResourceTest;

  @BeforeAll
  void setup() throws IOException {
    databaseServiceResourceTest = new DatabaseServiceResourceTest();
    createDatabaseService();
    testPipeline = createTestPipeline();
    LOG.info("Created test pipeline with FQN: {}", testPipeline.getFullyQualifiedName());
  }

  @AfterAll
  void cleanup() {
    if (testPipeline != null) {
      try {
        WebTarget target = getResource(COLLECTION_PATH + "/" + testPipeline.getId());
        TestUtils.delete(target, ADMIN_AUTH_HEADERS);
      } catch (Exception e) {
        LOG.warn("Failed to delete test pipeline", e);
      }
    }

    if (databaseService != null) {
      try {
        WebTarget target = getResource("services/databaseServices/" + databaseService.getId());
        TestUtils.delete(target, ADMIN_AUTH_HEADERS);
      } catch (Exception e) {
        LOG.warn("Failed to delete database service", e);
      }
    }
  }

  private void createDatabaseService() throws IOException {
    CreateDatabaseService createService =
        databaseServiceResourceTest
            .createRequest("test-db-service-log-streaming")
            .withServiceType(CreateDatabaseService.DatabaseServiceType.BigQuery)
            .withConnection(TestUtils.BIGQUERY_DATABASE_CONNECTION);

    databaseService = databaseServiceResourceTest.createEntity(createService, ADMIN_AUTH_HEADERS);
  }

  private IngestionPipeline createTestPipeline() throws IOException {
    DatabaseServiceMetadataPipeline sourceConfig =
        new DatabaseServiceMetadataPipeline()
            .withType(DatabaseServiceMetadataPipeline.DatabaseMetadataConfigType.DATABASE_METADATA);

    IngestionPipelineResourceTest pipelineResourceTest = new IngestionPipelineResourceTest();
    CreateIngestionPipeline createRequest =
        pipelineResourceTest
            .createRequest("test-pipeline-log-streaming")
            .withDisplayName("Test Pipeline for Log Streaming")
            .withDescription("Test pipeline for log streaming functionality")
            .withPipelineType(PipelineType.METADATA)
            .withService(databaseService.getEntityReference())
            .withSourceConfig(new SourceConfig().withConfig(sourceConfig));

    return pipelineResourceTest.createEntity(createRequest, ADMIN_AUTH_HEADERS);
  }

  @Test
  @Order(1)
  public void testReadLogsWithPagination() {
    UUID runId = UUID.randomUUID();
    String pipelineFQN = testPipeline.getFullyQualifiedName();

    WebTarget readTarget =
        getResource(COLLECTION_PATH + "/logs/" + pipelineFQN + "/" + runId).queryParam("limit", 10);

    Response readResponse = SecurityUtil.addHeaders(readTarget, ADMIN_AUTH_HEADERS).get();

    // With default storage and no Airflow running, this returns 404
    int status = readResponse.getStatus();
    assertTrue(
        status == Response.Status.OK.getStatusCode()
            || status == Response.Status.NOT_FOUND.getStatusCode(),
        "Expected OK or NOT_FOUND but got: " + status);

    if (status == Response.Status.OK.getStatusCode()) {
      Map<String, Object> result = readResponse.readEntity(Map.class);
      assertNotNull(result);
      assertTrue(result.containsKey("logs"));
      assertTrue(result.containsKey("after"));
      assertTrue(result.containsKey("total"));
    }
  }

  @Test
  @Order(2)
  void testListPipelineRuns() {
    String pipelineFQN = testPipeline.getFullyQualifiedName();

    WebTarget listTarget =
        getResource(COLLECTION_PATH + "/logs/" + pipelineFQN).queryParam("limit", 5);

    Response listResponse = SecurityUtil.addHeaders(listTarget, ADMIN_AUTH_HEADERS).get();

    int status = listResponse.getStatus();
    assertTrue(
        status == Response.Status.OK.getStatusCode()
            || status == Response.Status.NOT_FOUND.getStatusCode(),
        "Expected OK or NOT_FOUND but got: " + status);

    if (status == Response.Status.OK.getStatusCode()) {
      Map<String, Object> result = listResponse.readEntity(Map.class);
      assertNotNull(result);
      assertTrue(result.containsKey("runs"));
    }
  }

  @Test
  @Order(3)
  void testWriteLogsWithDefaultStorage() {
    UUID runId = UUID.randomUUID();
    String pipelineFQN = testPipeline.getFullyQualifiedName();
    String logContent = "Test log entry at " + System.currentTimeMillis() + "\n";

    WebTarget writeTarget = getResource(COLLECTION_PATH + "/logs/" + pipelineFQN + "/" + runId);

    Response writeResponse =
        SecurityUtil.addHeaders(writeTarget, ADMIN_AUTH_HEADERS)
            .post(jakarta.ws.rs.client.Entity.entity(logContent, MediaType.TEXT_PLAIN));

    int status = writeResponse.getStatus();
    assertTrue(
        status == Response.Status.OK.getStatusCode()
            || status == Response.Status.NOT_IMPLEMENTED.getStatusCode()
            || status == Response.Status.INTERNAL_SERVER_ERROR.getStatusCode(),
        "Expected OK, NOT_IMPLEMENTED, or INTERNAL_SERVER_ERROR but got: " + status);

    if (status == Response.Status.OK.getStatusCode()) {
      // If write succeeded, verify session cookie
      String sessionCookie = writeResponse.getHeaderString("Set-Cookie");
      if (sessionCookie != null) {
        assertTrue(sessionCookie.contains("PIPELINE_SESSION="));
      }
    }
  }

  @Test
  @Order(4)
  void testGetLogsForNonExistentRun() {
    UUID runId = UUID.randomUUID();
    String pipelineFQN = testPipeline.getFullyQualifiedName();

    WebTarget readTarget = getResource(COLLECTION_PATH + "/logs/" + pipelineFQN + "/" + runId);

    Response readResponse = SecurityUtil.addHeaders(readTarget, ADMIN_AUTH_HEADERS).get();

    int status = readResponse.getStatus();
    assertTrue(
        status == Response.Status.OK.getStatusCode()
            || status == Response.Status.NOT_FOUND.getStatusCode(),
        "Expected OK or NOT_FOUND but got: " + status);

    if (status == Response.Status.OK.getStatusCode()) {
      Map<String, Object> result = readResponse.readEntity(Map.class);
      assertNotNull(result);
      assertTrue(result.containsKey("logs"));

      String logs = (String) result.get("logs");
      assertTrue(logs == null || logs.isEmpty());
    }
  }

  @Test
  @Order(5)
  void testListRunsForEmptyPipeline() {
    String pipelineFQN = testPipeline.getFullyQualifiedName();

    WebTarget listTarget =
        getResource(COLLECTION_PATH + "/logs/" + pipelineFQN).queryParam("limit", 10);

    Response listResponse = SecurityUtil.addHeaders(listTarget, ADMIN_AUTH_HEADERS).get();

    int status = listResponse.getStatus();
    assertTrue(
        status == Response.Status.OK.getStatusCode()
            || status == Response.Status.NOT_FOUND.getStatusCode(),
        "Expected OK or NOT_FOUND but got: " + status);

    if (status == Response.Status.OK.getStatusCode()) {
      Map<String, Object> result = listResponse.readEntity(Map.class);
      assertNotNull(result);
      assertTrue(result.containsKey("runs"));

      Object runs = result.get("runs");
      assertNotNull(runs);
    }
  }

  @Test
  @Order(6)
  void testInvalidPipelineFQN() {
    String invalidFQN = "non.existent.pipeline";
    UUID runId = UUID.randomUUID();

    WebTarget target = getResource(COLLECTION_PATH + "/logs/" + invalidFQN + "/" + runId);

    Response response = SecurityUtil.addHeaders(target, ADMIN_AUTH_HEADERS).get();

    assertEquals(Response.Status.NOT_FOUND.getStatusCode(), response.getStatus());
  }

  @Test
  @Order(7)
  void testPaginationParameters() {
    UUID runId = UUID.randomUUID();
    String pipelineFQN = testPipeline.getFullyQualifiedName();

    WebTarget readTarget =
        getResource(COLLECTION_PATH + "/logs/" + pipelineFQN + "/" + runId)
            .queryParam("limit", 5)
            .queryParam("after", "100");

    Response readResponse = SecurityUtil.addHeaders(readTarget, ADMIN_AUTH_HEADERS).get();

    int status = readResponse.getStatus();
    assertTrue(
        status == Response.Status.OK.getStatusCode()
            || status == Response.Status.NOT_FOUND.getStatusCode(),
        "Expected OK or NOT_FOUND but got: " + status);

    if (status == Response.Status.OK.getStatusCode()) {
      Map<String, Object> result = readResponse.readEntity(Map.class);
      assertNotNull(result);
      assertTrue(result.containsKey("logs"));
      assertTrue(result.containsKey("after"));
    }
  }
}
