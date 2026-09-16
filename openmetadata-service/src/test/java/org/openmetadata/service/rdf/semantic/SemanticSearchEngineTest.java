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
package org.openmetadata.service.rdf.semantic;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.HashMap;
import java.util.Map;
import org.apache.jena.query.QueryExecution;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.rdf.model.Resource;
import org.apache.jena.vocabulary.RDF;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

class SemanticSearchEngineTest {
  private static final String OM_NS = "https://open-metadata.org/ontology/";
  private static final String PROV_NS = "http://www.w3.org/ns/prov#";
  private static final String SOURCE_URI = "https://open-metadata.org/entity/table/source";
  private static final String RELATED_URI = "https://open-metadata.org/entity/table/related";
  private static final String ANCESTOR_URI = "https://open-metadata.org/entity/table/ancestor";
  private Model model;

  @BeforeEach
  void setUp() {
    model = ModelFactory.createDefaultModel();
    model.setNsPrefix("om", OM_NS);
    model.setNsPrefix("prov", PROV_NS);
    entity(SOURCE_URI);
    entity(RELATED_URI);
  }

  @AfterEach
  void tearDown() {
    model.close();
  }

  @ParameterizedTest
  @CsvSource({
    "om:upstream, false, upstream",
    "om:downstream, true, upstream",
    "prov:wasDerivedFrom, false, upstream",
    "om:UPSTREAM, true, upstream",
    "om:downstream, false, downstream",
    "om:upstream, true, downstream",
    "prov:wasDerivedFrom, true, downstream",
    "om:UPSTREAM, false, downstream",
    "om:relatedTo, false, relatedTo",
    "om:similarTo, false, similarTo",
    "om:owns, true, relatedTo",
    "prov:used, true, relatedTo"
  })
  void returnsCanonicalRelationship(
      final String predicate, final boolean reversed, final String expectedRelationship) {
    final Resource source = model.getResource(reversed ? RELATED_URI : SOURCE_URI);
    final Resource target = model.getResource(reversed ? SOURCE_URI : RELATED_URI);
    source.addProperty(model.createProperty(model.expandPrefix(predicate)), target);

    assertEquals(Map.of(RELATED_URI, OM_NS + expectedRelationship), inferredRelationships());
  }

  @Test
  void returnsOneUpstreamResultForMirroredLineage() {
    final Resource source = model.getResource(SOURCE_URI);
    final Resource related = model.getResource(RELATED_URI);
    source.addProperty(model.createProperty(OM_NS + "upstream"), related);
    source.addProperty(model.createProperty(PROV_NS + "wasDerivedFrom"), related);
    related.addProperty(model.createProperty(OM_NS + "downstream"), source);
    related.addProperty(model.createProperty(OM_NS + "UPSTREAM"), source);

    assertEquals(Map.of(RELATED_URI, OM_NS + "upstream"), inferredRelationships());
  }

  @Test
  void labelsMixedPredicateAncestorsAsUpstream() {
    final Resource ancestor = entity(ANCESTOR_URI);
    final Resource related = model.getResource(RELATED_URI);
    model
        .getResource(SOURCE_URI)
        .addProperty(model.createProperty(PROV_NS + "wasDerivedFrom"), related);
    ancestor.addProperty(model.createProperty(OM_NS + "downstream"), related);

    assertEquals(
        Map.of(RELATED_URI, OM_NS + "upstream", ANCESTOR_URI, OM_NS + "upstream"),
        inferredRelationships());
  }

  private Resource entity(final String uri) {
    return model.createResource(uri).addProperty(RDF.type, model.createResource(OM_NS + "Table"));
  }

  private Map<String, String> inferredRelationships() {
    final Map<String, String> relationships = new HashMap<>();
    try (final var execution =
        QueryExecution.create(SemanticSearchEngine.buildInferenceQuery(SOURCE_URI), model)) {
      final var results = execution.execSelect();
      while (results.hasNext()) {
        final var row = results.next();
        assertNull(
            relationships.put(
                row.getResource("related").getURI(), row.getResource("relationship").getURI()),
            "Mirrored lineage must not duplicate inferred results");
      }
    }
    return relationships;
  }
}
