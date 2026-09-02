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
package org.openmetadata.service.migration.utils.v202;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.search.AssetTypeConfiguration;
import org.openmetadata.schema.api.search.FieldBoost;
import org.openmetadata.schema.api.search.SearchSettings;

/**
 * Covers the merge the 2.0.2 migration applies to a stored search-settings document: the alias
 * fields have to reach an existing {@code table} configuration without disturbing what an operator
 * already put there.
 */
class TableAliasesSearchSettingsMigrationTest {

  private FieldBoost fieldBoost(String field, double boost, FieldBoost.MatchType matchType) {
    FieldBoost fieldBoost = new FieldBoost();
    fieldBoost.setField(field);
    fieldBoost.setBoost(boost);
    fieldBoost.setMatchType(matchType);
    return fieldBoost;
  }

  private AssetTypeConfiguration tableConfig(
      List<FieldBoost> searchFields, List<String> highlightFields) {
    AssetTypeConfiguration config = new AssetTypeConfiguration();
    config.setAssetType("table");
    config.setSearchFields(new ArrayList<>(searchFields));
    config.setHighlightFields(new ArrayList<>(highlightFields));
    return config;
  }

  private SearchSettings settingsWithTableConfig(AssetTypeConfiguration tableConfig) {
    SearchSettings settings = new SearchSettings();
    settings.setAssetTypeConfigurations(new ArrayList<>(List.of(tableConfig)));
    return settings;
  }

  @Test
  void addsMissingAliasSearchFieldsAndHighlightField() {
    SearchSettings currentSettings =
        settingsWithTableConfig(
            tableConfig(
                new ArrayList<>(List.of(fieldBoost("name", 10.0, FieldBoost.MatchType.PHRASE))),
                new ArrayList<>(List.of("name", "description"))));
    SearchSettings defaultSettings =
        settingsWithTableConfig(
            tableConfig(
                List.of(
                    fieldBoost("name", 10.0, FieldBoost.MatchType.PHRASE),
                    fieldBoost("aliases", 5.0, FieldBoost.MatchType.STANDARD),
                    fieldBoost("aliases.keyword", 10.0, FieldBoost.MatchType.EXACT)),
                List.of("name", "description", "aliases")));

    boolean changed =
        TableAliasesSearchSettingsMigration.mergeAliasesIntoTableConfiguration(
            currentSettings, defaultSettings);

    assertTrue(changed);
    AssetTypeConfiguration mergedConfig = currentSettings.getAssetTypeConfigurations().getFirst();
    assertTrue(
        mergedConfig.getSearchFields().stream().anyMatch(f -> "aliases".equals(f.getField())));
    assertTrue(
        mergedConfig.getSearchFields().stream()
            .anyMatch(f -> "aliases.keyword".equals(f.getField())));
    assertTrue(mergedConfig.getHighlightFields().contains("aliases"));
    // The operator's own field must survive the merge.
    assertTrue(mergedConfig.getSearchFields().stream().anyMatch(f -> "name".equals(f.getField())));
  }

  @Test
  void isIdempotentWhenAliasesAlreadyPresent() {
    List<FieldBoost> fields =
        List.of(
            fieldBoost("name", 10.0, FieldBoost.MatchType.PHRASE),
            fieldBoost("aliases", 5.0, FieldBoost.MatchType.STANDARD),
            fieldBoost("aliases.keyword", 10.0, FieldBoost.MatchType.EXACT));
    SearchSettings currentSettings =
        settingsWithTableConfig(tableConfig(fields, List.of("name", "aliases")));
    SearchSettings defaultSettings =
        settingsWithTableConfig(tableConfig(fields, List.of("name", "aliases")));

    boolean changed =
        TableAliasesSearchSettingsMigration.mergeAliasesIntoTableConfiguration(
            currentSettings, defaultSettings);

    assertFalse(changed);
  }

  @Test
  void doesNothingWhenTableConfigurationMissing() {
    SearchSettings currentSettings = new SearchSettings();
    currentSettings.setAssetTypeConfigurations(new ArrayList<>());
    SearchSettings defaultSettings =
        settingsWithTableConfig(
            tableConfig(
                List.of(fieldBoost("aliases", 5.0, FieldBoost.MatchType.STANDARD)),
                List.of("aliases")));

    boolean changed =
        TableAliasesSearchSettingsMigration.mergeAliasesIntoTableConfiguration(
            currentSettings, defaultSettings);

    assertFalse(changed);
  }
}
