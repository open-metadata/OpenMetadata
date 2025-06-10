package org.openmetadata.service.mcp.prompts;

import io.modelcontextprotocol.spec.McpSchema;
import java.util.List;

public class GreetingsPrompt implements McpPrompt {

  @Override
  public McpSchema.GetPromptResult callPrompt(McpSchema.GetPromptRequest promptRequest) {
    return new McpSchema.GetPromptResult(
        null,
        List.of(
            new McpSchema.PromptMessage(
                McpSchema.Role.ASSISTANT,
                new McpSchema.TextContent(
                    "Please generate a greeting in ${style} style to ${name}."))));
  }
}
