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
package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.schema.entity.data.SearchIndex;
import org.openmetadata.schema.type.IndexMappingLanguage;
import org.openmetadata.schema.type.SearchIndexDataType;
import org.openmetadata.schema.type.SearchIndexField;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.search.indexes.SearchEntityIndex;
import org.openmetadata.service.search.opensearch.OsUtils;

class SearchEntityIndexMappingTest {

  static Stream<String> languages() {
    return Stream.of(IndexMappingLanguage.values())
        .map(language -> language.toString().toLowerCase(Locale.ROOT));
  }

  private static String readMappingResource(String language) throws IOException {
    String path = "/elasticsearch/" + language + "/search_entity_index_mapping.json";
    try (InputStream in = SearchEntityIndexMappingTest.class.getResourceAsStream(path)) {
      assertNotNull(in, "Missing mapping resource: " + path);
      return new String(in.readAllBytes(), StandardCharsets.UTF_8);
    }
  }

  private static void assertDisabledObjectMapping(JsonNode searchIndexSettings, String context) {
    assertFalse(
        searchIndexSettings.isMissingNode() || searchIndexSettings.isNull(),
        "mappings.properties.searchIndexSettings must be declared in " + context);
    assertEquals(
        "object",
        searchIndexSettings.path("type").asText(),
        "searchIndexSettings must have \"type\": \"object\" in " + context);
    assertFalse(
        searchIndexSettings.path("enabled").isMissingNode(),
        "searchIndexSettings must explicitly set \"enabled\": false in " + context);
    assertFalse(
        searchIndexSettings.path("enabled").asBoolean(true),
        "searchIndexSettings must set \"enabled\": false so dynamic subfield indexing is disabled in "
            + context);
    assertFalse(
        searchIndexSettings.has("properties"),
        "Disabled object searchIndexSettings must not declare nested properties in " + context);
  }

  @ParameterizedTest
  @MethodSource("languages")
  void searchIndexSettingsDisablesDynamicSubfieldIndexingInEveryLanguage(String language)
      throws IOException {
    String rawMapping = readMappingResource(language);
    JsonNode root = JsonUtils.readTree(rawMapping);
    JsonNode searchIndexSettings =
        root.path("mappings").path("properties").path("searchIndexSettings");
    assertDisabledObjectMapping(searchIndexSettings, "raw[" + language + "]");

    String hardened = SearchIndexSettings.harden(rawMapping, SearchFieldLimits.defaults());
    assertDisabledObjectMapping(
        JsonUtils.readTree(hardened)
            .path("mappings")
            .path("properties")
            .path("searchIndexSettings"),
        "hardened[" + language + "]");

    try (MockedStatic<Entity> entityMock = Mockito.mockStatic(Entity.class)) {
      entityMock.when(Entity::getSearchRepository).thenReturn(null);
      String enrichedForOpenSearch = OsUtils.enrichIndexMappingForOpenSearch(hardened);
      assertDisabledObjectMapping(
          JsonUtils.readTree(enrichedForOpenSearch)
              .path("mappings")
              .path("properties")
              .path("searchIndexSettings"),
          "opensearch[" + language + "]");
    }
  }

  @Test
  void searchEntityIndexPreservesKnnSearchIndexSettingsInIndexedDoc() {
    Map<String, Object> expectedSettings = new LinkedHashMap<>();
    expectedSettings.put("index.knn", true);
    expectedSettings.put("index.knn.algo_param.ef_search", 100);
    expectedSettings.put(
        "index", Map.of("knn", "true", "knn.algo_param", Map.of("ef_search", "256")));

    org.openmetadata.schema.type.searchindex.SearchIndexSettings settings =
        new org.openmetadata.schema.type.searchindex.SearchIndexSettings();
    expectedSettings.forEach(settings::withAdditionalProperty);

    SearchIndex searchIndex =
        new SearchIndex()
            .withId(UUID.randomUUID())
            .withName("knn_vectors")
            .withFullyQualifiedName("opensearch_prod.knn_vectors")
            .withFields(
                List.of(
                    new SearchIndexField()
                        .withName("embedding")
                        .withDataType(SearchIndexDataType.DENSE_VECTOR)))
            .withSearchIndexSettings(settings);

    try (MockedStatic<Entity> entityMock = Mockito.mockStatic(Entity.class)) {
      SearchRepository mockSearchRepo =
          Mockito.mock(SearchRepository.class, Mockito.RETURNS_DEEP_STUBS);
      entityMock.when(Entity::getSearchRepository).thenReturn(mockSearchRepo);
      entityMock
          .when(() -> Entity.getEntityTags(anyString(), any()))
          .thenReturn(Collections.emptyList());
      CollectionDAO dao = mock(CollectionDAO.class);
      CollectionDAO.EntityRelationshipDAO relDao = mock(CollectionDAO.EntityRelationshipDAO.class);
      when(dao.relationshipDAO()).thenReturn(relDao);
      when(relDao.findFrom(any(UUID.class), anyString(), anyInt()))
          .thenReturn(Collections.emptyList());
      entityMock.when(Entity::getCollectionDAO).thenReturn(dao);

      Map<String, Object> doc = new SearchEntityIndex(searchIndex).buildSearchIndexDoc();
      assertEquals(expectedSettings, doc.get("searchIndexSettings"));

      SearchIndex withoutSettings =
          new SearchIndex()
              .withId(UUID.randomUUID())
              .withName("plain_index")
              .withFullyQualifiedName("opensearch_prod.plain_index")
              .withFields(
                  List.of(
                      new SearchIndexField()
                          .withName("message")
                          .withDataType(SearchIndexDataType.TEXT)));
      Map<String, Object> docWithoutSettings =
          new SearchEntityIndex(withoutSettings).buildSearchIndexDoc();
      assertFalse(docWithoutSettings.containsKey("searchIndexSettings"));
    }
  }
}
