package org.openmetadata.service.apps;

import io.dropwizard.core.setup.Environment;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.security.Authorizer;

/**
 * Interface for MCP Server Provider to avoid circular dependency.
 * The actual implementation will be in openmetadata-mcp module.
 */
public interface McpServerProvider {
  /**
   * Initialize and register the MCP server with the application.
   */
  void initializeMcpServer(
      Environment environment,
      Authorizer authorizer,
      Limits limits,
      OpenMetadataApplicationConfig config);
}
