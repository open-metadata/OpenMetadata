/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.migration.utils.v210;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.search.AssetTypeConfiguration;
import org.openmetadata.schema.api.search.FieldBoost;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.configuration.EntityRulesSettings;
import org.openmetadata.schema.type.SemanticsRule;

class MigrationUtilTest {

  private SemanticsRule rule(String name, String... ignored) {
    return new SemanticsRule()
        .withName(name)
        .withIgnoredEntities(new ArrayList<>(List.of(ignored)));
  }

  private long queryCount(SemanticsRule rule) {
    return rule.getIgnoredEntities().stream().filter("query"::equals).count();
  }

  @Test
  void addsQueryToBothDomainRulesOnly() {
    SemanticsRule multiDomain = rule("Multiple Domains are not allowed", "user", "team");
    SemanticsRule dpDomain = rule("Data Product Domain Validation", "user", "team");
    SemanticsRule unrelated = rule("Tables can only have a single Glossary Term", "user");
    EntityRulesSettings settings =
        new EntityRulesSettings()
            .withEntitySemantics(new ArrayList<>(List.of(multiDomain, dpDomain, unrelated)));

    assertTrue(MigrationUtil.addQueryDomainRuleExemption(settings));

    assertTrue(multiDomain.getIgnoredEntities().contains("query"));
    assertTrue(dpDomain.getIgnoredEntities().contains("query"));
    // Unrelated rule must be left untouched.
    assertFalse(unrelated.getIgnoredEntities().contains("query"));
    // Existing exemptions preserved.
    assertTrue(multiDomain.getIgnoredEntities().contains("user"));
  }

  @Test
  void isIdempotent() {
    SemanticsRule multiDomain = rule("Multiple Domains are not allowed", "user", "team", "query");
    EntityRulesSettings settings =
        new EntityRulesSettings().withEntitySemantics(new ArrayList<>(List.of(multiDomain)));

    // Already exempt -> no change, and no duplicate entry.
    assertFalse(MigrationUtil.addQueryDomainRuleExemption(settings));
    assertEquals(1, queryCount(multiDomain));
  }

  @Test
  void handlesMissingOrNullSemantics() {
    assertFalse(MigrationUtil.addQueryDomainRuleExemption(null));
    assertFalse(MigrationUtil.addQueryDomainRuleExemption(new EntityRulesSettings()));
  }

  @Test
  void initializesNullIgnoredEntities() {
    SemanticsRule multiDomain = new SemanticsRule().withName("Multiple Domains are not allowed");
    multiDomain.setIgnoredEntities(null);
    EntityRulesSettings settings =
        new EntityRulesSettings().withEntitySemantics(new ArrayList<>(List.of(multiDomain)));

    assertTrue(MigrationUtil.addQueryDomainRuleExemption(settings));
    assertEquals(1, queryCount(multiDomain));
  }

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
        MigrationUtil.mergeAliasesIntoTableConfiguration(currentSettings, defaultSettings);

    assertTrue(changed);
    AssetTypeConfiguration mergedConfig = currentSettings.getAssetTypeConfigurations().getFirst();
    assertTrue(
        mergedConfig.getSearchFields().stream().anyMatch(f -> "aliases".equals(f.getField())));
    assertTrue(
        mergedConfig.getSearchFields().stream()
            .anyMatch(f -> "aliases.keyword".equals(f.getField())));
    assertTrue(mergedConfig.getHighlightFields().contains("aliases"));
  }

  @Test
  void aliasesMergeIsIdempotentWhenAlreadyPresent() {
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
        MigrationUtil.mergeAliasesIntoTableConfiguration(currentSettings, defaultSettings);

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
        MigrationUtil.mergeAliasesIntoTableConfiguration(currentSettings, defaultSettings);

    assertFalse(changed);
  }
}
