package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class DataContractIndexMappingTest {
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final List<String> FREE_FORM_FIELDS =
      List.of(
          "schema",
          "semantics",
          "qualityExpectations",
          "odcsQualityRules",
          "odcsElementExtensions",
          "contractUpdates",
          "sla",
          "security",
          "termsOfUse");

  private static JsonNode read(String path) throws IOException {
    try (InputStream in = DataContractIndexMappingTest.class.getResourceAsStream(path)) {
      assertNotNull(in, "missing resource " + path);
      return MAPPER.readTree(in);
    }
  }

  private static JsonNode properties(String language) throws IOException {
    return read("/elasticsearch/" + language + "/data_contract_index_mapping.json")
        .path("mappings")
        .path("properties");
  }

  @Test
  void indexIsRegisteredWithoutParentAliases() throws IOException {
    JsonNode entry = read("/elasticsearch/indexMapping.json").path("dataContract");
    assertEquals("data_contract_search_index", entry.path("indexName").asText());
    assertEquals(
        "/elasticsearch/%s/data_contract_index_mapping.json",
        entry.path("indexMappingFile").asText());
    assertEquals("dataContract", entry.path("alias").asText());
    // Not under `all`: owner/team asset lists and the domain/tag asset pickers query `all`, and a
    // contract there would be listed with no link and accepted as a domain/tag asset it can't hold.
    assertTrue(entry.path("parentAliases").isEmpty());
    assertTrue(entry.path("childAliases").isEmpty());
  }

  @ParameterizedTest
  @ValueSource(strings = {"en", "jp", "ru", "zh"})
  void contractFieldsAreMapped(String language) throws IOException {
    JsonNode props = properties(language);
    assertEquals("keyword", props.at("/entity/properties/type/type").asText());
    assertEquals(
        "keyword", props.at("/entity/properties/fullyQualifiedName/fields/keyword/type").asText());
    assertEquals("keyword", props.at("/testSuite/properties/id/type").asText());
    assertEquals("keyword", props.at("/latestResult/properties/status/type").asText());
    assertEquals("keyword", props.at("/reviewers/properties/id/type").asText());
    assertEquals("nested", props.at("/owners/type").asText());
    assertEquals("keyword", props.at("/fqnHash/type").asText());
  }

  @ParameterizedTest
  @ValueSource(strings = {"en", "jp", "ru", "zh"})
  void entityFqnKeywordHasNoIgnoreAbove(String language) throws IOException {
    JsonNode keyword =
        properties(language).at("/entity/properties/fullyQualifiedName/fields/keyword");
    assertTrue(
        keyword.path("ignore_above").isMissingNode(),
        "asset FQNs can exceed 256 chars; ignore_above would drop them from the filter");
  }

  @ParameterizedTest
  @ValueSource(strings = {"en", "jp", "ru", "zh"})
  void referenceFqnKeywordsAreLowercaseNormalized(String language) throws IOException {
    // Aggregation autocomplete lowercases the typed prefix; an un-normalized keyword never matches
    // mixed-case FQNs once the user types.
    JsonNode props = properties(language);
    for (String ref : List.of("entity", "testSuite")) {
      assertEquals(
          "lowercase_normalizer",
          props
              .at("/" + ref + "/properties/fullyQualifiedName/fields/keyword/normalizer")
              .asText());
    }
  }

  @ParameterizedTest
  @ValueSource(strings = {"en", "jp", "ru", "zh"})
  void freeFormBlocksAndTagsAreNotMapped(String language) throws IOException {
    JsonNode props = properties(language);
    for (String field : FREE_FORM_FIELDS) {
      assertFalse(props.has(field), field + " must be excluded, not mapped");
    }
    assertFalse(props.has("tags"), "contracts have no tags");
    assertFalse(props.has("classificationTags"), "contracts have no tags");
  }
}
