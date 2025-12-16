package org.openmetadata.service.migration.utils.v1114;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.search.AssetTypeConfiguration;
import org.openmetadata.schema.api.search.FieldValueBoost;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.SystemRepository;

@Slf4j
public class MigrationUtil {

  private static final SystemRepository systemRepository = Entity.getSystemRepository();
  private static final String SEARCH_SETTINGS_KEY = "searchSettings";

  public static void updateSearchSettingsBoostConfiguration() {
    try {
      LOG.info("Updating search settings: percentileRank factors from 0.05/0.1 to 1.0");

      Settings searchSettings = systemRepository.getConfigWithKey(SEARCH_SETTINGS_KEY);

      if (searchSettings == null) {
        LOG.warn("Search settings not found, skipping migration");
        return;
      }

      SearchSettings currentSettings =
          JsonUtils.readValue(
              JsonUtils.pojoToJson(searchSettings.getConfigValue()), SearchSettings.class);

      boolean updated = false;

      // Update global fieldValueBoosts - percentileRank factors
      if (currentSettings.getGlobalSettings() != null
          && currentSettings.getGlobalSettings().getFieldValueBoosts() != null) {
        for (FieldValueBoost boost : currentSettings.getGlobalSettings().getFieldValueBoosts()) {
          if (boost.getField() != null && boost.getField().contains("percentileRank")) {
            if (boost.getFactor() != null
                && (boost.getFactor() == 0.05 || boost.getFactor() == 0.1)) {
              LOG.info(
                  "Updating global percentileRank factor from {} to 1.0 for field: {}",
                  boost.getFactor(),
                  boost.getField());
              boost.setFactor(1.0);
              updated = true;
            }
          }
        }
      }

      // Update asset type configurations
      if (currentSettings.getAssetTypeConfigurations() != null) {
        for (AssetTypeConfiguration assetConfig : currentSettings.getAssetTypeConfigurations()) {

          // Update asset-specific fieldValueBoosts - percentileRank factors
          if (assetConfig.getFieldValueBoosts() != null) {
            for (FieldValueBoost boost : assetConfig.getFieldValueBoosts()) {
              if (boost.getField() != null && boost.getField().contains("percentileRank")) {
                if (boost.getFactor() != null
                    && (boost.getFactor() == 0.05 || boost.getFactor() == 0.1)) {
                  LOG.info(
                      "Updating percentileRank factor from {} to 1.0 for field: {} in asset type: {}",
                      boost.getFactor(),
                      boost.getField(),
                      assetConfig.getAssetType());
                  boost.setFactor(1.0);
                  updated = true;
                }
              }
            }
          }
        }
      }

      if (updated) {
        searchSettings.withConfigValue(currentSettings);
        systemRepository.updateSetting(searchSettings);
        LOG.info("Search settings percentileRank factors updated successfully");
      } else {
        LOG.info("No updates needed for search settings percentileRank factors");
      }

    } catch (Exception e) {
      LOG.error("Error updating search settings percentileRank factors", e);
      throw new RuntimeException("Failed to update search settings percentileRank factors", e);
    }
  }
}
