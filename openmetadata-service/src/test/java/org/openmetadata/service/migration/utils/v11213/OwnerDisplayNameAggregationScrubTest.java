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
package org.openmetadata.service.migration.utils.v11213;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.search.Aggregation;
import org.openmetadata.schema.api.search.AssetTypeConfiguration;
import org.openmetadata.schema.api.search.GlobalSettings;
import org.openmetadata.schema.api.search.SearchSettings;

class OwnerDisplayNameAggregationScrubTest {

  private static final String STALE = "owners.displayName.keyword";
  private static final String FIXED = "ownerDisplayName";

  private Aggregation agg(String name, String field) {
    Aggregation a = new Aggregation();
    a.setName(name);
    a.setField(field);
    return a;
  }

  private AssetTypeConfiguration assetConfig(String assetType, Aggregation... aggregations) {
    AssetTypeConfiguration config = new AssetTypeConfiguration();
    config.setAssetType(assetType);
    config.setAggregations(new ArrayList<>(List.of(aggregations)));
    return config;
  }

  @Test
  void retargetsStaleFieldInAssetConfigButKeepsName() {
    SearchSettings settings = new SearchSettings();
    settings.setAssetTypeConfigurations(
        new ArrayList<>(List.of(assetConfig("dashboard", agg(STALE, STALE), agg("tier", "tier")))));

    boolean changed = MigrationUtil.retargetStaleOwnerAggregations(settings);

    assertTrue(changed);
    List<Aggregation> aggs = settings.getAssetTypeConfigurations().getFirst().getAggregations();
    Aggregation owner =
        aggs.stream().filter(a -> STALE.equals(a.getName())).findFirst().orElseThrow();
    assertEquals(FIXED, owner.getField());
    assertEquals(STALE, owner.getName());
    assertTrue(aggs.stream().noneMatch(a -> STALE.equals(a.getField())));
  }

  @Test
  void retargetsStaleFieldInGlobalSettings() {
    GlobalSettings globalSettings = new GlobalSettings();
    globalSettings.setAggregations(
        new ArrayList<>(List.of(agg("owners.displayName.keyword", STALE), agg("tier", "tier"))));
    SearchSettings settings = new SearchSettings();
    settings.setGlobalSettings(globalSettings);

    boolean changed = MigrationUtil.retargetStaleOwnerAggregations(settings);

    assertTrue(changed);
    assertTrue(
        settings.getGlobalSettings().getAggregations().stream()
            .noneMatch(a -> STALE.equals(a.getField())));
    assertTrue(
        settings.getGlobalSettings().getAggregations().stream()
            .anyMatch(a -> FIXED.equals(a.getField())));
  }

  @Test
  void isIdempotentWhenAlreadyRetargeted() {
    SearchSettings settings = new SearchSettings();
    settings.setAssetTypeConfigurations(
        new ArrayList<>(List.of(assetConfig("dashboard", agg(STALE, FIXED), agg("tier", "tier")))));

    boolean changed = MigrationUtil.retargetStaleOwnerAggregations(settings);

    assertFalse(changed);
    assertEquals(
        FIXED,
        settings.getAssetTypeConfigurations().getFirst().getAggregations().getFirst().getField());
  }

  @Test
  void handlesNullAndEmptyGracefully() {
    assertFalse(MigrationUtil.retargetStaleOwnerAggregations(null));
    assertFalse(MigrationUtil.retargetStaleOwnerAggregations(new SearchSettings()));

    SearchSettings nullAggs = new SearchSettings();
    AssetTypeConfiguration config = new AssetTypeConfiguration();
    config.setAssetType("dashboard");
    config.setAggregations(null);
    nullAggs.setAssetTypeConfigurations(new ArrayList<>(List.of(config)));
    assertFalse(MigrationUtil.retargetStaleOwnerAggregations(nullAggs));
  }
}
