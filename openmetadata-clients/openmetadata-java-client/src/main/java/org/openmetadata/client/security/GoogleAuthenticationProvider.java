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

import com.google.auth.oauth2.AccessToken;
import com.google.auth.oauth2.IdTokenCredentials;
import com.google.auth.oauth2.ServiceAccountCredentials;
import feign.RequestTemplate;
import java.io.FileInputStream;
import java.util.Arrays;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.client.security.interfaces.AuthenticationProvider;
import org.openmetadata.schema.security.client.GoogleSSOClientConfig;
import org.openmetadata.schema.services.connections.metadata.OpenMetadataConnection;

@Slf4j
public class GoogleAuthenticationProvider implements AuthenticationProvider {
  private final GoogleSSOClientConfig securityConfig;
  private String generatedAuthToken;
  private Long expirationTimeMillis;
  private static final String OPENID_SCOPE = "https://www.googleapis.com/auth/plus.me";
  private static final String PROFILE_SCOPE = "https://www.googleapis.com/auth/userinfo.profile";
  private static final String EMAIL_SCOPE = "https://www.googleapis.com/auth/userinfo.email";

  public GoogleAuthenticationProvider(OpenMetadataConnection iConfig) {
    if (!iConfig.getAuthProvider().equals(OpenMetadataConnection.AuthProvider.GOOGLE)) {
      LOG.error("Required type to invoke is Google for GoogleAuthentication Provider");
      throw new RuntimeException("Required type to invoke is Google for GoogleAuthentication Provider");
    }

    securityConfig = (GoogleSSOClientConfig) iConfig.getSecurityConfig();
    if (securityConfig == null) {
      LOG.error("Security Config is missing, it is required");
      throw new RuntimeException("Security Config is missing, it is required");
    }

    generatedAuthToken = "";
  }

  @Override
  public AuthenticationProvider create(OpenMetadataConnection iConfig) {
    return new GoogleAuthenticationProvider(iConfig);
  }

  @Override
  public String authToken() {
    try {
      String credPath = securityConfig.getSecretKey();
      String targetAudience = securityConfig.getAudience();
      if ((credPath != null && !credPath.equals("")) && (targetAudience != null && !targetAudience.equals(""))) {
        ServiceAccountCredentials saCreds = ServiceAccountCredentials.fromStream(new FileInputStream(credPath));

        saCreds =
            (ServiceAccountCredentials) saCreds.createScoped(Arrays.asList(OPENID_SCOPE, PROFILE_SCOPE, EMAIL_SCOPE));
        IdTokenCredentials tokenCredential =
            IdTokenCredentials.newBuilder().setIdTokenProvider(saCreds).setTargetAudience(targetAudience).build();
        AccessToken token = tokenCredential.refreshAccessToken();
        this.expirationTimeMillis = token.getExpirationTime().getTime();
        this.generatedAuthToken = token.getTokenValue();
      } else {
        LOG.error("Credentials Path or Target Audience is null");
      }
    } catch (Exception ex) {
      LOG.error("Google Authentication Provider error in getting access token: {}", ex.getMessage());
    }
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
