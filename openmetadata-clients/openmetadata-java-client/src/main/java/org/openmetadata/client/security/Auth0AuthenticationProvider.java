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

package org.openmetadata.client.security;

import feign.RequestTemplate;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.client.ApiClient;
import org.openmetadata.client.interceptors.Auth0AccessTokenRequestInterceptor;
import org.openmetadata.client.model.AccessTokenResponse;
import org.openmetadata.client.security.interfaces.Auth0AccessTokenApi;
import org.openmetadata.client.security.interfaces.AuthenticationProvider;
import org.openmetadata.schema.security.client.Auth0SSOClientConfig;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;

@Slf4j
public class Auth0AuthenticationProvider implements AuthenticationProvider {
  private String generatedAuthToken;
  private Long expirationTimeMillis;
  private final Auth0AccessTokenApi auth0SSOClient;

  public Auth0AuthenticationProvider(OpenMetadataConnection iConfig) {
    if (!iConfig.getAuthProvider().equals(OpenMetadataConnection.AuthProvider.AUTH_0)) {
      LOG.error("Required type to invoke is Auth0 for Auth0Authentication Provider");
      throw new RuntimeException("Required type to invoke is Auth0 for Auth0Authentication Provider");
    }

    Auth0SSOClientConfig securityConfig = (Auth0SSOClientConfig) iConfig.getSecurityConfig();
    if (securityConfig == null) {
      LOG.error("Security Config is missing, it is required");
      throw new RuntimeException("Security Config is missing, it is required");
    }
    generatedAuthToken = "";

    ApiClient auth0SSO = new ApiClient();
    auth0SSO.setBasePath("https://" + securityConfig.getDomain());
    Auth0AccessTokenRequestInterceptor interceptor = new Auth0AccessTokenRequestInterceptor(securityConfig);
    auth0SSO.addAuthorization("0AuthToken", interceptor);
    auth0SSOClient = auth0SSO.buildClient(Auth0AccessTokenApi.class);
  }

  @Override
  public AuthenticationProvider create(OpenMetadataConnection iConfig) {
    return new Auth0AuthenticationProvider(iConfig);
  }

  @Override
  public String authToken() {
    AccessTokenResponse resp = auth0SSOClient.getAccessToken();
    generatedAuthToken = resp.getAccessToken();
    expirationTimeMillis = Date.from(Instant.now().plus(resp.getExpiresIn(), ChronoUnit.SECONDS)).getTime();
    return generatedAuthToken;
  }

  @Override
  public String getAccessToken() {
    return generatedAuthToken;
  }

  @Override
  public void apply(RequestTemplate requestTemplate) {
    if (requestTemplate.url().contains("version")) {
      return;
    }
    if (requestTemplate.headers().containsKey("Authorization")) {
      return;
    }
    // If first time, get the token
    if (expirationTimeMillis == null || System.currentTimeMillis() >= expirationTimeMillis) {
      this.authToken();
    }

    if (getAccessToken() != null) {
      requestTemplate.header("Authorization", "Bearer " + getAccessToken());
    }
  }
}
