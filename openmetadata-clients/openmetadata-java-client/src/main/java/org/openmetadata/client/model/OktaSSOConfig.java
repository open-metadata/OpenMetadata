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

package org.openmetadata.client.model;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class OktaSSOConfig {
  /** Okta Client ID for the service application. (Required) */
  private String clientId;
  /** Okta Client Secret for the API service application. (Required) */
  private String clientSecret;
  /** Okta Authorization Server Url. (Required) */
  private String authorizationServerURL;

  /** Okta client scopes. */
  private List<String> scopes = new ArrayList<String>();

  /** Okta Client ID. (Required) */
  public String getClientId() {
    return clientId;
  }

  /** Okta Client ID. (Required) */
  public void setClientId(String clientId) {
    this.clientId = clientId;
  }

  public OktaSSOConfig withClientId(String clientId) {
    this.clientId = clientId;
    return this;
  }

  /** Okta Client Secret. (Required) */
  public String getClientSecret() {
    return clientSecret;
  }

  /** Okta Client Secret. (Required) */
  public void setClientSecret(String clientId) {
    this.clientSecret = clientId;
  }

  public OktaSSOConfig withClientSecret(String clientId) {
    this.clientSecret = clientId;
    return this;
  }

  /** Okta org url. (Required) */
  public String getAuthorizationServerURL() {
    return authorizationServerURL;
  }

  /** Okta org url. (Required) */
  public void setAuthorizationServerURL(String orgURL) {
    this.authorizationServerURL = orgURL;
  }

  public OktaSSOConfig withAuthorizationServerURL(String orgURL) {
    this.authorizationServerURL = orgURL;
    return this;
  }

  /** Okta client scopes. */
  public List<String> getScopes() {
    return scopes;
  }

  /** Okta client scopes. */
  public void setScopes(List<String> scopes) {
    this.scopes = scopes;
  }

  public OktaSSOConfig withScopes(List<String> scopes) {
    this.scopes = scopes;
    return this;
  }

  @Override
  public String toString() {
    StringBuilder sb = new StringBuilder();
    sb.append(OktaSSOConfig.class.getName())
        .append('@')
        .append(Integer.toHexString(System.identityHashCode(this)))
        .append('[');
    sb.append("clientId");
    sb.append('=');
    sb.append(((this.clientId == null) ? "<null>" : this.clientId));
    sb.append("clientSecret");
    sb.append('=');
    sb.append(((this.clientSecret == null) ? "<null>" : this.clientSecret));
    sb.append(',');
    sb.append("authorizationServerURL");
    sb.append('=');
    sb.append(((this.authorizationServerURL == null) ? "<null>" : this.authorizationServerURL));
    sb.append(',');
    sb.append(',');
    sb.append("scopes");
    sb.append('=');
    sb.append(((this.scopes == null) ? "<null>" : this.scopes));
    sb.append(',');
    if (sb.charAt((sb.length() - 1)) == ',') {
      sb.setCharAt((sb.length() - 1), ']');
    } else {
      sb.append(']');
    }
    return sb.toString();
  }

  public enum GrantType {
    AUTHORIZATION_CODE("authorization_code"),
    CLIENT_CREDENTIALS("client_credentials"),
    IMPLICIT("implicit");
    private final String value;
    private static final Map<String, OktaSSOConfig.GrantType> CONSTANTS =
        new HashMap<String, OktaSSOConfig.GrantType>();

    static {
      for (OktaSSOConfig.GrantType c : values()) {
        CONSTANTS.put(c.value, c);
      }
    }

    GrantType(String value) {
      this.value = value;
    }

    @Override
    public String toString() {
      return this.value;
    }

    public String value() {
      return this.value;
    }

    public static OktaSSOConfig.GrantType fromValue(String value) {
      OktaSSOConfig.GrantType constant = CONSTANTS.get(value);
      if (constant == null) {
        throw new IllegalArgumentException(value);
      } else {
        return constant;
      }
    }
  }
}
