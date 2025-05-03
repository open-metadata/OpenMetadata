package org.openmetadata.service.mcp;

import static org.openmetadata.service.search.SearchUtil.searchMetadata;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.dropwizard.jetty.MutableServletContextHandler;
import io.dropwizard.setup.Environment;
import io.modelcontextprotocol.server.McpServerFeatures;
import io.modelcontextprotocol.server.McpSyncServer;
import io.modelcontextprotocol.spec.McpSchema;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.eclipse.jetty.servlet.ServletHolder;
import org.openmetadata.HttpServletSseServerTransportProvider;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.JsonUtils;

@Slf4j
public class McpServer {
  public static void initializeMcpServer(Environment environment) {
    McpSchema.ServerCapabilities serverCapabilities =
        McpSchema.ServerCapabilities.builder()
            .tools(true)
            .prompts(true)
            .resources(true, true)
            .build();

    HttpServletSseServerTransportProvider transport =
        new HttpServletSseServerTransportProvider(new ObjectMapper(), "/mcp/message", "/mcp/sse");
    McpSyncServer server =
        io.modelcontextprotocol.server.McpServer.sync(transport)
            .serverInfo("openmetadata-mcp", "0.1.0")
            .capabilities(serverCapabilities)
            .build();

    // Add resources, prompts, and tools to the MCP server
    addTools(server);

    MutableServletContextHandler contextHandler = environment.getApplicationContext();
    ServletHolder servletHolder = new ServletHolder(transport);
    contextHandler.addServlet(servletHolder, "/mcp/*");
  }

  public static void addTools(McpSyncServer server) {
    try {
      LOG.info("Loading tool definitions...");
      List<Map<String, Object>> cachedTools = loadToolDefinitions();
      if (cachedTools == null || cachedTools.isEmpty()) {
        LOG.error("No tool definitions were loaded!");
        throw new RuntimeException("Failed to load tool definitions");
      }
      LOG.info("Successfully loaded {} tool definitions", cachedTools.size());

      for (Map<String, Object> toolDef : cachedTools) {
        try {
          String name = (String) toolDef.get("name");
          String description = (String) toolDef.get("description");
          Map<String, Object> schema = JsonUtils.getMap(toolDef.get("parameters"));
          server.addTool(getTool(JsonUtils.pojoToJson(schema), name, description));
        } catch (Exception e) {
          LOG.error("Error processing tool definition: {}", toolDef, e);
        }
      }
      LOG.info("Initializing request handlers...");
    } catch (Exception e) {
      LOG.error("Error during server startup", e);
      throw new RuntimeException("Failed to start MCP server", e);
    }
  }

  @SuppressWarnings("unchecked")
  private static List<Map<String, Object>> loadToolDefinitions() throws IOException {
    try {
      String json =
          CommonUtil.getResourceAsStream(
              McpServer.class.getClassLoader(), "json/data/mcp/tools.json");
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

  private static McpServerFeatures.SyncToolSpecification getTool(
      String schema, String toolName, String description) {
    McpSchema.Tool tool = new McpSchema.Tool(toolName, description, schema);

    return new McpServerFeatures.SyncToolSpecification(
        tool,
        (exchange, arguments) -> {
          McpSchema.Content content =
              new McpSchema.TextContent(JsonUtils.pojoToJson(runMethod(toolName, arguments)));
          return new McpSchema.CallToolResult(List.of(content), false);
        });
  }

  private static Object runMethod(String toolName, Map<String, Object> params) {
    Object result;
    switch (toolName) {
      case "search_metadata":
        result = searchMetadata(params);
        break;
      case "get_entity_details":
        result = EntityUtil.getEntityDetails(params);
        break;
      default:
        result = Map.of("error", "Unknown function: " + toolName);
        break;
    }

    return result;
  }
}
