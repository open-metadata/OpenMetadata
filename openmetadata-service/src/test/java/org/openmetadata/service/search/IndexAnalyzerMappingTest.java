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
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.search.IndexMappingLoader;

/**
 * Guards the analyzer chains the shipped index mappings declare.
 *
 * <p>These are ordering constraints that no amount of ranking configuration can compensate for: if
 * the tokens are wrong, the query never matches in the first place. Asserted over every mapping
 * {@link IndexMappingLoader} ships rather than a hand-picked few, because the analysis block is
 * duplicated into each entity's mapping file and a new entity is added by copying an existing one.
 */
class IndexAnalyzerMappingTest {

  private static final String ENGLISH = "en";
  private static final String WORD_DELIMITER = "word_delimiter_filter";
  private static final String COMPOUND_DELIMITER = "compound_word_delimiter_graph";
  private static final String LOWERCASE = "lowercase";
  private static final String STEMMER = "om_stemmer";
  private static final String PLURAL_STEMMER = "om_plural_stemmer";

  @BeforeAll
  static void loadMappings() throws IOException {
    IndexMappingLoader.init();
  }

  @Test
  void wordDelimiterRunsBeforeLowercaseSoCamelCaseSplits() {
    // word_delimiter's split_on_case_change can only fire while the token still has its case.
    // Lowercasing first turns CustomerAddress into one opaque token that no single-word query
    // reaches on the name fields.
    List<String> offenders = new ArrayList<>();
    forEachEnglishAnalysisBlock(
        (name, analysis) -> {
          for (String analyzer : List.of("om_analyzer", "om_compound_analyzer")) {
            List<String> filters = filtersOf(analysis, analyzer);
            String delimiter = analyzer.equals("om_analyzer") ? WORD_DELIMITER : COMPOUND_DELIMITER;
            if (filters.contains(delimiter)
                && filters.contains(LOWERCASE)
                && filters.indexOf(delimiter) > filters.indexOf(LOWERCASE)) {
              offenders.add(name + ":" + analyzer + " " + filters);
            }
          }
        });
    assertTrue(offenders.isEmpty(), "lowercase must not precede the delimiter: " + offenders);
  }

  @Test
  void nameAnalyzersNormalisePluralsConsistently() {
    // kstem leaves orders, sessions, transactions and regions unstemmed while stemming customers
    // and items, so a singular query silently missed a quarter of the plural names in a catalog.
    // om_plural_stemmer (minimal_english) closes those cases behind kstem. Only the base field is
    // stemmed; the compound sub-field is deliberately left literal, see
    // compoundSubFieldStaysUnstemmed.
    List<String> offenders = new ArrayList<>();
    forEachEnglishAnalysisBlock(
        (name, analysis) -> {
          List<String> filters = filtersOf(analysis, "om_analyzer");
          if (filters.isEmpty()) {
            return;
          }
          if (!filters.contains(STEMMER) || !filters.contains(PLURAL_STEMMER)) {
            offenders.add(name + ":om_analyzer " + filters);
          } else if (filters.indexOf(PLURAL_STEMMER) < filters.indexOf(STEMMER)) {
            offenders.add(name + ":om_analyzer plural stemmer before kstem " + filters);
          }
        });
    assertTrue(offenders.isEmpty(), "stemmer chain incomplete: " + offenders);
  }

  @Test
  void compoundSubFieldStaysUnstemmed() {
    // The compound sub-field is the un-stemmed, delimiter-split view of a name, and the identity
    // stages query it alongside the stemmed base field precisely because the two differ. kstem
    // takes "customer" to "custom", so a typed "custmer" is three edits from the stemmed form and
    // reaches the document only through the compound field's literal "customer". Stemming it once
    // looked like a tidy-up -- the two fields disagreeing was inflating scores -- and silently
    // removed typo tolerance for every word kstem shortens. The inflation is handled by the
    // identity stages' zero tie breaker instead.
    List<String> offenders = new ArrayList<>();
    for (String language : List.of(ENGLISH, "ru", "jp", "zh")) {
      forEachAnalysisBlock(
          language,
          (name, analysis) -> {
            List<String> base = filtersOf(analysis, "om_analyzer");
            List<String> compound = filtersOf(analysis, "om_compound_analyzer");
            if (base.isEmpty() || compound.isEmpty()) {
              return;
            }
            if (compound.contains(STEMMER) || compound.contains(PLURAL_STEMMER)) {
              offenders.add(language + "/" + name + " compound=" + compound);
            }
          });
    }
    assertTrue(offenders.isEmpty(), "compound sub-field must not be stemmed: " + offenders);
  }

