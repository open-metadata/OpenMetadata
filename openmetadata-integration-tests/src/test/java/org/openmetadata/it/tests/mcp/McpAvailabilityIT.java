package org.openmetadata.it.tests.mcp;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.net.URI;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.schema.entity.app.AppExtension;
import org.openmetadata.service.apps.bundles.mcp.McpAppConstants;

/**
 * Turning MCP off, by disabling its app or by its setting, stops every MCP route without a restart
 * (ADR:2026-11-12-mcp-turns-off-at-request-time). Isolated, and its tests run one at a time,
 * because each switches MCP off for the whole server.
 */
@Isolated
@Execution(ExecutionMode.SAME_THREAD)
class McpAvailabilityIT extends McpTestBase {

  private static final String APP_PATH = "apps/name/" + McpAppConstants.MCP_APP_NAME;
  private static final String CONFIG_PATH = "system/mcp/config";
  private static final String PROTECTED_RESOURCE = "/.well-known/oauth-protected-resource";
  private static final String USAGE_EXTENSION = AppExtension.ExtensionType.LIMITS.value();
  private static final List<String> GET_ROUTES =
      List.of(PROTECTED_RESOURCE, "/.well-known/oauth-authorization-server", "/mcp/callback");
  // Above the 30 second entity cache TTL, in case the change is read from a cached entry.
  private static final Duration SWITCH_TIMEOUT = Duration.ofSeconds(45);

  @BeforeAll
  static void setUp() throws Exception {
    initAuth();
  }

  @Test
  void disablingTheAppStopsMcpUntilItIsEnabled() throws Exception {
    final String appId = get(APP_PATH, JsonNode.class).get("id").asText();
    assertMcpAnswers();
    try {
      assertThat(deleteResponse(APP_PATH + "?hardDelete=false").statusCode()).isEqualTo(200);
      await().atMost(SWITCH_TIMEOUT).untilAsserted(this::assertMcpRefused);
    } finally {
      putResponse("apps/restore", Map.of("id", appId), authToken);
    }
    final long restoredAt = System.currentTimeMillis();
    await().atMost(SWITCH_TIMEOUT).untilAsserted(this::assertMcpAnswers);
    // Enable registers the app again, so tool calls after it are still recorded as usage.
    await()
        .atMost(SWITCH_TIMEOUT)
        .untilAsserted(() -> assertThat(usageRecordsSince(restoredAt)).isPositive());
  }

  @Test
  void turningTheSettingOffStopsMcpUntilItIsOn() throws Exception {
    final JsonNode stored = get(CONFIG_PATH, JsonNode.class);
    assertMcpAnswers();
    try {
      put(CONFIG_PATH, ((ObjectNode) stored.deepCopy()).put("enabled", false), JsonNode.class);
      await().atMost(SWITCH_TIMEOUT).untilAsserted(this::assertMcpRefused);
    } finally {
      put(CONFIG_PATH, stored, JsonNode.class);
    }
    await().atMost(SWITCH_TIMEOUT).untilAsserted(this::assertMcpAnswers);
  }

  private void assertMcpAnswers() throws Exception {
    assertThat(executeMcpRequest(McpTestUtils.createInitializeRequest()).has("result")).isTrue();
    final JsonNode toolCall =
        executeMcpRequest(McpTestUtils.createGetTestDefinitionsToolCall("table")).get("result");
    assertThat(toolCall.has("content")).isTrue();
    assertThat(toolCall.path("isError").asBoolean(false)).isFalse();
    assertThat(rootGet(PROTECTED_RESOURCE).statusCode()).isEqualTo(200);
  }

  // An empty body too: the server's 404 error page would otherwise answer with the UI page.
  private void assertMcpRefused() throws Exception {
    assertRefused("/mcp", postInitialize());
    for (String route : GET_ROUTES) {
      assertRefused(route, rootGet(route));
    }
  }

  private static void assertRefused(String route, HttpResponse<String> response) {
    assertThat(response.statusCode()).as(route).isEqualTo(404);
    assertThat(response.body()).as(route).isEmpty();
  }

  private static int usageRecordsSince(long startTs) throws Exception {
    final String query = "/extension?extensionType=" + USAGE_EXTENSION + "&limit=100&startTs=";
    return get(APP_PATH + query + startTs, JsonNode.class).path("data").size();
  }

  private HttpResponse<String> postInitialize() throws Exception {
    final String body = OBJECT_MAPPER.writeValueAsString(McpTestUtils.createInitializeRequest());
    return send(
        HttpRequest.newBuilder(URI.create(getMcpUrl("/mcp")))
            .header("Content-Type", "application/json")
            .header("Accept", "application/json, text/event-stream")
            .header("Authorization", authToken)
            .POST(HttpRequest.BodyPublishers.ofString(body)));
  }

  private HttpResponse<String> rootGet(String path) throws Exception {
    return send(HttpRequest.newBuilder(URI.create(getMcpUrl(path))).GET());
  }

  private static HttpResponse<String> send(HttpRequest.Builder request) throws Exception {
    return HTTP_CLIENT.send(
        request.timeout(Duration.ofSeconds(30)).build(), HttpResponse.BodyHandlers.ofString());
  }
}
