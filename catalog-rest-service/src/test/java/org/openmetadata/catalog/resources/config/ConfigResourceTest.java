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

package org.openmetadata.catalog.resources.config;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.openmetadata.catalog.util.TestUtils.TEST_AUTH_HEADERS;

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
import org.openmetadata.catalog.CatalogApplicationConfig;
import org.openmetadata.catalog.CatalogApplicationTest;
import org.openmetadata.catalog.security.AuthenticationConfiguration;
import org.openmetadata.catalog.security.AuthorizerConfiguration;
import org.openmetadata.catalog.util.TestUtils;

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class ConfigResourceTest extends CatalogApplicationTest {

  static CatalogApplicationConfig config;

  @BeforeAll
  static void setup() throws IOException, ConfigurationException {
    // Get config object from test yaml file
    ObjectMapper objectMapper = Jackson.newObjectMapper();
    Validator validator = Validators.newValidator();
    YamlConfigurationFactory<CatalogApplicationConfig> factory =
        new YamlConfigurationFactory<>(CatalogApplicationConfig.class, validator, objectMapper, "dw");
    config = factory.build(new FileConfigurationSourceProvider(), CONFIG_PATH);
  }

  @Test
  void get_auth_configs_200_OK() throws IOException {
    WebTarget target = getConfigResource("auth");
    AuthenticationConfiguration auth = TestUtils.get(target, AuthenticationConfiguration.class, TEST_AUTH_HEADERS);
    assertEquals(config.getAuthenticationConfiguration().toString(), auth.toString());
  }

  @Test
  void get_authorizer_configs_200_OK() throws IOException {
    WebTarget target = getConfigResource("authorizer");
    AuthorizerConfiguration auth = TestUtils.get(target, AuthorizerConfiguration.class, TEST_AUTH_HEADERS);
    assertEquals(config.getAuthorizerConfiguration().toString(), auth.toString());
  }
}
