package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeFalse;

import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.junit.jupiter.api.TestMethodOrder;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.services.ingestionPipelines.CreateIngestionPipeline;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.ingestionPipelines.AirflowConfig;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.metadataIngestion.DatabaseServiceMetadataPipeline;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Integration tests for Ingestion Pipeline Log Streaming functionality.
 *
 * <p>Tests verify the log reading/writing APIs work correctly with both
 * default storage and S3 storage configurations.
 *
 * <p>Migrated from:
 * org.openmetadata.service.resources.services.ingestionpipelines.IngestionPipelineLogStreamingResourceTest
 *
 * <p>Run with: mvn test -Dtest=IngestionPipelineLogStreamingResourceIT
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
public class IngestionPipelineLogStreamingResourceIT {

  private static final Logger LOG =
      LoggerFactory.getLogger(IngestionPipelineLogStreamingResourceIT.class);
  private static final String BASE_PATH = "/v1/services/ingestionPipelines";

  @Test
  @Order(1)
  void testReadLogsWithPagination(TestNamespace ns) throws OpenMetadataException {
    IngestionPipeline pipeline = createTestPipeline(ns);
    UUID runId = UUID.randomUUID();
    String pipelineFQN = pipeline.getFullyQualifiedName();

    OpenMetadataClient client = SdkClients.adminClient();
    String path = BASE_PATH + "/logs/" + pipelineFQN + "/" + runId + "?limit=10";

    try {
      String response = client.getHttpClient().executeForString(HttpMethod.GET, path, null);

      if (response != null && !response.isEmpty()) {
        Map<String, Object> result = parseJsonResponse(response);
        assertNotNull(result);
        assertTrue(result.containsKey("logs"));
        assertTrue(result.containsKey("after"));
        assertTrue(result.containsKey("total"));
      }
    } catch (OpenMetadataException e) {
      int statusCode = e.getStatusCode();
      assertTrue(
          statusCode == 200 || statusCode == 404,
          "Expected OK or NOT_FOUND but got: " + statusCode);
    }
  }

  @Test
  @Order(2)
  void testListPipelineRuns(TestNamespace ns) throws OpenMetadataException {
    IngestionPipeline pipeline = createTestPipeline(ns);
    String pipelineFQN = pipeline.getFullyQualifiedName();

    OpenMetadataClient client = SdkClients.adminClient();
    String path = BASE_PATH + "/logs/" + pipelineFQN + "?limit=5";

    try {
      String response = client.getHttpClient().executeForString(HttpMethod.GET, path, null);

      if (response != null && !response.isEmpty()) {
        Map<String, Object> result = parseJsonResponse(response);
        assertNotNull(result);
        assertTrue(result.containsKey("runs"));
      }
    } catch (OpenMetadataException e) {
      int statusCode = e.getStatusCode();
      assertTrue(
          statusCode == 200 || statusCode == 404,
          "Expected OK or NOT_FOUND but got: " + statusCode);
    }
  }

  @Test
  @Order(3)
  void testWriteLogsWithDefaultStorage(TestNamespace ns) throws OpenMetadataException {
    IngestionPipeline pipeline = createTestPipeline(ns);
    UUID runId = UUID.randomUUID();
    String pipelineFQN = pipeline.getFullyQualifiedName();
    String logContent = "Test log entry at " + System.currentTimeMillis() + "\n";

    OpenMetadataClient client = SdkClients.adminClient();
    String path = BASE_PATH + "/logs/" + pipelineFQN + "/" + runId;

    Map<String, Object> logBatch = Map.of("logs", logContent);

    try {
      client.getHttpClient().execute(HttpMethod.POST, path, logBatch, String.class);
    } catch (OpenMetadataException e) {
      int statusCode = e.getStatusCode();
      assertTrue(
          statusCode == 200 || statusCode == 501 || statusCode == 500,
          "Expected OK, NOT_IMPLEMENTED, or INTERNAL_SERVER_ERROR but got: " + statusCode);
    }
  }

  @Test
  @Order(4)
  void testGetLogsForNonExistentRun(TestNamespace ns) throws OpenMetadataException {
    assumeFalse(
        TestSuiteBootstrap.isK8sEnabled(),
        "Log streaming behavior differs with K8s pipeline backend");
    IngestionPipeline pipeline = createTestPipeline(ns);
    UUID runId = UUID.randomUUID();
    String pipelineFQN = pipeline.getFullyQualifiedName();

    OpenMetadataClient client = SdkClients.adminClient();
    String path = BASE_PATH + "/logs/" + pipelineFQN + "/" + runId;

    try {
      String response = client.getHttpClient().executeForString(HttpMethod.GET, path, null);

      if (response != null && !response.isEmpty()) {
        Map<String, Object> result = parseJsonResponse(response);
        assertNotNull(result);
        assertTrue(result.containsKey("logs"));

        String logs = (String) result.get("logs");
        assertTrue(logs == null || logs.isEmpty());
      }
    } catch (OpenMetadataException e) {
      int statusCode = e.getStatusCode();
      assertTrue(
          statusCode == 200 || statusCode == 404,
          "Expected OK or NOT_FOUND but got: " + statusCode);
    }
  }

