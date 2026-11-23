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
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.search.elasticsearch.EsUtils;
import org.openmetadata.service.search.opensearch.OsUtils;

/**
 * Pins the typed {@code relatedTerms} mapping in every localized {@code
 * glossary_term_index_mapping.json}.
 *
 * <p>ADR:2026-11-23-glossary-related-terms-are-indexed-as-nested-typed-edges
 */
class GlossaryTermIndexMappingTest {

  private static final List<String> LANGUAGES = List.of("en", "jp", "ko", "ru", "zh");
  private static final List<String> EXACT_KEYWORD_FIELDS =
      List.of("relationType", "provenance", "status", "createdBy");
  private static final List<String> REFERENCE_FIELDS =
      List.of(
          "id",
          "type",
          "name",
          "displayName",
          "fullyQualifiedName",
          "description",
          "deleted",
          "href");

  @Test
  void relatedTermsIsNestedAndMatchesTermRelationSchemaInAllLanguages() throws IOException {
    Set<String> schemaProperties = termRelationSchemaProperties();
    for (String language : LANGUAGES) {
      JsonNode relatedTerms = loadProperties(language).path("relatedTerms");
      assertEquals(
          "nested",
          relatedTerms.path("type").asText(),
          "relatedTerms in " + language + " must be mapped as 'nested'");
      JsonNode properties = relatedTerms.path("properties");
      assertEquals(
          schemaProperties,
          fieldNames(properties),
          "relatedTerms properties in " + language + " must match type/termRelation.json");
    }
  }

  @Test
  void typedRelationMetadataFieldsUseExactKeywordAndEpochMillisInAllLanguages() throws IOException {
    for (String language : LANGUAGES) {
      JsonNode properties = loadProperties(language).path("relatedTerms").path("properties");
      for (String field : EXACT_KEYWORD_FIELDS) {
        JsonNode node = properties.path(field);
        assertEquals("keyword", node.path("type").asText(), language + " relatedTerms." + field);
        assertFalse(
            node.has("normalizer"),
            language + " relatedTerms." + field + " must preserve exact enum/type casing");
        assertFalse(
            node.has("fields"),
            language + " relatedTerms." + field + " should not add redundant subfields");
      }
      assertEquals("keyword", properties.at("/id/type").asText(), language + " relatedTerms.id");
      assertEquals(
          "date", properties.at("/createdAt/type").asText(), language + " relatedTerms.createdAt");
      assertEquals(
          "epoch_millis",
          properties.at("/createdAt/format").asText(),
          language + " relatedTerms.createdAt format");
    }
  }

  @Test
  void nestedEntityReferencesMapTargetAndRelationshipTypeInAllLanguages() throws IOException {
    for (String language : LANGUAGES) {
      JsonNode properties = loadProperties(language).path("relatedTerms").path("properties");
      for (String refField : List.of("term", "relationshipType")) {
        JsonNode refProps = properties.path(refField).path("properties");
        for (String subField : REFERENCE_FIELDS) {
          assertTrue(
              refProps.has(subField),
              language + " relatedTerms." + refField + " missing " + subField);
        }
        assertEquals(
            "keyword",
            refProps.at("/id/type").asText(),
            language + " relatedTerms." + refField + ".id");
        assertEquals(
            "keyword",
            refProps.at("/fullyQualifiedName/type").asText(),
            language + " relatedTerms." + refField + ".fullyQualifiedName");
        assertFalse(
            refProps.path("fullyQualifiedName").has("normalizer"),
            language + " relatedTerms." + refField + ".fullyQualifiedName preserves exact FQN");
      }
    }
  }

  @Test
  void relatedTermsMappingIsIdenticalAcrossAllLanguages() throws IOException {
    JsonNode english = loadProperties("en").path("relatedTerms");
    for (String language : LANGUAGES) {
      assertEquals(
          english,
          loadProperties(language).path("relatedTerms"),
          "relatedTerms mapping diverged between en and " + language);
    }
  }

  @Test
  void hardenedMappingTransformsCleanlyForElasticsearchAndOpenSearch() throws IOException {
    for (String language : LANGUAGES) {
      String raw = readResource("elasticsearch/" + language + "/glossary_term_index_mapping.json");
      String hardened = SearchIndexSettings.harden(raw, SearchFieldLimits.active());
      String esJson = EsUtils.enrichIndexMappingForElasticsearch(hardened);
      String osJson = OsUtils.enrichIndexMappingForOpenSearch(hardened);

      JsonNode esRelated =
          JsonUtils.readTree(esJson).path("mappings").path("properties").path("relatedTerms");
      JsonNode osRelated =
          JsonUtils.readTree(osJson).path("mappings").path("properties").path("relatedTerms");

      assertEquals("nested", esRelated.path("type").asText(), "ES " + language);
      assertEquals("nested", osRelated.path("type").asText(), "OS " + language);
      assertTrue(
          esRelated.at("/properties/relationType/ignore_above").asInt() > 0,
          "ES hardening should guard keyword ignore_above for " + language);
      assertTrue(
          osRelated.at("/properties/provenance/ignore_above").asInt() > 0,
          "OS hardening should guard keyword ignore_above for " + language);
      assertTrue(
          esRelated.at("/properties/createdAt/ignore_malformed").asBoolean(),
          "ES hardening should guard createdAt ignore_malformed for " + language);
      assertTrue(
          osRelated.at("/properties/createdAt/ignore_malformed").asBoolean(),
          "OS hardening should guard createdAt ignore_malformed for " + language);
    }
  }

  private static Set<String> termRelationSchemaProperties() throws IOException {
    JsonNode schema = JsonUtils.readTree(readResource("json/schema/type/termRelation.json"));
    return fieldNames(schema.path("properties"));
  }

  private static Set<String> fieldNames(JsonNode node) {
    Set<String> names = new TreeSet<>();
    node.fieldNames().forEachRemaining(names::add);
    return names;
  }

  private static JsonNode loadProperties(String language) throws IOException {
    String raw = readResource("elasticsearch/" + language + "/glossary_term_index_mapping.json");
    return JsonUtils.readTree(raw).path("mappings").path("properties");
  }

  private static String readResource(String path) throws IOException {
    try (InputStream in =
        GlossaryTermIndexMappingTest.class.getClassLoader().getResourceAsStream(path)) {
      assertNotNull(in, "Could not locate " + path + " on the test classpath");
      return new String(in.readAllBytes(), StandardCharsets.UTF_8);
    }
  }
}
