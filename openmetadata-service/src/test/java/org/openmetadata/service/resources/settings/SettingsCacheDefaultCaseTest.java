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

  @AfterEach
  void cleanup() {
    SettingsCache.CACHE.invalidate(SettingsType.MCP_CONFIGURATION.toString());
  }

  @Test
  void testDefaultCaseWithNonNullResult() throws Exception {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      SystemRepository mockSystemRepo = mock(SystemRepository.class);
      String key = SettingsType.MCP_CONFIGURATION.toString();
      Settings settings =
          new Settings()
              .withConfigType(SettingsType.MCP_CONFIGURATION)
              .withConfigValue("test-value");
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
      String key = SettingsType.MCP_CONFIGURATION.toString();
      when(mockSystemRepo.getConfigWithKey(key)).thenReturn(null);
      entityMock.when(Entity::getSystemRepository).thenReturn(mockSystemRepo);

      SettingsCache.CACHE.invalidate(key);

      assertThrows(Exception.class, () -> SettingsCache.CACHE.get(key));
    }
  }
}
