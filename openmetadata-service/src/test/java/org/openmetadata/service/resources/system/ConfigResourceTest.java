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

package org.openmetadata.service.resources.system;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.util.TestUtils.TEST_AUTH_HEADERS;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.dropwizard.configuration.ConfigurationException;
import io.dropwizard.configuration.FileConfigurationSourceProvider;
import io.dropwizard.configuration.YamlConfigurationFactory;
import io.dropwizard.jackson.Jackson;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import jakarta.ws.rs.client.WebTarget;
import java.io.IOException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.openmetadata.api.configuration.UiThemePreference;
import org.openmetadata.schema.api.configuration.LoginConfiguration;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.AuthorizerConfiguration;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.clients.pipeline.PipelineServiceAPIClientConfig;
import org.openmetadata.service.security.jwt.JWKSKey;
import org.openmetadata.service.security.jwt.JWKSResponse;
import org.openmetadata.service.util.TestUtils;

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class ConfigResourceTest extends OpenMetadataApplicationTest {

  static OpenMetadataApplicationConfig config;

  @BeforeAll
  static void setup() throws IOException, ConfigurationException {
    // Get config object from test yaml file
    ObjectMapper objectMapper = Jackson.newObjectMapper();
    ValidatorFactory validatorFactory = Validation.buildDefaultValidatorFactory();
    Validator validator = validatorFactory.getValidator();
    YamlConfigurationFactory<OpenMetadataApplicationConfig> configFactory =
        new YamlConfigurationFactory<>(
            OpenMetadataApplicationConfig.class, validator, objectMapper, "dw");
    config = configFactory.build(new FileConfigurationSourceProvider(), CONFIG_PATH);
  }

  @Test
  void get_auth_configs_200_OK() throws IOException {
    WebTarget target = getConfigResource("auth");
    AuthenticationConfiguration auth =
        TestUtils.get(target, AuthenticationConfiguration.class, TEST_AUTH_HEADERS);

    // Verify required fields are present
    assertEquals(config.getAuthenticationConfiguration().getProvider(), auth.getProvider());
    assertEquals(config.getAuthenticationConfiguration().getProviderName(), auth.getProviderName());
    assertEquals(config.getAuthenticationConfiguration().getClientType(), auth.getClientType());
    assertEquals(
        config.getAuthenticationConfiguration().getEnableSelfSignup(), auth.getEnableSelfSignup());
    assertEquals(
        config.getAuthenticationConfiguration().getJwtPrincipalClaims(),
        auth.getJwtPrincipalClaims());
    assertEquals(
        config.getAuthenticationConfiguration().getJwtPrincipalClaimsMapping(),
        auth.getJwtPrincipalClaimsMapping());
    assertEquals(config.getAuthenticationConfiguration().getClientId(), auth.getClientId());
    assertEquals(config.getAuthenticationConfiguration().getAuthority(), auth.getAuthority());
    assertEquals(config.getAuthenticationConfiguration().getCallbackUrl(), auth.getCallbackUrl());

    // For SAML, verify samlConfiguration is present but only contains authorityUrl
    if (auth.getProvider().name().equals("SAML")
        && config.getAuthenticationConfiguration().getSamlConfiguration() != null) {
      assertNotNull(auth.getSamlConfiguration());
      assertNotNull(auth.getSamlConfiguration().getIdp());
      assertEquals(
          config.getAuthenticationConfiguration().getSamlConfiguration().getIdp().getAuthorityUrl(),
          auth.getSamlConfiguration().getIdp().getAuthorityUrl());
    }

    // Verify sensitive/unused fields are excluded
    assertNull(auth.getLdapConfiguration());
    assertNull(auth.getOidcConfiguration());
    assertTrue(auth.getPublicKeyUrls().isEmpty());
    assertEquals(config.getAuthenticationConfiguration().getResponseType(), auth.getResponseType());
    assertEquals(
        config.getAuthenticationConfiguration().getTokenValidationAlgorithm(),
        auth.getTokenValidationAlgorithm());
  }

  @Test
  void get_authorizer_configs_200_OK() throws IOException {
    WebTarget target = getConfigResource("authorizer");
    AuthorizerConfiguration auth =
        TestUtils.get(target, AuthorizerConfiguration.class, TEST_AUTH_HEADERS);

    // Verify only required field is present
    assertEquals(
        config.getAuthorizerConfiguration().getPrincipalDomain(), auth.getPrincipalDomain());

    // Verify sensitive/unused fields are excluded
    assertNull(auth.getClassName());
    assertTrue(auth.getAdminPrincipals().isEmpty());
    assertNull(auth.getContainerRequestFilter());
    assertNull(auth.getEnableSecureSocketConnection());
    assertNull(auth.getEnforcePrincipalDomain());
    assertTrue(auth.getAllowedDomains().isEmpty());
    assertTrue(auth.getAllowedEmailRegistrationDomains().isEmpty());
    assertNull(auth.getBotPrincipals());
    assertTrue(auth.getTestPrincipals().isEmpty());
    assertEquals(
        config.getAuthorizerConfiguration().getUseRolesFromProvider(),
        auth.getUseRolesFromProvider());
  }

  @Test
  void get_airflow_configs_200_OK() throws IOException {
    WebTarget target = getConfigResource("pipeline-service-client");
    PipelineServiceAPIClientConfig auth =
        TestUtils.get(target, PipelineServiceAPIClientConfig.class, TEST_AUTH_HEADERS);
    assertEquals(
        config.getPipelineServiceClientConfiguration().getApiEndpoint(), auth.getApiEndpoint());
  }

  @Test
  void get_Custom_Ui_Theme_Preference_200_OK() throws IOException {
    // Test Against Default Values
    WebTarget target = getConfigResource("customUiThemePreference");
    UiThemePreference uiThemePreference =
        TestUtils.get(target, UiThemePreference.class, TEST_AUTH_HEADERS);

    assertEquals("", uiThemePreference.getCustomTheme().getPrimaryColor());
    assertEquals("", uiThemePreference.getCustomTheme().getSuccessColor());
    assertEquals("", uiThemePreference.getCustomTheme().getErrorColor());
    assertEquals("", uiThemePreference.getCustomTheme().getWarningColor());
    assertEquals("", uiThemePreference.getCustomTheme().getInfoColor());
    assertEquals("", uiThemePreference.getCustomLogoConfig().getCustomLogoUrlPath());
    assertEquals("", uiThemePreference.getCustomLogoConfig().getCustomMonogramUrlPath());
  }

  @Test
  void get_Login_Configuration_200_OK() throws IOException {
    // Test Against Default Values
    WebTarget target = getConfigResource("loginConfig");
    LoginConfiguration loginConfiguration =
        TestUtils.get(target, LoginConfiguration.class, TEST_AUTH_HEADERS);
    assertEquals(3, loginConfiguration.getMaxLoginFailAttempts());
    assertEquals(30, loginConfiguration.getAccessBlockTime());
    assertEquals(3600, loginConfiguration.getJwtTokenExpiryTime());
  }

  @Test
  void get_jwks_configs_200_OK() throws IOException {
    WebTarget target = getConfigResource("jwks");
    JWKSResponse auth = TestUtils.get(target, JWKSResponse.class, TEST_AUTH_HEADERS);
    assertNotNull(auth);
    assertEquals(1, auth.getJwsKeys().size());
    JWKSKey jwksKey = auth.getJwsKeys().get(0);
    assertEquals("RS256", jwksKey.getAlg());
    assertEquals("sig", jwksKey.getUse());
    assertEquals("RSA", jwksKey.getKty());
    assertNotNull(jwksKey.getN());
    assertNotNull(jwksKey.getE());
  }
}
