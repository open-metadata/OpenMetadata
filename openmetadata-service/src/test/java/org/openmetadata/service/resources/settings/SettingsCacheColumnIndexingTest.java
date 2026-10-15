package org.openmetadata.service.resources.settings;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.api.search.GlobalSettings;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.SystemRepository;
import org.slf4j.LoggerFactory;

class SettingsCacheColumnIndexingTest {

  private static final String SEARCH_SETTINGS = SettingsType.SEARCH_SETTINGS.toString();

  private final SystemRepository systemRepository = mock(SystemRepository.class);
  private MockedStatic<Entity> entityMock;

  @BeforeEach
  void setUp() {
    entityMock = mockStatic(Entity.class);
    entityMock.when(Entity::getSystemRepository).thenReturn(systemRepository);
    SettingsCache.invalidateSettings(SEARCH_SETTINGS);
  }

  @AfterEach
  void tearDown() {
    SettingsCache.invalidateSettings(SEARCH_SETTINGS);
    entityMock.close();
  }

  @Test
  void settingsSavedBeforeTheFlagExistedStillIndexColumns() {
    assertTrue(SettingsCache.isColumnIndexingEnabled((SearchSettings) null));
    assertTrue(SettingsCache.isColumnIndexingEnabled(new SearchSettings()));
    assertTrue(
        SettingsCache.isColumnIndexingEnabled(
            new SearchSettings()
                .withGlobalSettings(new GlobalSettings().withEnableColumnIndexing(null))));
  }

  @Test
  void readsTheStoredFlagUntilTheSearchSettingsAreInvalidated() {
    storeColumnIndexing(false);
    assertFalse(SettingsCache.isColumnIndexingEnabled());

    storeColumnIndexing(true);
    assertFalse(SettingsCache.isColumnIndexingEnabled());

    SettingsCache.invalidateSettings(SEARCH_SETTINGS);
    assertTrue(SettingsCache.isColumnIndexingEnabled());
  }

  @Test
  void freshInstallWithoutSearchSettingsIndexesColumnsWithoutLoggingAnError() {
    when(systemRepository.getConfigWithKey(SEARCH_SETTINGS)).thenReturn(null);
    final Logger logger = (Logger) LoggerFactory.getLogger(SettingsCache.class);
    final ListAppender<ILoggingEvent> appender = new ListAppender<>();
    appender.start();
    logger.addAppender(appender);

    try {
      assertTrue(SettingsCache.isColumnIndexingEnabled());
      assertTrue(appender.list.stream().noneMatch(event -> event.getLevel() == Level.ERROR));
    } finally {
      logger.detachAppender(appender);
      appender.stop();
    }
  }

  private void storeColumnIndexing(final boolean enabled) {
    final SearchSettings searchSettings =
        new SearchSettings()
            .withGlobalSettings(new GlobalSettings().withEnableColumnIndexing(enabled));
    when(systemRepository.getConfigWithKey(SEARCH_SETTINGS))
        .thenReturn(
            new Settings()
                .withConfigType(SettingsType.SEARCH_SETTINGS)
                .withConfigValue(searchSettings));
  }
}
