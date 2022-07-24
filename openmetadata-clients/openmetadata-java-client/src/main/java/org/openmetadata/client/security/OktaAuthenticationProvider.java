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
import io.swagger.client.ApiClient;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Date;
import org.openmetadata.catalog.services.connections.metadata.OpenMetadataServerConnection;
import org.openmetadata.client.interceptors.OktaAccessTokenRequestInterceptor;
import org.openmetadata.client.model.AccessTokenResponse;
import org.openmetadata.client.model.OktaSSOConfig;
import org.openmetadata.client.security.interfaces.AuthenticationProvider;
import org.openmetadata.client.security.interfaces.OktaAccessTokenApi;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class OktaAuthenticationProvider implements AuthenticationProvider {

  private static final Logger LOG = LoggerFactory.getLogger(GoogleAuthenticationProvider.class);

  public static final String clientAssertionType = "urn:ietf:params:oauth:client-assertion-type:jwt-bearer";
  private OpenMetadataServerConnection serverConfig;
  private OktaSSOConfig securityConfig;
  private String generatedAuthToken;
  private Long expirationTimeMillis;
  private OktaAccessTokenApi oktaSSOClient;

  public OktaAuthenticationProvider(OpenMetadataServerConnection iConfig) {
    if (!iConfig.getAuthProvider().equals(OpenMetadataServerConnection.AuthProvider.OKTA)) {
      LOG.error("Required type to invoke is OKTA for OKTA Authentication Provider");
      throw new RuntimeException("Required type to invoke is OKTA for OKTA Authentication Provider");
    }
    serverConfig = iConfig;

    securityConfig = (OktaSSOConfig) iConfig.getSecurityConfig();
    if (securityConfig == null) {
      LOG.error("Security Config is missing, it is required");
      throw new RuntimeException("Security Config is missing, it is required");
    }
    generatedAuthToken = "";

    // Setup Access Token Setting
    ApiClient oktaSSO = new ApiClient();
    oktaSSO.setBasePath(securityConfig.getAuthorizationServerURL());
    OktaAccessTokenRequestInterceptor interceptor = new OktaAccessTokenRequestInterceptor(securityConfig);
    oktaSSO.addAuthorization("OAuthToken", interceptor);
    oktaSSOClient = oktaSSO.buildClient(OktaAccessTokenApi.class);
  }

  @Override
  public AuthenticationProvider create(OpenMetadataServerConnection iConfig) {
    return new OktaAuthenticationProvider(iConfig);
  }

  @Override
  public String authToken() {
    AccessTokenResponse resp = oktaSSOClient.getAccessToken("client_credentials", "test");
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
