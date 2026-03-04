package org.openmetadata.service.migration.utils;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.function.BiPredicate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.search.AssetTypeConfiguration;
import org.openmetadata.schema.api.search.FieldValueBoost;
import org.openmetadata.schema.api.search.GlobalSettings;
import org.openmetadata.schema.api.search.SearchSettings;

public class SearchSettingsMergeUtilTest {

  private SearchSettings currentSettings;
  private SearchSettings defaultSettings;

  @BeforeEach
  public void setUp() {
    currentSettings = new SearchSettings();
    defaultSettings = new SearchSettings();
  }

  @Test
  public void testMergeFieldValueBoosts_GlobalSettings_SuccessfulMerge() {
    GlobalSettings currentGlobal = new GlobalSettings();
    FieldValueBoost currentBoost = new FieldValueBoost();
    currentBoost.setField("usageSummary.weeklyStats.percentileRank");
    currentBoost.setFactor(0.05);
    currentGlobal.setFieldValueBoosts(List.of(currentBoost));
    currentSettings.setGlobalSettings(currentGlobal);

    GlobalSettings defaultGlobal = new GlobalSettings();
    FieldValueBoost defaultBoost = new FieldValueBoost();
    defaultBoost.setField("usageSummary.weeklyStats.percentileRank");
    defaultBoost.setFactor(1.0);
    defaultGlobal.setFieldValueBoosts(List.of(defaultBoost));
    defaultSettings.setGlobalSettings(defaultGlobal);

    BiPredicate<String, Double> shouldMerge =
        (field, factor) -> field.contains("percentileRank") && (factor == 0.05 || factor == 0.1);

    boolean result =
        SearchSettingsMergeUtil.mergeFieldValueBoosts(
            currentSettings, defaultSettings, shouldMerge, "percentileRank");

    assertTrue(result, "Merge should return true when changes were made");
    assertEquals(
        1.0,
        currentSettings.getGlobalSettings().getFieldValueBoosts().getFirst().getFactor(),
        "Factor should be updated to 1.0");
  }

  @Test
  public void testMergeFieldValueBoosts_GlobalSettings_NoMergeWhenCustomized() {
    GlobalSettings currentGlobal = new GlobalSettings();
    FieldValueBoost currentBoost = new FieldValueBoost();
    currentBoost.setField("usageSummary.weeklyStats.percentileRank");
    currentBoost.setFactor(3.0);
    currentGlobal.setFieldValueBoosts(List.of(currentBoost));
    currentSettings.setGlobalSettings(currentGlobal);

    GlobalSettings defaultGlobal = new GlobalSettings();
    FieldValueBoost defaultBoost = new FieldValueBoost();
    defaultBoost.setField("usageSummary.weeklyStats.percentileRank");
    defaultBoost.setFactor(1.0);
    defaultGlobal.setFieldValueBoosts(List.of(defaultBoost));
    defaultSettings.setGlobalSettings(defaultGlobal);

    BiPredicate<String, Double> shouldMerge =
        (field, factor) -> field.contains("percentileRank") && (factor == 0.05 || factor == 0.1);

    boolean result =
        SearchSettingsMergeUtil.mergeFieldValueBoosts(
            currentSettings, defaultSettings, shouldMerge, "percentileRank");

    assertFalse(result, "Merge should return false when no changes were made");
    assertEquals(
        3.0,
        currentSettings.getGlobalSettings().getFieldValueBoosts().getFirst().getFactor(),
        "Custom value should be preserved");
  }

  @Test
  public void testMergeFieldValueBoosts_AssetSpecificSettings_SuccessfulMerge() {
    AssetTypeConfiguration currentAsset = new AssetTypeConfiguration();
    currentAsset.setAssetType("table");
    FieldValueBoost currentBoost = new FieldValueBoost();
    currentBoost.setField("usageSummary.monthlyStats.percentileRank");
    currentBoost.setFactor(0.1);
    currentAsset.setFieldValueBoosts(List.of(currentBoost));
    currentSettings.setAssetTypeConfigurations(List.of(currentAsset));

    AssetTypeConfiguration defaultAsset = new AssetTypeConfiguration();
    defaultAsset.setAssetType("table");
    FieldValueBoost defaultBoost = new FieldValueBoost();
    defaultBoost.setField("usageSummary.monthlyStats.percentileRank");
    defaultBoost.setFactor(1.0);
    defaultAsset.setFieldValueBoosts(List.of(defaultBoost));
    defaultSettings.setAssetTypeConfigurations(List.of(defaultAsset));

    BiPredicate<String, Double> shouldMerge =
        (field, factor) -> field.contains("percentileRank") && (factor == 0.05 || factor == 0.1);

    boolean result =
        SearchSettingsMergeUtil.mergeFieldValueBoosts(
            currentSettings, defaultSettings, shouldMerge, "percentileRank");

    assertTrue(result, "Merge should return true when changes were made");
    assertEquals(
        1.0,
        currentSettings
            .getAssetTypeConfigurations()
            .getFirst()
            .getFieldValueBoosts()
            .getFirst()
            .getFactor(),
        "Asset-specific factor should be updated");
  }

