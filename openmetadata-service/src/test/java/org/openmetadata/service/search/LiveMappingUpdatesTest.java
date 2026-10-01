package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.NullNode;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.utils.JsonUtils;

class LiveMappingUpdatesTest {
  private static final String MAPPING =
      """
      {
        "settings": {"analysis": {"analyzer": {
          "om_ngram": {"type": "custom", "tokenizer": "standard"},
          "om_ngram_search": {"type": "custom", "tokenizer": "standard"}
        }}},
        "mappings": {"properties": {
          "name": {"type": "text", "fields": {
            "ngram": {"type": "text", "analyzer": "om_ngram", "search_analyzer": "om_ngram_search"}
          }},
          "displayName": {"type": "text", "analyzer": "ik_max_word", "search_analyzer": "ik_smart"},
          "newField": {"type": "keyword"}
        }}
      }
      """;

  @Test
  void dropsSearchAnalyzersTheLiveIndexDoesNotDefine() {
    String update = LiveMappingUpdates.forLiveIndex(MAPPING, settings("om_ngram"));

    JsonNode properties = JsonUtils.readTree(update).path("mappings").path("properties");
    JsonNode ngram = properties.path("name").path("fields").path("ngram");
    assertFalse(ngram.has("search_analyzer"));
    assertEquals("om_ngram", ngram.path("analyzer").asText());
    assertEquals("keyword", properties.path("newField").path("type").asText());
    assertEquals("ik_smart", properties.path("displayName").path("search_analyzer").asText());
  }

  @Test
  void keepsTheMappingWhenTheLiveIndexHasEveryAnalyzer() {
    assertSame(
        MAPPING, LiveMappingUpdates.forLiveIndex(MAPPING, settings("om_ngram", "om_ngram_search")));
  }

  @Test
  void keepsTheMappingWhenTheLiveSettingsAreUnknown() {
    assertSame(MAPPING, LiveMappingUpdates.forLiveIndex(MAPPING, NullNode.getInstance()));
  }

  @Test
  void requiresTheAnalyzerOnEveryIndexBehindAnAlias() {
    JsonNode twoIndexes =
        JsonUtils.readTree(
            """
            {
              "a": {"settings": {"index": {"analysis": {"analyzer": {"om_ngram": {}, "om_ngram_search": {}}}}}},
              "b": {"settings": {"index": {"analysis": {"analyzer": {"om_ngram": {}}}}}}
            }
            """);

    String update = LiveMappingUpdates.forLiveIndex(MAPPING, twoIndexes);

    assertFalse(update.contains("\"search_analyzer\":\"om_ngram_search\""));
  }

  private static JsonNode settings(String... analyzers) {
    StringBuilder names = new StringBuilder();
    for (String analyzer : analyzers) {
      names.append(names.isEmpty() ? "" : ",").append('"').append(analyzer).append("\": {}");
    }
    return JsonUtils.readTree(
        "{\"idx\": {\"settings\": {\"index\": {\"analysis\": {\"analyzer\": {" + names + "}}}}}}");
  }
}
