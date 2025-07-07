package org.openmetadata.service.resources.system;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import org.openmetadata.schema.api.search.AssetTypeConfiguration;
import org.openmetadata.schema.api.search.FieldBoost;
import org.openmetadata.schema.api.search.GlobalSettings;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.service.exception.SystemSettingsException;

public class SearchSettingsHandler {
  private static final int MIN_AGGREGATE_SIZE = 100;
  private static final int MAX_AGGREGATE_SIZE = 10000;
  private static final int MIN_RESULT_HITS = 100;
  private static final int MAX_RESULT_HITS = 10000;
  private static final int MIN_ANALYZED_OFFSET = 1000;
  private static final int MAX_ANALYZED_OFFSET = 1000000;

  public void validateSearchSettings(SearchSettings searchSettings) {
    // Validate global settings
    validateGlobalSettings(searchSettings.getGlobalSettings());

    // Validate asset type configurations for duplicate fields
    if (searchSettings.getAssetTypeConfigurations() != null) {
      for (AssetTypeConfiguration assetConfig : searchSettings.getAssetTypeConfigurations()) {
        validateAssetTypeConfiguration(assetConfig);
      }
    }
  }

  public void validateAssetTypeConfiguration(AssetTypeConfiguration assetConfig) {
    if (assetConfig.getSearchFields() != null) {
      Set<String> fieldNames = new HashSet<>();

      for (FieldBoost fieldBoost : assetConfig.getSearchFields()) {
        String fieldName = fieldBoost.getField();
        if (!fieldNames.add(fieldName)) {
          throw new SystemSettingsException(
              String.format(
                  "Duplicate field configuration found for field: %s in asset type: %s",
                  fieldName, assetConfig.getAssetType()));
        }
      }
    }
  }

  public void validateGlobalSettings(GlobalSettings globalSettings) {
    if (globalSettings != null) {
      if (globalSettings.getMaxAggregateSize() != null) {
        validateRange(
            globalSettings.getMaxAggregateSize(),
            MIN_AGGREGATE_SIZE,
            MAX_AGGREGATE_SIZE,
            "maxAggregateSize");
      }
      if (globalSettings.getMaxResultHits() != null) {
        validateRange(
            globalSettings.getMaxResultHits(), MIN_RESULT_HITS, MAX_RESULT_HITS, "maxResultHits");
      }
      if (globalSettings.getMaxAnalyzedOffset() != null) {
        validateRange(
            globalSettings.getMaxAnalyzedOffset(),
            MIN_ANALYZED_OFFSET,
            MAX_ANALYZED_OFFSET,
            "maxAnalyzedOffset");
      }
    }
  }

  private void validateRange(int value, int min, int max, String field) {
    if (value < min || value > max) {
      throw new SystemSettingsException(
          String.format("%s must be between %d and %d", field, min, max));
    }
  }

