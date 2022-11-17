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
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.client.security.interfaces.AuthenticationProvider;
import org.openmetadata.schema.security.client.OpenMetadataJWTClientConfig;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;

@Slf4j
public class OpenMetadataAuthenticationProvider implements AuthenticationProvider {
  private final OpenMetadataJWTClientConfig securityConfig;
  private String generatedAuthToken;
  private Long expirationTimeMillis;

  public OpenMetadataAuthenticationProvider(OpenMetadataConnection iConfig) {
    if (!iConfig.getAuthProvider().equals(OpenMetadataConnection.AuthProvider.OPENMETADATA)) {
      LOG.error("Required type to invoke is OpenMetadata for OpenMetadataAuthentication Provider");
      throw new RuntimeException("Required type to invoke is OpenMetadata for OpenMetadataAuthentication Provider");
    }

    securityConfig = (OpenMetadataJWTClientConfig) iConfig.getSecurityConfig();
    if (securityConfig == null) {
      LOG.error("Security Config is missing, it is required");
      throw new RuntimeException("Security Config is missing, it is required");
    }
    generatedAuthToken = "";
  }

  @Override
  public AuthenticationProvider create(OpenMetadataConnection iConfig) {
    return new OpenMetadataAuthenticationProvider(iConfig);
  }

  @Override
  public String authToken() {
    generatedAuthToken = securityConfig.getJwtToken();
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
