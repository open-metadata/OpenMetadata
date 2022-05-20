/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetada.restclient.model;

import java.util.List;

public class AuthenticationConfiguration {
  private String provider;
  private String providerName;

  /** @deprecated Use publicKeyUrls */
  @Deprecated(since = "0.9.1", forRemoval = true)
  private String publicKey;

  public String getProvider() {
    return provider;
  }

  public void setProvider(String provider) {
    this.provider = provider;
  }

  public String getProviderName() {
    return providerName;
  }

  public void setProviderName(String providerName) {
    this.providerName = providerName;
  }

  public String getPublicKey() {
    return publicKey;
  }

  public void setPublicKey(String publicKey) {
    this.publicKey = publicKey;
  }

  public List<String> getPublicKeyUrls() {
    return publicKeyUrls;
  }

  public void setPublicKeyUrls(List<String> publicKeyUrls) {
    this.publicKeyUrls = publicKeyUrls;
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

  public List<String> getJwtPrincipalClaims() {
    return jwtPrincipalClaims;
  }

  public void setJwtPrincipalClaims(List<String> jwtPrincipalClaims) {
    this.jwtPrincipalClaims = jwtPrincipalClaims;
  }

  private List<String> publicKeyUrls;
  private String authority;
  private String clientId;
  private String callbackUrl;
  @Override
  public String toString() {
    return "AuthenticationConfiguration{"
        + "provider='"
        + provider
        + '\''
        + ", publicKeyUrls="
        + publicKeyUrls
        + ", authority='"
        + authority
        + '\''
        + ", clientId='"
        + clientId
        + '\''
        + ", callbackUrl='"
        + callbackUrl
        + '\''
        + ", jwtPrincipalClaims="
        + jwtPrincipalClaims
        + '}';
  }

  private List<String> jwtPrincipalClaims = List.of("email", "preferred_username", "sub");
}
