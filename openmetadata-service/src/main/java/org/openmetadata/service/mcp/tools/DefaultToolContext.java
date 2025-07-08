package org.openmetadata.service.mcp.tools;

import static org.openmetadata.service.mcp.McpUtils.getToolProperties;

import io.modelcontextprotocol.spec.McpSchema;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.JwtFilter;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.util.JsonUtils;

@Slf4j
public class DefaultToolContext {
  public DefaultToolContext() {}

  /**
   * Loads tool definitions from a JSON file located at the specified path.
   * The JSON file should contain an array of tool definitions under the "tools" key.
   *
   * @return List of McpSchema.Tool objects loaded from the JSON file.
   */
  public List<McpSchema.Tool> loadToolsDefinitionsFromJson(String toolFilePath) {
    return getToolProperties(toolFilePath);
  }

  public McpSchema.CallToolResult callTool(
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
          result = new SearchMetadataTool().execute(authorizer, securityContext, params);
          break;
        case "get_entity_details":
          result = new GetEntityTool().execute(authorizer, securityContext, params);
          break;
        case "create_glossary":
          result = new GlossaryTool().execute(authorizer, limits, securityContext, params);
          break;
        case "create_glossary_term":
          result = new GlossaryTermTool().execute(authorizer, limits, securityContext, params);
          break;
        case "patch_entity":
          result = new PatchEntityTool().execute(authorizer, securityContext, params);
          break;
        case "get_entity_lineage":
          result = new GetLineageTool().execute(authorizer, securityContext, params);
          break;
        default:
          return new McpSchema.CallToolResult(
              List.of(
                  new McpSchema.TextContent(
                      JsonUtils.pojoToJson(Map.of("error", "Unknown function: " + toolName)))),
              true);
      }

      return new McpSchema.CallToolResult(
          List.of(new McpSchema.TextContent(JsonUtils.pojoToJson(result))), false);
    } catch (AuthorizationException ex) {
      LOG.error("Authorization error: {}", ex.getMessage());
      return new McpSchema.CallToolResult(
          List.of(
              new McpSchema.TextContent(
                  JsonUtils.pojoToJson(
                      Map.of(
                          "error",
                          String.format("Authorization error: %s", ex.getMessage()),
                          "statusCode",
                          403)))),
          true);
    } catch (Exception ex) {
      LOG.error("Error executing tool: {}", ex.getMessage());
      return new McpSchema.CallToolResult(
          List.of(
              new McpSchema.TextContent(
                  JsonUtils.pojoToJson(
                      Map.of(
                          "error",
                          String.format("Error executing tool: %s", ex.getMessage()),
                          "statusCode",
                          500)))),
          true);
    }
  }
}
