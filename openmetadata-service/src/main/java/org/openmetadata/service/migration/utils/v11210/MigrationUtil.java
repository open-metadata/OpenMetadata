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
import org.openmetadata.schema.api.search.Aggregation;
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
  private static final Set<String> STALE_FLATTENED_CHILDREN_FIELDS =
      Set.of(
          "columns.children.name",
          "columns.children.description",
          "dataModel.columns.children.name",
          "messageSchema.schemaFields.children.name",
          "requestSchema.schemaFields.children.name",
          "responseSchema.schemaFields.children.name");

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

  // PR #27080 renamed the file search field and aggregation from "extension" (flattened —
  // unsupported for terms agg and multi_match on OpenSearch) to "fileExtension" (keyword). The
  // seed was updated but the additive settings merge means clusters upgraded from pre-1.12.5
  // still carry both stale entries, causing a 500 on every file search query on OpenSearch.
  private static final String STALE_FILE_EXTENSION_FIELD = "extension";
  private static final String FILE_ASSET_TYPE = "file";

  public static void removeStaleFileExtensionAggregation() {
    try {
      Settings searchSettings = SearchSettingsMergeUtil.getSearchSettingsFromDatabase();
      if (searchSettings == null) {
        LOG.warn("Search settings not found in database; skipping stale file extension scrub");
        return;
      }
      SearchSettings currentSettings = SearchSettingsMergeUtil.loadSearchSettings(searchSettings);
      if (stripStaleFileExtensionSettings(currentSettings)) {
        SearchSettingsMergeUtil.saveSearchSettings(searchSettings, currentSettings);
        LOG.info("Removed stale 'extension' searchField and aggregation from file search settings");
      } else {
        LOG.info("No stale 'extension' entries found in file search settings");
      }
    } catch (Exception e) {
      LOG.error("Error removing stale file extension settings", e);
    }
  }

  public static boolean stripStaleFileExtensionSettings(SearchSettings settings) {
    boolean changed = false;
    if (settings == null) {
      return false;
    }
    for (AssetTypeConfiguration assetConfig : listOrEmpty(settings.getAssetTypeConfigurations())) {
      if (FILE_ASSET_TYPE.equals(assetConfig.getAssetType())) {
        changed |= removeStaleAggregation(assetConfig.getAggregations());
        changed |= removeStaleSearchField(assetConfig.getSearchFields());
      }
    }
    return changed;
  }

  private static boolean removeStaleAggregation(List<Aggregation> aggregations) {
    boolean removed = false;
    if (!nullOrEmpty(aggregations)) {
      removed = aggregations.removeIf(agg -> STALE_FILE_EXTENSION_FIELD.equals(agg.getField()));
    }
    return removed;
  }

  private static boolean removeStaleSearchField(List<FieldBoost> searchFields) {
    boolean removed = false;
    if (!nullOrEmpty(searchFields)) {
      removed = searchFields.removeIf(field -> STALE_FILE_EXTENSION_FIELD.equals(field.getField()));
    }
    return removed;
  }
}
