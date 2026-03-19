package org.openmetadata.mcp.auth;

import java.util.List;

/**
 * Represents an OAuth access token.
 */
public class AccessToken {

  private String token;

  private String clientId;

  private List<String> scopes;

  private Long expiresAt;

  private List<String> audience;

  public AccessToken() {}

  public AccessToken(String token, String clientId, List<String> scopes, Long expiresAt) {
    this.token = token;
    this.clientId = clientId;
    this.scopes = scopes;
    this.expiresAt = expiresAt;
  }

  public AccessToken(
      String token, String clientId, List<String> scopes, Long expiresAt, List<String> audience) {
    this.token = token;
    this.clientId = clientId;
    this.scopes = scopes;
    this.expiresAt = expiresAt;
    this.audience = audience;
  }

  public String getToken() {
    return token;
  }

  public void setToken(String token) {
    this.token = token;
  }

  public String getClientId() {
    return clientId;
  }

  public void setClientId(String clientId) {
    this.clientId = clientId;
  }

  public List<String> getScopes() {
    return scopes;
  }

  public void setScopes(List<String> scopes) {
    this.scopes = scopes;
  }

  public Long getExpiresAt() {
    return expiresAt;
  }

  public void setExpiresAt(Long expiresAt) {
    this.expiresAt = expiresAt;
  }

  public List<String> getAudience() {
    return audience;
  }

  public void setAudience(List<String> audience) {
    this.audience = audience;
  }
}
