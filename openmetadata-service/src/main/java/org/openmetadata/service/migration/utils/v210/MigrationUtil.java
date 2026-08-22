/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.migration.utils.v210;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.api.search.AssetTypeConfiguration;
import org.openmetadata.schema.api.search.FieldBoost;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.SearchSettingsMergeUtil;

/** Migration utility for 2.1.0 archival of legacy thread storage after task cutover. */
@Slf4j
public class MigrationUtil {
  private static final String TABLE_ASSET_TYPE = "table";
  private static final String ALIASES_FIELD = "aliases";
  private static final String ALIASES_KEYWORD_FIELD = "aliases.keyword";

  private final Handle handle;
  private final ConnectionType connectionType;

  public MigrationUtil(Handle handle, ConnectionType connectionType) {
    this.handle = handle;
    this.connectionType = connectionType;
  }

  public void archiveLegacyThreadStorage() {
    if (!tableExists("thread_entity_legacy")) {
      LOG.info("No thread_entity_legacy table found, skipping legacy thread archival");
      return;
    }

    if (tableExists("thread_entity_archived")) {
      LOG.info("thread_entity_archived already exists, skipping legacy thread archival");
      return;
    }

    if (connectionType == ConnectionType.MYSQL) {
      handle.execute("RENAME TABLE thread_entity_legacy TO thread_entity_archived");
    } else {
      handle.execute("ALTER TABLE thread_entity_legacy RENAME TO thread_entity_archived");
    }

    LOG.info("Archived legacy thread storage from thread_entity_legacy to thread_entity_archived");
  }

  private boolean tableExists(String tableName) {
    try (ResultSet tables =
        handle
            .getConnection()
            .getMetaData()
            .getTables(null, null, tableName, new String[] {"TABLE"})) {
      while (tables.next()) {
        if (tableName.equalsIgnoreCase(tables.getString("TABLE_NAME"))) {
          return true;
        }
      }
      return false;
    } catch (Exception e) {
      return false;
    }
  }

  /**
   * Backfills the {@code aliases} / {@code aliases.keyword} searchFields and the {@code aliases}
   * highlightField onto the {@code table} assetTypeConfiguration of an already-installed
   * instance's stored searchSettings. searchSettings.json is seed data: the additive merge that
   * runs on startup only adds whole missing asset types, so a cluster upgrading from a pre-2.1.0
   * baseline keeps its old {@code table} entry forever and alias search silently returns zero
   * results even though the index document and mapping already carry the field. Idempotent; safe
   * to call on every reprocessing pass.
   */
  public static void addAliasesSearchSettings() {
    try {
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
    } catch (Exception e) {
      LOG.error("Error adding aliases search settings to table configuration", e);
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
