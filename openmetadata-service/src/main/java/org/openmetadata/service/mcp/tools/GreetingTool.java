package org.openmetadata.service.mcp.tools;

import io.modelcontextprotocol.server.McpServerFeatures;
import io.modelcontextprotocol.spec.McpSchema;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.util.JsonUtils;

@Slf4j
public class GreetingTool {
  public static McpServerFeatures.SyncToolSpecification tool() {
    // Step 1: Load the JSON schema for the tool input arguments.
    final String schema =
        "{\"$schema\":\"http://json-schema.org/draft-07/schema#\",\"type\":\"object\",\"properties\":{\"input\":{\"type\":\"string\",\"description\":\"Input that the users can pass to get Hello ${input}\"}},\"required\":[\"input\"]}";

    // Step 2: Create a tool with name, description, and JSON schema.
    McpSchema.Tool tool = new McpSchema.Tool("hello_input", "Get hello tool", schema);

    // Step 3: Create a tool specification with the tool and the call function.
    return new McpServerFeatures.SyncToolSpecification(
        tool,
        (exchange, arguments) -> {
          McpSchema.Content content =
              new McpSchema.TextContent(JsonUtils.pojoToJson(greet(arguments)));
          return new McpSchema.CallToolResult(List.of(content), false);
        });
  }

  private static Object greet(Map<String, Object> params) {
    try {
      String input = (String) params.get("input");
      return String.format("Hello, %s", input);
    } catch (Exception e) {
      LOG.error("Error greeting", e);
      return Map.of("error", e.getMessage());
    }
  }
}
