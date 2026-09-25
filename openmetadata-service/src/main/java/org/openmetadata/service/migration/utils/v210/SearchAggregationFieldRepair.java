package org.openmetadata.service.migration.utils.v210;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.ArrayList;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.search.Aggregation;
import org.openmetadata.schema.api.search.AssetTypeConfiguration;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.service.migration.utils.SearchSettingsMergeUtil;

/**
 * Migration utility for 2.1.0 that repairs the {@code fieldNames} terms aggregations on the topic
 * and apiEndpoint asset configurations.
 *
 * <p>The seed {@code searchSettings.json} shipped since 1.13.0 with the aggregation field misspelled
 * as {@code fieldsNames} (an extra {@code s}); no such field exists in any index mapping, so the
 * {@code fieldNames} aggregation was emitted with {@code { "buckets": [] }} for every topic and
 * apiEndpoint search. The per-asset aggregations are never re-merged into an upgraded cluster's
 * stored settings — {@code SearchSettingsHandler#mergeAssetTypeConfigurations} only adds missing
 * asset types — so correcting the seed alone leaves upgraded clusters pointing at the stale field.
 *
 * <p>This migration retargets the topic aggregation to the mapped {@code fieldNames} keyword field
 * the writer already populates, and replaces the single apiEndpoint {@code fieldNames} aggregation
 * with {@code requestFieldNames} and {@code responseFieldNames} aggregations over the mapped keyword
 * fields the writer now populates. Idempotent; safe on every reprocessing pass.
 */
@Slf4j
public class SearchAggregationFieldRepair {
  private SearchAggregationFieldRepair() {}

  private static final String TOPIC_ASSET_TYPE = "topic";
  private static final String API_ENDPOINT_ASSET_TYPE = "apiEndpoint";
  private static final String FIELD_NAMES_AGG_NAME = "fieldNames";
  private static final String STALE_FIELD_NAMES = "fieldsNames";
  private static final String TOPIC_NEW_FIELD_NAMES = "fieldNames";
  private static final String REQUEST_FIELD_NAMES_AGG_NAME = "requestFieldNames";
  private static final String RESPONSE_FIELD_NAMES_AGG_NAME = "responseFieldNames";

  /** Loads stored search settings, applies the repair, and persists them if anything changed. */
  public static void repairFieldNamesAggregations() {
    try {
      Settings storedSettings = SearchSettingsMergeUtil.getSearchSettingsFromDatabase();
      SearchSettings seedSettings = SearchSettingsMergeUtil.loadSearchSettingsFromFile();
      if (storedSettings == null || seedSettings == null) {
        LOG.warn("Search settings unavailable; skipping fieldNames aggregation repair");
        return;
      }
      SearchSettings currentSettings = SearchSettingsMergeUtil.loadSearchSettings(storedSettings);
      if (currentSettings == null) {
        LOG.warn(
            "Stored search settings could not be parsed; skipping fieldNames aggregation repair");
        return;
      }
      if (repairFieldNamesAggregations(currentSettings, seedSettings)) {
        SearchSettingsMergeUtil.saveSearchSettings(storedSettings, currentSettings);
        LOG.info("Repaired stale fieldNames aggregations in stored search settings");
      } else {
        LOG.info(
            "No stale fieldNames aggregation found in stored search settings; no repair needed");
      }
    } catch (Exception e) {
      LOG.error("Error repairing fieldNames aggregations in stored search settings", e);
    }
  }

  /**
   * Repairs the stored topic and apiEndpoint {@code fieldNames} aggregations in place. Returns
   * whether any change was made, so callers can persist only when needed and tests can assert
   * idempotency.
   */
  public static boolean repairFieldNamesAggregations(SearchSettings stored, SearchSettings seed) {
    boolean changed = false;
    changed |= retargetTopicFieldNamesAggregation(stored);
    changed |= replaceApiEndpointFieldNamesAggregation(stored, seed);
    return changed;
  }

  /**
   * Points the topic {@code fieldNames} aggregation at the mapped {@code fieldNames} keyword field
   * when it still references the misspelled {@code fieldsNames}.
   */
  private static boolean retargetTopicFieldNamesAggregation(SearchSettings stored) {
    AssetTypeConfiguration topic = findAsset(stored, TOPIC_ASSET_TYPE);
    if (topic == null) {
      return false;
    }
    boolean changed = false;
    for (Aggregation aggregation : listOrEmpty(topic.getAggregations())) {
      if (FIELD_NAMES_AGG_NAME.equals(aggregation.getName())
          && STALE_FIELD_NAMES.equals(aggregation.getField())) {
        aggregation.setField(TOPIC_NEW_FIELD_NAMES);
        changed = true;
      }
    }
    return changed;
  }

  /**
   * Removes the single apiEndpoint {@code fieldNames} aggregation (which targets the unmapped
   * {@code fieldsNames}) and adds the {@code requestFieldNames} and {@code responseFieldNames}
   * aggregations from the seed when they are not already present.
   */
  private static boolean replaceApiEndpointFieldNamesAggregation(
      SearchSettings stored, SearchSettings seed) {
    AssetTypeConfiguration apiEndpoint = findAsset(stored, API_ENDPOINT_ASSET_TYPE);
    if (apiEndpoint == null) {
      return false;
    }
    if (apiEndpoint.getAggregations() == null) {
      apiEndpoint.setAggregations(new ArrayList<>());
    }
    List<Aggregation> aggregations = apiEndpoint.getAggregations();
    // The apiEndpoint index mapping has no `fieldNames` field (it has `requestFieldNames` and
    // `responseFieldNames`), so any `fieldNames` aggregation here is the stale misconfiguration.
    boolean removed = aggregations.removeIf(agg -> FIELD_NAMES_AGG_NAME.equals(agg.getName()));

    List<Aggregation> toAdd = new ArrayList<>();
    AssetTypeConfiguration seedApiEndpoint = findAsset(seed, API_ENDPOINT_ASSET_TYPE);
    List<Aggregation> seedAggregations =
        seedApiEndpoint == null ? List.of() : listOrEmpty(seedApiEndpoint.getAggregations());
    for (String name : List.of(REQUEST_FIELD_NAMES_AGG_NAME, RESPONSE_FIELD_NAMES_AGG_NAME)) {
      if (aggregations.stream().noneMatch(agg -> name.equals(agg.getName()))) {
        Aggregation seedAggregation = findAggregation(seedAggregations, name);
        if (seedAggregation != null) {
          toAdd.add(seedAggregation);
        }
      }
    }
    if (!toAdd.isEmpty()) {
      aggregations.addAll(toAdd);
    }
    return removed || !toAdd.isEmpty();
  }

  private static AssetTypeConfiguration findAsset(SearchSettings settings, String assetType) {
    if (settings == null) {
      return null;
    }
    for (AssetTypeConfiguration config : listOrEmpty(settings.getAssetTypeConfigurations())) {
      if (assetType.equalsIgnoreCase(config.getAssetType())) {
        return config;
      }
    }
    return null;
  }

  private static Aggregation findAggregation(List<Aggregation> aggregations, String name) {
    for (Aggregation aggregation : listOrEmpty(aggregations)) {
      if (name.equals(aggregation.getName()) && !nullOrEmpty(aggregation.getField())) {
        return aggregation;
      }
    }
    return null;
  }
}
