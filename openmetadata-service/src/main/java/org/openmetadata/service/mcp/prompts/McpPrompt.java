package org.openmetadata.service.mcp.prompts;

import io.modelcontextprotocol.spec.McpSchema;

public interface McpPrompt {
  McpSchema.GetPromptResult callPrompt(McpSchema.GetPromptRequest promptRequest);
}
