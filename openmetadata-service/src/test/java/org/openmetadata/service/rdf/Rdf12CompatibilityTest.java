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

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
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

  @Test
  void validatesAnRdf12GraphWithBundledShaclShapes() {
    final Model model = rdf12Model();

    assertTrue(RdfShaclValidator.validate(model).conforms());
  }

  private static Model rdf12Model() {
    final Model model = ModelFactory.createDefaultModel();
    final Node directionalLiteral = NodeFactory.createLiteralDirLang("قطة", "ar", "rtl");
    final Node tripleTerm =
        NodeFactory.createTripleTerm(
            NodeFactory.createURI("https://example.com/subject"),
            NodeFactory.createURI("https://example.com/predicate"),
            directionalLiteral);
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
