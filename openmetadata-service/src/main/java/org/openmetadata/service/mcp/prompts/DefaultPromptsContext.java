package org.openmetadata.service.mcp.prompts;

import static org.openmetadata.service.mcp.McpUtils.getPrompts;

import io.modelcontextprotocol.spec.McpSchema;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.security.JwtFilter;
import org.openmetadata.service.security.auth.CatalogSecurityContext;

@Slf4j
public class DefaultPromptsContext {
  public List<McpSchema.Prompt> loadPromptsDefinitionsFromJson(String promptFilePath) {
    return getPrompts(promptFilePath);
  }

  public McpSchema.GetPromptResult callPrompt(
      JwtFilter jwtFilter, String promptName, McpSchema.GetPromptRequest promptRequest) {
    Map<String, Object> params = promptRequest.arguments();
    CatalogSecurityContext securityContext =
        jwtFilter.getCatalogSecurityContext((String) params.get("Authorization"));
    LOG.info(
        "Catalog Principal: {} is trying to call the prompt: {}",
        securityContext.getUserPrincipal().getName(),
        promptName);
    McpSchema.GetPromptResult result;
    try {
      switch (promptName) {
        case "create-greeting":
          result = new GreetingsPrompt().callPrompt(promptRequest);
          break;
        default:
          result =
              new McpSchema.GetPromptResult(
                  "This Prompt is not implemented yet", new ArrayList<>());
          break;
      }

      return result;
    } catch (Exception ex) {
      LOG.error("Error executing tool: {}", ex.getMessage());
      return new McpSchema.GetPromptResult(
          String.format("Error executing tool: %s", ex.getMessage()), new ArrayList<>());
    }
  }
}