  @Test
  void everyAnalyzerFilterIsDefinedOrBuiltIn() {
    // A dangling filter name fails index creation at startup rather than at review time.
    List<String> builtIn =
        List.of(
            LOWERCASE,
            "flatten_graph",
            "asciifolding",
            "uppercase",
            "trim",
            "stop",
            "porter_stem",
            "cjk_width",
            "cjk_bigram",
            "decimal_digit",
            "english_possessive_stemmer",
            "kuromoji_baseform",
            "kuromoji_part_of_speech",
            "kuromoji_number",
            "kuromoji_stemmer",
            "smartcn_stop");
    List<String> offenders = new ArrayList<>();
    for (String language : List.of(ENGLISH, "ru", "jp", "zh")) {
      forEachAnalysisBlock(
          language,
          (name, analysis) -> {
            JsonNode defined = analysis.path("filter");
            analysis
                .path("analyzer")
                .fields()
                .forEachRemaining(
                    analyzer ->
                        analyzer
                            .getValue()
                            .path("filter")
                            .forEach(
                                filter -> {
                                  String value = filter.asText();
                                  if (!builtIn.contains(value) && !defined.has(value)) {
                                    offenders.add(
                                        language
                                            + "/"
                                            + name
                                            + " "
                                            + analyzer.getKey()
                                            + " -> "
                                            + value);
                                  }
                                }));
          });
    }
    assertTrue(offenders.isEmpty(), "undefined analyzer filters: " + offenders);
  }

  @Test
  void englishMappingsAreActuallyCovered() {
    // The assertions above pass vacuously if the loader stops resolving mappings.
    List<String> seen = new ArrayList<>();
    forEachEnglishAnalysisBlock((name, analysis) -> seen.add(name));
    assertFalse(seen.isEmpty(), "no english mappings resolved");
    assertTrue(seen.size() > 40, "expected the full mapping set, resolved only " + seen.size());
    assertEquals(seen.size(), seen.stream().distinct().count(), "duplicate mappings resolved");
  }

  private interface AnalysisVisitor {
    void accept(String mappingName, JsonNode analysis);
  }

  private void forEachEnglishAnalysisBlock(AnalysisVisitor visitor) {
    forEachAnalysisBlock(ENGLISH, visitor);
  }

  private void forEachAnalysisBlock(String language, AnalysisVisitor visitor) {
    for (Map.Entry<String, IndexMapping> entry :
        IndexMappingLoader.getInstance().getIndexMapping().entrySet()) {
      String path = "/" + entry.getValue().getIndexMappingFile(language);
      JsonNode mapping = readMapping(path);
      if (mapping == null) {
        continue;
      }
      JsonNode analysis = mapping.path("settings").path("analysis");
      if (!analysis.isMissingNode()) {
        visitor.accept(entry.getKey(), analysis);
      }
    }
  }

  private JsonNode readMapping(String path) {
    try (InputStream stream = getClass().getResourceAsStream(path)) {
      return stream == null ? null : JsonUtils.readTree(new String(stream.readAllBytes()));
    } catch (IOException e) {
      return null;
    }
  }

  private List<String> filtersOf(JsonNode analysis, String analyzer) {
    List<String> filters = new ArrayList<>();
    analysis.path("analyzer").path(analyzer).path("filter").forEach(f -> filters.add(f.asText()));
    return filters;
  }
}