  @Test
  public void testMergeFieldValueBoosts_PreservesOtherFieldsInArray() {
    GlobalSettings currentGlobal = new GlobalSettings();
    FieldValueBoost percentileBoost = new FieldValueBoost();
    percentileBoost.setField("usageSummary.weeklyStats.percentileRank");
    percentileBoost.setFactor(0.05);

    FieldValueBoost countBoost = new FieldValueBoost();
    countBoost.setField("usageSummary.weeklyStats.count");
    countBoost.setFactor(5.0);

    currentGlobal.setFieldValueBoosts(Arrays.asList(percentileBoost, countBoost));
    currentSettings.setGlobalSettings(currentGlobal);

    GlobalSettings defaultGlobal = new GlobalSettings();
    FieldValueBoost defaultPercentileBoost = new FieldValueBoost();
    defaultPercentileBoost.setField("usageSummary.weeklyStats.percentileRank");
    defaultPercentileBoost.setFactor(1.0);

    FieldValueBoost defaultCountBoost = new FieldValueBoost();
    defaultCountBoost.setField("usageSummary.weeklyStats.count");
    defaultCountBoost.setFactor(2.0);

    defaultGlobal.setFieldValueBoosts(Arrays.asList(defaultPercentileBoost, defaultCountBoost));
    defaultSettings.setGlobalSettings(defaultGlobal);

    BiPredicate<String, Double> shouldMerge =
        (field, factor) -> field.contains("percentileRank") && (factor == 0.05 || factor == 0.1);

    boolean result =
        SearchSettingsMergeUtil.mergeFieldValueBoosts(
            currentSettings, defaultSettings, shouldMerge, "percentileRank");

    assertTrue(result, "Should merge percentileRank");

    List<FieldValueBoost> mergedBoosts = currentSettings.getGlobalSettings().getFieldValueBoosts();
    assertEquals(2, mergedBoosts.size(), "Should have both fields");

    FieldValueBoost updatedPercentile =
        mergedBoosts.stream()
            .filter(b -> b.getField().contains("percentileRank"))
            .findFirst()
            .orElse(null);
    assertNotNull(updatedPercentile);
    assertEquals(1.0, updatedPercentile.getFactor(), "percentileRank should be updated");

    FieldValueBoost preservedCount =
        mergedBoosts.stream().filter(b -> b.getField().contains("count")).findFirst().orElse(null);
    assertNotNull(preservedCount);
    assertEquals(5.0, preservedCount.getFactor(), "count should be preserved at user's value");
  }

  @Test
  public void testMergeFieldValueBoosts_NullDefaultSettings() {
    GlobalSettings currentGlobal = new GlobalSettings();
    currentSettings.setGlobalSettings(currentGlobal);

    BiPredicate<String, Double> shouldMerge = (field, factor) -> true;

    boolean result =
        SearchSettingsMergeUtil.mergeFieldValueBoosts(currentSettings, null, shouldMerge, "test");

    assertFalse(result, "Should return false when defaultSettings is null");
  }

  @Test
  public void testMergeGlobalSetting_IntegerValue_SuccessfulMerge() {
    GlobalSettings currentGlobal = new GlobalSettings();
    currentGlobal.setMaxAggregateSize(1000);
    currentSettings.setGlobalSettings(currentGlobal);

    GlobalSettings defaultGlobal = new GlobalSettings();
    defaultGlobal.setMaxAggregateSize(10000);
    defaultSettings.setGlobalSettings(defaultGlobal);

    BiPredicate<Integer, Integer> shouldMerge = (current, defaultVal) -> current < 5000;

    boolean result =
        SearchSettingsMergeUtil.mergeGlobalSetting(
            currentSettings,
            defaultSettings,
            settings -> settings.getGlobalSettings().getMaxAggregateSize(),
            (settings, val) -> settings.getGlobalSettings().setMaxAggregateSize(val),
            shouldMerge,
            "maxAggregateSize");

    assertTrue(result, "Merge should return true");
    assertEquals(
        10000,
        currentSettings.getGlobalSettings().getMaxAggregateSize(),
        "maxAggregateSize should be updated to 10000");
  }

  @Test
  public void testMergeGlobalSetting_IntegerValue_NoMergeWhenHighEnough() {
    GlobalSettings currentGlobal = new GlobalSettings();
    currentGlobal.setMaxAggregateSize(15000);
    currentSettings.setGlobalSettings(currentGlobal);

    GlobalSettings defaultGlobal = new GlobalSettings();
    defaultGlobal.setMaxAggregateSize(10000);
    defaultSettings.setGlobalSettings(defaultGlobal);

    BiPredicate<Integer, Integer> shouldMerge = (current, defaultVal) -> current < 5000;

    boolean result =
        SearchSettingsMergeUtil.mergeGlobalSetting(
            currentSettings,
            defaultSettings,
            settings -> settings.getGlobalSettings().getMaxAggregateSize(),
            (settings, val) -> settings.getGlobalSettings().setMaxAggregateSize(val),
            shouldMerge,
            "maxAggregateSize");

    assertFalse(result, "Merge should return false when condition not met");
    assertEquals(
        15000,
        currentSettings.getGlobalSettings().getMaxAggregateSize(),
        "Value should remain unchanged");
  }

