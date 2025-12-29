package org.openmetadata.mcp.auth;

import java.net.URI;
import java.util.List;

/**
 * Parameters for an authorization request.
 */
public class AuthorizationParams {

  private String state;

  private List<String> scopes;

  private String codeChallenge;

  private URI redirectUri;

  private boolean redirectUriProvidedExplicitly;

  private String connectorName;

  public AuthorizationParams() {}

  public AuthorizationParams(
      String state,
      List<String> scopes,
      String codeChallenge,
      URI redirectUri,
      boolean redirectUriProvidedExplicitly) {
    this.state = state;
    this.scopes = scopes;
    this.codeChallenge = codeChallenge;
    this.redirectUri = redirectUri;
    this.redirectUriProvidedExplicitly = redirectUriProvidedExplicitly;
  }

  public String getState() {
    return state;
  }

  public void setState(String state) {
    this.state = state;
  }

  public List<String> getScopes() {
    return scopes;
  }

  public void setScopes(List<String> scopes) {
    this.scopes = scopes;
  }

  public String getCodeChallenge() {
    return codeChallenge;
  }

  public void setCodeChallenge(String codeChallenge) {
    this.codeChallenge = codeChallenge;
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

  public String getConnectorName() {
    return connectorName;
  }

  public void setConnectorName(String connectorName) {
    this.connectorName = connectorName;
  }
}
