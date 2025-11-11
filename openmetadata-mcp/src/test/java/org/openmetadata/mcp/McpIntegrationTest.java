package org.openmetadata.mcp;

import static org.assertj.core.api.Assertions.assertThat;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.dropwizard.testing.ConfigOverride;
import io.dropwizard.testing.ResourceHelpers;
import io.dropwizard.testing.junit5.DropwizardAppExtension;
import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.sse.EventSource;
import okhttp3.sse.EventSourceListener;
import okhttp3.sse.EventSources;
import org.jetbrains.annotations.NotNull;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.data.CreateDatabase;
import org.openmetadata.schema.api.data.CreateDatabaseSchema;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.auth.LoginRequest;
import org.openmetadata.schema.auth.ServiceTokenType;
import org.openmetadata.schema.entity.app.AppSchedule;
import org.openmetadata.schema.entity.app.CreateApp;
import org.openmetadata.schema.entity.app.ScheduleTimeline;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplication;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.auth.JwtResponse;
import org.openmetadata.service.jdbi3.AppRepository;
import org.openmetadata.service.resources.glossary.GlossaryResourceTest;
import org.openmetadata.service.security.jwt.JWTTokenGenerator;
import org.openmetadata.service.util.TestUtils;

public class McpIntegrationTest extends OpenMetadataApplicationTest {

  private static String CONFIG_PATH_OVERRIDE =
      ResourceHelpers.resourceFilePath("test-config-mcp.yaml");

  private OkHttpClient client;
  private ObjectMapper objectMapper;
  private String authToken;

  // Test entities for load testing
  private static User testUser;
  private static String testUserToken;
  private static Table testTable;
  private static Database testDatabase;
  private static DatabaseSchema testSchema;
  private static DatabaseService testDatabaseService;

  @Override
  @NotNull
  protected DropwizardAppExtension<OpenMetadataApplicationConfig> getApp(
      ConfigOverride[] configOverridesArray) {
    return new DropwizardAppExtension<>(
        OpenMetadataApplication.class, CONFIG_PATH_OVERRIDE, configOverridesArray);
  }

  @BeforeAll
  void setUp() throws Exception {
    client =
        new OkHttpClient.Builder()
            .connectTimeout(10, TimeUnit.SECONDS)
            .readTimeout(10, TimeUnit.SECONDS)
            .writeTimeout(10, TimeUnit.SECONDS)
            .build();
    objectMapper = new ObjectMapper();
    OpenMetadataApplicationConfig config = APP.getConfiguration();
    try {
      User adminUser =
          new User().withName("admin").withEmail("admin@open-metadata.org").withIsAdmin(true);
      JWTTokenGenerator.getInstance()
          .init(
              config.getAuthenticationConfiguration().getTokenValidationAlgorithm(),
              config.getJwtTokenConfiguration());
      JWTAuthMechanism jwtAuthMechanism =
          JWTTokenGenerator.getInstance()
              .generateJWTToken(
                  adminUser.getName(),
                  null,
                  adminUser.getIsAdmin(),
                  adminUser.getEmail(),
                  3600,
                  false,
                  ServiceTokenType.OM_USER);
      authToken = "Bearer " + jwtAuthMechanism.getJWTToken();
    } catch (Exception e) {
      throw new RuntimeException("Failed to generate auth token", e);
    }
    createTestEntities();
    installMcpApplication();
  }

  @AfterAll
  void tearDown() throws Exception {
    if (client != null) {
      client.dispatcher().executorService().shutdown();
      client.connectionPool().evictAll();
      if (client.cache() != null) {
        client.cache().close();
      }
    }

    // Give some time for resources to clean up
    Thread.sleep(500);
  }

  private void createTestEntities() throws Exception {
    System.out.println("Creating test entities for MCP integration test...");
    createTestUser();
    createTestDatabaseEntities();
    System.out.println("✓ Test entities created successfully");
  }

  private void createTestUser() {
    try {
      String userName = "mcp-integration-user-" + UUID.randomUUID().toString().substring(0, 8);
      String userEmail = userName + "@openmetadata.org";
      String password = "McpIntegration@1234";

      CreateUser createUser =
          new CreateUser()
              .withName(userName)
              .withDisplayName("MCP Integration Test User")
              .withEmail(userEmail)
              .withIsAdmin(true)
              .withIsBot(false)
              .withDescription("Test user for MCP integration testing")
              .withCreatePasswordType(CreateUser.CreatePasswordType.ADMIN_CREATE)
              .withPassword(password)
              .withConfirmPassword(password);

      testUser =
          TestUtils.post(getResource("users"), createUser, User.class, 201, ADMIN_AUTH_HEADERS);

      LoginRequest loginRequest =
          new LoginRequest().withEmail(userEmail).withPassword(encodePassword(password));

      JwtResponse jwtResponse =
          TestUtils.post(
              getResource("users/login"), loginRequest, JwtResponse.class, 200, ADMIN_AUTH_HEADERS);

      testUserToken = "Bearer " + jwtResponse.getAccessToken();

      System.out.println("✓ Created test user: " + testUser.getName());
    } catch (Exception e) {
      throw new RuntimeException("Failed to create test user", e);
    }
  }

