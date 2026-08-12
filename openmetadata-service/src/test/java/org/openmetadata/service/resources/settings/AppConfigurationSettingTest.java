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

package org.openmetadata.service.resources.settings;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.openmetadata.schema.settings.SettingsType.APP_CONFIGURATION;

import jakarta.json.Json;
import jakarta.json.JsonPatch;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.SecurityContext;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.configuration.AppConfiguration;
import org.openmetadata.schema.api.configuration.AppConfiguration.DefaultAppMode;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.jdbi3.SystemRepository;
import org.openmetadata.service.resources.system.SystemResource;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;

/**
 * Unit tests (Mockito, no infra) for the {@code appConfiguration} setting: first-boot yaml
 * seeding via {@link SettingsCache#seedAppConfiguration}, and the read/write auth gating on the
 * generic {@code /v1/system/settings/appConfiguration} endpoints on {@link SystemResource}.
 */
class AppConfigurationSettingTest {

  @Test
  void seedAppConfiguration_seedsFromYaml_whenDbRowAbsent() {
    SystemRepository systemRepository = mock(SystemRepository.class);
    when(systemRepository.getConfigWithKey(APP_CONFIGURATION.toString())).thenReturn(null);
    OpenMetadataApplicationConfig config = mock(OpenMetadataApplicationConfig.class);
    AppConfiguration yamlConfig = new AppConfiguration().withDefaultAppMode(DefaultAppMode.AI);
    when(config.getAppConfiguration()).thenReturn(yamlConfig);

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      mockedEntity.when(Entity::getSystemRepository).thenReturn(systemRepository);
      SettingsCache.seedAppConfiguration(config);
    }

    ArgumentCaptor<Settings> captor = ArgumentCaptor.forClass(Settings.class);
    verify(systemRepository).createNewSetting(captor.capture());
    assertEquals(APP_CONFIGURATION, captor.getValue().getConfigType());
    assertEquals(yamlConfig, captor.getValue().getConfigValue());
  }

  @Test
  void seedAppConfiguration_yamlIgnored_whenDbRowPresent() {
    SystemRepository systemRepository = mock(SystemRepository.class);
    Settings existing =
        new Settings()
            .withConfigType(APP_CONFIGURATION)
            .withConfigValue(new AppConfiguration().withDefaultAppMode(DefaultAppMode.CLASSIC));
    when(systemRepository.getConfigWithKey(APP_CONFIGURATION.toString())).thenReturn(existing);
    OpenMetadataApplicationConfig config = mock(OpenMetadataApplicationConfig.class);
    when(config.getAppConfiguration())
        .thenReturn(new AppConfiguration().withDefaultAppMode(DefaultAppMode.AI));

    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      mockedEntity.when(Entity::getSystemRepository).thenReturn(systemRepository);
      SettingsCache.seedAppConfiguration(config);
    }

    verify(systemRepository, never()).createNewSetting(any());
  }

  @Test
  void getSettingByName_appConfiguration_nonAdminAllowed_returnsDbValueVerbatim() {
    SystemRepository systemRepository = mock(SystemRepository.class);
    Settings dbValue =
        new Settings()
            .withConfigType(APP_CONFIGURATION)
            .withConfigValue(new AppConfiguration().withDefaultAppMode(DefaultAppMode.CLASSIC));
    when(systemRepository.getConfigWithKey("appConfiguration")).thenReturn(dbValue);
    Authorizer authorizer = mock(Authorizer.class);
    SecurityContext securityContext = mock(SecurityContext.class);

    SystemResource resource = buildResource(systemRepository, authorizer);

    Settings result = resource.getSettingByName(null, securityContext, "appConfiguration");

    assertSame(dbValue, result);
    verify(authorizer, never()).authorizeAdmin(any(SecurityContext.class));
  }

  @Test
  void patch_appConfiguration_nonAdmin_isRejectedBeforeTouchingRepository() {
    SystemRepository systemRepository = mock(SystemRepository.class);
    Authorizer authorizer = mock(Authorizer.class);
    SecurityContext securityContext = mock(SecurityContext.class);
    doThrow(new AuthorizationException("Not an admin"))
        .when(authorizer)
        .authorizeAdmin(securityContext);
    JsonPatch patch = Json.createPatchBuilder().add("/defaultAppMode", "ai").build();

    SystemResource resource = buildResource(systemRepository, authorizer);

    assertThrows(
        AuthorizationException.class,
        () -> resource.patch(null, securityContext, "appConfiguration", patch));
    verify(systemRepository, never()).patchSetting(any(), any());
  }

  @Test
  void patch_appConfiguration_admin_delegatesToRepository() {
    SystemRepository systemRepository = mock(SystemRepository.class);
    Authorizer authorizer = mock(Authorizer.class);
    SecurityContext securityContext = mock(SecurityContext.class);
    JsonPatch patch = Json.createPatchBuilder().add("/defaultAppMode", "ai").build();
    Response expected = Response.ok().build();
    when(systemRepository.patchSetting(eq("appConfiguration"), eq(patch))).thenReturn(expected);

    SystemResource resource = buildResource(systemRepository, authorizer);

    Response result = resource.patch(null, securityContext, "appConfiguration", patch);

    assertSame(expected, result);
    verify(authorizer).authorizeAdmin(securityContext);
  }

  private static SystemResource buildResource(
      SystemRepository systemRepository, Authorizer authorizer) {
    try (MockedStatic<Entity> mockedEntity = mockStatic(Entity.class)) {
      mockedEntity.when(Entity::getSystemRepository).thenReturn(systemRepository);
      return new SystemResource(authorizer);
    }
  }
}