  /**
   * Merges default search settings with incoming search settings.
   * Certain fields like aggregations and highlightFields are kept from defaults,
   * while user-configurable settings like termBoosts and fieldValueBoosts are taken from incoming settings if present.
   *
   * @param defaultSearchSettings The default search settings
   * @param incomingSearchSettings The incoming search settings to merge
   * @return The merged search settings
   */
  public SearchSettings mergeSearchSettings(
      SearchSettings defaultSearchSettings, SearchSettings incomingSearchSettings) {
    if (defaultSearchSettings == null) {
      throw new SystemSettingsException("Default search settings cannot be null");
    }

    if (incomingSearchSettings == null) {
      return defaultSearchSettings;
    }

    GlobalSettings defaultGlobalSettings = defaultSearchSettings.getGlobalSettings();
    GlobalSettings incomingGlobalSettings = incomingSearchSettings.getGlobalSettings();
    GlobalSettings mergedGlobalSettings = new GlobalSettings();

    // For numeric settings, use incoming if provided, otherwise use default
    mergedGlobalSettings.setMaxAggregateSize(
        incomingGlobalSettings != null && incomingGlobalSettings.getMaxAggregateSize() != null
            ? incomingGlobalSettings.getMaxAggregateSize()
            : defaultGlobalSettings.getMaxAggregateSize());

    mergedGlobalSettings.setMaxResultHits(
        incomingGlobalSettings != null && incomingGlobalSettings.getMaxResultHits() != null
            ? incomingGlobalSettings.getMaxResultHits()
            : defaultGlobalSettings.getMaxResultHits());

    mergedGlobalSettings.setMaxAnalyzedOffset(
        incomingGlobalSettings != null && incomingGlobalSettings.getMaxAnalyzedOffset() != null
            ? incomingGlobalSettings.getMaxAnalyzedOffset()
            : defaultGlobalSettings.getMaxAnalyzedOffset());

    mergedGlobalSettings.setEnableAccessControl(
        incomingGlobalSettings != null && incomingGlobalSettings.getEnableAccessControl() != null
            ? incomingGlobalSettings.getEnableAccessControl()
            : defaultGlobalSettings.getEnableAccessControl());

    // Keep these settings from default - these are system controlled
    mergedGlobalSettings.setAggregations(defaultGlobalSettings.getAggregations());
    mergedGlobalSettings.setHighlightFields(defaultGlobalSettings.getHighlightFields());

    // Use incoming termBoosts and fieldValueBoosts if provided, otherwise keep defaults
    // These settings are user controlled
    if (incomingGlobalSettings != null) {
      // For TermBoosts
      if (incomingGlobalSettings.getTermBoosts() != null) {
        mergedGlobalSettings.setTermBoosts(new ArrayList<>(incomingGlobalSettings.getTermBoosts()));
      } else {
        mergedGlobalSettings.setTermBoosts(
            defaultGlobalSettings.getTermBoosts() != null
                ? new ArrayList<>(defaultGlobalSettings.getTermBoosts())
                : new ArrayList<>());
      }

      // For FieldValueBoosts
      if (incomingGlobalSettings.getFieldValueBoosts() != null) {
        mergedGlobalSettings.setFieldValueBoosts(
            new ArrayList<>(incomingGlobalSettings.getFieldValueBoosts()));
      } else {
        mergedGlobalSettings.setFieldValueBoosts(
            defaultGlobalSettings.getFieldValueBoosts() != null
                ? new ArrayList<>(defaultGlobalSettings.getFieldValueBoosts())
                : new ArrayList<>());
      }
    } else {
      // If incomingGlobalSettings is null, use defaults
      mergedGlobalSettings.setTermBoosts(
          defaultGlobalSettings.getTermBoosts() != null
              ? new ArrayList<>(defaultGlobalSettings.getTermBoosts())
              : new ArrayList<>());
      mergedGlobalSettings.setFieldValueBoosts(
          defaultGlobalSettings.getFieldValueBoosts() != null
              ? new ArrayList<>(defaultGlobalSettings.getFieldValueBoosts())
              : new ArrayList<>());
    }

    // Set the merged global settings
    incomingSearchSettings.setGlobalSettings(mergedGlobalSettings);

    // Set default configuration if not provided
    if (incomingSearchSettings.getDefaultConfiguration() == null) {
      incomingSearchSettings.setDefaultConfiguration(
          defaultSearchSettings.getDefaultConfiguration());
    }

    // Merge asset type configurations
    mergeAssetTypeConfigurations(defaultSearchSettings, incomingSearchSettings);

    // IMPORTANT: Always preserve allowedFields from default settings
    // This ensures admins cannot override the allowedFields configuration
    incomingSearchSettings.setAllowedFields(defaultSearchSettings.getAllowedFields());

    // Validate the merged settings before returning
    validateSearchSettings(incomingSearchSettings);

    return incomingSearchSettings;
  }

  /**
   * Merges asset type configurations from default settings into incoming settings
   * ensuring all required asset types are present.
   *
   * @param defaultSearchSettings The default search settings
   * @param incomingSearchSettings The incoming search settings
   */
  private void mergeAssetTypeConfigurations(
      SearchSettings defaultSearchSettings, SearchSettings incomingSearchSettings) {
    List<AssetTypeConfiguration> defaultAssetTypes =
        defaultSearchSettings.getAssetTypeConfigurations();
    List<AssetTypeConfiguration> incomingAssetTypes =
        incomingSearchSettings.getAssetTypeConfigurations();

    if (incomingAssetTypes == null) {
      incomingAssetTypes = new ArrayList<>();
      incomingSearchSettings.setAssetTypeConfigurations(incomingAssetTypes);
    }

    if (defaultAssetTypes != null) {
      for (AssetTypeConfiguration defaultConfig : defaultAssetTypes) {
        String assetType = defaultConfig.getAssetType().toLowerCase();
        boolean exists =
            incomingAssetTypes.stream()
                .anyMatch(config -> config.getAssetType().equalsIgnoreCase(assetType));
        if (!exists) {
          incomingAssetTypes.add(defaultConfig);
        }
      }
    }
  }
}
