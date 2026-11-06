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
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.io.StringReader;
import java.io.StringWriter;
import java.io.Writer;
import org.apache.jena.graph.Graph;
import org.apache.jena.graph.GraphMemFactory;
import org.apache.jena.graph.Node;
import org.apache.jena.graph.NodeFactory;
import org.apache.jena.graph.Triple;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.rdf.model.RDFErrorHandler;
import org.apache.jena.rdf.model.RDFWriterI;
import org.apache.jena.rdf.model.impl.ModelCom;
import org.apache.jena.riot.Lang;
import org.apache.jena.riot.RDFDataMgr;
import org.apache.jena.riot.RDFFormat;
import org.apache.jena.shared.WrappedIOException;
import org.apache.jena.vocabulary.OWL2;
import org.apache.jena.vocabulary.RDF;
import org.apache.jena.vocabulary.RDFS;
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

  /**
   * RDF/XML cannot name a predicate it cannot split into an XML QName. That is a property of the
   * requested format, not a server fault, so it is refused as a 400 that names the format and the
   * writer's reason instead of surfacing as a 500.
   */
  @Test
  void refusesAPredicateRdfXmlCannotNameAsAClientError() {
    final Graph graph = GraphMemFactory.createDefaultGraph();
    graph.add(
        Triple.create(
            NodeFactory.createURI("urn:table:orders"),
            NodeFactory.createURI("https://example.com/p/"),
            NodeFactory.createLiteralString("plain")));

    final UnsupportedRdfSerializationException failure =
        assertThrows(
            UnsupportedRdfSerializationException.class,
            () ->
                RdfGraphSerializer.asString(
                    ModelFactory.createModelForGraph(graph), RdfSerializationFormat.RDF_XML));

    assertTrue(failure.getMessage().startsWith("'rdfxml' cannot write this graph: "));
  }

  @Test
  void reportsTheRequestedFormatInTheFailureMessage() {
    final UnsupportedRdfSerializationException failure =
        new UnsupportedRdfSerializationException(RdfSerializationFormat.JSON_LD);

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

  @Test
  void writesAnOntologyWhoseIriIsABareUrnInEveryFormatAndReadsItBack() {
    final Model model = ModelFactory.createDefaultModel();
    model
        .createResource("urn:orders")
        .addProperty(RDFS.label, "Orders")
        .addProperty(RDF.type, OWL2.Ontology);

    for (final RdfSerializationFormat format : RdfSerializationFormat.values()) {
      final Model readBack =
          new SafeRdfModelParser().parse(RdfGraphSerializer.asString(model, format), format);

      assertTrue(
          readBack.contains(readBack.createResource("urn:orders"), RDF.type, OWL2.Ontology),
          format.externalName() + " keeps the ontology IRI");
      assertTrue(
          readBack.contains(readBack.createResource("urn:orders"), RDFS.label, "Orders"),
          format.externalName() + " keeps the label");
    }
  }

  @Test
  void writesANamespacedUrnAsRdfXml() {
    final Model model = ModelFactory.createDefaultModel();
    model.createResource("urn:example:orders").addProperty(RDF.type, OWL2.Ontology);

    assertTrue(
        RdfGraphSerializer.asString(model, RdfSerializationFormat.RDF_XML)
            .contains("rdf:about=\"urn:example:orders\""));
  }

  @Test
  void writesAnHttpsOntologyAsTheSameGraphThePrettyWriterDid() {
    final Model model = ModelFactory.createDefaultModel();
    model.setNsPrefix("ex", "https://example.com/onto#");
    final org.apache.jena.rdf.model.Resource ontology =
        model.createResource("https://example.com/onto").addProperty(RDF.type, OWL2.Ontology);
    model
        .createResource("https://example.com/onto#Order")
        .addProperty(RDF.type, OWL2.Class)
        .addProperty(RDFS.label, "Order", "en")
        .addProperty(RDFS.isDefinedBy, ontology);

    final StringWriter legacy = new StringWriter();
    RDFDataMgr.write(legacy, model, RDFFormat.RDFXML_PRETTY);
    final Model before = ModelFactory.createDefaultModel();
    before.read(new StringReader(legacy.toString()), null, Lang.RDFXML.getName());
    final Model after =
        new SafeRdfModelParser()
            .parse(
                RdfGraphSerializer.asString(model, RdfSerializationFormat.RDF_XML),
                RdfSerializationFormat.RDF_XML);

    assertTrue(before.isIsomorphicWith(after));
    assertEquals(4, after.size());
  }

  @Test
  void aWrappedIoFailureFromTheWriterIsNotRelabelledAsAnUnsupportedFormat() {
    final WrappedIOException disconnect =
        new WrappedIOException(new IOException("client disconnected"));
    final Model model =
        new ModelCom(GraphMemFactory.createDefaultGraph()) {
          @Override
          public RDFWriterI getWriter(final String lang) {
            return new RDFWriterI() {
              @Override
              public void write(final Model m, final Writer out, final String base) {
                throw disconnect;
              }

              @Override
              public void write(final Model m, final OutputStream out, final String base) {
                throw disconnect;
              }

              @Override
              public Object setProperty(final String propName, final Object propValue) {
                return null;
              }

              @Override
              public RDFErrorHandler setErrorHandler(final RDFErrorHandler errHandler) {
                return null;
              }
            };
          }
        };

    final WrappedIOException thrown =
        assertThrows(
            WrappedIOException.class,
            () ->
                RdfGraphSerializer.write(
                    new ByteArrayOutputStream(), model, RdfSerializationFormat.RDF_XML));

    assertSame(disconnect, thrown);
  }
}
