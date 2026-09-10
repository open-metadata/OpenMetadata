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

package org.openmetadata.service.migration.utils.v202;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.search.AllowedSearchFields;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.service.migration.utils.SearchSettingsMergeUtil;

/**
 * Migration utility for 2.0.2 that restores the complete {@code allowedFields} catalog on existing
 * installs (issue #31261 "Issue 2"). The UI sources its "add search field" menu solely from
 * {@code allowedFields}, so a search field absent from it cannot be re-added once removed. The
 * shipped seed lists every configured search field, but an upgraded cluster keeps the older, sparser
 * catalog it saved: {@code SettingsCache} refreshes {@code allowedFields} only in memory and never
 * persists it (its change check compares the merged settings to the same mutated object). This
 * migration writes the seed's {@code allowedFields} to the stored settings so removed fields stay
 * re-addable. {@code allowedFields} is system-controlled — admins cannot override it — so replacing
 * it wholesale is safe. Idempotent; safe on every reprocessing pass.
 */
@Slf4j
public class SearchAllowedFieldsRepair {
  private SearchAllowedFieldsRepair() {}

  public static void repairAllowedFields() {
    try {
      Settings storedSettings = SearchSettingsMergeUtil.getSearchSettingsFromDatabase();
      SearchSettings seedSettings = SearchSettingsMergeUtil.loadSearchSettingsFromFile();
      if (storedSettings == null || seedSettings == null) {
        LOG.warn("Search settings unavailable; skipping allowedFields completion");
      } else {
        SearchSettings currentSettings = SearchSettingsMergeUtil.loadSearchSettings(storedSettings);
        if (currentSettings == null) {
          LOG.warn("Stored search settings could not be parsed; skipping allowedFields completion");
        } else {
          applyAndSaveIfChanged(storedSettings, currentSettings, seedSettings);
        }
      }
    } catch (Exception e) {
      LOG.error("Error completing allowedFields from seed", e);
    }
  }

  private static void applyAndSaveIfChanged(
      Settings storedSettings, SearchSettings currentSettings, SearchSettings seedSettings) {
    if (repairAllowedFields(currentSettings, seedSettings)) {
      SearchSettingsMergeUtil.saveSearchSettings(storedSettings, currentSettings);
      LOG.info("Completed allowedFields from seed so removed search fields stay re-addable");
    } else {
      LOG.info("allowedFields already matches the seed; no repair needed");
    }
  }

  public static boolean repairAllowedFields(
      SearchSettings currentSettings, SearchSettings seedSettings) {
    List<AllowedSearchFields> seedAllowedFields = seedSettings.getAllowedFields();
    boolean changed = false;
    if (!nullOrEmpty(seedAllowedFields)
        && !sameFieldNames(currentSettings.getAllowedFields(), seedAllowedFields)) {
      currentSettings.setAllowedFields(seedAllowedFields);
      changed = true;
    }
    return changed;
  }

  private static boolean sameFieldNames(
      List<AllowedSearchFields> current, List<AllowedSearchFields> seed) {
    return fieldNamesByEntity(current).equals(fieldNamesByEntity(seed));
  }

  private static Map<String, Set<String>> fieldNamesByEntity(
      List<AllowedSearchFields> allowedFields) {
    Map<String, Set<String>> result = new HashMap<>();
    for (AllowedSearchFields allowed : listOrEmpty(allowedFields)) {
      Set<String> names = new HashSet<>();
      listOrEmpty(allowed.getFields()).forEach(field -> names.add(field.getName()));
      result.put(allowed.getEntityType(), names);
    }
    return result;
  }
}
