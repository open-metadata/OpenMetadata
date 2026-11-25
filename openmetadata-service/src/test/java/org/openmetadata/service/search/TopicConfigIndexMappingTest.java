package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.IndexMappingLanguage;

/**
 * A topic carries its broker configuration verbatim in {@code topicConfig}, and broker settings are
 * keyed with dots ({@code confluent.key.schema.validation}, {@code min.insync.replicas}). Left
 * undeclared, the search engine maps those keys dynamically and splits each dot into another level
 * of object, so the first topic whose key is a prefix of another topic's key makes the two
 * incompatible and the document is rejected with "can't merge a non object mapping ... with an
 * object mapping". The value is display-only, read from the entity API rather than from search.
 * ADR:2026-11-24-free-form-config-objects-stay-out-of-the-search-mapping
 */
class TopicConfigIndexMappingTest {
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final String MAPPING_FILE = "/elasticsearch/%s/topic_index_mapping.json";
  private static final List<String> LANGUAGES =
      Arrays.stream(IndexMappingLanguage.values())
          .map(language -> language.toString().toLowerCase(Locale.ROOT))
          .toList();

  @Test
  void topicConfigIsKeptInSourceWithoutBeingMapped() throws IOException {
    for (String language : LANGUAGES) {
      String path = String.format(MAPPING_FILE, language);
      JsonNode topicConfig = read(path).at("/mappings/properties/topicConfig");

      assertFalse(topicConfig.isMissingNode(), path + " does not declare topicConfig");
      assertFalse(
          topicConfig.path("enabled").asBoolean(true),
          path + " must declare topicConfig with \"enabled\": false");
    }
  }

  private static JsonNode read(String path) throws IOException {
    try (InputStream in = TopicConfigIndexMappingTest.class.getResourceAsStream(path)) {
      assertNotNull(in, "missing mapping " + path);
      return MAPPER.readTree(in);
    }
  }
}