  private void createTestDatabaseEntities() {
    try {
      // Create test database service
      String serviceName =
          "mcp_integration_service_" + UUID.randomUUID().toString().substring(0, 8);
      CreateDatabaseService createDatabaseService =
          new CreateDatabaseService()
              .withName(serviceName)
              .withServiceType(CreateDatabaseService.DatabaseServiceType.Mysql)
              .withConnection(TestUtils.MYSQL_DATABASE_CONNECTION);

      testDatabaseService =
          TestUtils.post(
              getResource("services/databaseServices"),
              createDatabaseService,
              DatabaseService.class,
              201,
              ADMIN_AUTH_HEADERS);

      // Create test database
      CreateDatabase createDatabase =
          new CreateDatabase()
              .withName("mcp_integration_database_" + UUID.randomUUID().toString().substring(0, 8))
              .withDescription("Test database for MCP integration")
              .withService(testDatabaseService.getFullyQualifiedName());

      testDatabase =
          TestUtils.post(
              getResource("databases"), createDatabase, Database.class, 201, ADMIN_AUTH_HEADERS);

      // Create test database schema
      CreateDatabaseSchema createSchema =
          new CreateDatabaseSchema()
              .withName("mcp_integration_schema")
              .withDescription("Test schema for MCP integration")
              .withDatabase(testDatabase.getFullyQualifiedName());

      testSchema =
          TestUtils.post(
              getResource("databaseSchemas"),
              createSchema,
              DatabaseSchema.class,
              201,
              ADMIN_AUTH_HEADERS);

      // Create test table with columns
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
              .withName("mcp_integration_table")
              .withDescription("Test table for MCP integration")
              .withDatabaseSchema(testSchema.getFullyQualifiedName())
              .withColumns(columns);

      testTable =
          TestUtils.post(getResource("tables"), createTable, Table.class, 201, ADMIN_AUTH_HEADERS);

      System.out.println(
          "✓ Created test database service and entities: " + testTable.getFullyQualifiedName());
    } catch (Exception e) {
      throw new RuntimeException("Failed to create test database entities", e);
    }
  }

  private String encodePassword(String password) {
    return Base64.getEncoder().encodeToString(password.getBytes());
  }

  private boolean validateToolResponse(
      JsonNode responseJson, String toolType, String expectedData) {
    try {
      if (!responseJson.has("result")) {
        return false;
      }

      JsonNode result = responseJson.get("result");
      if (!result.has("content") || !result.get("content").isArray()) {
        return false;
      }

      JsonNode content = result.get("content");
      if (content.size() == 0) {
        return false;
      }

      JsonNode firstResult = content.get(0);
      if (!firstResult.has("text")) {
        return false;
      }

      String responseText = firstResult.get("text").asText();

      // Basic validation based on tool type
      switch (toolType) {
        case "search_metadata":
        case "search_metadata_users":
          JsonNode searchResults = objectMapper.readTree(responseText);
          return searchResults.has("data") && searchResults.get("data").isArray();

        case "get_entity_details":
          JsonNode entityData = objectMapper.readTree(responseText);
          return entityData.has("id")
              && entityData.has("name")
              && entityData.has("fullyQualifiedName")
              && entityData.get("fullyQualifiedName").asText().equals(expectedData);

        case "create_glossary":
          JsonNode glossaryData = objectMapper.readTree(responseText);
          return glossaryData.has("id")
              && glossaryData.has("name")
              && glossaryData.has("fullyQualifiedName");

        case "create_glossary_term":
          JsonNode termData = objectMapper.readTree(responseText);
          return termData.has("id") && termData.has("name") && termData.has("glossary");

        case "patch_entity":
          JsonNode patchedData = objectMapper.readTree(responseText);
          return patchedData.has("id") && patchedData.has("description");

        case "get_entity_lineage":
          JsonNode lineageData = objectMapper.readTree(responseText);
          return lineageData.has("entity")
              && lineageData.has("nodes")
              && lineageData.has("upstreamEdges")
              && lineageData.has("downstreamEdges");

        default:
          return true; // Basic content validation passed
      }
    } catch (Exception e) {
      System.err.println("Response validation error for " + toolType + ": " + e.getMessage());
      return false;
    }
  }

  private String getMcpUrl(String path) {
    return String.format("http://localhost:%d%s", APP.getLocalPort(), path);
  }

