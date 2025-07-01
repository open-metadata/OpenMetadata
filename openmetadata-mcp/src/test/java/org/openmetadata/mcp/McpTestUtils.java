package org.openmetadata.mcp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Utility class for MCP testing.
 * Provides helper methods to create valid MCP protocol messages.
 */
public class McpTestUtils {

  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

  /**
   * Creates a valid JSON-RPC 2.0 request.
   */
  public static Map<String, Object> createJsonRpcRequest(
      String method, Map<String, Object> params) {
    Map<String, Object> request = new HashMap<>();
    request.put("jsonrpc", "2.0");
    request.put("id", UUID.randomUUID().toString());
    request.put("method", method);
    if (params != null) {
      request.put("params", params);
    }
    return request;
  }

  /**
   * Creates a valid JSON-RPC 2.0 notification (no id).
   */
  public static Map<String, Object> createJsonRpcNotification(
      String method, Map<String, Object> params) {
    Map<String, Object> notification = new HashMap<>();
    notification.put("jsonrpc", "2.0");
    notification.put("method", method);
    if (params != null) {
      notification.put("params", params);
    }
    return notification;
  }

  /**
   * Creates an initialize request.
   */
  public static Map<String, Object> createInitializeRequest() {
    Map<String, Object> params = new HashMap<>();
    params.put("protocolVersion", "2024-11-05");
    params.put(
        "capabilities",
        Map.of(
            "tools", Map.of("listSupported", true),
            "prompts", Map.of("listSupported", true)));
    params.put(
        "clientInfo",
        Map.of(
            "name", "test-client",
            "version", "1.0.0"));

    return createJsonRpcRequest("initialize", params);
  }

  /**
   * Creates a tool call request.
   */
  public static Map<String, Object> createToolCallRequest(
      String toolName, Map<String, Object> arguments) {
    Map<String, Object> params = new HashMap<>();
    params.put("name", toolName);
    params.put("arguments", arguments != null ? arguments : new HashMap<>());

    return createJsonRpcRequest("tools/call", params);
  }

  /**
   * Creates a prompt get request.
   */
  public static Map<String, Object> createPromptGetRequest(
      String promptName, Map<String, Object> arguments) {
    Map<String, Object> params = new HashMap<>();
    params.put("name", promptName);
    params.put("arguments", arguments != null ? arguments : new HashMap<>());

    return createJsonRpcRequest("prompts/get", params);
  }

  /**
   * Validates a JSON-RPC response.
   */
  public static void validateJsonRpcResponse(JsonNode response) {
    if (response == null) {
      throw new AssertionError("Response is null");
    }

    if (!response.has("jsonrpc") || !"2.0".equals(response.get("jsonrpc").asText())) {
      throw new AssertionError("Invalid JSON-RPC version");
    }

    if (!response.has("id")) {
      throw new AssertionError("Response missing id");
    }

    boolean hasResult = response.has("result");
    boolean hasError = response.has("error");

    if (hasResult && hasError) {
      throw new AssertionError("Response cannot have both result and error");
    }

    if (!hasResult && !hasError) {
      throw new AssertionError("Response must have either result or error");
    }

    if (hasError) {
      JsonNode error = response.get("error");
      if (!error.has("code") || !error.has("message")) {
        throw new AssertionError("Error response missing required fields");
      }
    }
  }

  /**
   * Creates test authorization header.
   */
  public static String createAuthorizationHeader(String token) {
    return "Bearer " + token;
  }

  /**
   * Extracts session ID from response headers.
   */
  public static String extractSessionId(okhttp3.Response response) {
    return response.header("Mcp-Session-Id");
  }

  /**
   * Creates a search metadata tool call.
   */
  public static Map<String, Object> createSearchMetadataToolCall(String query, int limit) {
    Map<String, Object> arguments = new HashMap<>();
    arguments.put("query", query);
    arguments.put("limit", limit);
    arguments.put("entity_type", "table");
    arguments.put("Authorization", createAuthorizationHeader("test-token"));

    return createToolCallRequest("search_metadata", arguments);
  }

  /**
   * Creates a get entity details tool call.
   */
  public static Map<String, Object> createGetEntityToolCall(String entityType, String fqn) {
    Map<String, Object> arguments = new HashMap<>();
    arguments.put("entity_type", entityType);
    arguments.put("fqn", fqn);
    arguments.put("Authorization", createAuthorizationHeader("test-token"));

    return createToolCallRequest("get_entity_details", arguments);
  }
}
