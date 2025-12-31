package org.openmetadata.service.config;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Arrays;
import java.util.List;
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

  /**
   * List of allowed origins for CORS on OAuth endpoints.
   * Use specific origins for production security. Wildcard (*) is NOT recommended.
   * Default includes common development origins.
   */
  @JsonProperty("allowedOrigins")
  private List<String> allowedOrigins =
      Arrays.asList("http://localhost:3000", "http://localhost:8585", "http://localhost:9090");
}
