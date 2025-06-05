package org.openmetadata.service.mcp;

import static org.openmetadata.service.search.SearchUtil.searchMetadata;

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
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.mcp.tools.GlossaryTermTool;
import org.openmetadata.service.mcp.tools.GlossaryTool;
import org.openmetadata.service.mcp.tools.PatchEntityTool;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.JwtFilter;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.util.EntityUtil;
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

  public static Object callTool(
      Authorizer authorizer,
      JwtFilter jwtFilter,
      Limits limits,
      String toolName,
      Map<String, Object> params) {
    CatalogSecurityContext securityContext =
        jwtFilter.getCatalogSecurityContext((String) params.get("Authorization"));
    LOG.info(
        "Catalog Principal: {} is trying to call the tool: {}",
        securityContext.getUserPrincipal().getName(),
        toolName);
    Object result;
    try {
      switch (toolName) {
        case "search_metadata":
          result = searchMetadata(params);
          break;
        case "get_entity_details":
          result = EntityUtil.getEntityDetails(params);
          break;
        case "create_glossary":
          result = new GlossaryTool().execute(authorizer, limits, securityContext, params);
          break;
        case "create_glossary_term":
          result = new GlossaryTermTool().execute(authorizer, limits, securityContext, params);
          break;
        case "patch_entity":
          result = new PatchEntityTool().execute(authorizer, limits, securityContext, params);
          break;
        default:
          result = Map.of("error", "Unknown function: " + toolName);
          break;
      }

      return result;
    } catch (AuthorizationException ex) {
      LOG.error("Authorization error: {}", ex.getMessage());
      return Map.of(
          "error", String.format("Authorization error: %s", ex.getMessage()), "statusCode", 403);
    } catch (Exception ex) {
      LOG.error("Error executing tool: {}", ex.getMessage());
      return Map.of(
          "error", String.format("Error executing tool: %s", ex.getMessage()), "statusCode", 500);
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
