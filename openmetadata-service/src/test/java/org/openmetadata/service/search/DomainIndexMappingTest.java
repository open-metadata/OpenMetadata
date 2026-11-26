package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.schema.type.IndexMappingLanguage;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.change.ChangeSource;

class DomainIndexMappingTest {
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final Map<String, List<String>> SOURCE_KEYS =
      Map.of(
          "descriptionSources",
              Arrays.stream(ChangeSource.values()).map(ChangeSource::value).toList(),
          "tagSources",
              Arrays.stream(TagLabel.LabelType.values()).map(TagLabel.LabelType::value).toList(),
          "tierSources",
              Arrays.stream(TagLabel.LabelType.values()).map(TagLabel.LabelType::value).toList());

  @ParameterizedTest
  @EnumSource(IndexMappingLanguage.class)
  void domainSearchFieldsExistInEveryLanguage(final IndexMappingLanguage language)
      throws IOException {
    final JsonNode english = loadProperties(IndexMappingLanguage.EN);
    final JsonNode localized = loadProperties(language);
    final Set<String> missing = new HashSet<>();
    english
        .fieldNames()
        .forEachRemaining(
            field -> {
              if (!localized.has(field)) {
                missing.add(field);
              }
            });
    assertTrue(
        missing.isEmpty(), language + " domain search is missing structural fields: " + missing);
  }

  @ParameterizedTest
  @EnumSource(IndexMappingLanguage.class)
  void hierarchyAggregationUsesAnUnnormalizedTopLevelKeyword(final IndexMappingLanguage language)
      throws IOException {
    final JsonNode keyword = MAPPER.readTree("{\"type\":\"keyword\"}");
    assertEquals(keyword, loadProperties(IndexMappingLanguage.EN).path("fqnParts"));
    assertEquals(
        keyword,
        loadProperties(language).path("fqnParts"),
        language
            + " domain hierarchy aggregates bare fqnParts and must preserve exact FQN spelling");
  }

  @ParameterizedTest
  @EnumSource(IndexMappingLanguage.class)
  void provenanceFiltersIndexEverySourceCounter(final IndexMappingLanguage language)
      throws IOException {
    final JsonNode english = loadProperties(IndexMappingLanguage.EN);
    final JsonNode localized = loadProperties(language);
    assertAll(
        language + " domain provenance filters",
        SOURCE_KEYS.entrySet().stream()
            .map(
                entry ->
                    () -> {
                      final String field = entry.getKey();
                      final JsonNode descriptor = localized.path(field);
                      assertEquals(english.path(field), descriptor, language + " " + field);
                      assertEquals("object", descriptor.path("type").asText(), field);
                      assertEquals(
                          MAPPER.getNodeFactory().booleanNode(false),
                          descriptor.path("dynamic"),
                          field);
                      for (final String key : entry.getValue()) {
                        assertEquals(
                            "integer",
                            descriptor.at("/properties/" + key + "/type").asText(),
                            language
                                + " domain exists filters require indexed "
                                + field
                                + "."
                                + key);
                      }
                    }));
  }

  private JsonNode loadProperties(final IndexMappingLanguage language) throws IOException {
    final String path =
        "/elasticsearch/"
            + language.value().toLowerCase(Locale.ROOT)
            + "/domain_index_mapping.json";
    try (InputStream input = getClass().getResourceAsStream(path)) {
      assertNotNull(input, "Required domain mapping missing: " + path);
      final JsonNode mapping = MAPPER.readTree(input);
      assertNotNull(mapping, "Required domain mapping is empty: " + path);
      final JsonNode properties = mapping.path("mappings").path("properties");
      assertTrue(
          properties.isObject() && !properties.isEmpty(), path + " requires mappings.properties");
      return properties;
    } catch (IOException exception) {
      throw new IOException("Failed to read required domain mapping: " + path, exception);
    }
  }
}
