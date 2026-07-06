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
package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.configuration.SearchIndexMappings;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.search.IndexMappingLoader;
import org.openmetadata.service.jdbi3.CollectionDAO;

class SearchIndexMappingsSeederTest {

  @BeforeAll
  static void init() throws Exception {
    IndexMappingLoader.init();
    SearchFieldLimits.setActive(SearchFieldLimits.defaults());
  }

  @Test
  void buildDefaultBlob_seedsEntitiesAndBakesInGuards() {
    SearchIndexMappings blob = SearchIndexMappingsSeeder.buildDefaultBlob(List.of("en"));

    assertNotNull(blob.getLanguages());
    Map<String, Object> enMappings = blob.getLanguages().get("en");
    assertNotNull(enMappings, "en mappings present");
    assertTrue(enMappings.containsKey("table"), "table mapping seeded");

    String tableJson = JsonUtils.pojoToJson(enMappings.get("table"));
    assertTrue(
        tableJson.contains("ignore_above"),
        "keyword fields are hardened with ignore_above at seed");
  }

  @Test
  void buildEntityMapping_returnsHardenedMapping_andNullForUnknownEntity() {
    Map<String, Object> table = SearchIndexMappingsSeeder.buildEntityMapping("en", "table");

    assertNotNull(table);
    assertTrue(table.containsKey("mappings"));
    assertNull(SearchIndexMappingsSeeder.buildEntityMapping("en", "no_such_entity"));
  }

  @Test
  void settingsRowMapper_roundTripsSearchIndexMappings() {
    SearchIndexMappings blob = SearchIndexMappingsSeeder.buildDefaultBlob(List.of("en"));
    String json = JsonUtils.pojoToJson(blob);

    Settings settings =
        CollectionDAO.SettingsRowMapper.getSettings(SettingsType.SEARCH_INDEX_MAPPINGS, json);

    assertNotNull(settings);
    SearchIndexMappings roundTripped =
        JsonUtils.convertValue(settings.getConfigValue(), SearchIndexMappings.class);
    assertNotNull(roundTripped.getLanguages().get("en"));
    assertFalse(roundTripped.getLanguages().get("en").isEmpty());
  }
}
