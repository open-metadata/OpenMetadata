/*
 *  Copyright 2026 Collate.
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

package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.api.configuration.LoginConfiguration;
import org.openmetadata.schema.api.configuration.OpenMetadataBaseUrlConfiguration;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.service.exception.SystemSettingsException;

class OpenMetadataBaseUrlValidatorTest {

  @ParameterizedTest
  @ValueSource(
      strings = {
        "http://localhost:8585",
        "https://example.org",
        "https://example.org/openmetadata",
        "HTTPS://example.org",
        "http://my_host:8585"
      })
  void acceptsAbsoluteHttpUrl(String url) {
    assertDoesNotThrow(() -> OpenMetadataBaseUrlValidator.validateUrl(url));
  }

  @ParameterizedTest
  @ValueSource(
      strings = {"example.org", "localhost:8585", "/api/v1", "ftp://example.org", "http://"})
  void rejectsUrlWithoutHttpSchemeAndHost(String url) {
    SystemSettingsException ex =
        assertThrows(
            SystemSettingsException.class, () -> OpenMetadataBaseUrlValidator.validateUrl(url));
    assertTrue(ex.getMessage().contains(url));
  }

  @ParameterizedTest
  @NullAndEmptySource
  void rejectsMissingUrl(String url) {
    assertThrows(
        SystemSettingsException.class, () -> OpenMetadataBaseUrlValidator.validateUrl(url));
  }

  @Test
  void rejectsBaseUrlSettingWithoutScheme() {
    Settings setting =
        new Settings()
            .withConfigType(SettingsType.OPEN_METADATA_BASE_URL_CONFIGURATION)
            .withConfigValue(
                new OpenMetadataBaseUrlConfiguration().withOpenMetadataUrl("example.org"));

    assertThrows(
        SystemSettingsException.class, () -> OpenMetadataBaseUrlValidator.validate(setting));
  }

  @Test
  void acceptsBaseUrlSettingWithScheme() {
    Settings setting =
        new Settings()
            .withConfigType(SettingsType.OPEN_METADATA_BASE_URL_CONFIGURATION)
            .withConfigValue(
                new OpenMetadataBaseUrlConfiguration().withOpenMetadataUrl("https://example.org"));

    assertDoesNotThrow(() -> OpenMetadataBaseUrlValidator.validate(setting));
  }

  @Test
  void ignoresOtherSettingTypes() {
    Settings setting =
        new Settings()
            .withConfigType(SettingsType.LOGIN_CONFIGURATION)
            .withConfigValue(new LoginConfiguration().withMaxLoginFailAttempts(3));

    assertDoesNotThrow(() -> OpenMetadataBaseUrlValidator.validate(setting));
  }
}
