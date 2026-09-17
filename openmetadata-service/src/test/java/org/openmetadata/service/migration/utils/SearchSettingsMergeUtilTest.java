package org.openmetadata.service.migration.utils;

import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.SystemRepository;

/**
 * {@link SystemRepository}'s constructor registers itself via {@code Entity.setSystemRepository},
 * and callers such as {@code EmailUtil} construct one per use, so the global is replaced repeatedly
 * over a JVM's life. Resolving it once into a {@code static final} field pins whichever instance
 * happened to be current when this class was first loaded - during migrations, that is whatever the
 * bootstrap had installed at the time, or {@code null} if nothing had.
 */
@Isolated("Swaps the globally registered SystemRepository")
class SearchSettingsMergeUtilTest {

  @Test
  void searchSettingsResolveTheCurrentlyRegisteredSystemRepository() {
    SystemRepository first = mock(SystemRepository.class);
    SystemRepository second = mock(SystemRepository.class);
    Settings fromFirst = new Settings();
    Settings fromSecond = new Settings();
    when(first.getConfigWithKey("searchSettings")).thenReturn(fromFirst);
    when(second.getConfigWithKey("searchSettings")).thenReturn(fromSecond);

    SystemRepository original = Entity.getSystemRepository();
    try {
      Entity.setSystemRepository(first);
      assertSame(fromFirst, SearchSettingsMergeUtil.getSearchSettingsFromDatabase());

      // What SystemRepository's own constructor does on every instantiation.
      Entity.setSystemRepository(second);
      assertSame(
          fromSecond,
          SearchSettingsMergeUtil.getSearchSettingsFromDatabase(),
          "the util must read through to the currently registered repository, not a copy taken"
              + " when the class was first loaded");
    } finally {
      Entity.setSystemRepository(original);
    }
  }

  @Test
  void savingSettingsWritesThroughToTheCurrentlyRegisteredSystemRepository() {
    SystemRepository stale = mock(SystemRepository.class);
    SystemRepository current = mock(SystemRepository.class);
    Settings settings = new Settings();

    SystemRepository original = Entity.getSystemRepository();
    try {
      Entity.setSystemRepository(stale);
      Entity.setSystemRepository(current);
      SearchSettingsMergeUtil.saveSearchSettings(settings, null);

      org.mockito.Mockito.verify(current).updateSetting(settings);
      org.mockito.Mockito.verifyNoInteractions(stale);
    } finally {
      Entity.setSystemRepository(original);
    }
  }
}