  private void installMcpApplication() throws Exception {
    // Check if McpApplication already exists
    AppRepository appRepository = (AppRepository) Entity.getEntityRepository(Entity.APPLICATION);
    try {
      appRepository.getByName(null, "McpApplication", appRepository.getFields("id"));
    } catch (Exception e) {
      Map<String, Object> appConfig = new HashMap<>();
      appConfig.put("originValidationEnabled", false);
      appConfig.put("originHeaderUri", "http://localhost:" + APP.getLocalPort());

      CreateApp createApp =
          new CreateApp()
              .withName("McpApplication")
              .withAppConfiguration(appConfig)
              .withAppSchedule(new AppSchedule().withScheduleTimeline(ScheduleTimeline.HOURLY));

      WebTarget installTarget = getResource("apps");
      Response createResponse =
          installTarget
              .request(MediaType.APPLICATION_JSON)
              .header("Authorization", authToken)
              .post(jakarta.ws.rs.client.Entity.json(createApp));

      if (createResponse.getStatus() != 201 && createResponse.getStatus() != 409) {
        throw new RuntimeException(
            "Failed to create McpApplication: " + createResponse.getStatus());
      }
      Thread.sleep(2000);
    }
  }

  @Test
  void testMcpInitialization() throws Exception {
    Map<String, Object> initRequest = McpTestUtils.createInitializeRequest();
    String requestBody = objectMapper.writeValueAsString(initRequest);

    okhttp3.RequestBody body =
        okhttp3.RequestBody.create(requestBody, okhttp3.MediaType.parse("application/json"));

    Request request =
        new Request.Builder()
            .url(getMcpUrl("/mcp"))
            .header("Accept", "application/json, text/event-stream")
            .header("Authorization", authToken)
            .post(body)
            .build();

    try (okhttp3.Response response = client.newCall(request).execute()) {
      assertThat(response.code()).isEqualTo(200);
      assertThat(response.body()).isNotNull();

      String responseBody = response.body().string();
      JsonNode responseJson = objectMapper.readTree(responseBody);

      assertThat(responseJson.has("jsonrpc")).isTrue();
      assertThat(responseJson.get("jsonrpc").asText()).isEqualTo("2.0");
      assertThat(responseJson.has("result")).isTrue();

      JsonNode result = responseJson.get("result");
      assertThat(result.has("protocolVersion")).isTrue();
      assertThat(result.has("capabilities")).isTrue();
      assertThat(result.has("serverInfo")).isTrue();
      // No session ID should be present in stateless mode
      String sessionId = response.header("Mcp-Session-Id");
      assertThat(sessionId).isNull();
    }
  }

