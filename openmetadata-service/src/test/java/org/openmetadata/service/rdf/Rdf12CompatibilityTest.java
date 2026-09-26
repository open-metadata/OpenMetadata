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

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import org.apache.jena.datatypes.xsd.XSDDatatype;
import org.apache.jena.graph.Graph;
import org.apache.jena.graph.GraphMemFactory;
import org.apache.jena.graph.Node;
import org.apache.jena.graph.NodeFactory;
import org.apache.jena.graph.Triple;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.riot.RDFDataMgr;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;

class Rdf12CompatibilityTest {
  private static final String RDF_REIFIES = "http://www.w3.org/1999/02/22-rdf-syntax-ns#reifies";
  private static final String RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
  private static final String OM = "https://open-metadata.org/ontology/";
  private static final String ENTITY_URI = "https://open-metadata.org/entity/table/orders";

  @ParameterizedTest
  @EnumSource(
      value = RdfSerializationFormat.class,
      names = {"TURTLE", "RDF_XML", "N_TRIPLES"})
  void roundTripsTripleTermsAndDirectionalLanguageLiterals(final RdfSerializationFormat format) {
    final Model source = rdf12Model();
    final ByteArrayOutputStream serialized = new ByteArrayOutputStream();
    RDFDataMgr.write(serialized, source, format.rdfFormat());

    final Model roundTripped = ModelFactory.createDefaultModel();
    RDFDataMgr.read(
        roundTripped,
        new ByteArrayInputStream(serialized.toByteArray()),
        format.rdfFormat().getLang());

    assertTrue(source.isIsomorphicWith(roundTripped));
  }

  /**
   * The bundled shapes only target {@code om:} classes, so a graph of bare triple terms conforms for
   * the uninteresting reason that no shape has a target - an empty graph passes that assertion just
   * as well. The entity missing its identifier is the control that proves {@code om:EntityShape} is
   * engaging on this data before the RDF 1.2 terms are judged.
   */
  @Test
  void bundledShaclShapesAcceptAnEntityCarryingRdf12Terms() {
    assertFalse(RdfShaclValidator.validate(entity(directionalLiteral(), false)).conforms());

    assertTrue(RdfShaclValidator.validate(entity(directionalLiteral(), true)).conforms());
  }

  @Test
  void bundledShaclShapesStillRejectANonStringDescription() {
    final Node number = NodeFactory.createLiteralDT("7", XSDDatatype.XSDinteger);

    assertFalse(RdfShaclValidator.validate(entity(number, true)).conforms());
  }

  /** An {@code om:Entity} described with the given literal and annotated with a triple term. */
  private static Model entity(final Node description, final boolean complete) {
    final Graph graph = GraphMemFactory.createDefaultGraph();
    final Node entity = NodeFactory.createURI(ENTITY_URI);
    add(graph, entity, RDF_TYPE, NodeFactory.createURI(OM + "Entity"));
    add(graph, entity, OM + "name", NodeFactory.createLiteralString("orders"));
    add(graph, entity, OM + "fullyQualifiedName", NodeFactory.createLiteralString("shop.orders"));
    add(graph, entity, OM + "description", description);
    add(
        graph,
        NodeFactory.createURI(ENTITY_URI + "#annotation"),
        RDF_REIFIES,
        NodeFactory.createTripleTerm(
            entity, NodeFactory.createURI(OM + "description"), description));
    if (complete) {
      add(graph, entity, OM + "id", NodeFactory.createLiteralString("1"));
    }
    return ModelFactory.createModelForGraph(graph);
  }

  private static void add(
      final Graph graph, final Node subject, final String predicate, final Node object) {
    graph.add(Triple.create(subject, NodeFactory.createURI(predicate), object));
  }

  private static Node directionalLiteral() {
    return NodeFactory.createLiteralDirLang("قطة", "ar", "rtl");
  }

  private static Model rdf12Model() {
    final Model model = ModelFactory.createDefaultModel();
    final Node tripleTerm =
        NodeFactory.createTripleTerm(
            NodeFactory.createURI("https://example.com/subject"),
            NodeFactory.createURI("https://example.com/predicate"),
            directionalLiteral());
    model
        .getGraph()
        .add(
            Triple.create(
                NodeFactory.createURI("https://example.com/reifier"),
                NodeFactory.createURI(RDF_REIFIES),
                tripleTerm));
    return model;
  }
}
