package org.openmetadata.mcp;

import org.openmetadata.service.OpenMetadataApplicationConfig;

/** Holds application-level singletons needed by MCP tools at runtime. */
public class McpApplicationContext {
  private static volatile OpenMetadataApplicationConfig config;

  private McpApplicationContext() {}

  public static void setConfig(OpenMetadataApplicationConfig applicationConfig) {
    config = applicationConfig;
  }

  public static OpenMetadataApplicationConfig getConfig() {
    return config;
  }
}
