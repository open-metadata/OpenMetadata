package org.openmetadata.service.migration.utils;

import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.SystemRepository;

/**
 * Which {@link SystemRepository} the merge utility reads and writes through.
 *
 * <p>{@code SystemRepository}'s constructor ends with {@code Entity.setSystemRepository(this)} and
 * callers construct one freely — {@code OpenMetadataApplication}, {@code OpenMetadataOperations},
 * the {@code @Repository} scan, and {@code EmailUtil} on every use — so the registered instance is
 * replaced repeatedly over a JVM's life. Resolving it once into a {@code static final} field pinned
 * whichever instance happened to be current when this migration utility was first loaded.
 *
 * <p>Separate from {@link SearchSettingsMergeUtilTest} because these swap a global and so have to be
 * {@code @Isolated}; the merge-logic tests there are pure and should keep running in parallel.
 */
@Isolated("Swaps the globally registered SystemRepository")
class SearchSettingsMergeUtilRepositoryResolutionTest {

  private static final String SEARCH_SETTINGS = "searchSettings";

  @Test
  void readsResolveTheCurrentlyRegisteredSystemRepository() {
    SystemRepository first = mock(SystemRepository.class);
    SystemRepository second = mock(SystemRepository.class);
    Settings fromFirst = new Settings();
    Settings fromSecond = new Settings();
    when(first.getConfigWithKey(SEARCH_SETTINGS)).thenReturn(fromFirst);
    when(second.getConfigWithKey(SEARCH_SETTINGS)).thenReturn(fromSecond);

    SystemRepository original = Entity.getSystemRepository();
    try {
      Entity.setSystemRepository(first);
      assertSame(fromFirst, SearchSettingsMergeUtil.getSearchSettingsFromDatabase());

      // What SystemRepository's own constructor does on every instantiation.
      Entity.setSystemRepository(second);
      assertSame(
          fromSecond,
          SearchSettingsMergeUtil.getSearchSettingsFromDatabase(),
          "the utility must read through to the currently registered repository, not a copy taken"
              + " when the class was first loaded");
    } finally {
      Entity.setSystemRepository(original);
    }
  }

  @Test
  void writesLandInTheCurrentlyRegisteredSystemRepository() {
    AtomicReference<Settings> writtenToStale = new AtomicReference<>();
    AtomicReference<Settings> writtenToCurrent = new AtomicReference<>();
    SystemRepository stale = recording(writtenToStale);
    SystemRepository current = recording(writtenToCurrent);
    Settings settings = new Settings();

    SystemRepository original = Entity.getSystemRepository();
    try {
      Entity.setSystemRepository(stale);
      Entity.setSystemRepository(current);

      SearchSettingsMergeUtil.saveSearchSettings(settings, null);

      assertSame(
          settings,
          writtenToCurrent.get(),
          "the merged settings must be persisted through the repository registered now");
      assertNull(
          writtenToStale.get(),
          "a repository replaced before the write must not receive the settings");
    } finally {
      Entity.setSystemRepository(original);
    }
  }

  /** A repository that records the settings handed to it, so the assertion is on state written. */
  private static SystemRepository recording(AtomicReference<Settings> written) {
    SystemRepository repository = mock(SystemRepository.class);
    doAnswer(
            invocation -> {
              written.set(invocation.getArgument(0));
              return null;
            })
        .when(repository)
        .updateSetting(any());
    return repository;
  }
}
