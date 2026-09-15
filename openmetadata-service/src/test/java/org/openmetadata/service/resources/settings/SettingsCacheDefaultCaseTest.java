package org.openmetadata.service.resources.settings;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import com.google.common.cache.CacheLoader;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.configuration.MCPConfiguration;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.SystemRepository;
import org.slf4j.LoggerFactory;

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

      // An unset setting surfaces as InvalidCacheLoadException, which is what
      // getSettingOrDefault() distinguishes from a genuine load failure
      assertThrows(CacheLoader.InvalidCacheLoadException.class, () -> SettingsCache.CACHE.get(key));
    }
  }

  @Test
  void testUnsetSettingReturnsTheDefaultWithoutLoggingAnError() {
    final Logger logger = (Logger) LoggerFactory.getLogger(SettingsCache.class);
    final ListAppender<ILoggingEvent> appender = attachListAppender(logger);

    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      SystemRepository mockSystemRepo = mock(SystemRepository.class);
      String key = SettingsType.MCP_CONFIGURATION.toString();
      when(mockSystemRepo.getConfigWithKey(key)).thenReturn(null);
      entityMock.when(Entity::getSystemRepository).thenReturn(mockSystemRepo);

      SettingsCache.CACHE.invalidate(key);

      MCPConfiguration fallback = new MCPConfiguration();
      assertSame(
          fallback,
          SettingsCache.getSettingOrDefault(
              SettingsType.MCP_CONFIGURATION, fallback, MCPConfiguration.class));
      assertNoErrorLogged(appender);
    } finally {
      logger.detachAppender(appender);
      appender.stop();
    }
  }

  private static ListAppender<ILoggingEvent> attachListAppender(final Logger logger) {
    final ListAppender<ILoggingEvent> appender = new ListAppender<>();
    appender.start();
    logger.addAppender(appender);
    return appender;
  }

  private static void assertNoErrorLogged(final ListAppender<ILoggingEvent> appender) {
    assertTrue(appender.list.stream().noneMatch(event -> event.getLevel() == Level.ERROR));
  }
}
