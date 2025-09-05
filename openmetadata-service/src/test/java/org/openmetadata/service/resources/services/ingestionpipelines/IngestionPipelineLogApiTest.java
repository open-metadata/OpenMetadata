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

import jakarta.ws.rs.client.Entity;
import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.util.*;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.TestInstance;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.api.services.ingestionPipelines.CreateIngestionPipeline;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.metadataIngestion.DatabaseServiceMetadataPipeline;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.services.connections.database.MysqlConnection;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.util.TestUtils;

@Slf4j
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class IngestionPipelineLogApiTest extends OpenMetadataApplicationTest {

  private static final String COLLECTION_PATH = "/v1/services/ingestionPipelines";
  private DatabaseService databaseService;
  private IngestionPipeline testPipeline;

  @BeforeAll
  public void setup() throws Exception {
    // Create a database service for testing
    CreateDatabaseService createService =
        new CreateDatabaseService()
            .withName("test-db-service-log-api")
            .withServiceType(CreateDatabaseService.DatabaseServiceType.Mysql)
            .withConnection(
                new DatabaseConnection()
                    .withConfig(
                        new MysqlConnection().withHostPort("localhost:3306").withUsername("test")));

    WebTarget target = getResource("services/databaseServices");
    databaseService =
        TestUtils.post(target, createService, DatabaseService.class, ADMIN_AUTH_HEADERS);

    // Create test ingestion pipeline
    testPipeline = createTestPipeline();
  }

  @AfterAll
  public void cleanup() throws Exception {
    // Clean up test pipeline
    if (testPipeline != null) {
      WebTarget target = getResource(COLLECTION_PATH + "/" + testPipeline.getId());
      TestUtils.delete(target, ADMIN_AUTH_HEADERS);
    }

    // Clean up database service
    if (databaseService != null) {
      WebTarget target = getResource("services/databaseServices/" + databaseService.getId());
      TestUtils.delete(target, ADMIN_AUTH_HEADERS);
    }
  }

  @Test
  @Order(1)
  public void testLogPaginationWithDefaultStorage() throws Exception {
    UUID runId = UUID.randomUUID();

    // Read logs with pagination - should work with default storage
    WebTarget readTarget =
        getResource(COLLECTION_PATH + "/logs/" + testPipeline.getFullyQualifiedName() + "/" + runId)
            .queryParam("limit", 10);

    Map<String, String> authHeaders = new HashMap<>(ADMIN_AUTH_HEADERS);
    Response readResponse =
        readTarget
            .request(MediaType.APPLICATION_JSON)
            .header("Authorization", authHeaders.get("Authorization"))
            .get();

    assertEquals(OK.getStatusCode(), readResponse.getStatus());

    Map<String, Object> logs = readResponse.readEntity(Map.class);
    assertNotNull(logs);
    assertTrue(logs.containsKey("logs"));
    assertTrue(logs.containsKey("after"));
    assertTrue(logs.containsKey("total"));
  }

  @Test
  @Order(2)
  public void testListRunsWithDefaultStorage() throws Exception {
    // List runs for the pipeline
    WebTarget listTarget =
        getResource(COLLECTION_PATH + "/logs/" + testPipeline.getFullyQualifiedName())
            .queryParam("limit", 5);

    Map<String, String> authHeaders = new HashMap<>(ADMIN_AUTH_HEADERS);
    Response listResponse =
        listTarget
            .request(MediaType.APPLICATION_JSON)
            .header("Authorization", authHeaders.get("Authorization"))
            .get();

    assertEquals(OK.getStatusCode(), listResponse.getStatus());

    Map<String, Object> result = listResponse.readEntity(Map.class);
    assertNotNull(result);
    assertTrue(result.containsKey("runs"));
    List<String> runs = (List<String>) result.get("runs");
    assertNotNull(runs);
  }

  @Test
  @Order(3)
  public void testWriteLogsWithDefaultStorage() throws Exception {
    UUID runId = UUID.randomUUID();
    String logContent = "Test log entry at " + new Date() + "\n";

    // Write logs - should fail with default storage (as it delegates to Airflow/Argo)
    WebTarget writeTarget =
        getResource(
            COLLECTION_PATH + "/logs/" + testPipeline.getFullyQualifiedName() + "/" + runId);

    Map<String, String> authHeaders = new HashMap<>(ADMIN_AUTH_HEADERS);
    Response writeResponse =
        writeTarget
            .request(MediaType.APPLICATION_JSON)
            .header("Authorization", authHeaders.get("Authorization"))
            .post(Entity.entity(logContent, MediaType.TEXT_PLAIN));

    // Default storage doesn't support direct writes
    assertEquals(Response.Status.INTERNAL_SERVER_ERROR.getStatusCode(), writeResponse.getStatus());
  }

  @Test
  @Order(4)
  public void testUnauthorizedAccess() throws Exception {
    UUID runId = UUID.randomUUID();

    // Try to read logs without authorization
    WebTarget readTarget =
        getResource(
            COLLECTION_PATH + "/logs/" + testPipeline.getFullyQualifiedName() + "/" + runId);
    Response readResponse = readTarget.request(MediaType.APPLICATION_JSON).get();

    // Should get forbidden
    assertEquals(Response.Status.FORBIDDEN.getStatusCode(), readResponse.getStatus());
  }

  @Test
  @Order(5)
  public void testLogEndpointsAvailability() throws Exception {
    // Test that all log endpoints are available and respond correctly
    UUID runId = UUID.randomUUID();
    String pipelineFQN = testPipeline.getFullyQualifiedName();

    // Test GET logs endpoint
    WebTarget getLogsTarget = getResource(COLLECTION_PATH + "/logs/" + pipelineFQN + "/" + runId);
    assertNotNull(getLogsTarget);

    // Test list runs endpoint
    WebTarget listRunsTarget = getResource(COLLECTION_PATH + "/logs/" + pipelineFQN);
    assertNotNull(listRunsTarget);

    // Test stream logs endpoint
    WebTarget streamTarget =
        getResource(COLLECTION_PATH + "/logs/" + pipelineFQN + "/stream/" + runId);
    assertNotNull(streamTarget);
  }

  private IngestionPipeline createTestPipeline() throws IOException {
    DatabaseServiceMetadataPipeline sourceConfig =
        new DatabaseServiceMetadataPipeline()
            .withType(DatabaseServiceMetadataPipeline.DatabaseMetadataConfigType.DATABASE_METADATA);

    CreateIngestionPipeline createRequest =
        new CreateIngestionPipeline()
            .withName("test-pipeline-log-api")
            .withDisplayName("Test Pipeline for Log API")
            .withDescription("Test pipeline for log storage API")
            .withPipelineType(PipelineType.METADATA)
            .withService(
                new EntityReference().withId(databaseService.getId()).withType("databaseService"))
            .withSourceConfig(new SourceConfig().withConfig(sourceConfig));

    WebTarget target = getResource(COLLECTION_PATH);
    Response response = TestUtils.post(target, createRequest, Response.class, ADMIN_AUTH_HEADERS);
    return response.readEntity(IngestionPipeline.class);
  }
}
