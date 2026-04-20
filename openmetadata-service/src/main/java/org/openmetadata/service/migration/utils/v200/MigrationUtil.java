package org.openmetadata.service.migration.utils.v200;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.service.migration.utils.SearchSettingsMergeUtil;

/**
 * Migration utility for v2.0.0 that adds tableColumn (column) search settings configuration.
 *
 * <p>This migration adds the tableColumn asset type configuration to existing search settings,
 * enabling columns to be searchable as first-class entities in the Explore page and global search.
 */
@Slf4j
public class MigrationUtil {

  private static final String TABLE_COLUMN_ASSET_TYPE = "tableColumn";

  /**
   * Adds tableColumn (column) search settings configuration if it doesn't already exist.
   *
   * <p>This enables columns to appear in:
   *
   * <ul>
   *   <li>Data Assets dropdown aggregations in Explore page
   *   <li>Global search results
   *   <li>Tag/Glossary Term Assets tabs
   *   <li>Search Settings UI for configuration
   * </ul>
   */
  public static void addTableColumnSearchSettings() {
    try {
      LOG.info("Adding tableColumn search settings configuration for column search support");

      Settings searchSettings = SearchSettingsMergeUtil.getSearchSettingsFromDatabase();

      if (searchSettings == null) {
        LOG.warn(
            "Search settings not found in database. "
                + "Default settings will be loaded on next startup which includes tableColumn.");
        return;
      }

      SearchSettings currentSettings = SearchSettingsMergeUtil.loadSearchSettings(searchSettings);
      SearchSettings defaultSettings = SearchSettingsMergeUtil.loadSearchSettingsFromFile();

      if (defaultSettings == null) {
        LOG.error("Failed to load default search settings from file, skipping migration");
        return;
      }

      boolean assetTypeAdded =
          SearchSettingsMergeUtil.addMissingAssetTypeConfiguration(
              currentSettings, defaultSettings, TABLE_COLUMN_ASSET_TYPE);

      boolean allowedFieldsAdded =
          SearchSettingsMergeUtil.addMissingAllowedFields(
              currentSettings, defaultSettings, TABLE_COLUMN_ASSET_TYPE);

      if (assetTypeAdded || allowedFieldsAdded) {
        SearchSettingsMergeUtil.saveSearchSettings(searchSettings, currentSettings);
        LOG.info(
            "Successfully added tableColumn search settings: "
                + "assetTypeConfiguration={}, allowedFields={}",
            assetTypeAdded,
            allowedFieldsAdded);
      } else {
        LOG.info("tableColumn search settings already exist, no updates needed");
      }

    } catch (Exception e) {
      LOG.error("Error adding tableColumn search settings", e);
      throw new RuntimeException("Failed to add tableColumn search settings", e);
    }
  }
}
