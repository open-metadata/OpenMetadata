package org.openmetadata.service.migration.utils;

import java.util.List;
import java.util.function.BiConsumer;
import java.util.function.BiPredicate;
import java.util.function.Function;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.api.search.AssetTypeConfiguration;
import org.openmetadata.schema.api.search.FieldValueBoost;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.SystemRepository;
import org.openmetadata.service.util.EntityUtil;

/**
 * Utility for merging search settings from default configuration files into database settings
 * during migrations.
 *
 * <p>This utility provides methods for selectively merging search settings while preserving user
 * customizations. It supports two merge strategies:
 *
 * <ul>
 *   <li><b>Array Item Merging:</b> Use specialized methods (mergeFieldValueBoosts, etc.) to update
 *       individual items within arrays based on field names, preserving user customizations on
 *       other items
 *   <li><b>Complete Property Replacement:</b> Use generic methods (mergeGlobalSetting,
 *       mergeAssetSpecificProperty) to replace entire scalar values or arrays when appropriate
 * </ul>
 */
@Slf4j
public class SearchSettingsMergeUtil {

  private static final SystemRepository systemRepository = Entity.getSystemRepository();
  private static final String SEARCH_SETTINGS_KEY = "searchSettings";

  /** Retrieves search settings from the database. */
  public static Settings getSearchSettingsFromDatabase() {
    return systemRepository.getConfigWithKey(SEARCH_SETTINGS_KEY);
  }

  /** Converts database Settings object to SearchSettings object. */
  public static SearchSettings loadSearchSettings(Settings searchSettings) {
    return JsonUtils.readValue(
        JsonUtils.pojoToJson(searchSettings.getConfigValue()), SearchSettings.class);
  }

  /** Loads default SearchSettings from packaged JSON file (searchSettings.json). */
  public static SearchSettings loadSearchSettingsFromFile() {
    try {
      List<String> jsonDataFiles =
          EntityUtil.getJsonDataResources(".*json/data/settings/searchSettings.json$");
      if (!jsonDataFiles.isEmpty()) {
        String json =
            CommonUtil.getResourceAsStream(
                EntityRepository.class.getClassLoader(), jsonDataFiles.getFirst());
        return JsonUtils.readValue(json, SearchSettings.class);
      }
    } catch (Exception e) {
      LOG.error("Failed to load default search settings from file", e);
    }
    return null;
  }

  /** Saves updated SearchSettings back to the database. */
  public static void saveSearchSettings(Settings searchSettings, SearchSettings updatedSettings) {
    searchSettings.withConfigValue(updatedSettings);
    systemRepository.updateSetting(searchSettings);
  }

