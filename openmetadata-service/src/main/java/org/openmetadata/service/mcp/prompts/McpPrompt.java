package org.openmetadata.service.mcp.prompts;

import io.modelcontextprotocol.spec.McpSchema;

public interface McpPrompt {
  WrappedGetPromptResult callPrompt(McpSchema.GetPromptRequest promptRequest);
}
