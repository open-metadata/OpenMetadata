package org.openmetadata.mcp.prompts;

import io.modelcontextprotocol.spec.McpSchema;
import java.util.List;
import java.util.Map;

public class SearchPrompt implements McpPrompt {
  @Override
  public WrappedGetPromptResult callPrompt(McpSchema.GetPromptRequest promptRequest) {
    Map<String, Object> params = promptRequest.arguments();
    String query = (String) params.get("query");
    int limit = 10;
    if (params.containsKey("limit")) {
      Object limitObj = params.get("limit");
      if (limitObj instanceof Number) {
        limit = ((Number) limitObj).intValue();
      } else if (limitObj instanceof String) {
        limit = Integer.parseInt((String) limitObj);
      }
    }
    String entityType = (String) params.get("entity_type");
    return new WrappedGetPromptResult(
        new McpSchema.GetPromptResult(
            "Message can be used to get search results",
            List.of(
                new McpSchema.PromptMessage(
                    McpSchema.Role.ASSISTANT,
                    new McpSchema.TextContent(
                        String.format(
                            "Search for `%s` in OpenMetadata where entity type is `%s` and with a limit of `%s` . Summarise the information for all the results properly and also make sure to provide clickable links using the href field from the results.",
                            query, entityType, limit))))),
        false);
  }
}