  /**
   * Merges individual fieldValueBoost items from defaults into current settings based on field
   * name and factor value.
   *
   * <p><b>WHEN TO USE:</b>
   *
   * <ul>
   *   <li>Updating numeric field-based boosts (percentileRank, usage counts, etc.)
   *   <li>Need to update specific items within the fieldValueBoosts array
   *   <li>Want to preserve user customizations on other fieldValueBoost items
   * </ul>
   *
   * <p><b>DO NOT USE:</b>
   *
   * <ul>
   *   <li>For updating entire array replacement (use mergeGlobalSetting instead)
   *   <li>For simple scalar values like maxAggregateSize (use mergeGlobalSetting)
   *   <li>For fieldBoosts/searchFields (different array type, add dedicated method if needed)
   * </ul>
   *
   * <p><b>Example:</b>
   *
   * <pre>{@code
   * // Update percentileRank factors from 0.05/0.1 to new defaults
   * BiPredicate<String, Double> shouldMerge = (field, factor) ->
   *     field.contains("percentileRank") && (factor == 0.05 || factor == 0.1);
   *
   * boolean updated = mergeFieldValueBoosts(
   *     currentSettings, defaultSettings, shouldMerge, "percentileRank");
   * }</pre>
   *
   * @param currentSettings Current settings from database
   * @param defaultSettings Default settings from searchSettings.json file
   * @param shouldMerge Predicate that receives (fieldName, currentFactor) and returns true if this
   *     item should be updated from defaults
   * @param fieldDescription Description for logging (e.g., "percentileRank")
   * @return true if any fieldValueBoosts were merged
   */
  public static boolean mergeFieldValueBoosts(
      SearchSettings currentSettings,
      SearchSettings defaultSettings,
      BiPredicate<String, Double> shouldMerge,
      String fieldDescription) {
    if (defaultSettings == null) {
      LOG.warn("Default settings not available, skipping merge for {}", fieldDescription);
      return false;
    }

    boolean merged = false;

    if (defaultSettings.getGlobalSettings() != null
        && defaultSettings.getGlobalSettings().getFieldValueBoosts() != null) {
      for (FieldValueBoost defaultBoost :
          defaultSettings.getGlobalSettings().getFieldValueBoosts()) {
        if (defaultBoost.getField() != null && defaultBoost.getFactor() != null) {
          FieldValueBoost currentBoost =
              findFieldValueBoostInGlobal(currentSettings, defaultBoost.getField());
          if (currentBoost != null
              && currentBoost.getFactor() != null
              && shouldMerge.test(currentBoost.getField(), currentBoost.getFactor())) {
            LOG.info(
                "Merging global {} from default: {} -> {} for field: {}",
                fieldDescription,
                currentBoost.getFactor(),
                defaultBoost.getFactor(),
                currentBoost.getField());
            currentBoost.setFactor(defaultBoost.getFactor());
            merged = true;
          }
        }
      }
    }

    if (defaultSettings.getAssetTypeConfigurations() != null
        && currentSettings.getAssetTypeConfigurations() != null) {
      for (AssetTypeConfiguration defaultAssetConfig :
          defaultSettings.getAssetTypeConfigurations()) {
        AssetTypeConfiguration currentAssetConfig =
            findAssetTypeConfiguration(currentSettings, defaultAssetConfig.getAssetType());
        if (currentAssetConfig != null
            && defaultAssetConfig.getFieldValueBoosts() != null
            && currentAssetConfig.getFieldValueBoosts() != null) {
          for (FieldValueBoost defaultBoost : defaultAssetConfig.getFieldValueBoosts()) {
            if (defaultBoost.getField() != null && defaultBoost.getFactor() != null) {
              FieldValueBoost currentBoost =
                  findFieldValueBoostInAsset(currentAssetConfig, defaultBoost.getField());
              if (currentBoost != null
                  && currentBoost.getFactor() != null
                  && shouldMerge.test(currentBoost.getField(), currentBoost.getFactor())) {
                LOG.info(
                    "Merging {} from default: {} -> {} for field: {} in asset type: {}",
                    fieldDescription,
                    currentBoost.getFactor(),
                    defaultBoost.getFactor(),
                    currentBoost.getField(),
                    currentAssetConfig.getAssetType());
                currentBoost.setFactor(defaultBoost.getFactor());
                merged = true;
              }
            }
          }
        }
      }
    }

    return merged;
  }

