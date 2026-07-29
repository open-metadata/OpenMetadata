package org.openmetadata.service.resources.settings;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;
import static org.openmetadata.schema.settings.SettingsType.MCP_CONFIGURATION;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.configuration.MCPConfiguration;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.SystemRepository;

/**
 * MCP configuration is read on the main thread while the server boots. Fresh installs have no row
 * for it, so the loader has to answer with the schema defaults instead of null - a null makes
 * Guava throw InvalidCacheLoadException and leaves the MCP server without CORS origins.
 */
class SettingsCacheMcpConfigurationTest {

  private static final String KEY = MCP_CONFIGURATION.toString();

  @AfterEach
  void cleanup() {
    SettingsCache.CACHE.invalidate(KEY);
  }

  @Test
  void testMcpConfigurationFallsBackToSchemaDefaultsWhenRowIsAbsent() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      stubStoredSetting(entityMock, null);

      MCPConfiguration mcpConfig =
          SettingsCache.getSettingOrDefault(MCP_CONFIGURATION, null, MCPConfiguration.class);

      assertNotNull(mcpConfig);
      assertEquals("/api/v1/mcp", mcpConfig.getPath());
      assertEquals(Boolean.TRUE, mcpConfig.getEnabled());
      assertEquals(30000, mcpConfig.getConnectTimeout());
      assertEquals(30000, mcpConfig.getReadTimeout());
      assertTrue(mcpConfig.getAllowedOrigins().contains("http://localhost:8585"));
    }
  }

  @Test
  void testMcpConfigurationLoadsStoredRow() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      MCPConfiguration storedConfig =
          new MCPConfiguration().withBaseUrl("https://openmetadata.example.com").withEnabled(false);
      stubStoredSetting(
          entityMock,
          new Settings().withConfigType(MCP_CONFIGURATION).withConfigValue(storedConfig));

      MCPConfiguration mcpConfig =
          SettingsCache.getSettingOrDefault(MCP_CONFIGURATION, null, MCPConfiguration.class);

      assertEquals("https://openmetadata.example.com", mcpConfig.getBaseUrl());
      assertEquals(Boolean.FALSE, mcpConfig.getEnabled());
    }
  }

  @Test
  void testSeedingIsSkippedWhenTheSettingCannotBeRead() {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      SystemRepository mockSystemRepo = mock(SystemRepository.class);
      when(mockSystemRepo.settingExists(KEY)).thenThrow(new IllegalStateException("db is down"));
      entityMock.when(Entity::getSystemRepository).thenReturn(mockSystemRepo);

      // Seeding upserts, so an unreadable row must never be treated as a missing one
      assertFalse(SettingsCache.isMcpConfigurationAbsent());
    }
  }

  private void stubStoredSetting(MockedStatic<Entity> entityMock, Settings storedSetting) {
    SystemRepository mockSystemRepo = mock(SystemRepository.class);
    when(mockSystemRepo.getConfigWithKey(KEY)).thenReturn(storedSetting);
    entityMock.when(Entity::getSystemRepository).thenReturn(mockSystemRepo);
    SettingsCache.CACHE.invalidate(KEY);
  }
}
