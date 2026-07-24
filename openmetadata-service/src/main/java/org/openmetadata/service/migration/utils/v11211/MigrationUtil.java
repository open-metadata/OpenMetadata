/*
 *  Copyright 2024 Collate.
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
package org.openmetadata.service.migration.utils.v11211;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.search.AllowedSearchFields;
import org.openmetadata.schema.api.search.AssetTypeConfiguration;
import org.openmetadata.schema.api.search.Field;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.service.migration.utils.SearchSettingsMergeUtil;

@Slf4j
public class MigrationUtil {
  private MigrationUtil() {}

  /**
   * Drop highlight fields that the search settings configuration does not mark as highlightable.
   * Only fields flagged {@code "highlight": true} in {@code allowedFields} (analyzed text fields)
   * can be highlighted; flattened/flat_object and non-indexed fields previously saved as highlight
   * fields make the highlight phase fail (500) at query time. The allow-list comes from the shipped
   * default settings (the source of truth for the flag); the stored highlightFields are filtered
   * against it. This is config-driven — no index-mapping inspection.
   */
  public static void removeUnsupportedHighlightFields() {
    try {
      Settings stored = SearchSettingsMergeUtil.getSearchSettingsFromDatabase();
      SearchSettings defaults = SearchSettingsMergeUtil.loadSearchSettingsFromFile();
      if (stored == null || defaults == null) {
        LOG.warn("Search settings not available; skipping highlight-field cleanup");
      } else {
        SearchSettings settings = SearchSettingsMergeUtil.loadSearchSettings(stored);
        if (removeDisallowedHighlightFields(settings, highlightableFields(defaults))) {
          SearchSettingsMergeUtil.saveSearchSettings(stored, settings);
          LOG.info("Removed unsupported highlight fields from stored search settings");
        } else {
          LOG.info("No unsupported highlight fields found in stored search settings");
        }
      }
    } catch (Exception e) {
      LOG.error("Error removing unsupported highlight fields from search settings", e);
    }
  }

  static Set<String> highlightableFields(SearchSettings settings) {
    Set<String> names = new HashSet<>();
    if (settings != null && settings.getAllowedFields() != null) {
      for (AllowedSearchFields allowed : settings.getAllowedFields()) {
        collectHighlightable(allowed.getFields(), names);
      }
    }
    return names;
  }

  private static void collectHighlightable(List<Field> fields, Set<String> names) {
    if (fields != null) {
      for (Field field : fields) {
        if (Boolean.TRUE.equals(field.getHighlight())) {
          names.add(field.getName());
        }
      }
    }
  }

  static boolean removeDisallowedHighlightFields(
      SearchSettings settings, Set<String> highlightable) {
    boolean changed = false;
    if (settings != null) {
      if (settings.getGlobalSettings() != null) {
        changed |=
            retainHighlightable(settings.getGlobalSettings().getHighlightFields(), highlightable);
      }
      if (settings.getAssetTypeConfigurations() != null) {
        for (AssetTypeConfiguration assetConfig : settings.getAssetTypeConfigurations()) {
          changed |= retainHighlightable(assetConfig.getHighlightFields(), highlightable);
        }
      }
    }
    return changed;
  }

  private static boolean retainHighlightable(
      List<String> highlightFields, Set<String> highlightable) {
    boolean changed = false;
    if (highlightFields != null) {
      changed = highlightFields.removeIf(field -> !highlightable.contains(field));
    }
    return changed;
  }
}
