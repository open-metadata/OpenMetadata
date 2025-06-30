package org.openmetadata.service.mcp.prompts;

import io.modelcontextprotocol.spec.McpSchema;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class WrappedGetPromptResult {
  private McpSchema.GetPromptResult result;
  private boolean isError;

  public WrappedGetPromptResult(McpSchema.GetPromptResult result, boolean isError) {
    this.result = result;
    this.isError = isError;
  }
}
