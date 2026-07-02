package org.openmetadata.service.migration.utils.v11213;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.search.Aggregation;
import org.openmetadata.schema.api.search.AssetTypeConfiguration;
import org.openmetadata.schema.api.search.GlobalSettings;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.service.migration.utils.SearchSettingsMergeUtil;

@Slf4j
public class MigrationUtil {
  private MigrationUtil() {}

  // PR #26000 (Hybrid search) switched the owner terms aggregation from the nested
  // `owners.displayName.keyword` sub-field to the flat `ownerDisplayName` keyword field. The seed
  // searchSettings.json was updated, but per-asset aggregations are never re-merged into an
  // upgraded cluster's stored settings (SearchSettingsHandler#mergeAssetTypeConfigurations only
  // adds missing asset types). Clusters upgrading to 1.12.13 therefore keep the stale field, which
  // aggregates on a nested path and fails once the index mappings are reindexed to the new shape.
  private static final String STALE_OWNER_AGG_FIELD = "owners.displayName.keyword";
  private static final String NEW_OWNER_AGG_FIELD = "ownerDisplayName";

  /**
   * Retargets any stored owner terms aggregation from the stale nested {@code
   * owners.displayName.keyword} field to the flat {@code ownerDisplayName} keyword field so the
   * DB-persisted searchSettings match the reindexed mappings. Idempotent.
   */
  public static void fixOwnerDisplayNameAggregation() {
    try {
      Settings searchSettings = SearchSettingsMergeUtil.getSearchSettingsFromDatabase();
      if (searchSettings == null) {
        LOG.warn("Search settings not found in database; skipping owner aggregation field fix");
      } else {
        SearchSettings currentSettings = SearchSettingsMergeUtil.loadSearchSettings(searchSettings);
        if (retargetStaleOwnerAggregations(currentSettings)) {
          SearchSettingsMergeUtil.saveSearchSettings(searchSettings, currentSettings);
          LOG.info(
              "Retargeted stale '{}' owner aggregation to '{}' in stored search settings",
              STALE_OWNER_AGG_FIELD,
              NEW_OWNER_AGG_FIELD);
        } else {
          LOG.info("No stale owner aggregation field found in stored search settings");
        }
      }
    } catch (Exception e) {
      LOG.error("Error fixing owner display name aggregation in stored search settings", e);
    }
  }

  public static boolean retargetStaleOwnerAggregations(SearchSettings settings) {
    boolean changed = false;
    if (settings != null) {
      GlobalSettings globalSettings = settings.getGlobalSettings();
      if (globalSettings != null) {
        changed |= retargetAggregations(globalSettings.getAggregations());
      }
      for (AssetTypeConfiguration assetConfig :
          listOrEmpty(settings.getAssetTypeConfigurations())) {
        changed |= retargetAggregations(assetConfig.getAggregations());
      }
    }
    return changed;
  }

  private static boolean retargetAggregations(List<Aggregation> aggregations) {
    boolean changed = false;
    if (!nullOrEmpty(aggregations)) {
      for (Aggregation aggregation : aggregations) {
        if (STALE_OWNER_AGG_FIELD.equals(aggregation.getField())) {
          aggregation.setField(NEW_OWNER_AGG_FIELD);
          changed = true;
        }
      }
    }
    return changed;
  }
}
