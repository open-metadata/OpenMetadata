package org.openmetadata.mcp.tools;

import static org.openmetadata.mcp.McpUtils.getToolProperties;

import io.modelcontextprotocol.spec.McpSchema;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;

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
      Limits limits,
      String toolName,
      CatalogSecurityContext securityContext,
      McpSchema.CallToolRequest request) {
    LOG.info(
        "Catalog Principal: {} is trying to call the tool: {}",
        securityContext.getUserPrincipal().getName(),
        toolName);
    Map<String, Object> params = request.arguments();
    Object result;
    try {
      McpTool tool;
      switch (toolName) {
        case "search_metadata":
          tool = new SearchMetadataTool();
          result = tool.execute(authorizer, securityContext, params);
          break;
        case "get_entity_details":
          tool = new GetEntityTool();
          result = tool.execute(authorizer, securityContext, params);
          break;
        case "create_glossary":
          tool = new GlossaryTool();
          result = tool.execute(authorizer, limits, securityContext, params);
          break;
        case "create_glossary_term":
          tool = new GlossaryTermTool();
          result = tool.execute(authorizer, limits, securityContext, params);
          break;
        case "patch_entity":
          tool = new PatchEntityTool();
          result = tool.execute(authorizer, securityContext, params);
          break;
        case "get_entity_lineage":
          tool = new GetLineageTool();
          result = tool.execute(authorizer, securityContext, params);
          break;
        default:
          return McpSchema.CallToolResult.builder()
              .content(
                  List.of(
                      new McpSchema.TextContent(
                          JsonUtils.pojoToJson(Map.of("error", "Unknown function: " + toolName)))))
              .isError(true)
              .build();
      }

      return McpSchema.CallToolResult.builder()
          .content(List.of(new McpSchema.TextContent(JsonUtils.pojoToJson(result))))
          .isError(false)
          .build();
    } catch (AuthorizationException ex) {
      // OpenMetadata authorization error
      LOG.error("Authorization error: {}", ex.getMessage());
      return McpSchema.CallToolResult.builder()
          .content(
              List.of(
                  new McpSchema.TextContent(
                      JsonUtils.pojoToJson(
                          Map.of(
                              "error",
                              String.format("Authorization error: %s", ex.getMessage()),
                              "statusCode",
                              403)))))
          .isError(true)
          .build();
    } catch (Exception ex) {
      LOG.error("Error executing tool: {}", ex.getMessage());
      return McpSchema.CallToolResult.builder()
          .content(
              List.of(
                  new McpSchema.TextContent(
                      JsonUtils.pojoToJson(
                          Map.of(
                              "error",
                              String.format("Error executing tool: %s", ex.getMessage()),
                              "statusCode",
                              500)))))
          .isError(true)
          .build();
    }
  }
}