  @Test
  void testMcpToolsList() throws Exception {
    // Test tools/list in stateless mode
    Map<String, Object> toolsListRequest = new HashMap<>();
    toolsListRequest.put("jsonrpc", "2.0");
    toolsListRequest.put("id", UUID.randomUUID().toString());
    toolsListRequest.put("method", "tools/list");

    String requestBody = objectMapper.writeValueAsString(toolsListRequest);

    okhttp3.RequestBody body =
        okhttp3.RequestBody.create(requestBody, okhttp3.MediaType.parse("application/json"));

    Request request =
        new Request.Builder()
            .url(getMcpUrl("/mcp"))
            .header("Accept", "application/json, text/event-stream")
            .header("Authorization", authToken)
            .post(body)
            .build();

    try (okhttp3.Response response = client.newCall(request).execute()) {
      assertThat(response.code()).isEqualTo(200);

      assert response.body() != null;
      String responseBody = response.body().string();

      // Handle SSE response format if present
      String jsonContent = responseBody;
      if (responseBody.startsWith("id:") || responseBody.startsWith("data:")) {
        // Extract JSON from SSE format
        String[] lines = responseBody.split("\n");
        for (String line : lines) {
          if (line.startsWith("data:")) {
            jsonContent = line.substring(5).trim();
            break;
          }
        }
      }

      JsonNode responseJson = objectMapper.readTree(jsonContent);
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
  }

  @Test
  void testMcpPromptsList() throws Exception {
    // Test prompts/list in stateless mode
    Map<String, Object> promptsListRequest = new HashMap<>();
    promptsListRequest.put("jsonrpc", "2.0");
    promptsListRequest.put("id", UUID.randomUUID().toString());
    promptsListRequest.put("method", "prompts/list");

    String requestBody = objectMapper.writeValueAsString(promptsListRequest);

    okhttp3.RequestBody body =
        okhttp3.RequestBody.create(requestBody, okhttp3.MediaType.parse("application/json"));

    Request request =
        new Request.Builder()
            .url(getMcpUrl("/mcp"))
            .header("Accept", "application/json, text/event-stream")
            .header("Authorization", authToken)
            .post(body)
            .build();

    try (okhttp3.Response response = client.newCall(request).execute()) {
      assertThat(response.code()).isEqualTo(200);

      assert response.body() != null;
      String responseBody = response.body().string();

      // Handle SSE response format if present
      String jsonContent = responseBody;
      if (responseBody.startsWith("id:") || responseBody.startsWith("data:")) {
        // Extract JSON from SSE format
        String[] lines = responseBody.split("\n");
        for (String line : lines) {
          if (line.startsWith("data:")) {
            jsonContent = line.substring(5).trim();
            break;
          }
        }
      }

      JsonNode responseJson = objectMapper.readTree(jsonContent);
      assertThat(responseJson.has("result")).isTrue();

      JsonNode result = responseJson.get("result");
      assertThat(result.has("prompts")).isTrue();
      assertThat(result.get("prompts").isArray()).isTrue();
    }
  }

  // test passes but server doesn't close cleanly
  void testMcpSseConnection() throws Exception {
    CountDownLatch connectionLatch = new CountDownLatch(1);
    CountDownLatch closeLatch = new CountDownLatch(1);
    AtomicReference<String> endpointUrl = new AtomicReference<>();
    AtomicReference<EventSource> eventSourceRef = new AtomicReference<>();

    Request request =
        new Request.Builder()
            .url(getMcpUrl("/mcp/sse"))
            .header("Accept", "text/event-stream")
            .header("Authorization", authToken)
            .build();

    EventSourceListener listener =
        new EventSourceListener() {
          @Override
          public void onOpen(@NotNull EventSource eventSource, @NotNull okhttp3.Response response) {
            eventSourceRef.set(eventSource);
          }

          @Override
          public void onEvent(EventSource eventSource, String id, String type, String data) {
            if ("endpoint".equals(type)) {
              endpointUrl.set(data);
              connectionLatch.countDown();
              eventSource.cancel();
            }
          }

          @Override
          public void onFailure(
              @NotNull EventSource eventSource, Throwable t, okhttp3.Response response) {
            connectionLatch.countDown();
            closeLatch.countDown();
          }

          @Override
          public void onClosed(@NotNull EventSource eventSource) {
            closeLatch.countDown();
          }
        };
    EventSource eventSource = EventSources.createFactory(client).newEventSource(request, listener);

    try {
      assertThat(connectionLatch.await(5, TimeUnit.SECONDS)).isTrue();
      assertThat(endpointUrl.get()).isNotNull();
      assertThat(endpointUrl.get()).contains("/mcp/messages?sessionId=");
      EventSource es = eventSourceRef.get();
      if (es != null) {
        es.cancel();
      }
    } finally {
      eventSource.cancel();
    }
  }

  @Test
  void testMcpToolCall() throws Exception {
    // Test stateless tool call
    Map<String, Object> toolCallRequest =
        McpTestUtils.createSearchMetadataToolCall("test", 5, Entity.TABLE);
    String requestBody = objectMapper.writeValueAsString(toolCallRequest);

    okhttp3.RequestBody body =
        okhttp3.RequestBody.create(requestBody, okhttp3.MediaType.parse("application/json"));

    Request request =
        new Request.Builder()
            .url(getMcpUrl("/mcp"))
            .header("Accept", "application/json, text/event-stream")
            .header("Authorization", authToken)
            .post(body)
            .build();

    // When
    try (okhttp3.Response response = client.newCall(request).execute()) {
      // Then
      assertThat(response.code()).isEqualTo(200);

      String responseBody = response.body().string();

      // Handle SSE response format if present
      String jsonContent = responseBody;
      if (responseBody.startsWith("id:") || responseBody.startsWith("data:")) {
        // Extract JSON from SSE format
        String[] lines = responseBody.split("\n");
        for (String line : lines) {
          if (line.startsWith("data:")) {
            jsonContent = line.substring(5).trim();
            break;
          }
        }
      }

      JsonNode responseJson = objectMapper.readTree(jsonContent);
      assertThat(responseJson.has("result")).isTrue();

      JsonNode result = responseJson.get("result");
      assertThat(result.has("content")).isTrue();
      assertThat(result.get("content").isArray()).isTrue();

      // The search result should contain at least one content item
      JsonNode content = result.get("content");
      assertThat(content.size()).isGreaterThanOrEqualTo(1);
      assertThat(content.get(0).has("type")).isTrue();
      assertThat(content.get(0).get("type").asText()).isEqualTo("text");
    }
  }

  @Test
  void testConcurrentStreamableHttpConnections() throws Exception {
    int numberOfConnections = 500;
    CountDownLatch startLatch = new CountDownLatch(1);
    CountDownLatch completionLatch = new CountDownLatch(numberOfConnections);
    AtomicReference<Exception> firstError = new AtomicReference<>();

    // Create a separate client for concurrent testing with increased timeouts
    OkHttpClient concurrentClient =
        new OkHttpClient.Builder()
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(30, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .build();

    // Create concurrent requests
    for (int i = 0; i < numberOfConnections; i++) {
      final int requestId = i;
      Thread.ofVirtual()
          .start(
              () -> {
                try {
                  // Wait for all threads to be ready
                  startLatch.await();

                  // Make a stateless tool call (no session needed)
                  Map<String, Object> toolCallRequest =
                      McpTestUtils.createSearchMetadataToolCall(
                          "test" + requestId, 3, Entity.TABLE);
                  String toolRequestBody = objectMapper.writeValueAsString(toolCallRequest);

                  okhttp3.RequestBody toolBody =
                      okhttp3.RequestBody.create(
                          toolRequestBody, okhttp3.MediaType.parse("application/json"));

                  Request toolReq =
                      new Request.Builder()
                          .url(getMcpUrl("/mcp"))
                          .header("Accept", "application/json, text/event-stream")
                          .header("Authorization", authToken)
                          .post(toolBody)
                          .build();

                  try (okhttp3.Response toolResponse =
                      concurrentClient.newCall(toolReq).execute()) {
                    if (toolResponse.code() == 503) {
                      System.out.println(
                          "Request " + requestId + " tool call hit server limit (503)");
                    } else if (toolResponse.code() == 200) {
                      String responseBody = toolResponse.body().string();

                      // Handle SSE response format if present
                      String jsonContent = responseBody;
                      if (responseBody.startsWith("id:") || responseBody.startsWith("data:")) {
                        String[] lines = responseBody.split("\n");
                        for (String line : lines) {
                          if (line.startsWith("data:")) {
                            jsonContent = line.substring(5).trim();
                            break;
                          }
                        }
                      }

                      JsonNode responseJson = objectMapper.readTree(jsonContent);
                      if (!responseJson.has("result")) {
                        throw new RuntimeException(
                            "Missing result in tool call response for request " + requestId);
                      }

                      System.out.println(
                          "Request " + requestId + " tool call completed successfully");
                    } else {
                      throw new RuntimeException(
                          "Unexpected tool call response code "
                              + toolResponse.code()
                              + " for request "
                              + requestId);
                    }
                  }
                } catch (Exception e) {
                  firstError.compareAndSet(null, e);
                  System.err.println("Request " + requestId + " failed: " + e.getMessage());
                } finally {
                  completionLatch.countDown();
                }
              });
    }

    // Start all requests simultaneously
    System.out.println(
        "Starting " + numberOfConnections + " concurrent connections with tool calls...");
    long startTime = System.currentTimeMillis();
    startLatch.countDown();

    // Wait for all requests to complete (with timeout)
    boolean allCompleted =
        completionLatch.await(90, TimeUnit.SECONDS); // Increased timeout for tool calls
    long duration = System.currentTimeMillis() - startTime;

    System.out.println("Test completed in " + duration + "ms");
    System.out.println("All requests completed: " + allCompleted);

    // Clean up
    concurrentClient.dispatcher().executorService().shutdown();
    concurrentClient.connectionPool().evictAll();

    // Assert results
    assertThat(allCompleted).isTrue();

    // If there was an error, it should be a connection limit error (503) or timeout, not a server
    // crash
    if (firstError.get() != null) {
      String errorMessage = firstError.get().getMessage();
      boolean isExpectedError =
          errorMessage.contains("503")
              || errorMessage.contains("Service unavailable")
              || errorMessage.contains("timeout")
              || errorMessage.contains("connection limit");
      assertThat(isExpectedError).isTrue();
    }
  }

  @Test
  void testConcurrentToolCalls() throws Exception {
    int numberOfCalls = 100;
    CountDownLatch startLatch = new CountDownLatch(1);
    CountDownLatch completionLatch = new CountDownLatch(numberOfCalls);
    AtomicReference<Exception> firstError = new AtomicReference<>();

    // Create concurrent stateless tool calls
    for (int i = 0; i < numberOfCalls; i++) {
      final int callId = i;
      Thread.ofVirtual()
          .start(
              () -> {
                try {
                  startLatch.await();

                  Map<String, Object> toolCallRequest =
                      McpTestUtils.createSearchMetadataToolCall("test" + callId, 5, Entity.TABLE);
                  String requestBody = objectMapper.writeValueAsString(toolCallRequest);

                  okhttp3.RequestBody body =
                      okhttp3.RequestBody.create(
                          requestBody, okhttp3.MediaType.parse("application/json"));

                  Request request =
                      new Request.Builder()
                          .url(getMcpUrl("/mcp"))
                          .header("Accept", "application/json, text/event-stream")
                          .header("Authorization", authToken)
                          .post(body)
                          .build();

                  try (okhttp3.Response response = client.newCall(request).execute()) {
                    if (response.code() == 503) {
                      System.out.println("Tool call " + callId + " hit server limit (503)");
                    } else if (response.code() == 200) {
                      String responseBody = response.body().string();

                      // Handle SSE response format if present
                      String jsonContent = responseBody;
                      if (responseBody.startsWith("id:") || responseBody.startsWith("data:")) {
                        String[] lines = responseBody.split("\n");
                        for (String line : lines) {
                          if (line.startsWith("data:")) {
                            jsonContent = line.substring(5).trim();
                            break;
                          }
                        }
                      }

                      JsonNode responseJson = objectMapper.readTree(jsonContent);
                      if (!responseJson.has("result")) {
                        throw new RuntimeException(
                            "Missing result in tool call response " + callId);
                      }

                      System.out.println("Tool call " + callId + " completed successfully");
                    } else {
                      throw new RuntimeException(
                          "Unexpected response code "
                              + response.code()
                              + " for tool call "
                              + callId);
                    }
                  }
                } catch (Exception e) {
                  firstError.compareAndSet(null, e);
                  System.err.println("Tool call " + callId + " failed: " + e.getMessage());
                } finally {
                  completionLatch.countDown();
                }
              });
    }

    System.out.println("Starting " + numberOfCalls + " concurrent tool calls...");
    long startTime = System.currentTimeMillis();
    startLatch.countDown();

    boolean allCompleted = completionLatch.await(30, TimeUnit.SECONDS);
    long duration = System.currentTimeMillis() - startTime;

    System.out.println("Tool calls test completed in " + duration + "ms");
    System.out.println("All tool calls completed: " + allCompleted);

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
  void testComprehensiveMcpToolsLoadTest() throws Exception {
    // Test configuration: 10,000 total requests with 500 concurrent connections
    int totalRequests = 10000;
    int concurrentConnections = 500;
    int requestsPerConnection = totalRequests / concurrentConnections;

    GlossaryResourceTest glossaryResourceTest = new GlossaryResourceTest();

    System.out.println("Starting comprehensive MCP tools load test:");
    System.out.println("- Total requests: " + totalRequests);
    System.out.println("- Concurrent connections: " + concurrentConnections);
    System.out.println("- Requests per connection: " + requestsPerConnection);

    CountDownLatch startLatch = new CountDownLatch(1);
    CountDownLatch completionLatch = new CountDownLatch(concurrentConnections);

    // Track statistics
    AtomicReference<Exception> firstError = new AtomicReference<>();
    AtomicInteger successfulRequests = new AtomicInteger();
    AtomicInteger failedRequests = new AtomicInteger();
    AtomicInteger validatedResponses = new AtomicInteger();
    AtomicInteger searchMetadataCount = new AtomicInteger();
    AtomicInteger getEntityCount = new AtomicInteger();
    AtomicInteger createGlossaryCount = new AtomicInteger();
    AtomicInteger createTermCount = new AtomicInteger();
    AtomicInteger patchEntityCount = new AtomicInteger();
    AtomicInteger getLineageCount = new AtomicInteger();

    // Create a separate client for load testing
    OkHttpClient loadTestClient =
        new OkHttpClient.Builder()
            .connectTimeout(60, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .writeTimeout(60, TimeUnit.SECONDS)
            .connectionPool(new okhttp3.ConnectionPool(600, 5, TimeUnit.MINUTES))
            .dispatcher(
                new okhttp3.Dispatcher(java.util.concurrent.Executors.newFixedThreadPool(600)))
            .build();

    // Create concurrent connections
    for (int connectionId = 0; connectionId < concurrentConnections; connectionId++) {
      final int connId = connectionId;
      Thread.ofVirtual()
          .start(
              () -> {
                try {
                  startLatch.await();

                  // Create glossary first (used by other operations) - stateless mode
                  String testGlossaryName = "LoadTestGlossary" + connId;
                  try {
                    glossaryResourceTest.getEntityByName(testGlossaryName, ADMIN_AUTH_HEADERS);
                  } catch (Exception ex) {
                    glossaryResourceTest.createEntity(
                        glossaryResourceTest.createRequest(testGlossaryName), ADMIN_AUTH_HEADERS);
                  }

                  boolean glossaryCreated = false;

                  try {
                    Map<String, Object> createGlossaryRequest =
                        McpTestUtils.createGlossaryToolCall(
                            testGlossaryName, "Load test glossary for connection " + connId);

                    if (executeToolCallWithClient(loadTestClient, createGlossaryRequest)) {
                      glossaryCreated = true;
                      createGlossaryCount.incrementAndGet();
                      successfulRequests.incrementAndGet();
                    } else {
                      failedRequests.incrementAndGet();
                    }
                  } catch (Exception e) {
                    failedRequests.incrementAndGet();
                  }

                  // Execute requests for this connection
                  for (int reqNum = 0; reqNum < requestsPerConnection; reqNum++) {
                    try {
                      Map<String, Object> toolCallRequest = null;
                      String toolType = "";

                      // Round-robin through different tools
                      int toolIndex = (connId * requestsPerConnection + reqNum) % 6;

                      switch (toolIndex) {
                        case 0: // search_metadata
                          toolCallRequest =
                              McpTestUtils.createSearchMetadataToolCall(
                                  "mcp_integration", 3, Entity.TABLE);
                          toolType = "search_metadata";
                          break;
                        case 1: // get_entity_details (use our test table)
                          toolCallRequest =
                              McpTestUtils.createGetEntityToolCall(
                                  "table", testTable.getFullyQualifiedName());
                          toolType = "get_entity_details";
                          break;
                        case 2: // create_glossary_term (only if glossary was created)
                          if (glossaryCreated) {
                            toolCallRequest =
                                McpTestUtils.createGlossaryTermToolCall(
                                    testGlossaryName,
                                    "TestTerm" + reqNum,
                                    "Test term " + reqNum + " for load testing");
                            toolType = "create_glossary_term";
                          } else {
                            // Fallback to search if glossary creation failed
                            toolCallRequest =
                                McpTestUtils.createSearchMetadataToolCall(
                                    "loadtest_fallback" + connId + "_" + reqNum, 3, Entity.TABLE);
                            toolType = "search_metadata";
                          }
                          break;
                        case 3: // patch_entity (try to patch our test table)
                          String patchJson =
                              "[{\"op\": \"add\", \"path\": \"/description\", \"value\": \"Load test description "
                                  + connId
                                  + "_"
                                  + reqNum
                                  + "\"}]";
                          toolCallRequest =
                              McpTestUtils.createPatchEntityToolCall(
                                  "table", testTable.getFullyQualifiedName(), patchJson);
                          toolType = "patch_entity";
                          break;
                        case 4: // get_entity_lineage (use our test table)
                          toolCallRequest =
                              McpTestUtils.createGetLineageToolCall(
                                  "table", testTable.getFullyQualifiedName(), 2, 2);
                          toolType = "get_entity_lineage";
                          break;
                        case 5: // Search for our test user
                          toolCallRequest =
                              McpTestUtils.createSearchMetadataToolCall(
                                  testUser.getName(), 5, Entity.USER);
                          toolType = "search_metadata_users";
                          break;
                      }

                      if (toolCallRequest != null) {
                        String expectedData = null;

                        // Determine expected data for validation
                        if ("get_entity_details".equals(toolType)
                            || "get_entity_lineage".equals(toolType)) {
                          expectedData = testTable.getFullyQualifiedName();
                        } else if ("search_metadata_users".equals(toolType)) {
                          expectedData = testUser.getName();
                        }

                        if (executeToolCallWithClient(
                            loadTestClient, toolCallRequest, toolType, expectedData)) {
                          successfulRequests.incrementAndGet();
                          validatedResponses.incrementAndGet();

                          // Track tool usage
                          switch (toolType) {
                            case "search_metadata":
                            case "search_metadata_users":
                              searchMetadataCount.incrementAndGet();
                              break;
                            case "get_entity_details":
                              getEntityCount.incrementAndGet();
                              break;
                            case "create_glossary_term":
                              createTermCount.incrementAndGet();
                              break;
                            case "patch_entity":
                              patchEntityCount.incrementAndGet();
                              break;
                            case "get_entity_lineage":
                              getLineageCount.incrementAndGet();
                              break;
                            default:
                              System.err.println("Unknown tool type: " + toolType);
                              break;
                          }
                        } else {
                          failedRequests.incrementAndGet();
                        }
                      } else {
                        failedRequests.incrementAndGet();
                      }

                      // Small delay between requests to avoid overwhelming
                      Thread.sleep(10);

                    } catch (Exception e) {
                      failedRequests.incrementAndGet();
                      if (firstError.compareAndSet(null, e)) {
                        System.err.println(
                            "First error in connection "
                                + connId
                                + ", request "
                                + reqNum
                                + ": "
                                + e.getMessage());
                      }
                    }
                  }

                } catch (Exception e) {
                  failedRequests.addAndGet(requestsPerConnection);
                  if (firstError.compareAndSet(null, e)) {
                    System.err.println("Connection " + connId + " failed: " + e.getMessage());
                  }
                } finally {
                  completionLatch.countDown();
                }
              });
    }

    // Start the load test
    long startTime = System.currentTimeMillis();
    System.out.println("Starting load test at " + new java.util.Date());
    startLatch.countDown();

    // Wait for completion with extended timeout
    boolean allCompleted = completionLatch.await(10, TimeUnit.MINUTES);
    long duration = System.currentTimeMillis() - startTime;

    // Print results
    System.out.println("\n=== LOAD TEST RESULTS ===");
    System.out.println("Test completed: " + allCompleted);
    System.out.println("Total duration: " + duration + "ms (" + (duration / 1000.0) + " seconds)");
    System.out.println("Successful requests: " + successfulRequests.get());
    System.out.println("Failed requests: " + failedRequests.get());
    System.out.println("Validated responses: " + validatedResponses.get());
    System.out.println(
        "Success rate: "
            + (100.0 * successfulRequests.get() / (successfulRequests.get() + failedRequests.get()))
            + "%");
    System.out.println(
        "Validation rate: " + (100.0 * validatedResponses.get() / successfulRequests.get()) + "%");
    System.out.println("Average requests per second: " + (totalRequests * 1000.0 / duration));

    System.out.println("\n=== TOOL USAGE BREAKDOWN ===");
    System.out.println("search_metadata calls: " + searchMetadataCount.get());
    System.out.println("get_entity_details calls: " + getEntityCount.get());
    System.out.println("create_glossary calls: " + createGlossaryCount.get());
    System.out.println("create_glossary_term calls: " + createTermCount.get());
    System.out.println("patch_entity calls: " + patchEntityCount.get());
    System.out.println("get_entity_lineage calls: " + getLineageCount.get());

    // Clean up
    loadTestClient.dispatcher().executorService().shutdown();
    loadTestClient.connectionPool().evictAll();

    // Assert results
    assertThat(allCompleted).isTrue();
    assertThat(successfulRequests.get())
        .isGreaterThan(totalRequests / 2); // At least 50% success rate
    assertThat(validatedResponses.get())
        .isGreaterThan(
            successfulRequests.get()
                / 4); // At least 25% of successful requests are properly validated

    // Verify most tools were tested (some may fail in load test conditions)
    int toolsTested = 0;
    if (searchMetadataCount.get() > 0) toolsTested++;
    if (getEntityCount.get() > 0) toolsTested++;
    if (createGlossaryCount.get() > 0) toolsTested++;
    if (createTermCount.get() > 0) toolsTested++;
    if (patchEntityCount.get() > 0) toolsTested++;
    if (getLineageCount.get() > 0) toolsTested++;

    assertThat(toolsTested).isGreaterThan(3); // At least 4 out of 6 tools should work

    // These core tools should definitely work
    assertThat(getEntityCount.get()).isGreaterThan(0);
    assertThat(createGlossaryCount.get()).isGreaterThan(0);

    System.out.println("\n=== LOAD TEST COMPLETED SUCCESSFULLY ===");
  }

  private boolean executeToolCallWithClient(
      OkHttpClient httpClient, Map<String, Object> toolCallRequest) {
    return executeToolCallWithClient(httpClient, toolCallRequest, null, null);
  }

  private boolean executeToolCallWithClient(
      OkHttpClient httpClient,
      Map<String, Object> toolCallRequest,
      String toolType,
      String expectedData) {
    try {
      String requestBody = objectMapper.writeValueAsString(toolCallRequest);

      okhttp3.RequestBody body =
          okhttp3.RequestBody.create(requestBody, okhttp3.MediaType.parse("application/json"));

      Request request =
          new Request.Builder()
              .url(getMcpUrl("/mcp"))
              .header("Accept", "application/json, text/event-stream")
              .header("Authorization", authToken)
              .post(body)
              .build();

      try (okhttp3.Response response = httpClient.newCall(request).execute()) {
        if (response.code() == 503) {
          // Server limit reached, consider this acceptable
          return false;
        } else if (response.code() == 200) {
          if (response.body() == null) {
            return false;
          }
          String responseBody = response.body().string();

          // Handle SSE response format if present
          String jsonContent = responseBody;
          if (responseBody.startsWith("id:") || responseBody.startsWith("data:")) {
            String[] lines = responseBody.split("\n");
            for (String line : lines) {
              if (line.startsWith("data:")) {
                jsonContent = line.substring(5).trim();
                break;
              }
            }
          }

          JsonNode responseJson = objectMapper.readTree(jsonContent);
          // Basic validation first
          if (!responseJson.has("result") || responseJson.get("result").isNull()) {
            return false;
          }
          // Enhanced validation if toolType is provided
          if (toolType != null) {
            return validateToolResponse(responseJson, toolType, expectedData);
          }
          return true;
        } else {
          return false;
        }
      }
    } catch (Exception e) {
      return false;
    }
  }
}
