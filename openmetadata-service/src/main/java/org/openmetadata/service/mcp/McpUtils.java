package org.openmetadata.service.mcp;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.modelcontextprotocol.spec.McpSchema;
import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.service.security.JwtFilter;
import org.openmetadata.service.util.JsonUtils;

@Slf4j
public class McpUtils {

  public static McpSchema.JSONRPCMessage getJsonRpcMessageWithAuthorizationParam(
      ObjectMapper objectMapper, HttpServletRequest request, String body) throws IOException {
    Map<String, Object> requestMessage = JsonUtils.getMap(JsonUtils.readTree(body));
    Map<String, Object> params = (Map<String, Object>) requestMessage.get("params");
    if (params != null) {
      Map<String, Object> arguments = (Map<String, Object>) params.get("arguments");
      if (arguments != null) {
        arguments.put("Authorization", JwtFilter.extractToken(request.getHeader("Authorization")));
      }
    }
    return McpSchema.deserializeJsonRpcMessage(objectMapper, JsonUtils.pojoToJson(requestMessage));
  }

  @SuppressWarnings("unchecked")
  public static List<Map<String, Object>> loadToolDefinitionsFromJson(String json) {
    try {
      LOG.info("Loaded tool definitions, content length: {}", json.length());
      LOG.info("Raw tools.json content: {}", json);

      JsonNode toolsJson = JsonUtils.readTree(json);
      JsonNode toolsArray = toolsJson.get("tools");

      if (toolsArray == null || !toolsArray.isArray()) {
        LOG.error("Invalid MCP tools file format. Expected 'tools' array.");
        return new ArrayList<>();
      }

      List<Map<String, Object>> tools = new ArrayList<>();
      for (JsonNode toolNode : toolsArray) {
        String name = toolNode.get("name").asText();
        Map<String, Object> toolDef = JsonUtils.convertValue(toolNode, Map.class);
        tools.add(toolDef);
        LOG.info("Tool found: {} with definition: {}", name, toolDef);
      }

      LOG.info("Found {} tool definitions", tools.size());
      return tools;
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
      List<Map<String, Object>> cachedTools = loadToolDefinitionsFromJson(json);
      if (cachedTools == null || cachedTools.isEmpty()) {
        LOG.error("No tool definitions were loaded!");
        throw new RuntimeException("Failed to load tool definitions");
      }
      LOG.debug("Successfully loaded {} tool definitions", cachedTools.size());
      for (int i = 0; i < cachedTools.size(); i++) {
        Map<String, Object> toolDef = cachedTools.get(i);
        String name = (String) toolDef.get("name");
        String description = (String) toolDef.get("description");
        Map<String, Object> schema = JsonUtils.getMap(toolDef.get("parameters"));
        result.add(new McpSchema.Tool(name, description, JsonUtils.pojoToJson(schema)));
      }
      return result;
    } catch (Exception e) {
      LOG.error("Error during server startup", e);
      throw new RuntimeException("Failed to start MCP server", e);
    }
  }
}
