package org.openmetadata.service.migration.utils.v202;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.search.AssetTypeConfiguration;
import org.openmetadata.schema.api.search.FieldBoost;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.service.migration.utils.SearchSettingsMergeUtil;

/**
 * Migration utility for 2.0.2 that restores the {@code name.keyword} search field on the top-level
 * name-searchable assets that shipped without it. Exact-match ranking on an entity's name relies on
 * {@code name.keyword}; databaseSchema and table already had it while database, storedProcedure,
 * query and metric did not. The settings merge is additive and never rewrites an asset type it
 * already knows, so correcting the seed alone leaves upgraded clusters missing the field. Idempotent;
 * safe on every reprocessing pass.
 */
@Slf4j
public class SearchNameKeywordRepair {
  private SearchNameKeywordRepair() {}

  private static final String NAME_KEYWORD = "name.keyword";
  private static final String DISPLAY_NAME_KEYWORD = "displayName.keyword";
  private static final Set<String> TARGET_ASSET_TYPES =
      Set.of("database", "storedProcedure", "query", "metric");

  public static void repairNameKeywordSearchFields() {
    try {
      Settings storedSettings = SearchSettingsMergeUtil.getSearchSettingsFromDatabase();
      SearchSettings seedSettings = SearchSettingsMergeUtil.loadSearchSettingsFromFile();
      if (storedSettings == null || seedSettings == null) {
        LOG.warn("Search settings unavailable; skipping name.keyword search-field repair");
      } else {
        SearchSettings currentSettings = SearchSettingsMergeUtil.loadSearchSettings(storedSettings);
        applyAndSaveIfChanged(storedSettings, currentSettings, seedSettings);
      }
    } catch (Exception e) {
      LOG.error("Error repairing name.keyword search fields", e);
    }
  }

  private static void applyAndSaveIfChanged(
      Settings storedSettings, SearchSettings currentSettings, SearchSettings seedSettings) {
    List<String> repairedAssets = repairAndCollect(currentSettings, seedSettings);
    if (repairedAssets.isEmpty()) {
      LOG.info("name.keyword search field already present for target assets; no repair needed");
    } else {
      SearchSettingsMergeUtil.saveSearchSettings(storedSettings, currentSettings);
      LOG.info("Added name.keyword search field to {}", repairedAssets);
    }
  }

  public static boolean repairNameKeywordSearchFields(
      SearchSettings currentSettings, SearchSettings seedSettings) {
    return !repairAndCollect(currentSettings, seedSettings).isEmpty();
  }

  private static List<String> repairAndCollect(
      SearchSettings currentSettings, SearchSettings seedSettings) {
    List<String> repairedAssets = new ArrayList<>();
    for (String assetType : TARGET_ASSET_TYPES) {
      if (addNameKeywordIfMissing(currentSettings, seedSettings, assetType)) {
        repairedAssets.add(assetType);
      }
    }
    return repairedAssets;
  }

  private static boolean addNameKeywordIfMissing(
      SearchSettings currentSettings, SearchSettings seedSettings, String assetType) {
    boolean added = false;
    AssetTypeConfiguration currentAsset = findAsset(currentSettings, assetType);
    AssetTypeConfiguration seedAsset = findAsset(seedSettings, assetType);
    if (currentAsset != null && seedAsset != null && !hasNameKeyword(currentAsset)) {
      FieldBoost seedField = findNameKeyword(seedAsset);
      if (seedField != null) {
        insertAfterDisplayNameKeyword(currentAsset, seedField);
        added = true;
      }
    }
    return added;
  }

  private static AssetTypeConfiguration findAsset(SearchSettings settings, String assetType) {
    AssetTypeConfiguration result = null;
    for (AssetTypeConfiguration config : listOrEmpty(settings.getAssetTypeConfigurations())) {
      if (assetType.equalsIgnoreCase(config.getAssetType())) {
        result = config;
        break;
      }
    }
    return result;
  }

  private static boolean hasNameKeyword(AssetTypeConfiguration asset) {
    return listOrEmpty(asset.getSearchFields()).stream()
        .anyMatch(field -> NAME_KEYWORD.equals(field.getField()));
  }

  private static FieldBoost findNameKeyword(AssetTypeConfiguration asset) {
    return listOrEmpty(asset.getSearchFields()).stream()
        .filter(field -> NAME_KEYWORD.equals(field.getField()))
        .findFirst()
        .orElse(null);
  }

  private static void insertAfterDisplayNameKeyword(
      AssetTypeConfiguration asset, FieldBoost nameKeyword) {
    if (asset.getSearchFields() == null) {
      asset.setSearchFields(new ArrayList<>());
    }
    List<FieldBoost> searchFields = asset.getSearchFields();
    int insertAt = 0;
    for (int i = 0; i < searchFields.size(); i++) {
      if (DISPLAY_NAME_KEYWORD.equals(searchFields.get(i).getField())) {
        insertAt = i + 1;
        break;
      }
    }
    searchFields.add(insertAt, nameKeyword);
  }
}
