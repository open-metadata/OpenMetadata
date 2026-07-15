package org.openmetadata.mcp;

import com.fasterxml.jackson.databind.JsonNode;
import io.modelcontextprotocol.json.McpJsonMapper;
import io.modelcontextprotocol.json.jackson2.JacksonMcpJsonMapper;
import io.modelcontextprotocol.spec.McpSchema;
import jakarta.servlet.http.HttpServletRequest;
import java.io.BufferedReader;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.security.JwtFilter;

@Slf4j
public class McpUtils {

  private static final McpJsonMapper JSON_MAPPER =
      new JacksonMcpJsonMapper(JsonUtils.getObjectMapper());

  @SuppressWarnings("unchecked")
  public static McpSchema.JSONRPCMessage getJsonRpcMessageWithAuthorizationParam(
      McpJsonMapper jsonMapper, HttpServletRequest request, String body) throws IOException {
    Map<String, Object> requestMessage = JsonUtils.getMap(JsonUtils.readTree(body));
    Map<String, Object> params = (Map<String, Object>) requestMessage.get("params");
    if (params != null) {
      Map<String, Object> arguments = (Map<String, Object>) params.get("arguments");
      if (arguments != null) {
        arguments.put("Authorization", JwtFilter.extractToken(request.getHeader("Authorization")));
      }
    }
    return McpSchema.deserializeJsonRpcMessage(jsonMapper, JsonUtils.pojoToJson(requestMessage));
  }

  @SuppressWarnings("unchecked")
  public static List<Map<String, Object>> loadDefinitionsFromJson(String json) {
    try {
      LOG.info("Loaded definitions, content length: {}", json.length());

      JsonNode jsonNode = JsonUtils.readTree(json);
      JsonNode jsonArray = jsonNode.get("tools");

      if (jsonArray == null || !jsonArray.isArray()) {
        LOG.error("Invalid MCP tools file format. Expected 'tools' array.");
        return new ArrayList<>();
      }

      List<Map<String, Object>> toolOrPrompt = new ArrayList<>();
      for (JsonNode toolNode : jsonArray) {
        String name = toolNode.get("name").asText();
        Map<String, Object> toolDef = JsonUtils.convertValue(toolNode, Map.class);
        toolOrPrompt.add(toolDef);
        LOG.info("Tool/Prompt found: {} with definition: {}", name, toolDef);
      }

      LOG.info("Found {} tool/prompts definitions", toolOrPrompt.size());
      return toolOrPrompt;
    } catch (Exception e) {
      LOG.error("Error loading tool definitions: {}", e.getMessage(), e);
      throw e;
    }
  }

  public static String getJsonFromFile(String path) {
    try {
      return CommonUtil.getResourceAsStream(McpServer.class.getClassLoader(), path);
    } catch (Exception ex) {
      LOG.error("Error loading JSON file: {}", path, ex);
      return null;
    }
  }

  public static List<McpSchema.Tool> getToolProperties(String jsonFilePath) {
    try {
      List<McpSchema.Tool> result = new ArrayList<>();
      String json = getJsonFromFile(jsonFilePath);
      List<Map<String, Object>> cachedTools = loadDefinitionsFromJson(json);
      if (cachedTools == null || cachedTools.isEmpty()) {
        LOG.error("No tool definitions were loaded!");
        throw new RuntimeException("Failed to load tool definitions");
      }
      LOG.debug("Successfully loaded {} tool definitions", cachedTools.size());
      for (Map<String, Object> toolDef : cachedTools) {
        result.add(buildTool(toolDef));
      }
      return result;
    } catch (Exception e) {
      LOG.error("Error during server startup", e);
      throw new RuntimeException("Failed to start MCP server", e);
    }
  }

  private static McpSchema.Tool buildTool(Map<String, Object> toolDef) {
    String name = (String) toolDef.get("name");
    String title = (String) toolDef.get("title");
    String description = (String) toolDef.get("description");
    Map<String, Object> schema = JsonUtils.getMap(toolDef.get("parameters"));
    McpSchema.Tool.Builder builder =
        McpSchema.Tool.builder()
            .name(name)
            .title(title)
            .description(description)
            .inputSchema(JSON_MAPPER, JsonUtils.pojoToJson(schema));
    McpSchema.ToolAnnotations annotations = buildToolAnnotations(toolDef, title);
    if (annotations != null) {
      builder.annotations(annotations);
    }
    return builder.build();
  }

  @SuppressWarnings("unchecked")
  private static McpSchema.ToolAnnotations buildToolAnnotations(
      Map<String, Object> toolDef, String title) {
    McpSchema.ToolAnnotations result = null;
    Map<String, Object> annotations = (Map<String, Object>) toolDef.get("annotations");
    if (annotations != null) {
      result =
          new McpSchema.ToolAnnotations(
              title,
              (Boolean) annotations.get("readOnlyHint"),
              (Boolean) annotations.get("destructiveHint"),
              (Boolean) annotations.get("idempotentHint"),
              (Boolean) annotations.get("openWorldHint"),
              (Boolean) annotations.get("returnDirect"));
    }
    return result;
  }

  public static List<McpSchema.Prompt> getPrompts(String jsonFilePath) {
    try {
      String json = getJsonFromFile(jsonFilePath);
      if (json == null || json.isEmpty()) {
        LOG.error("No prompts definitions were loaded from file: {}", jsonFilePath);
      }
      List<Map<String, Object>> cachedPrompts = loadDefinitionsFromJson(json);

      return cachedPrompts.stream()
          .map(
              promptDef -> {
                String name = (String) promptDef.get("name");
                String description = (String) promptDef.get("description");
                List<McpSchema.PromptArgument> arguments =
                    JsonUtils.readOrConvertValues(
                        promptDef.get("arguments"), McpSchema.PromptArgument.class);
                return new McpSchema.Prompt(name, description, arguments);
              })
          .toList();
    } catch (Exception e) {
      LOG.error("Error during server startup", e);
      throw new RuntimeException("Failed to start MCP server", e);
    }
  }

  public static String readRequestBody(HttpServletRequest request) throws IOException {
    StringBuilder body = new StringBuilder();
    try (BufferedReader reader = request.getReader()) {
      String line;
      while ((line = reader.readLine()) != null) {
        body.append(line);
      }
    }
    return body.toString();
  }
}
