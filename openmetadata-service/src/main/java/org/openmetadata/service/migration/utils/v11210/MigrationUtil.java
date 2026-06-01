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
package org.openmetadata.service.migration.utils.v11210;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.List;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.search.AllowedSearchFields;
import org.openmetadata.schema.api.search.AssetTypeConfiguration;
import org.openmetadata.schema.api.search.FieldBoost;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.service.migration.utils.SearchSettingsMergeUtil;

@Slf4j
public class MigrationUtil {
  private MigrationUtil() {}

  // The recursive column/schema children subtree was remapped from flattened to
  // object/enabled:false. Its indexed leaves no longer exist so references to
  // columns.children.name, dataModel.columns.children.name, and the schemaFields
  // variants in highlightFields, searchFields, and allowedFields are now dead weight.
  // Upgraded clusters keep the stale entries because the additive settings merge
  // preserves stored asset config wholesale; this scrub removes exactly those entries.
  private static final Set<String> STALE_FLATTENED_CHILDREN_FIELDS =
      Set.of(
          "columns.children.name",
          "columns.children.description",
          "dataModel.columns.children.name",
          "messageSchema.schemaFields.children.name",
          "requestSchema.schemaFields.children.name",
          "responseSchema.schemaFields.children.name");

  /**
   * Removes every reference to the now non-indexed {@code *.children} fields from the DB-stored
   * SearchSettings on clusters upgrading to 1.12.10. The recursive column/schema {@code children}
   * subtree is mapped {@code object} with {@code "enabled": false} — stored for display, not
   * indexed — so its leaves no longer resolve. Idempotent; safe to call on every reprocessing pass.
   */
  public static void removeFlattenedChildrenSearchSettings() {
    try {
      Settings searchSettings = SearchSettingsMergeUtil.getSearchSettingsFromDatabase();
      if (searchSettings == null) {
        LOG.warn("Search settings not found in database; skipping flattened-children scrub");
      } else {
        SearchSettings currentSettings = SearchSettingsMergeUtil.loadSearchSettings(searchSettings);
        if (stripFlattenedChildrenReferences(currentSettings)) {
          SearchSettingsMergeUtil.saveSearchSettings(searchSettings, currentSettings);
          LOG.info("Removed stale flattened children references from search settings");
        } else {
          LOG.info("No stale flattened children references found in search settings");
        }
      }
    } catch (Exception e) {
      LOG.error("Error removing stale flattened children references from search settings", e);
    }
  }

  public static boolean stripFlattenedChildrenReferences(SearchSettings settings) {
    boolean changed = false;
    if (settings != null) {
      if (settings.getGlobalSettings() != null) {
        changed = removeStaleHighlightFields(settings.getGlobalSettings().getHighlightFields());
      }
      for (AssetTypeConfiguration assetConfig :
          listOrEmpty(settings.getAssetTypeConfigurations())) {
        changed |= removeStaleHighlightFields(assetConfig.getHighlightFields());
        changed |= removeStaleSearchFields(assetConfig.getSearchFields());
      }
      changed |= removeStaleAllowedFields(settings.getAllowedFields());
    }
    return changed;
  }

  private static boolean removeStaleHighlightFields(List<String> highlightFields) {
    boolean removed = false;
    if (!nullOrEmpty(highlightFields)) {
      removed = highlightFields.removeIf(STALE_FLATTENED_CHILDREN_FIELDS::contains);
    }
    return removed;
  }

  private static boolean removeStaleSearchFields(List<FieldBoost> searchFields) {
    boolean removed = false;
    if (!nullOrEmpty(searchFields)) {
      removed =
          searchFields.removeIf(
              field -> STALE_FLATTENED_CHILDREN_FIELDS.contains(field.getField()));
    }
    return removed;
  }

  private static boolean removeStaleAllowedFields(List<AllowedSearchFields> allowedFields) {
    boolean removed = false;
    for (AllowedSearchFields allowedField : listOrEmpty(allowedFields)) {
      if (!nullOrEmpty(allowedField.getFields())) {
        removed |=
            allowedField
                .getFields()
                .removeIf(field -> STALE_FLATTENED_CHILDREN_FIELDS.contains(field.getName()));
      }
    }
    return removed;
  }
}
