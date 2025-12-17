package org.openmetadata.service.migration.utils.v1114;

import java.util.function.BiPredicate;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.service.migration.utils.SearchSettingsMergeUtil;

@Slf4j
public class MigrationUtil {

  public static void updateSearchSettingsBoostConfiguration() {
    try {
      LOG.info(
          "Updating search settings: merging percentileRank factors from default configuration");

      Settings searchSettings = SearchSettingsMergeUtil.getSearchSettingsFromDatabase();

      if (searchSettings == null) {
        LOG.warn("Search settings not found, skipping migration");
        return;
      }

      SearchSettings currentSettings = SearchSettingsMergeUtil.loadSearchSettings(searchSettings);
      SearchSettings defaultSettings = SearchSettingsMergeUtil.loadSearchSettingsFromFile();

      if (defaultSettings == null) {
        LOG.error("Failed to load default search settings, skipping migration");
        return;
      }

      BiPredicate<String, Double> shouldMerge =
          (field, factor) ->
              field.contains("percentileRank") && (factor == 0.05 || factor == 0.1 || factor == 2);

      boolean updated =
          SearchSettingsMergeUtil.mergeFieldValueBoosts(
              currentSettings, defaultSettings, shouldMerge, "percentileRank");

      if (updated) {
        SearchSettingsMergeUtil.saveSearchSettings(searchSettings, currentSettings);
        LOG.info("Search settings percentileRank factors merged successfully from defaults");
      } else {
        LOG.info("No updates needed for search settings percentileRank factors");
      }

    } catch (Exception e) {
      LOG.error("Error updating search settings percentileRank factors", e);
      throw new RuntimeException("Failed to update search settings percentileRank factors", e);
    }
  }
}
