package org.openmetadata.it.tests.mcp;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.HashMap;
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
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.service.Entity;

public class McpIntegrationIT extends McpTestBase {

  private static Table testTable;

  @BeforeAll
  static void setUp() throws Exception {
    initAuth();
    testTable = createServiceDatabaseSchemaTable("mcp_it");
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
                          .timeout(java.time.Duration.ofSeconds(30))
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
                              .timeout(java.time.Duration.ofSeconds(60))
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
