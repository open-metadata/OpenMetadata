/*
 *  Copyright 2025 Collate.
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
package org.openmetadata.codegen;

import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;
import org.junit.jupiter.api.DynamicTest;
import org.junit.jupiter.api.TestFactory;

/**
 * Validates that every generated Elasticsearch index mapping is byte-for-byte (semantically)
 * identical to the committed file in {@code openmetadata-spec/.../elasticsearch/<lang>/}. One
 * dynamic test per (entity, language) — 220 in total — so a mismatch points at the exact file.
 *
 * <p>This is the test counterpart of the build-time parity guard in {@link IndexCodegen}: it lets
 * CI prove that the codegen still reproduces the committed mappings before anything ships.
 */
class IndexMappingParityTest {
  private static final List<String> LANGUAGES = List.of("en", "jp", "ru", "zh");
  private static final String MAPPING_SUFFIX = "_index_mapping.json";
  private static final Path ELASTICSEARCH =
      Path.of("..", "openmetadata-spec", "src", "main", "resources", "elasticsearch");
  private static final Path SPEC_DIR = ELASTICSEARCH.resolve("spec");

  @TestFactory
  Stream<DynamicTest> generatedMappingsMatchCommitted() {
    Spec spec = new Spec(SPEC_DIR);
    MappingGenerator generator = new MappingGenerator(spec);
    EngineProfile elasticsearch = new EngineProfile(spec.engine("elasticsearch"));
    List<DynamicTest> tests = new ArrayList<>();
    for (String entity : spec.entityNames()) {
      for (String language : LANGUAGES) {
        tests.add(parityTest(generator, elasticsearch, language, entity));
      }
    }
    return tests.stream();
  }

  private DynamicTest parityTest(
      MappingGenerator generator, EngineProfile elasticsearch, String language, String entity) {
    return DynamicTest.dynamicTest(
        language + "/" + entity,
        () -> {
          Path committed = ELASTICSEARCH.resolve(language).resolve(entity + MAPPING_SUFFIX);
          ObjectNode generated = elasticsearch.apply(generator.generate(language, entity));
          List<String> drift = Json.diff(Json.loadFile(committed), generated);
          assertTrue(
              drift.isEmpty(),
              () -> "Generated mapping for " + language + "/" + entity + " drifted: " + drift);
        });
  }

  /**
   * Validates the generated OpenSearch mappings: each must equal the committed Elasticsearch
   * mapping put through the same transform OM applies at runtime today —
   * {@code OsUtils.transformFieldTypesForOpenSearch} ({@code flattened -> flat_object}) and
   * {@code transformStemmerForOpenSearch} (the stemmer {@code name -> language} rename). The
   * runtime knn_vector enrichment is out of scope (it depends on live embedding config).
   */
  @TestFactory
  Stream<DynamicTest> generatedOpenSearchMappingsMatchRuntimeTransform() {
    Spec spec = new Spec(SPEC_DIR);
    MappingGenerator generator = new MappingGenerator(spec);
    EngineProfile opensearch = new EngineProfile(spec.engine("opensearch"));
    List<DynamicTest> tests = new ArrayList<>();
    for (String entity : spec.entityNames()) {
      for (String language : LANGUAGES) {
        tests.add(openSearchTest(generator, opensearch, language, entity));
      }
    }
    return tests.stream();
  }

  private DynamicTest openSearchTest(
      MappingGenerator generator, EngineProfile opensearch, String language, String entity) {
    return DynamicTest.dynamicTest(
        language + "/" + entity,
        () -> {
          Path committed = ELASTICSEARCH.resolve(language).resolve(entity + MAPPING_SUFFIX);
          ObjectNode generated = opensearch.apply(generator.generate(language, entity));
          ObjectNode expected = runtimeOpenSearchTransform((ObjectNode) Json.loadFile(committed));
          List<String> drift = Json.diff(expected, generated);
          assertTrue(
              drift.isEmpty(),
              () ->
                  "Generated OpenSearch mapping for "
                      + language
                      + "/"
                      + entity
                      + " differs from the runtime transform: "
                      + drift);
        });
  }

  /** Mirrors {@code OsUtils.enrichIndexMappingForOpenSearch} (minus knn_vector enrichment). */
  private ObjectNode runtimeOpenSearchTransform(ObjectNode esMapping) {
    ObjectNode result = esMapping.deepCopy();
    JsonNode properties = result.path("mappings").path("properties");
    if (properties.isObject()) {
      flattenedToFlatObject((ObjectNode) properties);
    }
    JsonNode filter = result.path("settings").path("analysis").path("filter");
    JsonNode stemmer = filter.path("om_stemmer");
    if (stemmer.isObject()
        && "stemmer".equals(stemmer.path("type").asText())
        && stemmer.has("name")) {
      ObjectNode renamed = Json.MAPPER.createObjectNode();
      renamed.put("type", "stemmer");
      renamed.put("language", stemmer.get("name").asText());
      ((ObjectNode) filter).set("om_stemmer", renamed);
    }
    return result;
  }

  private void flattenedToFlatObject(ObjectNode properties) {
    properties.forEach(
        field -> {
          if (!field.isObject()) {
            return;
          }
          ObjectNode obj = (ObjectNode) field;
          if ("flattened".equals(obj.path("type").asText())) {
            obj.put("type", "flat_object");
          }
          JsonNode nested = obj.get("properties");
          if (nested != null && nested.isObject()) {
            flattenedToFlatObject((ObjectNode) nested);
          }
        });
  }
}
