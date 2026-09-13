package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.migration.utils.SearchSettingsMergeUtil;
import org.openmetadata.service.resources.settings.SettingsCache;

@Isolated("Mutates global search settings inside a rolled-back transaction")
class SearchSettingsMigrationIT {
  @BeforeAll
  static void initialize() {
    SdkClients.adminClient();
  }

  @Test
  void migrationReadsAndWritesJoinTheCurrentApplicationTransaction() {
    final Settings settings = currentSettings();
    final SearchSettings config = SearchSettingsMergeUtil.loadSearchSettings(settings);
    final int originalLimit = config.getGlobalSettings().getMaxAggregateSize();
    try {
      assertThrows(
          Rollback.class,
          () ->
              Entity.getJdbi()
                  .useTransaction(
                      handle -> {
                        verifyTransactionalMigration(settings, config, originalLimit);
                        throw new Rollback();
                      }));
      assertEquals(originalLimit, maxAggregateSize(currentSettings()));
    } finally {
      SettingsCache.invalidateSettings(SettingsType.SEARCH_SETTINGS.value());
    }
  }

  private static void verifyTransactionalMigration(
      final Settings settings, final SearchSettings config, final int originalLimit) {
    config.getGlobalSettings().setMaxAggregateSize(originalLimit + 1);
    Entity.getSystemRepository().updateSetting(settings.withConfigValue(config));
    assertEquals(
        originalLimit + 1,
        maxAggregateSize(SearchSettingsMergeUtil.getSearchSettingsFromDatabase()));
    config.getGlobalSettings().setMaxAggregateSize(originalLimit + 2);
    SearchSettingsMergeUtil.saveSearchSettings(settings, config);
    assertEquals(originalLimit + 2, maxAggregateSize(currentSettings()));
  }

  private static int maxAggregateSize(final Settings settings) {
    return SearchSettingsMergeUtil.loadSearchSettings(settings)
        .getGlobalSettings()
        .getMaxAggregateSize();
  }

  private static Settings currentSettings() {
    return Entity.getSystemRepository().getConfigWithKey(SettingsType.SEARCH_SETTINGS.value());
  }

  private static final class Rollback extends RuntimeException {}
}
