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

package org.openmetadata.service.rdf;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.apache.jena.graph.Graph;
import org.apache.jena.graph.GraphMemFactory;
import org.apache.jena.graph.Node;
import org.apache.jena.graph.NodeFactory;
import org.apache.jena.graph.Triple;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

class RdfGraphSerializerTest {
  private static final String REIFIES = "http://www.w3.org/1999/02/22-rdf-syntax-ns#reifies";
  private static final String LABEL = "http://www.w3.org/2000/01/rdf-schema#label";

  @ParameterizedTest
  @EnumSource(
      value = RdfSerializationFormat.class,
      names = {"TURTLE", "RDF_XML", "N_TRIPLES"})
  void writesTripleTermsInEveryFormatThatCanCarryThem(final RdfSerializationFormat format) {
    assertTrue(RdfGraphSerializer.canRepresent(tripleTermModel(), format));

    assertTrue(RdfGraphSerializer.asString(tripleTermModel(), format).length() > 0);
  }

  @Test
  void rejectsTripleTermsAsJsonLdWithAnActionableMessage() {
    final Model model = tripleTermModel();

    final UnsupportedRdfSerializationException failure =
        assertThrows(
            UnsupportedRdfSerializationException.class,
            () -> RdfGraphSerializer.asString(model, RdfSerializationFormat.JSON_LD));

    assertTrue(failure.getMessage().contains("jsonld"));
    assertTrue(failure.getMessage().contains("turtle"));
  }

  @Test
  void rejectsATripleTermInSubjectPosition() {
    final Graph graph = GraphMemFactory.createDefaultGraph();
    graph.add(
        Triple.create(
            tripleTerm(),
            NodeFactory.createURI(LABEL),
            NodeFactory.createLiteralString("annotated")));

    assertThrows(
        UnsupportedRdfSerializationException.class,
        () ->
            RdfGraphSerializer.asString(
                ModelFactory.createModelForGraph(graph), RdfSerializationFormat.JSON_LD));
  }

  @Test
  void stillWritesJsonLdForGraphsWithoutTripleTerms() {
    final Graph graph = GraphMemFactory.createDefaultGraph();
    graph.add(
        Triple.create(
            NodeFactory.createURI("https://example.com/term"),
            NodeFactory.createURI(LABEL),
            NodeFactory.createLiteralDirLang("قطة", "ar", "rtl")));

    final String jsonLd =
        RdfGraphSerializer.asString(
            ModelFactory.createModelForGraph(graph), RdfSerializationFormat.JSON_LD);

    assertTrue(jsonLd.contains("قطة"));
  }

  @Test
  void reportsTheRequestedFormatInTheFailureMessage() {
    final UnsupportedRdfSerializationException failure =
        new UnsupportedRdfSerializationException(RdfSerializationFormat.JSON_LD, null);

    assertEquals(
        "Result contains RDF 1.2 triple terms, which 'jsonld' cannot represent. Request 'turtle' or 'ntriples' instead.",
        failure.getMessage());
  }

  private static Model tripleTermModel() {
    final Graph graph = GraphMemFactory.createDefaultGraph();
    graph.add(
        Triple.create(
            NodeFactory.createURI("https://example.com/reifier"),
            NodeFactory.createURI(REIFIES),
            tripleTerm()));
    return ModelFactory.createModelForGraph(graph);
  }

  private static Node tripleTerm() {
    return NodeFactory.createTripleTerm(
        NodeFactory.createURI("https://example.com/subject"),
        NodeFactory.createURI("https://example.com/predicate"),
        NodeFactory.createLiteralDirLang("قطة", "ar", "rtl"));
  }
}
