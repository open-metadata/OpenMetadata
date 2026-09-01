package org.openmetadata.service.migration.utils.v1135;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.search.AssetTypeConfiguration;
import org.openmetadata.schema.api.search.FieldBoost;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.service.migration.utils.SearchSettingsMergeUtil;

/**
 * Backfills the {@code aliases} / {@code aliases.keyword} searchFields and the {@code aliases}
 * highlightField onto the {@code table} assetTypeConfiguration of an already-installed instance's
 * stored searchSettings.
 *
 * <p>searchSettings.json is seed data: the additive merge that runs on startup only adds whole
 * missing asset types, so a cluster upgrading from an older baseline keeps its own {@code table}
 * entry forever and alias search silently returns zero results even though the index document and
 * the mapping already carry the field.
 *
 * <p>Only the alias fields are added, so an operator's own boosts and highlight fields survive.
 */
@Slf4j
public class TableAliasesSearchSettingsMigration {

  private static final String TABLE_ASSET_TYPE = "table";
  private static final String ALIASES_FIELD = "aliases";
  private static final String ALIASES_KEYWORD_FIELD = "aliases.keyword";

  private TableAliasesSearchSettingsMigration() {}

  /** Idempotent; safe to call on every reprocessing pass. */
  public static void addAliasesSearchSettings() {
    Settings searchSettings = SearchSettingsMergeUtil.getSearchSettingsFromDatabase();
    if (searchSettings == null) {
      LOG.warn(
          "Search settings not found in database. "
              + "Default settings will be loaded on next startup which includes table aliases.");
      return;
    }

    SearchSettings currentSettings = SearchSettingsMergeUtil.loadSearchSettings(searchSettings);
    SearchSettings defaultSettings = SearchSettingsMergeUtil.loadSearchSettingsFromFile();
    if (defaultSettings == null) {
      LOG.error("Failed to load default search settings from file, skipping aliases migration");
      return;
    }

    if (mergeAliasesIntoTableConfiguration(currentSettings, defaultSettings)) {
      SearchSettingsMergeUtil.saveSearchSettings(searchSettings, currentSettings);
      LOG.info("Added 'aliases' search field and highlight field to table search settings");
    } else {
      LOG.info("Table search settings already include 'aliases'; no updates needed");
    }
  }

  static boolean mergeAliasesIntoTableConfiguration(
      SearchSettings currentSettings, SearchSettings defaultSettings) {
    boolean changed = false;
    AssetTypeConfiguration currentTableConfig = findTableConfiguration(currentSettings);
    AssetTypeConfiguration defaultTableConfig = findTableConfiguration(defaultSettings);
    if (currentTableConfig != null && defaultTableConfig != null) {
      changed |= mergeMissingAliasSearchFields(currentTableConfig, defaultTableConfig);
      changed |= mergeMissingAliasHighlightField(currentTableConfig, defaultTableConfig);
    }
    return changed;
  }

  private static AssetTypeConfiguration findTableConfiguration(SearchSettings settings) {
    AssetTypeConfiguration match = null;
    if (settings != null) {
      for (AssetTypeConfiguration config : listOrEmpty(settings.getAssetTypeConfigurations())) {
        if (TABLE_ASSET_TYPE.equals(config.getAssetType())) {
          match = config;
          break;
        }
      }
    }
    return match;
  }

  private static boolean mergeMissingAliasSearchFields(
      AssetTypeConfiguration currentConfig, AssetTypeConfiguration defaultConfig) {
    boolean added = false;
    List<FieldBoost> currentFields = currentConfig.getSearchFields();
    if (currentFields == null) {
      currentFields = new ArrayList<>();
      currentConfig.setSearchFields(currentFields);
    }

    Set<String> existingFieldNames = new HashSet<>();
    for (FieldBoost field : currentFields) {
      existingFieldNames.add(field.getField());
    }

    for (FieldBoost defaultField : listOrEmpty(defaultConfig.getSearchFields())) {
      boolean isAliasField =
          ALIASES_FIELD.equals(defaultField.getField())
              || ALIASES_KEYWORD_FIELD.equals(defaultField.getField());
      if (isAliasField && !existingFieldNames.contains(defaultField.getField())) {
        currentFields.add(defaultField);
        existingFieldNames.add(defaultField.getField());
        added = true;
      }
    }
    return added;
  }

  private static boolean mergeMissingAliasHighlightField(
      AssetTypeConfiguration currentConfig, AssetTypeConfiguration defaultConfig) {
    boolean added = false;
    List<String> currentHighlights = currentConfig.getHighlightFields();
    if (currentHighlights == null) {
      currentHighlights = new ArrayList<>();
      currentConfig.setHighlightFields(currentHighlights);
    }

    if (!currentHighlights.contains(ALIASES_FIELD)
        && listOrEmpty(defaultConfig.getHighlightFields()).contains(ALIASES_FIELD)) {
      currentHighlights.add(ALIASES_FIELD);
      added = true;
    }
    return added;
  }
}
