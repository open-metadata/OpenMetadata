package org.openmetadata.service.migration.utils.v200;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.ArrayList;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.search.Aggregation;
import org.openmetadata.schema.api.search.AllowedSearchFields;
import org.openmetadata.schema.api.search.AssetTypeConfiguration;
import org.openmetadata.schema.api.search.FieldBoost;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.service.migration.utils.SearchSettingsMergeUtil;

/** Migration utility for 2.0.0 repair of the searchIndex asset search configuration. */
@Slf4j
public class SearchIndexSettingsRepair {
  private SearchIndexSettingsRepair() {}

  private static final String SEARCH_INDEX_ASSET_TYPE = "searchIndex";
  private static final String ML_FEATURE_PREFIX = "mlFeatures.";
  private static final String RESPONSE_SCHEMA_PREFIX = "searchIndex.responseSchema.";
  private static final String INDEX_FIELD_PREFIX = "fields.";

  /**
   * Repairs the {@code searchIndex} search configuration so that a search index can be found by the
   * name of one of its fields. The shipped seed pointed the asset at {@code mlFeatures.*} and the
   * allowedFields catalog at {@code searchIndex.responseSchema.*}; neither path exists in the
   * searchIndex mapping, whose fields live under {@code fields.*}. The settings merge is additive
   * and never rewrites an asset type it already knows, so correcting the seed alone leaves upgraded
   * clusters on the dead configuration. Idempotent; safe on every reprocessing pass.
   */
  public static void repairSearchIndexFieldSearchSettings() {
    try {
      Settings storedSettings = SearchSettingsMergeUtil.getSearchSettingsFromDatabase();
      SearchSettings seedSettings = SearchSettingsMergeUtil.loadSearchSettingsFromFile();
      if (storedSettings == null || seedSettings == null) {
        LOG.warn("Search settings unavailable; skipping searchIndex field-search repair");
      } else {
        SearchSettings currentSettings = SearchSettingsMergeUtil.loadSearchSettings(storedSettings);
        if (repairSearchIndexSettings(currentSettings, seedSettings)) {
          SearchSettingsMergeUtil.saveSearchSettings(storedSettings, currentSettings);
          LOG.info("Repaired searchIndex search settings to target indexed field names");
        } else {
          LOG.info("searchIndex search settings already target indexed field names");
        }
      }
    } catch (Exception e) {
      LOG.error("Error repairing searchIndex field search settings", e);
    }
  }

  public static boolean repairSearchIndexSettings(
      SearchSettings currentSettings, SearchSettings seedSettings) {
    boolean changed = repairAllowedFields(currentSettings, seedSettings);
    AssetTypeConfiguration currentAsset = findSearchIndexAsset(currentSettings);
    AssetTypeConfiguration seedAsset = findSearchIndexAsset(seedSettings);
    if (currentAsset != null && seedAsset != null) {
      changed |= removeStaleAssetEntries(currentAsset);
      changed |= addSeedSearchFields(currentAsset, seedAsset);
      changed |= addSeedAggregations(currentAsset, seedAsset);
      changed |= addSeedHighlightFields(currentAsset, seedAsset);
    }
    return changed;
  }

  private static AssetTypeConfiguration findSearchIndexAsset(SearchSettings settings) {
    AssetTypeConfiguration result = null;
    for (AssetTypeConfiguration config : listOrEmpty(settings.getAssetTypeConfigurations())) {
      if (SEARCH_INDEX_ASSET_TYPE.equalsIgnoreCase(config.getAssetType())) {
        result = config;
        break;
      }
    }
    return result;
  }

  private static boolean removeStaleAssetEntries(AssetTypeConfiguration asset) {
    boolean changed = false;
    if (!nullOrEmpty(asset.getSearchFields())) {
      changed = asset.getSearchFields().removeIf(field -> isMlFeature(field.getField()));
    }
    if (!nullOrEmpty(asset.getAggregations())) {
      changed |= asset.getAggregations().removeIf(agg -> isMlFeature(agg.getField()));
    }
    if (!nullOrEmpty(asset.getHighlightFields())) {
      changed |= asset.getHighlightFields().removeIf(SearchIndexSettingsRepair::isMlFeature);
    }
    return changed;
  }