  @Test
  public void testMergeGlobalSetting_ListValue_ReplaceEmptyArray() {
    GlobalSettings currentGlobal = new GlobalSettings();
    currentGlobal.setHighlightFields(new ArrayList<>());
    currentSettings.setGlobalSettings(currentGlobal);

    GlobalSettings defaultGlobal = new GlobalSettings();
    defaultGlobal.setHighlightFields(Arrays.asList("name", "description", "displayName"));
    defaultSettings.setGlobalSettings(defaultGlobal);

    BiPredicate<List<String>, List<String>> shouldMerge =
        (current, defaultVal) -> current == null || current.isEmpty();

    boolean result =
        SearchSettingsMergeUtil.mergeGlobalSetting(
            currentSettings,
            defaultSettings,
            settings -> settings.getGlobalSettings().getHighlightFields(),
            (settings, val) -> settings.getGlobalSettings().setHighlightFields(val),
            shouldMerge,
            "highlightFields");

    assertTrue(result, "Merge should return true");
    assertEquals(
        3,
        currentSettings.getGlobalSettings().getHighlightFields().size(),
        "Should have 3 highlight fields");
    assertTrue(
        currentSettings.getGlobalSettings().getHighlightFields().contains("name"),
        "Should contain 'name'");
  }

  @Test
  public void testMergeFieldValueBoosts_MultipleAssetsWithDifferentBoosts() {
    AssetTypeConfiguration tableAsset = new AssetTypeConfiguration();
    tableAsset.setAssetType("table");
    FieldValueBoost tableBoost = new FieldValueBoost();
    tableBoost.setField("usageSummary.weeklyStats.percentileRank");
    tableBoost.setFactor(0.05);
    tableAsset.setFieldValueBoosts(List.of(tableBoost));

    AssetTypeConfiguration dashboardAsset = new AssetTypeConfiguration();
    dashboardAsset.setAssetType("dashboard");
    FieldValueBoost dashboardBoost = new FieldValueBoost();
    dashboardBoost.setField("usageSummary.weeklyStats.percentileRank");
    dashboardBoost.setFactor(2.0);
    dashboardAsset.setFieldValueBoosts(List.of(dashboardBoost));

    currentSettings.setAssetTypeConfigurations(Arrays.asList(tableAsset, dashboardAsset));

    AssetTypeConfiguration defaultTable = new AssetTypeConfiguration();
    defaultTable.setAssetType("table");
    FieldValueBoost defaultTableBoost = new FieldValueBoost();
    defaultTableBoost.setField("usageSummary.weeklyStats.percentileRank");
    defaultTableBoost.setFactor(1.0);
    defaultTable.setFieldValueBoosts(List.of(defaultTableBoost));

    AssetTypeConfiguration defaultDashboard = new AssetTypeConfiguration();
    defaultDashboard.setAssetType("dashboard");
    FieldValueBoost defaultDashboardBoost = new FieldValueBoost();
    defaultDashboardBoost.setField("usageSummary.weeklyStats.percentileRank");
    defaultDashboardBoost.setFactor(1.0);
    defaultDashboard.setFieldValueBoosts(List.of(defaultDashboardBoost));

    defaultSettings.setAssetTypeConfigurations(Arrays.asList(defaultTable, defaultDashboard));

    BiPredicate<String, Double> shouldMerge =
        (field, factor) -> field.contains("percentileRank") && (factor == 0.05 || factor == 0.1);

    boolean result =
        SearchSettingsMergeUtil.mergeFieldValueBoosts(
            currentSettings, defaultSettings, shouldMerge, "percentileRank");

    assertTrue(result, "Should merge table asset");

    AssetTypeConfiguration updatedTable =
        currentSettings.getAssetTypeConfigurations().stream()
            .filter(a -> "table".equals(a.getAssetType()))
            .findFirst()
            .orElse(null);
    assertNotNull(updatedTable);
    assertEquals(
        1.0,
        updatedTable.getFieldValueBoosts().getFirst().getFactor(),
        "table percentileRank should be updated");

    AssetTypeConfiguration unchangedDashboard =
        currentSettings.getAssetTypeConfigurations().stream()
            .filter(a -> "dashboard".equals(a.getAssetType()))
            .findFirst()
            .orElse(null);
    assertNotNull(unchangedDashboard);
    assertEquals(
        2.0,
        unchangedDashboard.getFieldValueBoosts().getFirst().getFactor(),
        "dashboard percentileRank should remain at custom value");
  }
}
