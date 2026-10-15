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
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.configuration.OpenMetadataBaseUrlConfiguration;
import org.openmetadata.schema.api.security.OpsConfig;
import org.openmetadata.schema.email.SmtpSettings;
import org.openmetadata.schema.operations.OperationalConfiguration;
import org.openmetadata.service.exception.SystemSettingsException;

class DefaultOperationalConfigProviderTest {

  private static DefaultOperationalConfigProvider provider() {
    return new DefaultOperationalConfigProvider(new OpsConfig().withEnable(false));
  }

  private static OperationalConfiguration withServerUrl(String openMetadataUrl) {
    return new OperationalConfiguration()
        .withEmail(new SmtpSettings())
        .withServerUrl(new OpenMetadataBaseUrlConfiguration().withOpenMetadataUrl(openMetadataUrl));
  }

  @Test
  void applyConfigurationRejectsSchemelessServerUrl() {
    // Issue #34468: a scheme-less URL must fail fast instead of being seeded into the database.
    DefaultOperationalConfigProvider provider = provider();
    OperationalConfiguration configuration = withServerUrl("localhost:8585");

    IllegalStateException ex =
        assertThrows(IllegalStateException.class, () -> provider.applyConfiguration(configuration));
    assertTrue(
        ex.getMessage().contains("openMetadataUrl"),
        "error should identify the invalid openMetadataUrl field: " + ex.getMessage());
    assertInstanceOf(SystemSettingsException.class, ex.getCause());
  }

  @Test
  void applyConfigurationRejectsNotAUrlServerUrl() {
    DefaultOperationalConfigProvider provider = provider();
    OperationalConfiguration configuration = withServerUrl("not-a-url");

    assertThrows(IllegalStateException.class, () -> provider.applyConfiguration(configuration));
  }

  @Test
  void applyConfigurationFallsBackToDefaultWhenServerUrlIsBlank() {
    DefaultOperationalConfigProvider provider = provider();

    provider.applyConfiguration(withServerUrl(""));

    assertEquals("http://localhost:8585", provider.getServerUrl().getOpenMetadataUrl());
  }

  @Test
  void applyConfigurationFallsBackToDefaultWhenServerUrlBlockIsMissing() {
    DefaultOperationalConfigProvider provider = provider();

    provider.applyConfiguration(new OperationalConfiguration().withEmail(new SmtpSettings()));

    assertEquals("http://localhost:8585", provider.getServerUrl().getOpenMetadataUrl());
  }

  @Test
  void applyConfigurationAcceptsValidBaseUrl() {
    DefaultOperationalConfigProvider provider = provider();
    OperationalConfiguration configuration = withServerUrl("https://example.org");

    provider.applyConfiguration(configuration);

    assertEquals(configuration.getEmail(), provider.getEmailSettings());
    assertEquals("https://example.org", provider.getServerUrl().getOpenMetadataUrl());
  }
}
