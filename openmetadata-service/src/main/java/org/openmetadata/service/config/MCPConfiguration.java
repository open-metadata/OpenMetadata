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
   * Base URL for MCP OAuth endpoints. Used for OAuth metadata (issuer, endpoints).
   * If not set, falls back to system settings (OpenMetadataBaseUrlConfiguration).
   * For clustered deployments, set this to the external-facing URL of the service.
   */
  @JsonProperty("baseUrl")
  private String baseUrl;

  /**
   * List of allowed origins for CORS on OAuth endpoints.
   * Use specific origins for production security. Wildcard (*) is NOT recommended.
   * Default includes common development origins.
   * IMPORTANT: Add your OpenMetadata server's hosted URL to this list for production deployments.
   * Example: If OpenMetadata is hosted at https://om.company.com, add it to this list.
   */
  @JsonProperty("allowedOrigins")
  private List<String> allowedOrigins =
      Arrays.asList("http://localhost:3000", "http://localhost:8585", "http://localhost:9090");

  /**
   * HTTP connection timeout in milliseconds for SSO provider metadata fetching.
   * Used by pac4j HttpURLConnection when fetching OIDC discovery documents.
   * Default: 30000ms (30 seconds)
   */
  @JsonProperty("connectTimeout")
  private Integer connectTimeout = 30000;

  /**
   * HTTP read timeout in milliseconds for SSO provider metadata fetching.
   * Used by pac4j HttpURLConnection when reading OIDC discovery responses.
   * Default: 30000ms (30 seconds)
   */
  @JsonProperty("readTimeout")
  private Integer readTimeout = 30000;
}