  private static boolean addSeedSearchFields(
      AssetTypeConfiguration currentAsset, AssetTypeConfiguration seedAsset) {
    boolean changed = false;
    if (currentAsset.getSearchFields() == null) {
      currentAsset.setSearchFields(new ArrayList<>());
    }
    for (FieldBoost seedField : listOrEmpty(seedAsset.getSearchFields())) {
      if (isIndexField(seedField.getField()) && !hasSearchField(currentAsset, seedField)) {
        currentAsset.getSearchFields().add(seedField);
        changed = true;
      }
    }
    return changed;
  }

  private static boolean addSeedAggregations(
      AssetTypeConfiguration currentAsset, AssetTypeConfiguration seedAsset) {
    boolean changed = false;
    if (currentAsset.getAggregations() == null) {
      currentAsset.setAggregations(new ArrayList<>());
    }
    for (Aggregation seedAggregation : listOrEmpty(seedAsset.getAggregations())) {
      if (isIndexField(seedAggregation.getField())
          && !hasAggregation(currentAsset, seedAggregation)) {
        currentAsset.getAggregations().add(seedAggregation);
        changed = true;
      }
    }
    return changed;
  }

  private static boolean addSeedHighlightFields(
      AssetTypeConfiguration currentAsset, AssetTypeConfiguration seedAsset) {
    boolean changed = false;
    if (currentAsset.getHighlightFields() == null) {
      currentAsset.setHighlightFields(new ArrayList<>());
    }
    for (String seedField : listOrEmpty(seedAsset.getHighlightFields())) {
      if (isIndexField(seedField) && !currentAsset.getHighlightFields().contains(seedField)) {
        currentAsset.getHighlightFields().add(seedField);
        changed = true;
      }
    }
    return changed;
  }

  private static boolean repairAllowedFields(
      SearchSettings currentSettings, SearchSettings seedSettings) {
    AllowedSearchFields currentAllowed = findSearchIndexAllowedFields(currentSettings);
    AllowedSearchFields seedAllowed = findSearchIndexAllowedFields(seedSettings);
    boolean changed = false;
    if (currentAllowed != null && seedAllowed != null && !nullOrEmpty(currentAllowed.getFields())) {
      changed = currentAllowed.getFields().removeIf(field -> isResponseSchema(field.getName()));
      for (var seedField : listOrEmpty(seedAllowed.getFields())) {
        if (isIndexField(seedField.getName())
            && !hasAllowedField(currentAllowed, seedField.getName())) {
          currentAllowed.getFields().add(seedField);
          changed = true;
        }
      }
    }
    return changed;
  }

  private static AllowedSearchFields findSearchIndexAllowedFields(SearchSettings settings) {
    AllowedSearchFields result = null;
    for (AllowedSearchFields allowedFields : listOrEmpty(settings.getAllowedFields())) {
      if (SEARCH_INDEX_ASSET_TYPE.equalsIgnoreCase(allowedFields.getEntityType())) {
        result = allowedFields;
        break;
      }
    }
    return result;
  }

  private static boolean hasSearchField(AssetTypeConfiguration asset, FieldBoost seedField) {
    return listOrEmpty(asset.getSearchFields()).stream()
        .anyMatch(field -> seedField.getField().equals(field.getField()));
  }

  private static boolean hasAggregation(AssetTypeConfiguration asset, Aggregation seedAggregation) {
    return listOrEmpty(asset.getAggregations()).stream()
        .anyMatch(agg -> seedAggregation.getName().equals(agg.getName()));
  }

  private static boolean hasAllowedField(AllowedSearchFields allowedFields, String seedName) {
    return listOrEmpty(allowedFields.getFields()).stream()
        .anyMatch(field -> seedName.equals(field.getName()));
  }

  private static boolean isMlFeature(String fieldName) {
    return fieldName != null && fieldName.startsWith(ML_FEATURE_PREFIX);
  }

  private static boolean isResponseSchema(String fieldName) {
    return fieldName != null && fieldName.startsWith(RESPONSE_SCHEMA_PREFIX);
  }

  private static boolean isIndexField(String fieldName) {
    return fieldName != null && fieldName.startsWith(INDEX_FIELD_PREFIX);
  }
}
