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
package org.openmetadata.service.migration.utils.v201;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.search.GlobalSettings;
import org.openmetadata.schema.api.search.SearchSettings;

class HybridSearchWeightSwapTest {

  private SearchSettings settingsWithWeights(Double keywordWeight, Double semanticWeight) {
    GlobalSettings globalSettings = new GlobalSettings();
    globalSettings.setKeywordWeight(keywordWeight);
    globalSettings.setSemanticWeight(semanticWeight);
    SearchSettings settings = new SearchSettings();
    settings.setGlobalSettings(globalSettings);
    return settings;
  }

  @Test
  void swapsThePreviousDefaultPair() {
    SearchSettings settings = settingsWithWeights(0.4, 0.6);

    assertTrue(MigrationUtil.swapPreviousHybridWeights(settings));

    assertEquals(0.6, settings.getGlobalSettings().getKeywordWeight());
    assertEquals(0.4, settings.getGlobalSettings().getSemanticWeight());
  }

  @Test
  void leavesOperatorTunedWeightsUntouched() {
    SearchSettings settings = settingsWithWeights(0.7, 0.3);

    assertFalse(MigrationUtil.swapPreviousHybridWeights(settings));

    assertEquals(0.7, settings.getGlobalSettings().getKeywordWeight());
    assertEquals(0.3, settings.getGlobalSettings().getSemanticWeight());
  }

  @Test
  void isIdempotentOnAlreadySwappedWeights() {
    SearchSettings settings = settingsWithWeights(0.6, 0.4);

    assertFalse(MigrationUtil.swapPreviousHybridWeights(settings));

    assertEquals(0.6, settings.getGlobalSettings().getKeywordWeight());
    assertEquals(0.4, settings.getGlobalSettings().getSemanticWeight());
  }

  @Test
  void leavesAHalfMatchingPairUntouched() {
    SearchSettings settings = settingsWithWeights(0.4, 0.4);

    assertFalse(MigrationUtil.swapPreviousHybridWeights(settings));

    assertEquals(0.4, settings.getGlobalSettings().getKeywordWeight());
    assertEquals(0.4, settings.getGlobalSettings().getSemanticWeight());
  }

  @Test
  void toleratesAbsentWeights() {
    SearchSettings settings = settingsWithWeights(null, null);

    assertFalse(MigrationUtil.swapPreviousHybridWeights(settings));

    assertNull(settings.getGlobalSettings().getKeywordWeight());
  }

  @Test
  void toleratesAbsentGlobalSettings() {
    assertFalse(MigrationUtil.swapPreviousHybridWeights(new SearchSettings()));
  }
}
