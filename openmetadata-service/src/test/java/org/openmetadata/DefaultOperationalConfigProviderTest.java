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

package org.openmetadata;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.dropwizard.configuration.ConfigurationException;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.openmetadata.schema.api.configuration.OpenMetadataBaseUrlConfiguration;
import org.openmetadata.schema.api.security.OpsConfig;
import org.openmetadata.schema.email.SmtpSettings;
import org.openmetadata.schema.operations.OperationalConfiguration;

class DefaultOperationalConfigProviderTest {

  private static final String VALID_EMAIL_BLOCK =
      """
      email:
        emailingEntity: OpenMetadata
        enableSmtpServer: false
        senderMail: sender@example.com
        serverEndpoint: smtp.example.com
        serverPort: 587
        username: user
        password: pass
        transportationStrategy: SMTP_TLS
        templates: openmetadata
      """;

  private static final String VALID_SERVER_URL_BLOCK =
      """
      serverUrl:
        openMetadataUrl: http://localhost:8585
      """;

  @TempDir Path tempDir;

  private Path writeYaml(String name, String content) throws IOException {
    Path file = tempDir.resolve(name);
    Files.writeString(file, content);
    return file;
  }

  @Test
  void readOperationsConfigParsesYamlWithBothBlocks() throws Exception {
    Path file = writeYaml("valid.yaml", VALID_EMAIL_BLOCK + VALID_SERVER_URL_BLOCK);
    OperationalConfiguration configuration =
        DefaultOperationalConfigProvider.readOperationsConfig(file.toString());

    assertNotNull(configuration, "configuration should be parsed");
    assertNotNull(configuration.getEmail(), "email block should be populated");
    assertNotNull(configuration.getServerUrl(), "serverUrl block should be populated");
    assertEquals("http://localhost:8585", configuration.getServerUrl().getOpenMetadataUrl());
  }

  @Test
  void readOperationsConfigParsesShippedOperationsYaml() throws Exception {
    // The shipped conf/operations.yaml sets both `email:` and `serverUrl:` blocks with
    // env-var-overridable defaults, so it must still satisfy the new `required` constraint;
    // otherwise the default deployment would fail to boot.
    OperationalConfiguration configuration =
        DefaultOperationalConfigProvider.readOperationsConfig("../conf/operations.yaml");

    assertNotNull(configuration.getEmail(), "shipped operations.yaml must keep the email block");
    assertNotNull(
        configuration.getServerUrl(), "shipped operations.yaml must keep the serverUrl block");
    assertNotNull(
        configuration.getServerUrl().getOpenMetadataUrl(),
        "shipped operations.yaml must resolve a non-null base url");
  }

  @Test
  void readOperationsConfigFailsFastWhenServerUrlIsOmitted() throws Exception {
    Path file = writeYaml("missing-server-url.yaml", VALID_EMAIL_BLOCK);

    ConfigurationException ex =
        assertThrows(
            ConfigurationException.class,
            () -> DefaultOperationalConfigProvider.readOperationsConfig(file.toString()));
    assertTrue(
        ex.getMessage().contains("serverUrl"),
        "validation error should mention the missing serverUrl block: " + ex.getMessage());
  }

  @Test
  void readOperationsConfigFailsFastWhenEmailIsOmitted() throws Exception {
    Path file = writeYaml("missing-email.yaml", VALID_SERVER_URL_BLOCK);

    ConfigurationException ex =
        assertThrows(
            ConfigurationException.class,
            () -> DefaultOperationalConfigProvider.readOperationsConfig(file.toString()));
    assertTrue(
        ex.getMessage().contains("email"),
        "validation error should mention the missing email block: " + ex.getMessage());
  }

  @Test
  void readOperationsConfigFailsFastWhenBothBlocksAreOmitted() throws Exception {
    Path file = writeYaml("empty.yaml", "");

    assertThrows(
        ConfigurationException.class,
        () -> DefaultOperationalConfigProvider.readOperationsConfig(file.toString()));
  }

