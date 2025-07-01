package org.openmetadata.mcp;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.dropwizard.testing.ConfigOverride;
import io.dropwizard.testing.ResourceHelpers;
import io.dropwizard.testing.junit5.DropwizardAppExtension;
import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
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
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.auth.ServiceTokenType;
import org.openmetadata.schema.entity.app.AppSchedule;
import org.openmetadata.schema.entity.app.CreateApp;
import org.openmetadata.schema.entity.app.ScheduleTimeline;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplication;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.jdbi3.AppRepository;
import org.openmetadata.service.security.jwt.JWTTokenGenerator;

public class McpIntegrationTest extends OpenMetadataApplicationTest {

  private static String CONFIG_PATH_OVERRIDE =
      ResourceHelpers.resourceFilePath("test-config-mcp.yaml");

  private OkHttpClient client;
  private ObjectMapper objectMapper;
  private String authToken;

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
      assertThat(result.get("protocolVersion").asText()).isEqualTo("2024-11-05");
      assertThat(result.has("capabilities")).isTrue();
      assertThat(result.has("serverInfo")).isTrue();
      String sessionId = response.header("Mcp-Session-Id");
      assertThat(sessionId).isNotNull();
    }
  }

  @Test
  void testMcpToolsList() throws Exception {
    // Given - Initialize session first
    String sessionId = initializeMcpSession();

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
            .header("Mcp-Session-Id", sessionId)
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
    String sessionId = initializeMcpSession();
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
            .header("Mcp-Session-Id", sessionId)
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

  @Test
  void testMcpSseConnection() throws Exception {
    // Given
    CountDownLatch latch = new CountDownLatch(1);
    AtomicReference<String> endpointUrl = new AtomicReference<>();
    EventSource eventSource = null;

    try {
      Request request =
          new Request.Builder()
              .url(getMcpUrl("/mcp/sse"))
              .header("Accept", "text/event-stream")
              .header("Authorization", authToken)
              .build();

      EventSourceListener listener =
          new EventSourceListener() {
            @Override
            public void onEvent(EventSource eventSource, String id, String type, String data) {
              if ("endpoint".equals(type)) {
                endpointUrl.set(data);
                latch.countDown();
              }
            }

            @Override
            public void onFailure(
                @NotNull EventSource eventSource, Throwable t, okhttp3.Response response) {
              if (t != null) {
                System.err.println("SSE connection failed: " + t.getMessage());
              } else if (response != null) {
                System.err.println("SSE connection failed with response: " + response.code());
              }
              latch.countDown();
            }
          };

      // When
      eventSource = EventSources.createFactory(client).newEventSource(request, listener);

      // Then
      assertThat(latch.await(5, TimeUnit.SECONDS)).isTrue();
      assertThat(endpointUrl.get()).isNotNull();
      assertThat(endpointUrl.get()).contains("/mcp/messages?sessionId=");
    } finally {
      // Always cancel the event source
      if (eventSource != null) {
        eventSource.cancel();
      }
    }
  }

  @Test
  void testMcpToolCall() throws Exception {
    // Given - Initialize session first
    String sessionId = initializeMcpSession();

    // Create a search metadata tool call
    Map<String, Object> toolCallRequest = McpTestUtils.createSearchMetadataToolCall("test", 5);
    String requestBody = objectMapper.writeValueAsString(toolCallRequest);

    okhttp3.RequestBody body =
        okhttp3.RequestBody.create(requestBody, okhttp3.MediaType.parse("application/json"));

    Request request =
        new Request.Builder()
            .url(getMcpUrl("/mcp"))
            .header("Accept", "application/json, text/event-stream")
            .header("Authorization", authToken)
            .header("Mcp-Session-Id", sessionId)
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

  private String initializeMcpSession() throws Exception {
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
      return response.header("Mcp-Session-Id");
    }
  }
}
