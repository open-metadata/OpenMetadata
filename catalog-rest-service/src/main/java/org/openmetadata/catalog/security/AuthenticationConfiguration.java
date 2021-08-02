package org.openmetadata.catalog.security;

public class AuthenticationConfiguration {
  private String provider;

  private String publicKey;

  private String authority;

  private String clientId;

  private String callbackUrl;

  public String getProvider() {
    return provider;
  }

  public void setProvider(String provider) {
    this.provider = provider;
  }

  public String getPublicKey() { return publicKey; }

  public void setPublicKey(String publicKey) {
    this.publicKey = publicKey;
  }

  public String getAuthority() {
    return authority;
  }

  public void setAuthority(String authority) {
    this.authority = authority;
  }

  public String getClientId() {
    return clientId;
  }

  public void setClientId(String clientId) {
    this.clientId = clientId;
  }

  public String getCallbackUrl() {
    return callbackUrl;
  }

  public void setCallbackUrl(String callbackUrl) {
    this.callbackUrl = callbackUrl;
  }
}
