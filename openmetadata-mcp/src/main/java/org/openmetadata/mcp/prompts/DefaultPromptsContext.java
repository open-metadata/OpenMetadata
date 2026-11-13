package org.openmetadata.mcp.prompts;

import static org.openmetadata.mcp.McpUtils.getPrompts;

import io.modelcontextprotocol.spec.McpSchema;
import java.util.ArrayList;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.security.auth.CatalogSecurityContext;

@Slf4j
public class DefaultPromptsContext {
  public List<McpSchema.Prompt> loadPromptsDefinitionsFromJson(String promptFilePath) {
    return getPrompts(promptFilePath);
  }

  public McpSchema.GetPromptResult callPrompt(
      CatalogSecurityContext securityContext,
      String promptName,
      McpSchema.GetPromptRequest promptRequest) {
    LOG.info(
        "Catalog Principal: {} is trying to call the prompt: {}",
        securityContext.getUserPrincipal().getName(),
        promptName);
    McpSchema.GetPromptResult result;
    try {
      switch (promptName) {
        case "search_metadata":
          result = new SearchPrompt().callPrompt(promptRequest);
          break;
        default:
          return McpSchema.GetPromptResult.builder(new ArrayList<>()).description("error").build();
      }

      return result;
    } catch (Exception ex) {
      LOG.error("Error executing tool: {}", ex.getMessage());
      return McpSchema.GetPromptResult.builder(new ArrayList<>())
          .description(String.format("Error executing tool: %s", ex.getMessage()))
          .build();
    }
  }
}