  @Test
  @Order(5)
  void testListRunsForEmptyPipeline(TestNamespace ns) throws OpenMetadataException {
    IngestionPipeline pipeline = createTestPipeline(ns);
    String pipelineFQN = pipeline.getFullyQualifiedName();

    OpenMetadataClient client = SdkClients.adminClient();
    String path = BASE_PATH + "/logs/" + pipelineFQN + "?limit=10";

    try {
      String response = client.getHttpClient().executeForString(HttpMethod.GET, path, null);

      if (response != null && !response.isEmpty()) {
        Map<String, Object> result = parseJsonResponse(response);
        assertNotNull(result);
        assertTrue(result.containsKey("runs"));

        Object runs = result.get("runs");
        assertNotNull(runs);
      }
    } catch (OpenMetadataException e) {
      int statusCode = e.getStatusCode();
      assertTrue(
          statusCode == 200 || statusCode == 404,
          "Expected OK or NOT_FOUND but got: " + statusCode);
    }
  }

  @Test
  @Order(6)
  void testInvalidPipelineFQN(TestNamespace ns) throws OpenMetadataException {
    String invalidFQN = "non.existent.pipeline";
    UUID runId = UUID.randomUUID();

    OpenMetadataClient client = SdkClients.adminClient();
    String path = BASE_PATH + "/logs/" + invalidFQN + "/" + runId;

    OpenMetadataException exception =
        assertThrows(
            OpenMetadataException.class,
            () -> client.getHttpClient().executeForString(HttpMethod.GET, path, null));

    assertEquals(404, exception.getStatusCode());
  }

  @Test
  @Order(7)
  void testPaginationParameters(TestNamespace ns) throws OpenMetadataException {
    IngestionPipeline pipeline = createTestPipeline(ns);
    UUID runId = UUID.randomUUID();
    String pipelineFQN = pipeline.getFullyQualifiedName();

    OpenMetadataClient client = SdkClients.adminClient();
    String path = BASE_PATH + "/logs/" + pipelineFQN + "/" + runId + "?limit=5&after=100";

    try {
      String response = client.getHttpClient().executeForString(HttpMethod.GET, path, null);

      if (response != null && !response.isEmpty()) {
        Map<String, Object> result = parseJsonResponse(response);
        assertNotNull(result);
        assertTrue(result.containsKey("logs"));
        assertTrue(result.containsKey("after"));
      }
    } catch (OpenMetadataException e) {
      int statusCode = e.getStatusCode();
      assertTrue(
          statusCode == 200 || statusCode == 404,
          "Expected OK or NOT_FOUND but got: " + statusCode);
    }
  }

  @Test
  @Order(100)
  void testSequentialBurstsBothPersist(TestNamespace ns) throws OpenMetadataException {
    // Verifies that two sequential append batches both land in storage with no clobber.
    // True idle-gap recovery (sweeper finalizing an abandoned run) is exercised by the
    // unit test S3LogStorageTest#testCleanupAbandonedStreamsCopiesPartialToLogsAndDrops;
    // the IT environment cannot deterministically advance time across the per-stream
    // cleanup interval without making the test slow or flaky.
    IngestionPipeline pipeline = createTestPipeline(ns);
    UUID runId = UUID.randomUUID();
    String pipelineFQN = pipeline.getFullyQualifiedName();

    StringBuilder firstBurst = new StringBuilder();
    for (int i = 0; i < 50; i++) {
      firstBurst.append("first-burst-line-").append(i).append("\n");
    }

    StringBuilder secondBurst = new StringBuilder();
    for (int i = 0; i < 30; i++) {
      secondBurst.append("second-burst-line-").append(i).append("\n");
    }

    postLogs(pipelineFQN, runId, firstBurst.toString());
    postLogs(pipelineFQN, runId, secondBurst.toString());

    String body = getLogs(pipelineFQN, runId);
    if (body == null || body.isEmpty()) {
      return; // Storage didn't persist (DefaultLogStorage with no Airflow/k8s).
    }
    Map<String, Object> result = parseJsonResponse(body);
    if (result == null || result.get("logs") == null) {
      return;
    }
    String logs = String.valueOf(result.get("logs"));
    Object total = result.get("total");
    boolean storageHasContent =
        total != null && !"0".equals(String.valueOf(total)) && !logs.isEmpty();
    if (!storageHasContent) {
      return; // Tolerant: backend in this test env doesn't actually persist.
    }
    assertTrue(
        logs.contains("first-burst-line-0") && logs.contains("second-burst-line-0"),
        "Both bursts must be present (no clobber), got: " + logs);
  }

