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

package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.core.Response;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.configuration.OpenMetadataBaseUrlConfiguration;
import org.openmetadata.schema.email.SmtpSettings;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.SystemSettingsException;
import org.openmetadata.service.jdbi3.SystemTokenDAOs.SystemDAO;
import org.openmetadata.service.migration.MigrationValidationClient;
import org.openmetadata.service.resources.settings.SettingsCache;

/**
 * Exercises the {@code SystemRepository.createNewSetting} seed path that {@link
 * SettingsCache#createDefaultConfiguration} uses on first boot of a fresh DB. The seed path must
 * validate the OpenMetadata base URL before persisting it, mirroring the admin write paths
 * ({@code createOrUpdate} / {@code patchSetting}); otherwise a scheme-less value such as {@code
 * localhost:8585} supplied via the YAML (or the {@code OPENMETADATA_SERVER_URL} env override) is
 * silently seeded into {@code openmetadata_settings} and breaks every entity {@code _links.href}
 * and email/notification link (issue #26451).
 */
class SystemRepositoryCreateNewSettingTest {
  private static final String BASE_URL_SETTING_NAME =
      SettingsType.OPEN_METADATA_BASE_URL_CONFIGURATION.value();
  private static final String EMAIL_SETTING_NAME = SettingsType.EMAIL_CONFIGURATION.value();

  private MockedStatic<Entity> entityMock;
  private MockedStatic<MigrationValidationClient> migrationMock;
  private MockedStatic<SettingsCache> settingsCacheMock;
  private SystemDAO systemDAO;
  private SystemRepository systemRepository;

  @BeforeEach
  void setup() {
    entityMock = mockStatic(Entity.class);
    migrationMock = mockStatic(MigrationValidationClient.class);
    settingsCacheMock = mockStatic(SettingsCache.class);

    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    systemDAO = mock(SystemDAO.class);
    when(collectionDAO.systemDAO()).thenReturn(systemDAO);
    entityMock.when(Entity::getCollectionDAO).thenReturn(collectionDAO);
    migrationMock
        .when(MigrationValidationClient::getInstance)
        .thenReturn(mock(MigrationValidationClient.class));

    systemRepository = new SystemRepository();
  }

  @AfterEach
  void tearDown() {
    settingsCacheMock.close();
    migrationMock.close();
    entityMock.close();
  }

  @Test
  void createNewSettingRejectsSchemelessBaseUrlBeforePersistence() {
    Settings setting = baseUrlSetting("localhost:8585");

    SystemSettingsException failure =
        assertThrows(
            SystemSettingsException.class, () -> systemRepository.createNewSetting(setting));

    assertTrue(
        failure.getMessage().contains("localhost:8585"),
        "error should echo the malformed URL: " + failure.getMessage());
    verify(systemDAO, never()).insertSettings(anyString(), anyString());
    settingsCacheMock.verifyNoInteractions();
  }

  @Test
  void createNewSettingRejectsBlankBaseUrlBeforePersistence() {
    Settings setting = baseUrlSetting("");

    assertThrows(SystemSettingsException.class, () -> systemRepository.createNewSetting(setting));

    verify(systemDAO, never()).insertSettings(anyString(), anyString());
    settingsCacheMock.verifyNoInteractions();
  }

  @Test
  void createNewSettingRejectsNotAUrlBaseUrlBeforePersistence() {
    Settings setting = baseUrlSetting("not-a-url");

    SystemSettingsException failure =
        assertThrows(
            SystemSettingsException.class, () -> systemRepository.createNewSetting(setting));

    assertTrue(
        failure.getMessage().contains("not-a-url"),
        "error should echo the malformed URL: " + failure.getMessage());
    verify(systemDAO, never()).insertSettings(anyString(), anyString());
    settingsCacheMock.verifyNoInteractions();
  }

  @Test
  void createNewSettingPersistsValidBaseUrl() {
    Settings setting = baseUrlSetting("http://localhost:8585");

    Response response = systemRepository.createNewSetting(setting);

    assertEquals(Response.Status.CREATED.getStatusCode(), response.getStatus());
    ArgumentCaptor<String> persistedJson = ArgumentCaptor.forClass(String.class);
    verify(systemDAO).insertSettings(eq(BASE_URL_SETTING_NAME), persistedJson.capture());
    OpenMetadataBaseUrlConfiguration persisted =
        JsonUtils.readValue(persistedJson.getValue(), OpenMetadataBaseUrlConfiguration.class);
    assertEquals("http://localhost:8585", persisted.getOpenMetadataUrl());
    settingsCacheMock.verify(() -> SettingsCache.invalidateSettings(BASE_URL_SETTING_NAME));
  }

  @Test
  void createNewSettingPersistsValidHttpsUrlWithTrailingSlashAndPath() {
    Settings setting = baseUrlSetting("https://example.org/openmetadata/");

    Response response = systemRepository.createNewSetting(setting);

    assertEquals(Response.Status.CREATED.getStatusCode(), response.getStatus());
    ArgumentCaptor<String> persistedJson = ArgumentCaptor.forClass(String.class);
    verify(systemDAO).insertSettings(eq(BASE_URL_SETTING_NAME), persistedJson.capture());
    OpenMetadataBaseUrlConfiguration persisted =
        JsonUtils.readValue(persistedJson.getValue(), OpenMetadataBaseUrlConfiguration.class);
    assertEquals("https://example.org/openmetadata/", persisted.getOpenMetadataUrl());
  }

  @Test
  void createNewSettingLeavesNonBaseUrlSettingsUnvalidated() {
    // OpenMetadataBaseUrlValidator.validate is a no-op for every setting type other than the
    // base URL configuration, so the other boot seeds (email, theme, login, ...) keep flowing
    // through unchanged. Use an email setting with a blank password so prepareSettingForUpdate
    // skips the Fernet encryption branch.
    Settings setting =
        new Settings()
            .withConfigType(SettingsType.EMAIL_CONFIGURATION)
            .withConfigValue(
                new SmtpSettings().withPassword(null).withEmailingEntity("OpenMetadata"));

    Response response = systemRepository.createNewSetting(setting);

    assertEquals(Response.Status.CREATED.getStatusCode(), response.getStatus());
    verify(systemDAO).insertSettings(eq(EMAIL_SETTING_NAME), anyString());
    settingsCacheMock.verify(() -> SettingsCache.invalidateSettings(EMAIL_SETTING_NAME));
  }

  private Settings baseUrlSetting(String openMetadataUrl) {
    return new Settings()
        .withConfigType(SettingsType.OPEN_METADATA_BASE_URL_CONFIGURATION)
        .withConfigValue(
            new OpenMetadataBaseUrlConfiguration().withOpenMetadataUrl(openMetadataUrl));
  }
}
