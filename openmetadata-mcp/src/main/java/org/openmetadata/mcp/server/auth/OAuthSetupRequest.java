package org.openmetadata.mcp.server.auth;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;

/**
 * Request body for OAuth setup endpoint.
 *
 * Used by admins to store OAuth credentials for a connector after completing
 * the one-time OAuth flow in the browser.
 */
@Data
public class OAuthSetupRequest {

  @JsonProperty("connectorName")
  private String connectorName;

  @JsonProperty("authorizationCode")
  private String authorizationCode;

  @JsonProperty("redirectUri")
  private String redirectUri;

  @JsonProperty("clientId")
  private String clientId;

  @JsonProperty("clientSecret")
  private String clientSecret;

  @JsonProperty("tokenEndpoint")
  private String tokenEndpoint; // Optional - can be inferred from connector type

  @JsonProperty("scopes")
  private String scopes; // Space-separated scopes
}
