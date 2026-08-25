/*
 *  Copyright 2025 Collate.
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
package org.openmetadata.service.resources.system;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.mockStatic;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.ClientType;
import org.openmetadata.schema.api.security.ResponseType;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.service.security.auth.SecurityConfigurationManager;

/**
 * Unit tests for {@link ConfigResource#getAuthConfig()} — the public, unauthenticated endpoint the
 * login page consumes. It must reflect the persisted authentication configuration for the fields the
 * login flow depends on (regression guard for #29597, where AWS Cognito's configured {@code code}
 * response type was served back as the schema default {@code id_token}).
 */
class ConfigResourceTest {

  private static final List<String> PUBLIC_KEY_URLS =
      List.of("https://cognito-idp.us-east-1.amazonaws.com/pool/.well-known/jwks.json");

  private AuthenticationConfiguration persistedCognitoConfig() {
    return new AuthenticationConfiguration()
        .withProvider(AuthProvider.AWS_COGNITO)
        .withProviderName("aws-cognito")
        .withClientType(ClientType.PUBLIC)
        .withResponseType(ResponseType.CODE)
        .withPublicKeyUrls(PUBLIC_KEY_URLS)
        .withTokenValidationAlgorithm(AuthenticationConfiguration.TokenValidationAlgorithm.RS_384)
        .withClientId("client-id")
        .withAuthority("https://cognito-idp.us-east-1.amazonaws.com/pool");
  }

  @Test
  void getAuthConfigReflectsPersistedResponseType() {
    try (MockedStatic<SecurityConfigurationManager> managerMock =
        mockStatic(SecurityConfigurationManager.class)) {
      managerMock
          .when(SecurityConfigurationManager::getCurrentAuthConfig)
          .thenReturn(persistedCognitoConfig());

      AuthenticationConfiguration response = new ConfigResource().getAuthConfig();

      assertEquals(
          ResponseType.CODE,
          response.getResponseType(),
          "Persisted responseType 'code' must not be replaced by the schema default 'id_token'");
    }
  }

  @Test
  void getAuthConfigReflectsPersistedPublicKeyUrls() {
    try (MockedStatic<SecurityConfigurationManager> managerMock =
        mockStatic(SecurityConfigurationManager.class)) {
      managerMock
          .when(SecurityConfigurationManager::getCurrentAuthConfig)
          .thenReturn(persistedCognitoConfig());

      AuthenticationConfiguration response = new ConfigResource().getAuthConfig();

      assertEquals(
          PUBLIC_KEY_URLS,
          response.getPublicKeyUrls(),
          "Persisted publicKeyUrls must be served, not reset to the empty schema default");
    }
  }

  @Test
  void getAuthConfigReflectsPersistedTokenValidationAlgorithm() {
    try (MockedStatic<SecurityConfigurationManager> managerMock =
        mockStatic(SecurityConfigurationManager.class)) {
      managerMock
          .when(SecurityConfigurationManager::getCurrentAuthConfig)
          .thenReturn(persistedCognitoConfig());

      AuthenticationConfiguration response = new ConfigResource().getAuthConfig();

      assertEquals(
          AuthenticationConfiguration.TokenValidationAlgorithm.RS_384,
          response.getTokenValidationAlgorithm(),
          "Persisted tokenValidationAlgorithm must be served, not reset to the RS256 default");
    }
  }

  @Test
  void getAuthConfigStillExcludesSensitiveNestedConfigs() {
    try (MockedStatic<SecurityConfigurationManager> managerMock =
        mockStatic(SecurityConfigurationManager.class)) {
      managerMock
          .when(SecurityConfigurationManager::getCurrentAuthConfig)
          .thenReturn(persistedCognitoConfig());

      AuthenticationConfiguration response = new ConfigResource().getAuthConfig();

      assertNull(response.getOidcConfiguration(), "OIDC configuration must stay excluded");
      assertNull(response.getLdapConfiguration(), "LDAP configuration must stay excluded");
    }
  }
}
