/*
 *  Copyright 2026 Collate
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

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.search.AssetTypeConfiguration;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.api.search.TermBoost;
import org.openmetadata.schema.utils.JsonUtils;

class SearchTermBoostRepairTest {

  @Test
  void repairCorrectsLegacyPathsAndAllowsUiTermBoostFields() {
    SearchSettings settings =
        settings(
            """
            {
              "globalSettings": {
                "termBoosts": [
                  {"field": "certification.tagFQN", "value": "Certification.Gold", "boost": 3.0}
                ]
              },
              "defaultConfiguration": {
                "assetType": "default",
                "termBoosts": [
                  {"field": "certification.tagFQN", "value": "Certification.Bronze", "boost": 2.0}
                ],
                "ranking": {
                  "signals": {"fields": ["entityType"]}
                }
              },
              "assetTypeConfigurations": [
                {
                  "assetType": "table",
                  "termBoosts": [
                    {"field": "certification.tagFQN", "value": "Certification.Silver", "boost": 4.0},
                    {"field": "tags.tagFQN", "value": "PII.Sensitive", "boost": 2.0}
                  ],
                  "ranking": {
                    "signals": {"fields": ["tier.tagFQN", "tags.tagFQN"]}
                  }
                }
              ]
            }
            """);

    assertTrue(SearchTermBoostRepair.repairTermBoostSettings(settings));

    assertEquals(
        List.of("certification.tagLabel.tagFQN"),
        termBoostFields(settings.getGlobalSettings().getTermBoosts()));
    assertEquals(
        List.of("certification.tagLabel.tagFQN"),
        termBoostFields(settings.getDefaultConfiguration().getTermBoosts()));
    assertEquals(
        List.of("certification.tagLabel.tagFQN", "tags.tagFQN"),
        termBoostFields(asset(settings, "table").getTermBoosts()));
    assertEquals(
        List.of("entityType", "tags.tagFQN", "certification.tagLabel.tagFQN"),
        settings.getDefaultConfiguration().getRanking().getSignals().getFields());
    assertEquals(
        List.of("tier.tagFQN", "tags.tagFQN", "certification.tagLabel.tagFQN"),
        asset(settings, "table").getRanking().getSignals().getFields());
    assertFalse(SearchTermBoostRepair.repairTermBoostSettings(settings));
  }

  @Test
  void repairPreservesEmptySignalFieldsAsAllowAll() {
    SearchSettings settings =
        settings(
            """
            {
              "defaultConfiguration": {
                "assetType": "default",
                "ranking": {"signals": {"fields": []}}
              },
              "assetTypeConfigurations": [
                {
                  "assetType": "table",
                  "ranking": {"signals": {}}
                }
              ]
            }
            """);

    assertFalse(SearchTermBoostRepair.repairTermBoostSettings(settings));

    assertTrue(settings.getDefaultConfiguration().getRanking().getSignals().getFields().isEmpty());
    assertTrue(asset(settings, "table").getRanking().getSignals().getFields().isEmpty());
  }

  @Test
  void repairLeavesCorrectSettingsUnchanged() {
    SearchSettings settings =
        settings(
            """
            {
              "defaultConfiguration": {
                "assetType": "default",
                "ranking": {
                  "signals": {
                    "fields": ["entityType", "tags.tagFQN", "certification.tagLabel.tagFQN"]
                  }
                }
              }
            }
            """);

    assertFalse(SearchTermBoostRepair.repairTermBoostSettings(settings));
  }

  private SearchSettings settings(String json) {
    return JsonUtils.readValue(json, SearchSettings.class);
  }

  private AssetTypeConfiguration asset(SearchSettings settings, String assetType) {
    return settings.getAssetTypeConfigurations().stream()
        .filter(configuration -> assetType.equals(configuration.getAssetType()))
        .findFirst()
        .orElseThrow();
  }

  private List<String> termBoostFields(List<TermBoost> termBoosts) {
    return termBoosts.stream().map(TermBoost::getField).toList();
  }
}