  /**
   * Generic method to merge any global-level setting (scalar values, entire arrays, or complex
   * objects) from defaults into current settings.
   *
   * <p><b>WHEN TO USE:</b>
   *
   * <ul>
   *   <li>Updating scalar values: enableAccessControl, maxAggregateSize, maxResultHits, etc.
   *   <li>Replacing entire arrays: highlightFields, aggregations (when full replacement is
   *       acceptable)
   *   <li>Updating complex objects: nlqConfiguration (entire object replacement)
   *   <li>Any top-level SearchSettings property
   * </ul>
   *
   * <p><b>DO NOT USE:</b>
   *
   * <ul>
   *   <li>For updating individual items within fieldValueBoosts array (use mergeFieldValueBoosts)
   *   <li>For asset-specific properties like boostMode, scoreMode (use mergeAssetSpecificProperty)
   * </ul>
   *
   * <p><b>Examples:</b>
   *
   * <pre>{@code
   * // Example 1: Update boolean setting
   * BiPredicate<Boolean, Boolean> shouldMerge = (current, defaultVal) -> !current && defaultVal;
   * mergeGlobalSetting(
   *     currentSettings, defaultSettings,
   *     settings -> settings.getGlobalSettings().getEnableAccessControl(),
   *     (settings, val) -> settings.getGlobalSettings().setEnableAccessControl(val),
   *     shouldMerge, "enableAccessControl");
   *
   * // Example 2: Update integer setting if too low
   * BiPredicate<Integer, Integer> shouldMerge = (current, defaultVal) -> current < 5000;
   * mergeGlobalSetting(
   *     currentSettings, defaultSettings,
   *     settings -> settings.getGlobalSettings().getMaxAggregateSize(),
   *     (settings, val) -> settings.getGlobalSettings().setMaxAggregateSize(val),
   *     shouldMerge, "maxAggregateSize");
   *
   * // Example 3: Replace entire highlightFields array if empty
   * BiPredicate<List<String>, List<String>> shouldMerge =
   *     (current, defaultVal) -> current == null || current.isEmpty();
   * mergeGlobalSetting(
   *     currentSettings, defaultSettings,
   *     settings -> settings.getGlobalSettings().getHighlightFields(),
   *     (settings, val) -> settings.getGlobalSettings().setHighlightFields(val),
   *     shouldMerge, "highlightFields");
   * }</pre>
   *
   * @param <T> Type of the setting being merged
   * @param currentSettings Current settings from database
   * @param defaultSettings Default settings from searchSettings.json file
   * @param getter Function to extract the property value from SearchSettings
   * @param setter Function to set the property value on SearchSettings
   * @param shouldMerge Predicate that receives (currentValue, defaultValue) and returns true if
   *     should update
   * @param settingName Name for logging (e.g., "maxAggregateSize")
   * @return true if the setting was merged
   */
  public static <T> boolean mergeGlobalSetting(
      SearchSettings currentSettings,
      SearchSettings defaultSettings,
      Function<SearchSettings, T> getter,
      BiConsumer<SearchSettings, T> setter,
      BiPredicate<T, T> shouldMerge,
      String settingName) {
    if (defaultSettings == null) {
      LOG.warn("Default settings not available, skipping merge for {}", settingName);
      return false;
    }

    T currentValue = getter.apply(currentSettings);
    T defaultValue = getter.apply(defaultSettings);

    if (defaultValue != null
        && currentValue != null
        && shouldMerge.test(currentValue, defaultValue)) {
      LOG.info("Merging global {} from default: {} -> {}", settingName, currentValue, defaultValue);
      setter.accept(currentSettings, defaultValue);
      return true;
    }

    return false;
  }

