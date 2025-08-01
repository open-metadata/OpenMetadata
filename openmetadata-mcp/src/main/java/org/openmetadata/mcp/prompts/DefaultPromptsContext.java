package org.openmetadata.mcp.prompts;

import static org.openmetadata.mcp.McpUtils.getPrompts;

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

  public WrappedGetPromptResult callPrompt(
      JwtFilter jwtFilter, String promptName, McpSchema.GetPromptRequest promptRequest) {
    Map<String, Object> params = promptRequest.arguments();
    CatalogSecurityContext securityContext =
        jwtFilter.getCatalogSecurityContext((String) params.get("Authorization"));
    LOG.info(
        "Catalog Principal: {} is trying to call the prompt: {}",
        securityContext.getUserPrincipal().getName(),
        promptName);
    WrappedGetPromptResult result;
    try {
      switch (promptName) {
        case "create-greeting":
          result = new GreetingsPrompt().callPrompt(promptRequest);
          break;
        case "search_metadata":
          result = new SearchPrompt().callPrompt(promptRequest);
          break;
        default:
          return new WrappedGetPromptResult(
              new McpSchema.GetPromptResult("error", new ArrayList<>()), true);
      }

      return result;
    } catch (Exception ex) {
      LOG.error("Error executing tool: {}", ex.getMessage());
      return new WrappedGetPromptResult(
          new McpSchema.GetPromptResult(
              String.format("Error executing tool: %s", ex.getMessage()), new ArrayList<>()),
          false);
    }
  }
}