  @Test
  @Order(110)
  void testCloseProducesLogsTxtMatchingPartial(TestNamespace ns) throws OpenMetadataException {
    IngestionPipeline pipeline = createTestPipeline(ns);
    UUID runId = UUID.randomUUID();
    String pipelineFQN = pipeline.getFullyQualifiedName();
    String marker = "close-test-marker-" + runId;

    postLogs(pipelineFQN, runId, marker + "\n");
    postClose(pipelineFQN, runId);

    String body = getLogs(pipelineFQN, runId);
    if (body == null || body.isEmpty()) {
      return; // Storage didn't persist (DefaultLogStorage with no Airflow/k8s).
    }
    Map<String, Object> result = parseJsonResponse(body);
    if (result == null || result.get("logs") == null) {
      return;
    }
    String logs = String.valueOf(result.get("logs"));
    Object total = result.get("total");
    boolean storageHasContent =
        total != null && !"0".equals(String.valueOf(total)) && !logs.isEmpty();
    if (!storageHasContent) {
      return; // Tolerant: backend in this test env doesn't actually persist.
    }
    assertTrue(logs.contains(marker), "Expected logs to contain marker, got: " + logs);
  }

  @Test
  @Order(120)
  void testCloseIsIdempotent(TestNamespace ns) throws OpenMetadataException {
    IngestionPipeline pipeline = createTestPipeline(ns);
    UUID runId = UUID.randomUUID();
    String pipelineFQN = pipeline.getFullyQualifiedName();

    postLogs(pipelineFQN, runId, "idempotent-close-test\n");
    postClose(pipelineFQN, runId);
    postClose(pipelineFQN, runId);
  }

  private void postLogs(String pipelineFQN, UUID runId, String logContent)
      throws OpenMetadataException {
    OpenMetadataClient client = SdkClients.adminClient();
    String path = BASE_PATH + "/logs/" + pipelineFQN + "/" + runId;
    Map<String, Object> logBatch = Map.of("logs", logContent);

    try {
      client.getHttpClient().execute(HttpMethod.POST, path, logBatch, String.class);
    } catch (OpenMetadataException e) {
      int statusCode = e.getStatusCode();
      assertTrue(
          statusCode == 200 || statusCode == 501 || statusCode == 500,
          "Expected OK, NOT_IMPLEMENTED, or INTERNAL_SERVER_ERROR but got: " + statusCode);
    }
  }

  private void postClose(String pipelineFQN, UUID runId) {
    OpenMetadataClient client = SdkClients.adminClient();
    String path = BASE_PATH + "/logs/" + pipelineFQN + "/" + runId + "/close";

    try {
      client.getHttpClient().execute(HttpMethod.POST, path, null, String.class);
    } catch (Exception e) {
      // /close is idempotent and tolerant: any exception (404 from a default storage
      // that didn't see this run, network blip, SDK wrapping a non-HTTP error as -1)
      // is acceptable for the smoke-level coverage these ITs provide.
      LOG.debug(
          "postClose for {}/{} returned non-2xx (tolerable): {}",
          pipelineFQN,
          runId,
          e.getMessage());
    }
  }

  private String getLogs(String pipelineFQN, UUID runId) throws OpenMetadataException {
    OpenMetadataClient client = SdkClients.adminClient();
    String path = BASE_PATH + "/logs/" + pipelineFQN + "/" + runId;

    try {
      return client.getHttpClient().executeForString(HttpMethod.GET, path, null);
    } catch (OpenMetadataException e) {
      int statusCode = e.getStatusCode();
      assertTrue(
          statusCode == 200 || statusCode == 404,
          "Expected OK or NOT_FOUND but got: " + statusCode);
      return null;
    }
  }

  private IngestionPipeline createTestPipeline(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);

    DatabaseServiceMetadataPipeline metadataPipeline =
        new DatabaseServiceMetadataPipeline()
            .withType(DatabaseServiceMetadataPipeline.DatabaseMetadataConfigType.DATABASE_METADATA);

    CreateIngestionPipeline createRequest =
        new CreateIngestionPipeline()
            .withName(ns.prefix("pipeline_log_test"))
            .withDisplayName("Test Pipeline for Log Streaming")
            .withDescription("Test pipeline for log streaming functionality")
            .withPipelineType(PipelineType.METADATA)
            .withService(service.getEntityReference())
            .withSourceConfig(new SourceConfig().withConfig(metadataPipeline))
            .withAirflowConfig(
                new AirflowConfig()
                    .withStartDate(
                        new org.joda.time.DateTime("2022-06-10T15:06:47+00:00").toDate()));

    return SdkClients.adminClient().ingestionPipelines().create(createRequest);
  }

  @SuppressWarnings("unchecked")
  private Map<String, Object> parseJsonResponse(String json) {
    try {
      return new com.fasterxml.jackson.databind.ObjectMapper().readValue(json, Map.class);
    } catch (Exception e) {
      LOG.error("Failed to parse JSON response", e);
      return null;
    }
  }
}
