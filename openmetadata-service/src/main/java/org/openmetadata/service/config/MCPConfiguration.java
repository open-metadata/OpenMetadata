package org.openmetadata.service.config;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class MCPConfiguration {
  @JsonProperty("mcpServerName")
  private String mcpServerName = "openmetadata-mcp-server";

  @JsonProperty("mcpServerVersion")
  private String mcpServerVersion = "1.0.0";

  @JsonProperty("enabled")
  private boolean enabled = true;

  @JsonProperty("path")
  private String path = "/api/v1/mcp";

  @JsonProperty("originValidationEnabled")
  private boolean originValidationEnabled = false;

  @JsonProperty("originHeaderUri")
  private String originHeaderUri = "http://localhost";

  // Connection management settings
  @JsonProperty("maxConnections")
  private Integer maxConnections = 100;

  @JsonProperty("maxUserConnections")
  private Integer maxUserConnections = 10;

  @JsonProperty("maxOrgConnections")
  private Integer maxOrgConnections = 30;

  @JsonProperty("connectionsPerSecond")
  private Double connectionsPerSecond = 10.0;

  @JsonProperty("enableCircuitBreaker")
  private Boolean enableCircuitBreaker = true;

  // Thread pool settings
  @JsonProperty("sseThreadPoolSize")
  private Integer sseThreadPoolSize = 10;

  @JsonProperty("streamableThreadPoolSize")
  private Integer streamableThreadPoolSize = 10;

  @JsonProperty("useVirtualThreads")
  private Boolean useVirtualThreads = true;
}
