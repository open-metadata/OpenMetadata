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

import static org.junit.jupiter.api.Assertions.assertEqual;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.openmetadata.service.util.TestUtils.TEST_AUTH_HEADERS;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.dropwizard.configuration.ConfigurationException;
import io.dropwizard.configuration.FileConfigurationSourceProvider;
import io.dropwizard.configuration.YamlConfigurationFactory;
import io.dropwizard.jackson.Jackson;
import io.dropwizard.jersey.validation.Validators;
import java.io.IOException;
import javax.validation.Validator;
import javax.ws.rs.client.WebTarget;
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
    Validator validator = Validators.newValidator();
    YamlConfigurationFactory<OpenMetadataApplicationConfig> factory =
        new YamlConfigurationFactory<>(
            OpenMetadataApplicationConfig.class, validator, objectMapper, "dw");
    config = factory.build(new FileConfigurationSourceProvider(), CONFIG_PATH);
  }

  @Test
  void get_auth_configs_200_OK() throws IOException {
    WebTarget target = getConfigResource("auth");
    AuthenticationConfiguration auth =
        TestUtils.get(target, AuthenticationConfiguration.class, TEST_AUTH_HEADERS);
    assertEqual(config.getAuthenticationConfiguration().getProvider(), auth.getProvider());
    assertEqual(config.getAuthenticationConfiguration().getProviderName(), auth.getProviderName());
    assertEqual(config.getAuthenticationConfiguration().getAuthority(), auth.getAuthority());
    assertEqual(config.getAuthenticationConfiguration().getCallbackUrl(), auth.getCallbackUrl());
    assertEqual(
        config.getAuthenticationConfiguration().getJwtPrincipalClaims(),
        auth.getJwtPrincipalClaims());
    assertEqual(config.getAuthenticationConfiguration().getClientId(), auth.getClientId());
  }

  @Test
  void get_authorizer_configs_200_OK() throws IOException {
    WebTarget target = getConfigResource("authorizer");
    AuthorizerConfiguration auth =
        TestUtils.get(target, AuthorizerConfiguration.class, TEST_AUTH_HEADERS);
    assertEqual(config.getAuthorizerConfiguration().getClassName(), auth.getClassName());
    assertEqual(
        config.getAuthorizerConfiguration().getPrincipalDomain(), auth.getPrincipalDomain());
    assertEqual(
        config.getAuthorizerConfiguration().getAdminPrincipals(), auth.getAdminPrincipals());
    assertEqual(
        config.getAuthorizerConfiguration().getContainerRequestFilter(),
        auth.getContainerRequestFilter());
    assertEqual(
        config.getAuthorizerConfiguration().getEnableSecureSocketConnection(),
        auth.getEnableSecureSocketConnection());
    assertEqual(
        config.getAuthorizerConfiguration().getEnforcePrincipalDomain(),
        auth.getEnforcePrincipalDomain());
  }

  @Test
  void get_airflow_configs_200_OK() throws IOException {
    WebTarget target = getConfigResource("pipeline-service-client");
    PipelineServiceAPIClientConfig auth =
        TestUtils.get(target, PipelineServiceAPIClientConfig.class, TEST_AUTH_HEADERS);
    assertEqual(
        config.getPipelineServiceClientConfiguration().getApiEndpoint(), auth.getApiEndpoint());
  }

  @Test
  void get_Custom_Ui_Theme_Preference_200_OK() throws IOException {
    // Test Against Default Values
    WebTarget target = getConfigResource("customUiThemePreference");
    UiThemePreference uiThemePreference =
        TestUtils.get(target, UiThemePreference.class, TEST_AUTH_HEADERS);

    assertEqual("", uiThemePreference.getCustomTheme().getPrimaryColor());
    assertEqual("", uiThemePreference.getCustomTheme().getSuccessColor());
    assertEqual("", uiThemePreference.getCustomTheme().getErrorColor());
    assertEqual("", uiThemePreference.getCustomTheme().getWarningColor());
    assertEqual("", uiThemePreference.getCustomTheme().getInfoColor());
    assertEqual("", uiThemePreference.getCustomLogoConfig().getCustomLogoUrlPath());
    assertEqual("", uiThemePreference.getCustomLogoConfig().getCustomMonogramUrlPath());
  }

  @Test
  void get_Login_Configuration_200_OK() throws IOException {
    // Test Against Default Values
    WebTarget target = getConfigResource("loginConfig");
    LoginConfiguration loginConfiguration =
        TestUtils.get(target, LoginConfiguration.class, TEST_AUTH_HEADERS);
    assertEqual(3, loginConfiguration.getMaxLoginFailAttempts());
    assertEqual(600, loginConfiguration.getAccessBlockTime());
    assertEqual(3600, loginConfiguration.getJwtTokenExpiryTime());
  }

  @Test
  void get_jwks_configs_200_OK() throws IOException {
    WebTarget target = getConfigResource("jwks");
    JWKSResponse auth = TestUtils.get(target, JWKSResponse.class, TEST_AUTH_HEADERS);
    assertNotNull(auth);
    assertEqual(1, auth.getJwsKeys().size());
    JWKSKey jwksKey = auth.getJwsKeys().get(0);
    assertEqual("RS256", jwksKey.getAlg());
    assertEqual("sig", jwksKey.getUse());
    assertEqual("RSA", jwksKey.getKty());
    assertNotNull(jwksKey.getN());
    assertNotNull(jwksKey.getE());
  }
}
