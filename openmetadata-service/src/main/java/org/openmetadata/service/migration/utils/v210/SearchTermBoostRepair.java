/*
 *  Copyright 2026 Collate
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
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.ArrayList;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.search.AssetTypeConfiguration;
import org.openmetadata.schema.api.search.GlobalSettings;
import org.openmetadata.schema.api.search.RankingConfiguration;
import org.openmetadata.schema.api.search.RankingSignals;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.api.search.TermBoost;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.service.migration.utils.SearchSettingsMergeUtil;

/**
 * Repairs persisted tag-based term boosts. Older UI versions saved certification boosts with a
 * field path that does not exist in the search mappings. The ranking-signal allowlist introduced
 * later also omitted both tag fields exposed by the UI, causing otherwise valid boosts to be
 * discarded while building queries. Updating the seed does not replace stored ranking settings on
 * upgraded clusters, so the migration repairs both representations in place.
 */
@Slf4j
public class SearchTermBoostRepair {
  private static final String LEGACY_CERTIFICATION_FIELD = "certification.tagFQN";
  private static final String CERTIFICATION_FIELD = "certification.tagLabel.tagFQN";
  private static final String TAG_FIELD = "tags.tagFQN";
  private static final List<String> UI_TERM_BOOST_FIELDS = List.of(TAG_FIELD, CERTIFICATION_FIELD);

  private SearchTermBoostRepair() {}

  /** Loads stored search settings, applies the repair, and persists them when changed. */
  public static void repairTermBoostSettings() {
    try {
      Settings storedSettings = SearchSettingsMergeUtil.getSearchSettingsFromDatabase();
      if (storedSettings == null) {
        LOG.warn("Search settings unavailable; skipping tag term-boost repair");
        return;
      }
      SearchSettings currentSettings = SearchSettingsMergeUtil.loadSearchSettings(storedSettings);
      applyAndSaveIfChanged(storedSettings, currentSettings);
    } catch (Exception e) {
      LOG.error("Error repairing tag term boosts in stored search settings", e);
    }
  }

  private static void applyAndSaveIfChanged(
      Settings storedSettings, SearchSettings currentSettings) {
    if (currentSettings == null) {
      LOG.warn("Stored search settings could not be parsed; skipping tag term-boost repair");
    } else if (repairTermBoostSettings(currentSettings)) {
      SearchSettingsMergeUtil.saveSearchSettings(storedSettings, currentSettings);
      LOG.info("Repaired tag term boosts and ranking-signal allowlists");
    } else {
      LOG.info("Tag term boosts and ranking-signal allowlists need no repair");
    }
  }

  /** Repairs legacy field paths and enables every term-boost field exposed by the UI. */
  public static boolean repairTermBoostSettings(SearchSettings searchSettings) {
    if (searchSettings == null) {
      return false;
    }
    boolean changed = repairGlobalTermBoosts(searchSettings.getGlobalSettings());
    changed |= repairAssetConfiguration(searchSettings.getDefaultConfiguration());
    for (AssetTypeConfiguration configuration :
        listOrEmpty(searchSettings.getAssetTypeConfigurations())) {
      changed |= repairAssetConfiguration(configuration);
    }
    return changed;
  }

  private static boolean repairGlobalTermBoosts(GlobalSettings globalSettings) {
    return globalSettings != null && repairTermBoosts(globalSettings.getTermBoosts());
  }

  private static boolean repairAssetConfiguration(AssetTypeConfiguration configuration) {
    if (configuration == null) {
      return false;
    }
    boolean changed = repairTermBoosts(configuration.getTermBoosts());
    changed |= allowUiTermBoostFields(configuration.getRanking());
    return changed;
  }

  private static boolean repairTermBoosts(List<TermBoost> termBoosts) {
    boolean changed = false;
    for (TermBoost termBoost : listOrEmpty(termBoosts)) {
      if (termBoost != null && LEGACY_CERTIFICATION_FIELD.equals(termBoost.getField())) {
        termBoost.setField(CERTIFICATION_FIELD);
        changed = true;
      }
    }
    return changed;
  }

  private static boolean allowUiTermBoostFields(RankingConfiguration ranking) {
    RankingSignals signals = ranking == null ? null : ranking.getSignals();
    if (signals == null || nullOrEmpty(signals.getFields())) {
      return false;
    }
    List<String> fields = new ArrayList<>(signals.getFields());
    boolean changed = false;
    for (String field : UI_TERM_BOOST_FIELDS) {
      if (!fields.contains(field)) {
        fields.add(field);
        changed = true;
      }
    }
    if (changed) {
      signals.setFields(fields);
    }
    return changed;
  }
}
