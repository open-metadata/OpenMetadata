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

package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;

import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.Response;
import java.io.IOException;
import java.util.List;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.api.search.SearchSettings;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.security.SecurityUtil;
import org.openmetadata.service.util.EntityUtil;

@Slf4j
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class SimpleFuzzySearchTest extends OpenMetadataApplicationTest {

  @BeforeAll
  void setupSearchSettings() {
    // Ensure search settings are initialized for the test
    Settings storedSearchSettings =
        Entity.getSystemRepository().getConfigWithKey(SettingsType.SEARCH_SETTINGS.toString());
    if (storedSearchSettings == null) {
      try {
        List<String> jsonDataFiles =
            EntityUtil.getJsonDataResources(".*json/data/settings/searchSettings.json$");
        if (!jsonDataFiles.isEmpty()) {
          String json =
              CommonUtil.getResourceAsStream(
                  EntityRepository.class.getClassLoader(), jsonDataFiles.get(0));
          Settings setting =
              new Settings()
                  .withConfigType(SettingsType.SEARCH_SETTINGS)
                  .withConfigValue(JsonUtils.readValue(json, SearchSettings.class));
          Entity.getSystemRepository().createNewSetting(setting);
          LOG.info("Initialized search settings for test");
        }
      } catch (IOException e) {
        LOG.error("Failed to initialize search settings for test", e);
      }
    }
  }

  @Test
  void testLongQueryDoesNotCauseClauseExplosion() {
    String problematicQuery = "int_snowplow_experiment_evaluation_detailed_analytics_processing";

    assertDoesNotThrow(
        () -> {
          Response response = searchWithQuery(problematicQuery, "table_search_index");
          assertNotEquals(
              400, response.getStatus(), "Search should not return 400 error for long queries");
          assertTrue(
              response.getStatus() < 400,
              "Search should succeed without too_many_nested_clauses error. Status: "
                  + response.getStatus());
        });
  }

  @Test
  void testVeryLongQueryWithSpecialCharacters() {
    String veryLongQuery =
        "int_snowplow_experiment_evaluation_detailed_analytics_processing_with_special_characters_and_numbers_12345_test";

    assertDoesNotThrow(
        () -> {
          Response response = searchWithQuery(veryLongQuery, "table_search_index");

          assertNotEquals(400, response.getStatus(), "Very long query should not return 400 error");

          assertTrue(
              response.getStatus() < 400,
              "Very long query search should succeed without errors. Status: "
                  + response.getStatus());
        });
  }

  @Test
  void testSearchAcrossMultipleIndexes() {
    String query = "experiment_evaluation";
    String[] indexes = {"table_search_index", "topic_search_index", "all"};

    for (String index : indexes) {
      assertDoesNotThrow(
          () -> {
            Response response = searchWithQuery(query, index);
            assertNotEquals(
                400,
                response.getStatus(),
                "Search in index '" + index + "' should not return 400 error");
            assertTrue(
                response.getStatus() < 400,
                "Search in index '" + index + "' should succeed. Status: " + response.getStatus());
          });
    }
  }

  @Test
  void testFuzzySearchWithNgramFields() {
    String ngramProblematicQuery = "customer_email_address";
    assertDoesNotThrow(
        () -> {
          Response response = searchWithQuery(ngramProblematicQuery, "all");

          assertNotEquals(
              400, response.getStatus(), "Ngram field search should not return 400 error");

          assertTrue(
              response.getStatus() < 400,
              "Ngram field search should succeed. Status: " + response.getStatus());
        });
  }

  private Response searchWithQuery(String query, String index) {
    WebTarget target =
        getResource("search/query")
            .queryParam("q", query)
            .queryParam("index", index)
            .queryParam("from", 0)
            .queryParam("size", 10);

    return SecurityUtil.addHeaders(target, ADMIN_AUTH_HEADERS).get();
  }
}
