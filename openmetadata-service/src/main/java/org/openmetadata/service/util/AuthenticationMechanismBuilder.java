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

package org.openmetadata.service.util;

import static org.openmetadata.schema.entity.teams.AuthenticationMechanism.AuthType.JWT;
import static org.openmetadata.schema.entity.teams.AuthenticationMechanism.AuthType.SSO;

import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.auth.SSOAuthMechanism;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.security.client.Auth0SSOClientConfig;
import org.openmetadata.schema.security.client.AzureSSOClientConfig;
import org.openmetadata.schema.security.client.CustomOIDCSSOClientConfig;
import org.openmetadata.schema.security.client.GoogleSSOClientConfig;
import org.openmetadata.schema.security.client.OktaSSOClientConfig;

public class AuthenticationMechanismBuilder {

  /**
   * Build `AuthenticationMechanism` object with concrete class for the config which by definition it is a `Object`.
   *
   * @param authMechanism the auth mechanism object
   * @return auth mechanism object with concrete classes
   */
  public static AuthenticationMechanism build(AuthenticationMechanism authMechanism) {
    if (authMechanism != null) {
      if (JWT.equals(authMechanism.getAuthType())) {
        authMechanism.setConfig(JsonUtils.convertValue(authMechanism.getConfig(), JWTAuthMechanism.class));
      } else if (SSO.equals(authMechanism.getAuthType())) {
        SSOAuthMechanism ssoAuth = JsonUtils.convertValue(authMechanism.getConfig(), SSOAuthMechanism.class);
        switch (ssoAuth.getSsoServiceType()) {
          case GOOGLE:
            ssoAuth.setAuthConfig(JsonUtils.convertValue(ssoAuth.getAuthConfig(), GoogleSSOClientConfig.class));
            break;
          case OKTA:
            ssoAuth.setAuthConfig(JsonUtils.convertValue(ssoAuth.getAuthConfig(), OktaSSOClientConfig.class));
            break;
          case AUTH_0:
            ssoAuth.setAuthConfig(JsonUtils.convertValue(ssoAuth.getAuthConfig(), Auth0SSOClientConfig.class));
            break;
          case CUSTOM_OIDC:
            ssoAuth.setAuthConfig(JsonUtils.convertValue(ssoAuth.getAuthConfig(), CustomOIDCSSOClientConfig.class));
            break;
          case AZURE:
            ssoAuth.setAuthConfig(JsonUtils.convertValue(ssoAuth.getAuthConfig(), AzureSSOClientConfig.class));
            break;
          default:
            throw new IllegalArgumentException(
                String.format("SSO service type [%s] can not be parsed.", ssoAuth.getSsoServiceType()));
        }
        authMechanism.setConfig(ssoAuth);
      }
    }
    return authMechanism;
  }
}
