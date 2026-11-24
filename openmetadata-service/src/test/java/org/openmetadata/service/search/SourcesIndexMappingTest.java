package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.IndexMappingLanguage;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.change.ChangeSource;

/**
 * The *Sources maps are mapped with "dynamic": false, so a source key that is not declared is
 * kept in _source but never indexed, and Explore filters such as exists on
 * descriptionSources.Suggested silently match nothing.
 * ADR:2026-11-04-source-maps-index-every-enum-key
 */
class SourcesIndexMappingTest {
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final List<String> LANGUAGES =
      Arrays.stream(IndexMappingLanguage.values())
          .map(language -> language.toString().toLowerCase(Locale.ROOT))
          .toList();
  private static final List<String> CHANGE_SOURCES =
      Arrays.stream(ChangeSource.values()).map(ChangeSource::value).toList();
  private static final List<String> LABEL_TYPES =
      Arrays.stream(TagLabel.LabelType.values()).map(TagLabel.LabelType::value).toList();
  private static final Map<String, List<String>> SOURCE_KEYS =
      Map.of(
          "descriptionSources", CHANGE_SOURCES,
          "tagSources", LABEL_TYPES,
          "tierSources", LABEL_TYPES);

  private static JsonNode read(String path) throws IOException {
    try (InputStream in = SourcesIndexMappingTest.class.getResourceAsStream(path)) {
      return in == null ? null : MAPPER.readTree(in);
    }
  }

  @Test
  void everySourceKeyIsIndexed() throws IOException {
    final List<String> checked = new ArrayList<>();
    for (JsonNode entry : read("/elasticsearch/indexMapping.json")) {
      for (String language : LANGUAGES) {
        final String path = String.format(entry.path("indexMappingFile").asText(), language);
        final JsonNode mapping = read(path);
        if (mapping != null) {
          checked.addAll(
              assertSourceKeysIndexed(path, mapping.path("mappings").path("properties")));
        }
      }
    }
    assertTrue(checked.contains("/elasticsearch/en/table_index_mapping.json descriptionSources"));
  }

  private static List<String> assertSourceKeysIndexed(String path, JsonNode props) {
    final List<String> checked = new ArrayList<>();
    SOURCE_KEYS.forEach(
        (field, keys) -> {
          final JsonNode sources = props.path(field);
          if (sources.isMissingNode()) {
            return;
          }
          keys.forEach(
              key ->
                  assertEquals(
                      "integer",
                      sources.at("/properties/" + key + "/type").asText(),
                      path + " " + field + "." + key));
          checked.add(path + " " + field);
        });
    return checked;
  }
}
