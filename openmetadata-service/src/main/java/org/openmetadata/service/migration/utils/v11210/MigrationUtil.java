package org.openmetadata.service.migration.utils.v11210;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.search.Aggregation;
import org.openmetadata.schema.api.search.AssetTypeConfiguration;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.service.migration.utils.SearchSettingsMergeUtil;

@Slf4j
public class MigrationUtil {
  private MigrationUtil() {}

  // PR #27080 (backported to 1.12.5) renamed the file aggregation field from "extension"
  // (flattened, unsupported by OpenSearch terms agg) to "fileExtension" (keyword). The seed was
  // updated but the additive settings merge means clusters upgraded from pre-1.12.5 still carry
  // the stale aggregation, causing a 500 on every file search query on OpenSearch.
  private static final String STALE_FILE_EXTENSION_AGGREGATION_FIELD = "extension";
  private static final String FILE_ASSET_TYPE = "file";

  /**
   * Removes the stale {@code extension} aggregation from the DB-stored file SearchSettings on
   * upgraded clusters. Idempotent; safe to call on every reprocessing pass.
   */
  public static void removeStaleFileExtensionAggregation() {
    try {
      Settings searchSettings = SearchSettingsMergeUtil.getSearchSettingsFromDatabase();
      if (searchSettings == null) {
        LOG.warn("Search settings not found in database; skipping stale file extension agg scrub");
        return;
      }
      SearchSettings currentSettings = SearchSettingsMergeUtil.loadSearchSettings(searchSettings);
      if (stripStaleFileExtensionAggregation(currentSettings)) {
        SearchSettingsMergeUtil.saveSearchSettings(searchSettings, currentSettings);
        LOG.info("Removed stale 'extension' aggregation from file search settings");
      } else {
        LOG.info("No stale 'extension' aggregation found in file search settings");
      }
    } catch (Exception e) {
      LOG.error("Error removing stale file extension aggregation from search settings", e);
    }
  }

  public static boolean stripStaleFileExtensionAggregation(SearchSettings settings) {
    boolean changed = false;
    if (settings == null) {
      return false;
    }
    for (AssetTypeConfiguration assetConfig : listOrEmpty(settings.getAssetTypeConfigurations())) {
      if (FILE_ASSET_TYPE.equals(assetConfig.getAssetType())) {
        changed |= removeStaleAggregation(assetConfig.getAggregations());
      }
    }
    return changed;
  }

  private static boolean removeStaleAggregation(List<Aggregation> aggregations) {
    boolean removed = false;
    if (!nullOrEmpty(aggregations)) {
      removed =
          aggregations.removeIf(
              agg -> STALE_FILE_EXTENSION_AGGREGATION_FIELD.equals(agg.getField()));
    }
    return removed;
  }
}
