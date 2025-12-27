package org.openmetadata.mcp.auth;

import java.util.List;

/**
 * Represents an OAuth refresh token.
 */
public class RefreshToken {

  private String token;

  private String clientId;

  private List<String> scopes;

  private Integer expiresAt;

  public RefreshToken() {}

  public RefreshToken(String token, String clientId, List<String> scopes, Integer expiresAt) {
    this.token = token;
    this.clientId = clientId;
    this.scopes = scopes;
    this.expiresAt = expiresAt;
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

  public Integer getExpiresAt() {
    return expiresAt;
  }

  public void setExpiresAt(Integer expiresAt) {
    this.expiresAt = expiresAt;
  }
}
