package org.openmetadata.mcp.auth;

import java.net.URI;
import java.util.List;

/**
 * Represents an OAuth authorization code.
 */
public class AuthorizationCode {

  private String code;

  private List<String> scopes;

  private long expiresAt;

  private String clientId;

  private String codeChallenge;

  private String codeVerifier;

  private URI redirectUri;

  private boolean redirectUriProvidedExplicitly;

  public AuthorizationCode() {}

  public AuthorizationCode(
      String code,
      List<String> scopes,
      long expiresAt,
      String clientId,
      String codeChallenge,
      URI redirectUri,
      boolean redirectUriProvidedExplicitly) {
    this.code = code;
    this.scopes = scopes;
    this.expiresAt = expiresAt;
    this.clientId = clientId;
    this.codeChallenge = codeChallenge;
    this.redirectUri = redirectUri;
    this.redirectUriProvidedExplicitly = redirectUriProvidedExplicitly;
  }

  public String getCode() {
    return code;
  }

  public void setCode(String code) {
    this.code = code;
  }

  public List<String> getScopes() {
    return scopes;
  }

  public void setScopes(List<String> scopes) {
    this.scopes = scopes;
  }

  public long getExpiresAt() {
    return expiresAt;
  }

  public void setExpiresAt(long expiresAt) {
    this.expiresAt = expiresAt;
  }

  public String getClientId() {
    return clientId;
  }

  public void setClientId(String clientId) {
    this.clientId = clientId;
  }

  public String getCodeChallenge() {
    return codeChallenge;
  }

  public void setCodeChallenge(String codeChallenge) {
    this.codeChallenge = codeChallenge;
  }

  public String getCodeVerifier() {
    return codeVerifier;
  }

  public void setCodeVerifier(String codeVerifier) {
    this.codeVerifier = codeVerifier;
  }

  public URI getRedirectUri() {
    return redirectUri;
  }

  public void setRedirectUri(URI redirectUri) {
    this.redirectUri = redirectUri;
  }

  public boolean isRedirectUriProvidedExplicitly() {
    return redirectUriProvidedExplicitly;
  }

  public void setRedirectUriProvidedExplicitly(boolean redirectUriProvidedExplicitly) {
    this.redirectUriProvidedExplicitly = redirectUriProvidedExplicitly;
  }
}
