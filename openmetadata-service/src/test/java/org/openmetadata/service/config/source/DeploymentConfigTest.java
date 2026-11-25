/*
 *  Copyright 2026 Collate
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

package org.openmetadata.service.config.source;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.schema.settings.SettingsType.APP_CONFIGURATION;
import static org.openmetadata.schema.settings.SettingsType.AUTHENTICATION_CONFIGURATION;
import static org.openmetadata.schema.settings.SettingsType.SCIM_CONFIGURATION;

import io.dropwizard.configuration.ConfigurationSourceProvider;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.api.security.OpsConfig;
import org.openmetadata.schema.configuration.ConfigSourceConfiguration;
import org.openmetadata.schema.configuration.ConfigSourceMode;
import org.openmetadata.schema.services.connections.metadata.AuthProvider;
import org.openmetadata.service.OpenMetadataApplicationConfig;

class DeploymentConfigTest {
  private static final String SERVER_YAML =
      """
      authenticationConfiguration:
        provider: ${AUTHENTICATION_PROVIDER:-basic}
        maxActiveSessionsPerUser: ${AUTHENTICATION_MAX_ACTIVE_SESSIONS_PER_USER:-5}
      """;

  private static final String OPERATIONS_YAML =
      """
      email:
        emailingEntity: ${OM_EMAIL_ENTITY:-"OpenMetadata"}
        enableSmtpServer: ${AUTHORIZER_ENABLE_SMTP:-false}
        senderMail: ${OPENMETADATA_SMTP_SENDER_MAIL:-"sender@example.com"}
        serverEndpoint: ${SMTP_SERVER_ENDPOINT:-"smtp.example.com"}
        serverPort: ${SMTP_SERVER_PORT:-"587"}
        transportationStrategy: ${SMTP_SERVER_STRATEGY:-"SMTP_TLS"}
        templates: ${TEMPLATES:-"openmetadata"}
      serverUrl:
        openMetadataUrl: ${OPENMETADATA_SERVER_URL:-"http://localhost:8585"}
      """;

  @TempDir Path tempDir;

  @AfterEach
  void tearDown() {
    ConfigTemplates.clear();
  }

  @Test
  void capturesTheConfigurationFileAsWrittenBeforeSubstitution() throws IOException {
    ConfigurationSourceProvider file =
        path -> new ByteArrayInputStream(SERVER_YAML.getBytes(StandardCharsets.UTF_8));

    try (InputStream passedOn = new RawConfigCapture(file, ConfigTemplateKind.SERVER).open("x")) {
      assertEquals(SERVER_YAML, new String(passedOn.readAllBytes(), StandardCharsets.UTF_8));
    }
    assertEquals(SERVER_YAML, ConfigTemplates.get(ConfigTemplateKind.SERVER).orElseThrow());
  }

  @Test
  void capturesDeploymentValuesWithTheirVariablesAndModes() throws IOException {
    new RawConfigCapture(
            path -> new ByteArrayInputStream(SERVER_YAML.getBytes(StandardCharsets.UTF_8)),
            ConfigTemplateKind.SERVER)
        .open("x")
        .close();
    OpenMetadataApplicationConfig config = new OpenMetadataApplicationConfig();
    config.setAuthenticationConfiguration(
        new AuthenticationConfiguration()
            .withProvider(AuthProvider.BASIC)
            .withMaxActiveSessionsPerUser(1000));

    DeploymentConfig deployment = DeploymentConfig.capture(config);

    DeploymentSetting authentication =
        deployment.setting(AUTHENTICATION_CONFIGURATION).orElseThrow();
    assertEquals(1000, authentication.value().get("maxActiveSessionsPerUser").asInt());
    assertEquals(
        "AUTHENTICATION_MAX_ACTIVE_SESSIONS_PER_USER",
        authentication.template().envVariable(List.of("/maxActiveSessionsPerUser")).orElseThrow());
    assertTrue(deployment.setting(SCIM_CONFIGURATION).isEmpty());
    assertEquals(ConfigSourceMode.AUTO, deployment.modeOf(AUTHENTICATION_CONFIGURATION));
    assertEquals(ConfigSourceMode.DB, deployment.modeOf(APP_CONFIGURATION));
    assertEquals(Duration.ofSeconds(10), deployment.watchInterval());
  }

  @Test
  void reportsEnvModeSettingsTheConfigurationFileDoesNotDefine() {
    OpenMetadataApplicationConfig config = new OpenMetadataApplicationConfig();
    config.setAuthenticationConfiguration(new AuthenticationConfiguration());
    config.setConfigSourceConfiguration(
        new ConfigSourceConfiguration()
            .withSecurity(ConfigSourceMode.ENV)
            .withScim(ConfigSourceMode.ENV));

    List<String> undefined =
        DeploymentConfig.capture(config).envModeSettingsWithoutDeploymentValue();

    assertEquals(List.of("authorizerConfiguration", "scimConfiguration"), undefined);
    assertFalse(undefined.contains("authenticationConfiguration"));
  }

  /**
   * With operational config disabled no operations file is read, and the email and server URL the
   * configuration carries are built-in fallbacks that ENV mode would store over the database.
   */
  @Test
  void reportsEnvModeEmailAndServerUrlWhenNoOperationsFileIsRead() {
    OpenMetadataApplicationConfig config = new OpenMetadataApplicationConfig();
    config.setOpsConfig(new OpsConfig().withEnable(false));
    config.setConfigSourceConfiguration(operationsGroupsInEnvMode());

    assertEquals(
        List.of("emailConfiguration", "openMetadataBaseUrlConfiguration"),
        DeploymentConfig.capture(config).envModeSettingsWithoutDeploymentValue());
  }

  @Test
  void acceptsEnvModeEmailAndServerUrlReadFromTheOperationsFile() throws IOException {
    Path operations = tempDir.resolve("operations.yaml");
    Files.writeString(operations, OPERATIONS_YAML);
    OpenMetadataApplicationConfig config = new OpenMetadataApplicationConfig();
    config.setOpsConfig(
        new OpsConfig().withEnable(true).withOperationsConfigFile(operations.toString()));
    config.setConfigSourceConfiguration(operationsGroupsInEnvMode());

    assertEquals(
        List.of(), DeploymentConfig.capture(config).envModeSettingsWithoutDeploymentValue());
  }

  private static ConfigSourceConfiguration operationsGroupsInEnvMode() {
    return new ConfigSourceConfiguration()
        .withEmail(ConfigSourceMode.ENV)
        .withServerUrl(ConfigSourceMode.ENV);
  }
}
