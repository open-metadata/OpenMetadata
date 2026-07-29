package org.openmetadata.service.resources.settings;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.SystemRepository;

class SettingsCacheDefaultCaseTest {

  // Any settings type handled by the loader's default branch, i.e. one without its own case
  private static final SettingsType SETTINGS_TYPE = SettingsType.WORKFLOW_SETTINGS;

  @AfterEach
  void cleanup() {
    SettingsCache.CACHE.invalidate(SETTINGS_TYPE.toString());
  }

  @Test
  void testDefaultCaseWithNonNullResult() throws Exception {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      SystemRepository mockSystemRepo = mock(SystemRepository.class);
      String key = SETTINGS_TYPE.toString();
      Settings settings =
          new Settings().withConfigType(SETTINGS_TYPE).withConfigValue("test-value");
      when(mockSystemRepo.getConfigWithKey(key)).thenReturn(settings);
      entityMock.when(Entity::getSystemRepository).thenReturn(mockSystemRepo);

      SettingsCache.CACHE.invalidate(key);

      Settings result = SettingsCache.CACHE.get(key);

      assertNotNull(result);
    }
  }

  @Test
  void testDefaultCaseWithNullResult() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      SystemRepository mockSystemRepo = mock(SystemRepository.class);
      String key = SETTINGS_TYPE.toString();
      when(mockSystemRepo.getConfigWithKey(key)).thenReturn(null);
      entityMock.when(Entity::getSystemRepository).thenReturn(mockSystemRepo);

      SettingsCache.CACHE.invalidate(key);

      assertThrows(Exception.class, () -> SettingsCache.CACHE.get(key));
    }
  }
}
