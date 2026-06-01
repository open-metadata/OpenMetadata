package org.openmetadata.service.migration.utils.v11210;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.search.Aggregation;
import org.openmetadata.schema.api.search.AssetTypeConfiguration;
import org.openmetadata.schema.api.search.FieldBoost;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.service.migration.utils.SearchSettingsMergeUtil;

@Slf4j
public class MigrationUtil {
  private MigrationUtil() {}

  // PR #27080 renamed the file search field and aggregation from "extension" (flattened —
  // unsupported for terms agg and multi_match on OpenSearch) to "fileExtension" (keyword). The
  // seed was updated but the additive settings merge means clusters upgraded from pre-1.12.5
  // still carry both stale entries, causing a 500 on every file search query on OpenSearch.
  private static final String STALE_FILE_EXTENSION_FIELD = "extension";
  private static final String FILE_ASSET_TYPE = "file";

  /**
   * Removes the stale {@code extension} searchField and aggregation from the DB-stored file
   * SearchSettings on upgraded clusters. Idempotent; safe to call on every reprocessing pass.
   */
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
