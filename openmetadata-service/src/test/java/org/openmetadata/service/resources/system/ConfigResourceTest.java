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
import org.openmetadata.api.configuration.ApplicationConfiguration;
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
        new YamlConfigurationFactory<>(OpenMetadataApplicationConfig.class, validator, objectMapper, "dw");
    config = factory.build(new FileConfigurationSourceProvider(), CONFIG_PATH);
  }

  @Test
  void get_auth_configs_200_OK() throws IOException {
    WebTarget target = getConfigResource("auth");
    AuthenticationConfiguration auth = TestUtils.get(target, AuthenticationConfiguration.class, TEST_AUTH_HEADERS);
    assertEquals(config.getAuthenticationConfiguration().getProvider(), auth.getProvider());
    assertEquals(config.getAuthenticationConfiguration().getProviderName(), auth.getProviderName());
    assertEquals(config.getAuthenticationConfiguration().getAuthority(), auth.getAuthority());
    assertEquals(config.getAuthenticationConfiguration().getCallbackUrl(), auth.getCallbackUrl());
    assertEquals(config.getAuthenticationConfiguration().getJwtPrincipalClaims(), auth.getJwtPrincipalClaims());
    assertEquals(config.getAuthenticationConfiguration().getClientId(), auth.getClientId());
  }

  @Test
  void get_authorizer_configs_200_OK() throws IOException {
    WebTarget target = getConfigResource("authorizer");
    AuthorizerConfiguration auth = TestUtils.get(target, AuthorizerConfiguration.class, TEST_AUTH_HEADERS);
    assertEquals(config.getAuthorizerConfiguration().getClassName(), auth.getClassName());
    assertEquals(config.getAuthorizerConfiguration().getPrincipalDomain(), auth.getPrincipalDomain());
    assertEquals(config.getAuthorizerConfiguration().getAdminPrincipals(), auth.getAdminPrincipals());
    assertEquals(config.getAuthorizerConfiguration().getContainerRequestFilter(), auth.getContainerRequestFilter());
    assertEquals(
        config.getAuthorizerConfiguration().getEnableSecureSocketConnection(), auth.getEnableSecureSocketConnection());
    assertEquals(config.getAuthorizerConfiguration().getEnforcePrincipalDomain(), auth.getEnforcePrincipalDomain());
  }

  @Test
  void get_airflow_configs_200_OK() throws IOException {
    WebTarget target = getConfigResource("pipeline-service-client");
    PipelineServiceAPIClientConfig auth =
        TestUtils.get(target, PipelineServiceAPIClientConfig.class, TEST_AUTH_HEADERS);
    assertEquals(config.getPipelineServiceClientConfiguration().getApiEndpoint(), auth.getApiEndpoint());
  }

  @Test
  void get_slack_chat_configs_200_OK() throws IOException {
    WebTarget target = getConfigResource("applicationConfig");
    ApplicationConfiguration applicationConfiguration =
        TestUtils.get(target, ApplicationConfiguration.class, TEST_AUTH_HEADERS);
    assertEquals(config.getApplicationConfiguration().getSlackConfig(), applicationConfiguration.getSlackConfig());
    assertEquals(config.getApplicationConfiguration().getLogoConfig(), applicationConfiguration.getLogoConfig());
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
