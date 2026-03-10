package org.openmetadata.it.tests.mcp;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public class McpTestUtils {

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

  public static Map<String, Object> createInitializeRequest() {
    Map<String, Object> params = new HashMap<>();
    params.put("protocolVersion", "2025-06-18");
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

  public static Map<String, Object> createToolCallRequest(
      String toolName, Map<String, Object> arguments) {
    Map<String, Object> params = new HashMap<>();
    params.put("name", toolName);
    params.put("arguments", arguments != null ? arguments : new HashMap<>());

    return createJsonRpcRequest("tools/call", params);
  }

  public static Map<String, Object> createPromptGetRequest(
      String promptName, Map<String, Object> arguments) {
    Map<String, Object> params = new HashMap<>();
    params.put("name", promptName);
    params.put("arguments", arguments != null ? arguments : new HashMap<>());

    return createJsonRpcRequest("prompts/get", params);
  }

  public static String createAuthorizationHeader(String token) {
    return "Bearer " + token;
  }

  public static Map<String, Object> createSearchMetadataToolCall(
      String query, int limit, String entityType) {
    Map<String, Object> arguments = new HashMap<>();
    arguments.put("query", query);
    arguments.put("limit", limit);
    arguments.put("entityType", entityType);
    arguments.put("Authorization", createAuthorizationHeader("test-token"));

    return createToolCallRequest("search_metadata", arguments);
  }

  public static Map<String, Object> createGetEntityToolCall(String entityType, String fqn) {
    Map<String, Object> arguments = new HashMap<>();
    arguments.put("entityType", entityType);
    arguments.put("fqn", fqn);
    arguments.put("Authorization", createAuthorizationHeader("test-token"));

    return createToolCallRequest("get_entity_details", arguments);
  }

  public static Map<String, Object> createGlossaryToolCall(String name, String description) {
    Map<String, Object> arguments = new HashMap<>();
    arguments.put("name", name);
    arguments.put("description", description);
    arguments.put("mutuallyExclusive", false);
    arguments.put("Authorization", createAuthorizationHeader("test-token"));

    return createToolCallRequest("create_glossary", arguments);
  }

  public static Map<String, Object> createGlossaryTermToolCall(
      String glossary, String name, String description) {
    Map<String, Object> arguments = new HashMap<>();
    arguments.put("glossary", glossary);
    arguments.put("name", name);
    arguments.put("description", description);
    arguments.put("Authorization", createAuthorizationHeader("test-token"));

    return createToolCallRequest("create_glossary_term", arguments);
  }

  public static Map<String, Object> createPatchEntityToolCall(
      String entityType, String fqn, String patch) {
    Map<String, Object> arguments = new HashMap<>();
    arguments.put("entityType", entityType);
    arguments.put("fqn", fqn);
    arguments.put("patch", patch);
    arguments.put("Authorization", createAuthorizationHeader("test-token"));

    return createToolCallRequest("patch_entity", arguments);
  }

  public static Map<String, Object> createGetLineageToolCall(
      String entityType, String fqn, int upstreamDepth, int downstreamDepth) {
    Map<String, Object> arguments = new HashMap<>();
    arguments.put("entityType", entityType);
    arguments.put("fqn", fqn);
    arguments.put("upstreamDepth", upstreamDepth);
    arguments.put("downstreamDepth", downstreamDepth);
    arguments.put("Authorization", createAuthorizationHeader("test-token"));

    return createToolCallRequest("get_entity_lineage", arguments);
  }

  public static Map<String, Object> createLineageToolCall(
      String fromEntityType, String fromEntityId, String toEntityType, String toEntityId) {
    Map<String, Object> fromEntity = new HashMap<>();
    fromEntity.put("type", fromEntityType);
    fromEntity.put("id", fromEntityId);

    Map<String, Object> toEntity = new HashMap<>();
    toEntity.put("type", toEntityType);
    toEntity.put("id", toEntityId);

    Map<String, Object> arguments = new HashMap<>();
    arguments.put("fromEntity", fromEntity);
    arguments.put("toEntity", toEntity);
    arguments.put("Authorization", createAuthorizationHeader("test-token"));

    return createToolCallRequest("create_lineage", arguments);
  }

  public static Map<String, Object> createGetTestDefinitionsToolCall(String entityType) {
    Map<String, Object> arguments = new HashMap<>();
    arguments.put("entityType", entityType);
    arguments.put("Authorization", createAuthorizationHeader("test-token"));

    return createToolCallRequest("get_test_definitions", arguments);
  }

  public static Map<String, Object> createTestCaseToolCall(
      String name,
      String fqn,
      String testDefinitionName,
      List<Map<String, String>> parameterValues) {
    Map<String, Object> arguments = new HashMap<>();
    arguments.put("name", name);
    arguments.put("fqn", fqn);
    arguments.put("testDefinitionName", testDefinitionName);
    arguments.put("parameterValues", parameterValues);
    arguments.put("Authorization", createAuthorizationHeader("test-token"));

    return createToolCallRequest("create_test_case", arguments);
  }

  public static Map<String, Object> createRootCauseAnalysisToolCall(
      String fqn, String entityType, int upstreamDepth, int downstreamDepth) {
    Map<String, Object> arguments = new HashMap<>();
    arguments.put("fqn", fqn);
    arguments.put("entityType", entityType);
    arguments.put("upstreamDepth", upstreamDepth);
    arguments.put("downstreamDepth", downstreamDepth);
    arguments.put("Authorization", createAuthorizationHeader("test-token"));

    return createToolCallRequest("root_cause_analysis", arguments);
  }
}