  @Test
  void providerWithEnabledFlagAndValidYamlPopulatesBothSettings() throws Exception {
    Path file = writeYaml("valid.yaml", VALID_EMAIL_BLOCK + VALID_SERVER_URL_BLOCK);
    OpsConfig opsConfig =
        new OpsConfig().withEnable(true).withOperationsConfigFile(file.toString());

    DefaultOperationalConfigProvider provider = new DefaultOperationalConfigProvider(opsConfig);

    assertNotNull(provider.getEmailSettings(), "email settings should be populated from yaml");
    assertNotNull(provider.getServerUrl(), "server url should be populated from yaml");
    assertEquals("http://localhost:8585", provider.getServerUrl().getOpenMetadataUrl());
    assertFalse(
        provider.getEmailSettings().getEnableSmtpServer(),
        "enableSmtpServer should reflect the yaml value");
  }

  @Test
  void providerWithEnabledFlagFailsFastOnPartialYamlMissingServerUrl() throws Exception {
    Path file = writeYaml("missing-server-url.yaml", VALID_EMAIL_BLOCK);
    OpsConfig opsConfig =
        new OpsConfig().withEnable(true).withOperationsConfigFile(file.toString());

    assertThrows(
        ConfigurationException.class, () -> new DefaultOperationalConfigProvider(opsConfig));
  }

  @Test
  void providerWithDisabledFlagAppliesDefaultsInsteadOfReadingFile() throws Exception {
    OpsConfig opsConfig =
        new OpsConfig().withEnable(false).withOperationsConfigFile("does-not-exist.yaml");

    DefaultOperationalConfigProvider provider = new DefaultOperationalConfigProvider(opsConfig);

    assertNotNull(provider.getEmailSettings(), "disabled branch should seed default smtp settings");
    assertNotNull(provider.getServerUrl(), "disabled branch should seed default server url");
    assertEquals("http://localhost:8585", provider.getServerUrl().getOpenMetadataUrl());
    assertFalse(
        provider.getEmailSettings().getEnableSmtpServer(),
        "default smtp settings should keep the server disabled");
  }

  @Test
  void applyConfigurationThrowsWhenEmailBlockIsNull() {
    DefaultOperationalConfigProvider provider =
        new DefaultOperationalConfigProvider(new OpsConfig().withEnable(false));

    OperationalConfiguration configuration =
        new OperationalConfiguration()
            .withServerUrl(
                new OpenMetadataBaseUrlConfiguration()
                    .withOpenMetadataUrl("http://localhost:8585"));

    IllegalStateException ex =
        assertThrows(IllegalStateException.class, () -> provider.applyConfiguration(configuration));
    assertTrue(ex.getMessage().contains("email"), "error should identify the missing email block");
  }

  @Test
  void applyConfigurationThrowsWhenServerUrlBlockIsNull() {
    DefaultOperationalConfigProvider provider =
        new DefaultOperationalConfigProvider(new OpsConfig().withEnable(false));

    OperationalConfiguration configuration =
        new OperationalConfiguration().withEmail(new SmtpSettings());

    IllegalStateException ex =
        assertThrows(IllegalStateException.class, () -> provider.applyConfiguration(configuration));
    assertTrue(
        ex.getMessage().contains("serverUrl"), "error should identify the missing serverUrl block");
  }

  @Test
  void applyConfigurationAppliesNonNullBlocks() {
    DefaultOperationalConfigProvider provider =
        new DefaultOperationalConfigProvider(new OpsConfig().withEnable(false));

    SmtpSettings email = new SmtpSettings().withEmailingEntity("Custom");
    OpenMetadataBaseUrlConfiguration serverUrl =
        new OpenMetadataBaseUrlConfiguration().withOpenMetadataUrl("https://example.org");
    OperationalConfiguration configuration =
        new OperationalConfiguration().withEmail(email).withServerUrl(serverUrl);

    provider.applyConfiguration(configuration);

    assertEquals(email, provider.getEmailSettings());
    assertEquals(serverUrl, provider.getServerUrl());
  }
}