  /**
   * Generic method to merge any asset-specific property (properties within AssetTypeConfiguration)
   * from defaults into current settings.
   *
   * <p><b>WHEN TO USE:</b>
   *
   * <ul>
   *   <li>Updating asset-specific scalar values: boostMode, scoreMode
   *   <li>Replacing asset-specific arrays: highlightFields, aggregations (when full replacement is
   *       acceptable)
   *   <li>Updating nested objects: matchTypeBoostMultipliers
   *   <li>Any property within AssetTypeConfiguration (table, dashboard, etc.)
   * </ul>
   *
   * <p><b>DO NOT USE:</b>
   *
   * <ul>
   *   <li>For updating individual items within fieldValueBoosts array in asset config (use
   *       mergeFieldValueBoosts)
   *   <li>For global settings (use mergeGlobalSetting)
   * </ul>
   *
   * <p><b>Examples:</b>
   *
   * <pre>{@code
   * // Example 1: Update boostMode from "sum" to "multiply"
   * BiPredicate<String, String> shouldMerge = (current, defaultVal) -> "sum".equals(current);
   * mergeAssetSpecificProperty(
   *     currentSettings, defaultSettings,
   *     AssetTypeConfiguration::getBoostMode,
   *     AssetTypeConfiguration::setBoostMode,
   *     shouldMerge, "boostMode");
   *
   * // Example 2: Update scoreMode
   * BiPredicate<String, String> shouldMerge = (current, defaultVal) -> "sum".equals(current);
   * mergeAssetSpecificProperty(
   *     currentSettings, defaultSettings,
   *     AssetTypeConfiguration::getScoreMode,
   *     AssetTypeConfiguration::setScoreMode,
   *     shouldMerge, "scoreMode");
   *
   * // Example 3: Update exactMatchMultiplier in nested object
   * BiPredicate<Double, Double> shouldMerge = (current, defaultVal) -> current == 1.0;
   * mergeAssetSpecificProperty(
   *     currentSettings, defaultSettings,
   *     asset -> asset.getMatchTypeBoostMultipliers() != null ?
   *         asset.getMatchTypeBoostMultipliers().getExactMatchMultiplier() : null,
   *     (asset, newValue) -> {
   *       if (asset.getMatchTypeBoostMultipliers() != null) {
   *         asset.getMatchTypeBoostMultipliers().setExactMatchMultiplier(newValue);
   *       }
   *     },
   *     shouldMerge, "exactMatchMultiplier");
   * }</pre>
   *
   * @param <T> Type of the property being merged
   * @param currentSettings Current settings from database
   * @param defaultSettings Default settings from searchSettings.json file
   * @param assetGetter Function to extract the property value from AssetTypeConfiguration
   * @param assetSetter Function to set the property value on AssetTypeConfiguration
   * @param shouldMerge Predicate that receives (currentValue, defaultValue) and returns true if
   *     should update
   * @param propertyName Name for logging (e.g., "boostMode")
   * @return true if any asset configurations were merged
   */
  public static <T> boolean mergeAssetSpecificProperty(
      SearchSettings currentSettings,
      SearchSettings defaultSettings,
      Function<AssetTypeConfiguration, T> assetGetter,
      BiConsumer<AssetTypeConfiguration, T> assetSetter,
      BiPredicate<T, T> shouldMerge,
      String propertyName) {
    if (defaultSettings == null
        || defaultSettings.getAssetTypeConfigurations() == null
        || currentSettings.getAssetTypeConfigurations() == null) {
      LOG.warn("Asset configurations not available, skipping merge for {}", propertyName);
      return false;
    }

    boolean merged = false;

    for (AssetTypeConfiguration defaultAssetConfig : defaultSettings.getAssetTypeConfigurations()) {
      AssetTypeConfiguration currentAssetConfig =
          findAssetTypeConfiguration(currentSettings, defaultAssetConfig.getAssetType());

      if (currentAssetConfig != null) {
        T currentValue = assetGetter.apply(currentAssetConfig);
        T defaultValue = assetGetter.apply(defaultAssetConfig);

        if (defaultValue != null
            && currentValue != null
            && shouldMerge.test(currentValue, defaultValue)) {
          LOG.info(
              "Merging {} from default: {} -> {} for asset type: {}",
              propertyName,
              currentValue,
              defaultValue,
              currentAssetConfig.getAssetType());
          assetSetter.accept(currentAssetConfig, defaultValue);
          merged = true;
        }
      }
    }

    return merged;
  }

  private static FieldValueBoost findFieldValueBoostInGlobal(
      SearchSettings settings, String fieldName) {
    if (settings.getGlobalSettings() != null
        && settings.getGlobalSettings().getFieldValueBoosts() != null) {
      for (FieldValueBoost boost : settings.getGlobalSettings().getFieldValueBoosts()) {
        if (boost.getField() != null && boost.getField().equals(fieldName)) {
          return boost;
        }
      }
    }
    return null;
  }

  private static FieldValueBoost findFieldValueBoostInAsset(
      AssetTypeConfiguration assetConfig, String fieldName) {
    if (assetConfig.getFieldValueBoosts() != null) {
      for (FieldValueBoost boost : assetConfig.getFieldValueBoosts()) {
        if (boost.getField() != null && boost.getField().equals(fieldName)) {
          return boost;
        }
      }
    }
    return null;
  }

  private static AssetTypeConfiguration findAssetTypeConfiguration(
      SearchSettings settings, String assetType) {
    if (settings.getAssetTypeConfigurations() != null) {
      for (AssetTypeConfiguration config : settings.getAssetTypeConfigurations()) {
        if (config.getAssetType() != null && config.getAssetType().equals(assetType)) {
          return config;
        }
      }
    }
    return null;
  }
}
