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

import com.google.common.collect.ImmutableSet;
import com.microsoft.aad.msal4j.ClientCredentialFactory;
import com.microsoft.aad.msal4j.ClientCredentialParameters;
import com.microsoft.aad.msal4j.ConfidentialClientApplication;
import com.microsoft.aad.msal4j.IAuthenticationResult;
import com.microsoft.aad.msal4j.IClientCredential;
import feign.RequestTemplate;
import java.io.IOException;
import java.util.Set;
import org.openmetadata.catalog.security.client.AzureSSOClientConfig;
import org.openmetadata.catalog.services.connections.metadata.OpenMetadataServerConnection;
import org.openmetadata.client.security.interfaces.AuthenticationProvider;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class AzureAuthenticationProvider implements AuthenticationProvider {
  private static final Logger LOG = LoggerFactory.getLogger(AzureAuthenticationProvider.class);
  private OpenMetadataServerConnection serverConfig;
  private final AzureSSOClientConfig securityConfig;
  private String generatedAuthToken;
  private Long expirationTimeMillis;

  public AzureAuthenticationProvider(OpenMetadataServerConnection iConfig) {
    if (!iConfig.getAuthProvider().equals(OpenMetadataServerConnection.AuthProvider.AZURE)) {
      LOG.error("Required type to invoke is Azure for AzureAuthentication Provider");
      throw new RuntimeException("Required type to invoke is Azure for AzureAuthentication Provider");
    }
    serverConfig = iConfig;

    securityConfig = (AzureSSOClientConfig) iConfig.getSecurityConfig();
    if (securityConfig == null) {
      LOG.error("Security Config is missing, it is required");
      throw new RuntimeException("Security Config is missing, it is required");
    }
    generatedAuthToken = "";
  }

  @Override
  public AuthenticationProvider create(OpenMetadataServerConnection iConfig) {
    return new AzureAuthenticationProvider(iConfig);
  }

  @Override
  public String authToken() throws IOException {
    IClientCredential credential = ClientCredentialFactory.createFromSecret(securityConfig.getClientSecret());
    ConfidentialClientApplication cca =
        ConfidentialClientApplication.builder(securityConfig.getClientId(), credential)
            .authority(securityConfig.getAuthority())
            .build();
    Set<String> scope = ImmutableSet.of("api://" + securityConfig.getClientId() + "/.default");

    ClientCredentialParameters parameters = ClientCredentialParameters.builder(scope).build();
    IAuthenticationResult result = cca.acquireToken(parameters).join();
    generatedAuthToken = result.accessToken();
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
      try {
        this.authToken();
      } catch (IOException e) {
        throw new RuntimeException(e);
      }
    }
    if (getAccessToken() != null) {
      requestTemplate.header("Authorization", "Bearer " + getAccessToken());
    }
  }
}
