package org.openmetadata.mcp.auth;

import java.util.List;

/**
 * Represents an OAuth refresh token.
 */
public class RefreshToken {

  private String token;

  private String clientId;

  private String userName;

  private List<String> scopes;

  private Long expiresAt;

  public RefreshToken() {}

  public RefreshToken(String token, String clientId, List<String> scopes, Long expiresAt) {
    this.token = token;
    this.clientId = clientId;
    this.scopes = scopes;
    this.expiresAt = expiresAt;
  }

  public RefreshToken(
      String token, String clientId, String userName, List<String> scopes, Long expiresAt) {
    this.token = token;
    this.clientId = clientId;
    this.userName = userName;
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

  public String getUserName() {
    return userName;
  }

  public void setUserName(String userName) {
    this.userName = userName;
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
}
