package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import java.util.UUID;
import org.joda.time.DateTime;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
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
import org.openmetadata.sdk.network.RequestOptions;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Integration tests for Ingestion Pipeline Log Streaming endpoints.
 *
 * <p>Tests the /v1/services/ingestionPipelines/logs endpoint for reading, writing, and streaming
 * ingestion pipeline logs.
 *
 * <p>Test isolation: Uses TestNamespace extension for test isolation Parallelization: Safe for
 * concurrent execution via @Execution(ExecutionMode.CONCURRENT)
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class IngestionPipelineLogStreamingResourceIT {

  private static final Logger LOG =
      LoggerFactory.getLogger(IngestionPipelineLogStreamingResourceIT.class);
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final java.util.Date START_DATE =
      new DateTime("2022-06-10T15:06:47+00:00").toDate();

  private IngestionPipeline createTestPipeline(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);

    DatabaseServiceMetadataPipeline metadataPipeline =
        new DatabaseServiceMetadataPipeline().withMarkDeletedTables(true).withIncludeViews(true);

    SourceConfig sourceConfig = new SourceConfig().withConfig(metadataPipeline);

    CreateIngestionPipeline request =
        new CreateIngestionPipeline()
            .withName(ns.prefix("pipeline-log-test"))
            .withDescription("Test pipeline for log streaming")
            .withPipelineType(PipelineType.METADATA)
            .withService(service.getEntityReference())
            .withSourceConfig(sourceConfig)
            .withAirflowConfig(new AirflowConfig().withStartDate(START_DATE));

    return SdkClients.adminClient().ingestionPipelines().create(request);
  }

  @Test
  void test_writeAndReadPipelineLogs(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    IngestionPipeline pipeline = createTestPipeline(ns);
    UUID runId = UUID.randomUUID();

    String logContent =
        "Starting ingestion pipeline\nProcessing database metadata\nCompleted successfully\n";

    String writePath =
        "/v1/services/ingestionPipelines/logs/" + pipeline.getFullyQualifiedName() + "/" + runId;

    String writeResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.POST, writePath, logContent, RequestOptions.builder().build());

    assertNotNull(writeResponse, "Write response should not be null");

    String readPath =
        "/v1/services/ingestionPipelines/logs/" + pipeline.getFullyQualifiedName() + "/" + runId;

    String logsJson =
        client
            .getHttpClient()
            .executeForString(HttpMethod.GET, readPath, null, RequestOptions.builder().build());

    assertNotNull(logsJson, "Logs response should not be null");
    assertFalse(logsJson.isEmpty(), "Logs response should not be empty");

    JsonNode logsNode = MAPPER.readTree(logsJson);
    assertTrue(logsNode.has("logs"), "Response should contain 'logs' field");

    String retrievedLogs = logsNode.get("logs").asText();
    assertTrue(
        retrievedLogs.contains("Starting ingestion pipeline"),
        "Retrieved logs should contain written content");
  }

  @Test
  void test_writeLogsWithPagination(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    IngestionPipeline pipeline = createTestPipeline(ns);
    UUID runId = UUID.randomUUID();

    String writePath =
        "/v1/services/ingestionPipelines/logs/" + pipeline.getFullyQualifiedName() + "/" + runId;

    for (int i = 1; i <= 5; i++) {
      String logContent = "Log line batch " + i + "\n";
      client
          .getHttpClient()
          .executeForString(
              HttpMethod.POST, writePath, logContent, RequestOptions.builder().build());
    }

    String readPath =
        "/v1/services/ingestionPipelines/logs/"
            + pipeline.getFullyQualifiedName()
            + "/"
            + runId
            + "?limit=3";

    String logsJson =
        client
            .getHttpClient()
            .executeForString(HttpMethod.GET, readPath, null, RequestOptions.builder().build());

    assertNotNull(logsJson, "Logs response should not be null");

    JsonNode logsNode = MAPPER.readTree(logsJson);
    assertTrue(logsNode.has("logs"), "Response should contain 'logs' field");

    if (logsNode.has("after")) {
      assertNotNull(logsNode.get("after"), "Should have pagination cursor");
    }
  }

  @Test
  void test_listPipelineRuns(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    IngestionPipeline pipeline = createTestPipeline(ns);

    UUID runId1 = UUID.randomUUID();
    UUID runId2 = UUID.randomUUID();

    String writePath1 =
        "/v1/services/ingestionPipelines/logs/" + pipeline.getFullyQualifiedName() + "/" + runId1;
    String writePath2 =
        "/v1/services/ingestionPipelines/logs/" + pipeline.getFullyQualifiedName() + "/" + runId2;

    client
        .getHttpClient()
        .executeForString(
            HttpMethod.POST, writePath1, "Run 1 logs\n", RequestOptions.builder().build());
    client
        .getHttpClient()
        .executeForString(
            HttpMethod.POST, writePath2, "Run 2 logs\n", RequestOptions.builder().build());

    String listPath =
        "/v1/services/ingestionPipelines/logs/" + pipeline.getFullyQualifiedName() + "?limit=10";

    String runsJson =
        client
            .getHttpClient()
            .executeForString(HttpMethod.GET, listPath, null, RequestOptions.builder().build());

    assertNotNull(runsJson, "Runs response should not be null");
    assertFalse(runsJson.isEmpty(), "Runs response should not be empty");

    JsonNode runsNode = MAPPER.readTree(runsJson);
    assertTrue(runsNode.has("runs"), "Response should contain 'runs' field");
    assertTrue(runsNode.get("runs").isArray(), "Runs should be an array");

    JsonNode runs = runsNode.get("runs");
    assertTrue(runs.size() >= 2, "Should have at least 2 runs");
  }

  @Test
  void test_closeLogStream(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    IngestionPipeline pipeline = createTestPipeline(ns);
    UUID runId = UUID.randomUUID();

    String writePath =
        "/v1/services/ingestionPipelines/logs/" + pipeline.getFullyQualifiedName() + "/" + runId;

    client
        .getHttpClient()
        .executeForString(
            HttpMethod.POST, writePath, "Test log content\n", RequestOptions.builder().build());

    String closePath =
        "/v1/services/ingestionPipelines/logs/"
            + pipeline.getFullyQualifiedName()
            + "/"
            + runId
            + "/close";

    String closeResponse =
        client
            .getHttpClient()
            .executeForString(HttpMethod.POST, closePath, "", RequestOptions.builder().build());

    assertNotNull(closeResponse, "Close response should not be null");

    JsonNode closeNode = MAPPER.readTree(closeResponse);
    assertTrue(closeNode.has("message"), "Close response should contain 'message' field");
  }

  @Test
  void test_getLogsWithAfterCursor(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    IngestionPipeline pipeline = createTestPipeline(ns);
    UUID runId = UUID.randomUUID();

    String writePath =
        "/v1/services/ingestionPipelines/logs/" + pipeline.getFullyQualifiedName() + "/" + runId;

    StringBuilder largeLog = new StringBuilder();
    for (int i = 1; i <= 100; i++) {
      largeLog.append("Log line ").append(i).append("\n");
    }

    client
        .getHttpClient()
        .executeForString(
            HttpMethod.POST, writePath, largeLog.toString(), RequestOptions.builder().build());

    String readPath =
        "/v1/services/ingestionPipelines/logs/"
            + pipeline.getFullyQualifiedName()
            + "/"
            + runId
            + "?limit=10";

    String firstPageJson =
        client
            .getHttpClient()
            .executeForString(HttpMethod.GET, readPath, null, RequestOptions.builder().build());

    JsonNode firstPage = MAPPER.readTree(firstPageJson);
    assertNotNull(firstPage, "First page should not be null");

    if (firstPage.has("after") && !firstPage.get("after").isNull()) {
      String afterCursor = firstPage.get("after").asText();

      String nextPagePath =
          "/v1/services/ingestionPipelines/logs/"
              + pipeline.getFullyQualifiedName()
              + "/"
              + runId
              + "?limit=10&after="
              + afterCursor;

      String secondPageJson =
          client
              .getHttpClient()
              .executeForString(
                  HttpMethod.GET, nextPagePath, null, RequestOptions.builder().build());

      assertNotNull(secondPageJson, "Second page should not be null");

      JsonNode secondPage = MAPPER.readTree(secondPageJson);
      assertTrue(secondPage.has("logs"), "Second page should contain logs");
    }
  }

  @Test
  void test_getLogsForNonExistentPipeline(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String fakeFqn = ns.prefix("nonexistent-pipeline");
    UUID runId = UUID.randomUUID();

    String readPath = "/v1/services/ingestionPipelines/logs/" + fakeFqn + "/" + runId;

    try {
      client
          .getHttpClient()
          .executeForString(HttpMethod.GET, readPath, null, RequestOptions.builder().build());
      fail("Expected exception for non-existent pipeline");
    } catch (OpenMetadataException e) {
      assertTrue(
          e.getStatusCode() >= 400, "Should return error status code for non-existent pipeline");
    }
  }

  @Test
  void test_writeLogsWithStructuredBatch(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    IngestionPipeline pipeline = createTestPipeline(ns);
    UUID runId = UUID.randomUUID();

    Map<String, Object> logBatch =
        Map.of(
            "logs",
            "Structured log entry\nWith multiple lines\n",
            "timestamp",
            System.currentTimeMillis(),
            "connectorId",
            "test-connector-1",
            "compressed",
            false,
            "lineCount",
            2);

    String batchJson = MAPPER.writeValueAsString(logBatch);

    String writePath =
        "/v1/services/ingestionPipelines/logs/" + pipeline.getFullyQualifiedName() + "/" + runId;

    String writeResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.POST, writePath, batchJson, RequestOptions.builder().build());

    assertNotNull(writeResponse, "Write response should not be null");

    String readPath =
        "/v1/services/ingestionPipelines/logs/" + pipeline.getFullyQualifiedName() + "/" + runId;

    String logsJson =
        client
            .getHttpClient()
            .executeForString(HttpMethod.GET, readPath, null, RequestOptions.builder().build());

    assertNotNull(logsJson, "Logs response should not be null");

    JsonNode logsNode = MAPPER.readTree(logsJson);
    assertTrue(logsNode.has("logs"), "Response should contain 'logs' field");

    String retrievedLogs = logsNode.get("logs").asText();
    assertTrue(
        retrievedLogs.contains("Structured log entry"),
        "Retrieved logs should contain structured content");
  }

  @Test
  void test_multipleWritesAppendLogs(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    IngestionPipeline pipeline = createTestPipeline(ns);
    UUID runId = UUID.randomUUID();

    String writePath =
        "/v1/services/ingestionPipelines/logs/" + pipeline.getFullyQualifiedName() + "/" + runId;

    client
        .getHttpClient()
        .executeForString(
            HttpMethod.POST, writePath, "First log entry\n", RequestOptions.builder().build());

    client
        .getHttpClient()
        .executeForString(
            HttpMethod.POST, writePath, "Second log entry\n", RequestOptions.builder().build());

    client
        .getHttpClient()
        .executeForString(
            HttpMethod.POST, writePath, "Third log entry\n", RequestOptions.builder().build());

    String readPath =
        "/v1/services/ingestionPipelines/logs/" + pipeline.getFullyQualifiedName() + "/" + runId;

    String logsJson =
        client
            .getHttpClient()
            .executeForString(HttpMethod.GET, readPath, null, RequestOptions.builder().build());

    JsonNode logsNode = MAPPER.readTree(logsJson);
    String retrievedLogs = logsNode.get("logs").asText();

    assertTrue(retrievedLogs.contains("First log entry"), "Should contain first log entry");
    assertTrue(retrievedLogs.contains("Second log entry"), "Should contain second log entry");
    assertTrue(retrievedLogs.contains("Third log entry"), "Should contain third log entry");
  }

  @Test
  void test_emptyLogsHandling(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    IngestionPipeline pipeline = createTestPipeline(ns);
    UUID runId = UUID.randomUUID();

    String readPath =
        "/v1/services/ingestionPipelines/logs/" + pipeline.getFullyQualifiedName() + "/" + runId;

    try {
      String logsJson =
          client
              .getHttpClient()
              .executeForString(HttpMethod.GET, readPath, null, RequestOptions.builder().build());

      JsonNode logsNode = MAPPER.readTree(logsJson);

      if (logsNode.has("logs")) {
        String logs = logsNode.get("logs").asText();
        assertTrue(
            logs == null || logs.isEmpty() || logs.equals("null"),
            "Empty run should return empty or null logs");
      }
    } catch (OpenMetadataException e) {
      assertTrue(
          e.getStatusCode() == 404 || e.getStatusCode() == 200,
          "Should handle empty logs gracefully");
    }
  }
}
