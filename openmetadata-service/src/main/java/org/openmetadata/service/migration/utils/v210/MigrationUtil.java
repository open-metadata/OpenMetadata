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

import java.sql.ResultSet;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.api.search.GlobalSettings;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.SearchSettingsMergeUtil;

/**
 * Migration utility for 2.1.0: alignment of stored hybrid search weights with the shipped defaults.
 * The legacy thread-storage archival helper below is not wired to a migration step.
 */
@Slf4j
public class MigrationUtil {
  private static final double PREVIOUS_KEYWORD_WEIGHT = 0.4;
  private static final double PREVIOUS_SEMANTIC_WEIGHT = 0.6;
  private static final double KEYWORD_WEIGHT = 0.6;
  private static final double SEMANTIC_WEIGHT = 0.4;
  private static final double WEIGHT_TOLERANCE = 1e-9;

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
   * Aligns the hybrid search weights in the stored search settings with the shipped defaults.
   *
   * <p>The weights are seeded into the settings row from the schema defaults on first startup, so
   * every installation carries an explicit pair that takes precedence over a later default. Only a
   * pair equal to the previous default is rewritten; any other pair is an operator choice.
   */
  public static void alignHybridSearchWeightsWithDefaults() {
    try {
      Settings storedSettings = SearchSettingsMergeUtil.getSearchSettingsFromDatabase();
      if (storedSettings == null) {
        LOG.warn("Search settings not found in database; skipping hybrid weight alignment");
      } else {
        alignStoredHybridWeights(storedSettings);
      }
    } catch (Exception e) {
      LOG.error("Error aligning hybrid search weights in stored search settings", e);
    }
  }

  private static void alignStoredHybridWeights(Settings storedSettings) {
    SearchSettings searchSettings = SearchSettingsMergeUtil.loadSearchSettings(storedSettings);
    if (swapPreviousHybridWeights(searchSettings)) {
      SearchSettingsMergeUtil.saveSearchSettings(storedSettings, searchSettings);
      LOG.info(
          "Hybrid search weights aligned to keyword={}, semantic={}",
          KEYWORD_WEIGHT,
          SEMANTIC_WEIGHT);
    } else {
      LOG.info("Stored hybrid search weights are not the previous defaults; left unchanged");
    }
  }

  /** Returns true when the previous default pair was found and swapped. */
  public static boolean swapPreviousHybridWeights(SearchSettings searchSettings) {
    GlobalSettings globalSettings = searchSettings.getGlobalSettings();
    boolean carriesPreviousDefaults =
        globalSettings != null
            && weightIs(globalSettings.getKeywordWeight(), PREVIOUS_KEYWORD_WEIGHT)
            && weightIs(globalSettings.getSemanticWeight(), PREVIOUS_SEMANTIC_WEIGHT);
    if (carriesPreviousDefaults) {
      globalSettings.setKeywordWeight(KEYWORD_WEIGHT);
      globalSettings.setSemanticWeight(SEMANTIC_WEIGHT);
    }
    return carriesPreviousDefaults;
  }

  private static boolean weightIs(Double weight, double expected) {
    return weight != null && Math.abs(weight - expected) < WEIGHT_TOLERANCE;
  }
}
