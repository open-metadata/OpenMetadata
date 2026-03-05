package org.openmetadata.it.tests.mcp;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.openmetadata.it.auth.JwtAuthProvider;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.services.connections.database.MysqlConnection;
import org.openmetadata.schema.services.connections.database.common.basicAuth;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.service.Entity;

public class McpIntegrationIT {

  private static final HttpClient HTTP_CLIENT =
      HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(30)).build();
  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
  private static String authToken;

  private static Table testTable;

  @BeforeAll
  static void setUp() throws Exception {
    authToken =
        "Bearer "
            + JwtAuthProvider.tokenFor(
                "admin@open-metadata.org", "admin@open-metadata.org", new String[] {"admin"}, 3600);
    createTestEntities();
  }

  private static void createTestEntities() throws Exception {
    String serviceName = "mcp_it_service_" + UUID.randomUUID().toString().substring(0, 8);
    DatabaseConnection connection =
        new DatabaseConnection()
            .withConfig(
                new MysqlConnection()
                    .withHostPort("localhost:3306")
                    .withUsername("test")
                    .withAuthType(new basicAuth().withPassword("test")));

    CreateDatabaseService createDatabaseService =
        new CreateDatabaseService()
            .withName(serviceName)
            .withServiceType(CreateDatabaseService.DatabaseServiceType.Mysql)
            .withConnection(connection);

    DatabaseService databaseService =
        post("services/databaseServices", createDatabaseService, DatabaseService.class);

    CreateDatabase createDatabase =
        new CreateDatabase()
            .withName("mcp_it_database_" + UUID.randomUUID().toString().substring(0, 8))
            .withDescription("Test database for MCP integration")
            .withService(databaseService.getFullyQualifiedName());

    Database testDatabase = post("databases", createDatabase, Database.class);

    CreateDatabaseSchema createSchema =
        new CreateDatabaseSchema()
            .withName("mcp_it_schema")
            .withDescription("Test schema for MCP integration")
            .withDatabase(testDatabase.getFullyQualifiedName());

    DatabaseSchema testSchema = post("databaseSchemas", createSchema, DatabaseSchema.class);

    List<Column> columns =
        List.of(
            new Column()
                .withName("id")
                .withDataType(ColumnDataType.BIGINT)
                .withDescription("Primary key"),
            new Column()
                .withName("name")
                .withDataType(ColumnDataType.VARCHAR)
                .withDataLength(50)
                .withDescription("Entity name"),
            new Column()
                .withName("created_at")
                .withDataType(ColumnDataType.TIMESTAMP)
                .withDescription("Creation timestamp"));

    CreateTable createTable =
        new CreateTable()
            .withName("mcp_it_table")
            .withDescription("Test table for MCP integration")
            .withDatabaseSchema(testSchema.getFullyQualifiedName())
            .withColumns(columns);

    testTable = post("tables", createTable, Table.class);
  }

  private static <T> T post(String path, Object body, Class<T> responseType) throws Exception {
    String baseUrl = TestSuiteBootstrap.getBaseUrl();
    String jsonBody = OBJECT_MAPPER.writeValueAsString(body);
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + "/api/v1/" + path))
            .header("Content-Type", "application/json")
            .header("Authorization", authToken)
            .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
            .timeout(Duration.ofSeconds(30))
            .build();
    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
    if (response.statusCode() != 200 && response.statusCode() != 201) {
      throw new RuntimeException("HTTP " + response.statusCode() + ": " + response.body());
    }
    return OBJECT_MAPPER.readValue(response.body(), responseType);
  }

  private String getMcpUrl(String path) {
    return TestSuiteBootstrap.getBaseUrl() + path;
  }

  private JsonNode executeMcpRequest(Map<String, Object> mcpRequest) throws Exception {
    String requestBody = OBJECT_MAPPER.writeValueAsString(mcpRequest);
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(getMcpUrl("/mcp")))
            .header("Content-Type", "application/json")
            .header("Accept", "application/json, text/event-stream")
            .header("Authorization", authToken)
            .POST(HttpRequest.BodyPublishers.ofString(requestBody))
            .timeout(Duration.ofSeconds(30))
            .build();

    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
    assertThat(response.statusCode()).isEqualTo(200);

    String responseBody = response.body();
    String jsonContent = extractJsonFromResponse(responseBody);
    return OBJECT_MAPPER.readTree(jsonContent);
  }

  private static String extractJsonFromResponse(String responseBody) {
    if (responseBody.startsWith("id:") || responseBody.startsWith("data:")) {
      String[] lines = responseBody.split("\n");
      for (String line : lines) {
        if (line.startsWith("data:")) {
          return line.substring(5).trim();
        }
      }
    }
    return responseBody;
  }

  @Test
  void testMcpInitialization() throws Exception {
    Map<String, Object> initRequest = McpTestUtils.createInitializeRequest();
    JsonNode responseJson = executeMcpRequest(initRequest);

    assertThat(responseJson.has("jsonrpc")).isTrue();
    assertThat(responseJson.get("jsonrpc").asText()).isEqualTo("2.0");
    assertThat(responseJson.has("result")).isTrue();

    JsonNode result = responseJson.get("result");
    assertThat(result.has("protocolVersion")).isTrue();
    assertThat(result.has("capabilities")).isTrue();
    assertThat(result.has("serverInfo")).isTrue();
  }

  @Test
  void testMcpToolsList() throws Exception {
    Map<String, Object> toolsListRequest = new HashMap<>();
    toolsListRequest.put("jsonrpc", "2.0");
    toolsListRequest.put("id", UUID.randomUUID().toString());
    toolsListRequest.put("method", "tools/list");

    JsonNode responseJson = executeMcpRequest(toolsListRequest);
    assertThat(responseJson.has("result")).isTrue();

    JsonNode result = responseJson.get("result");
    assertThat(result.has("tools")).isTrue();
    assertThat(result.get("tools").isArray()).isTrue();
    assertThat(result.get("tools").size()).isGreaterThan(0);

    boolean hasSearchTool = false;
    boolean hasGetEntityTool = false;
    for (JsonNode tool : result.get("tools")) {
      String toolName = tool.get("name").asText();
      if ("search_metadata".equals(toolName)) {
        hasSearchTool = true;
      } else if ("get_entity_details".equals(toolName)) {
        hasGetEntityTool = true;
      }
    }
    assertThat(hasSearchTool).isTrue();
    assertThat(hasGetEntityTool).isTrue();
  }

  @Test
  void testMcpPromptsList() throws Exception {
    Map<String, Object> promptsListRequest = new HashMap<>();
    promptsListRequest.put("jsonrpc", "2.0");
    promptsListRequest.put("id", UUID.randomUUID().toString());
    promptsListRequest.put("method", "prompts/list");

    JsonNode responseJson = executeMcpRequest(promptsListRequest);
    assertThat(responseJson.has("result")).isTrue();

    JsonNode result = responseJson.get("result");
    assertThat(result.has("prompts")).isTrue();
    assertThat(result.get("prompts").isArray()).isTrue();
  }

  @Test
  void testMcpToolCall() throws Exception {
    Map<String, Object> toolCallRequest =
        McpTestUtils.createSearchMetadataToolCall("test", 5, Entity.TABLE);

    JsonNode responseJson = executeMcpRequest(toolCallRequest);
    assertThat(responseJson.has("result")).isTrue();

    JsonNode result = responseJson.get("result");
    assertThat(result.has("content")).isTrue();
    assertThat(result.get("content").isArray()).isTrue();

    JsonNode content = result.get("content");
    assertThat(content.size()).isGreaterThanOrEqualTo(1);
    assertThat(content.get(0).has("type")).isTrue();
    assertThat(content.get(0).get("type").asText()).isEqualTo("text");
  }

  @Test
  @Tag("load")
  @Disabled("Load test - run manually")
  void testConcurrentToolCalls() throws Exception {
    int numberOfCalls = 100;
    CountDownLatch startLatch = new CountDownLatch(1);
    CountDownLatch completionLatch = new CountDownLatch(numberOfCalls);
    AtomicReference<Exception> firstError = new AtomicReference<>();

    for (int i = 0; i < numberOfCalls; i++) {
      final int callId = i;
      Thread.ofVirtual()
          .start(
              () -> {
                try {
                  startLatch.await();

                  Map<String, Object> toolCallRequest =
                      McpTestUtils.createSearchMetadataToolCall("test" + callId, 5, Entity.TABLE);
                  String requestBody = OBJECT_MAPPER.writeValueAsString(toolCallRequest);

                  HttpRequest request =
                      HttpRequest.newBuilder()
                          .uri(URI.create(getMcpUrl("/mcp")))
                          .header("Content-Type", "application/json")
                          .header("Accept", "application/json, text/event-stream")
                          .header("Authorization", authToken)
                          .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                          .timeout(Duration.ofSeconds(30))
                          .build();

                  HttpResponse<String> response =
                      HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
                  if (response.statusCode() == 503) {
                    // Server limit reached, acceptable
                  } else if (response.statusCode() == 200) {
                    String jsonContent = extractJsonFromResponse(response.body());
                    JsonNode responseJson = OBJECT_MAPPER.readTree(jsonContent);
                    if (!responseJson.has("result")) {
                      throw new RuntimeException("Missing result in tool call response " + callId);
                    }
                  } else {
                    throw new RuntimeException(
                        "Unexpected response code "
                            + response.statusCode()
                            + " for tool call "
                            + callId);
                  }
                } catch (Exception e) {
                  firstError.compareAndSet(null, e);
                } finally {
                  completionLatch.countDown();
                }
              });
    }

    startLatch.countDown();
    boolean allCompleted = completionLatch.await(30, TimeUnit.SECONDS);
    assertThat(allCompleted).isTrue();

    if (firstError.get() != null) {
      String errorMessage = firstError.get().getMessage();
      boolean isExpectedError =
          errorMessage.contains("503")
              || errorMessage.contains("Service unavailable")
              || errorMessage.contains("timeout");
      assertThat(isExpectedError).isTrue();
    }
  }

  @Test
  @Tag("load")
  @Disabled("Load test - run manually")
  void testComprehensiveMcpToolsLoadTest() throws Exception {
    int totalRequests = 10000;
    int concurrentConnections = 500;
    int requestsPerConnection = totalRequests / concurrentConnections;

    CountDownLatch startLatch = new CountDownLatch(1);
    CountDownLatch completionLatch = new CountDownLatch(concurrentConnections);

    AtomicReference<Exception> firstError = new AtomicReference<>();
    AtomicInteger successfulRequests = new AtomicInteger();
    AtomicInteger failedRequests = new AtomicInteger();

    for (int connectionId = 0; connectionId < concurrentConnections; connectionId++) {
      final int connId = connectionId;
      Thread.ofVirtual()
          .start(
              () -> {
                try {
                  startLatch.await();
                  for (int reqNum = 0; reqNum < requestsPerConnection; reqNum++) {
                    try {
                      Map<String, Object> toolCallRequest;
                      int toolIndex = (connId * requestsPerConnection + reqNum) % 3;
                      switch (toolIndex) {
                        case 0:
                          toolCallRequest =
                              McpTestUtils.createSearchMetadataToolCall("mcp_it", 3, Entity.TABLE);
                          break;
                        case 1:
                          toolCallRequest =
                              McpTestUtils.createGetEntityToolCall(
                                  "table", testTable.getFullyQualifiedName());
                          break;
                        default:
                          toolCallRequest =
                              McpTestUtils.createGetLineageToolCall(
                                  "table", testTable.getFullyQualifiedName(), 2, 2);
                          break;
                      }

                      String requestBody = OBJECT_MAPPER.writeValueAsString(toolCallRequest);
                      HttpRequest request =
                          HttpRequest.newBuilder()
                              .uri(URI.create(getMcpUrl("/mcp")))
                              .header("Content-Type", "application/json")
                              .header("Accept", "application/json, text/event-stream")
                              .header("Authorization", authToken)
                              .POST(HttpRequest.BodyPublishers.ofString(requestBody))
                              .timeout(Duration.ofSeconds(60))
                              .build();

                      HttpResponse<String> response =
                          HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
                      if (response.statusCode() == 200) {
                        successfulRequests.incrementAndGet();
                      } else {
                        failedRequests.incrementAndGet();
                      }
                      Thread.sleep(10);
                    } catch (Exception e) {
                      failedRequests.incrementAndGet();
                      firstError.compareAndSet(null, e);
                    }
                  }
                } catch (Exception e) {
                  failedRequests.addAndGet(requestsPerConnection);
                  firstError.compareAndSet(null, e);
                } finally {
                  completionLatch.countDown();
                }
              });
    }

    startLatch.countDown();
    boolean allCompleted = completionLatch.await(10, TimeUnit.MINUTES);

    assertThat(allCompleted).isTrue();
    assertThat(successfulRequests.get()).isGreaterThan(totalRequests / 2);
  }
}
