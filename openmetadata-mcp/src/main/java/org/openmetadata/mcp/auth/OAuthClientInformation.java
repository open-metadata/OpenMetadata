package org.openmetadata.mcp.auth;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

/**
 * RFC 7591 OAuth 2.0 Dynamic Client Registration full response (client information plus
 * metadata).
 */
@JsonIgnoreProperties(ignoreUnknown = true)
public class OAuthClientInformation extends OAuthClientMetadata {

  @JsonProperty("client_id")
  private String clientId;

  @JsonProperty("client_secret")
  private String clientSecret;

  @JsonProperty("client_id_issued_at")
  private Long clientIdIssuedAt;

  @JsonProperty("client_secret_expires_at")
  private Long clientSecretExpiresAt;

  public OAuthClientInformation() {
    super();
  }

  public String getClientId() {
    return clientId;
  }

  public void setClientId(String clientId) {
    this.clientId = clientId;
  }

  public String getClientSecret() {
    return clientSecret;
  }

  public void setClientSecret(String clientSecret) {
    this.clientSecret = clientSecret;
  }

  public Long getClientIdIssuedAt() {
    return clientIdIssuedAt;
  }

  public void setClientIdIssuedAt(Long clientIdIssuedAt) {
    this.clientIdIssuedAt = clientIdIssuedAt;
  }

  public Long getClientSecretExpiresAt() {
    return clientSecretExpiresAt;
  }

  public void setClientSecretExpiresAt(Long clientSecretExpiresAt) {
    this.clientSecretExpiresAt = clientSecretExpiresAt;
  }
}
