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

import java.net.URI;
import java.util.List;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.vocabulary.OWL2;
import org.apache.jena.vocabulary.RDFS;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.type.OntologyAxiomType;
import org.openmetadata.schema.type.OntologyExpression;
import org.openmetadata.schema.type.OntologyExpressionKind;
import org.openmetadata.schema.type.OntologyRestrictionKind;

class OntologyExpressionRdfWriterTest {
  private static final URI CUSTOMER = URI.create("https://example.org/Customer");
  private static final URI HAS_ORDER = URI.create("https://example.org/hasOrder");
  private static final URI ORDER = URI.create("https://example.org/Order");
  private final OntologyExpressionRdfWriter writer = new OntologyExpressionRdfWriter();

  @Test
  void writesQualifiedCardinalityRestriction() {
    final OntologyExpression restriction =
        new OntologyExpression()
            .withKind(OntologyExpressionKind.RESTRICTION)
            .withPropertyIri(HAS_ORDER)
            .withRestrictionKind(OntologyRestrictionKind.MIN)
            .withCardinality(1)
            .withFiller(namedClass(ORDER));
    final OntologyAxiom axiom =
        new OntologyAxiom()
            .withAxiomType(OntologyAxiomType.SUBCLASS_OF)
            .withSubjectIri(CUSTOMER)
            .withExpressions(List.of(restriction));

    final Model model = ModelFactory.createDefaultModel();
    try {
      writer.write(model, axiom);

      assertTrue(model.contains(model.getResource(CUSTOMER.toString()), RDFS.subClassOf));
      assertTrue(model.contains(null, OWL2.onProperty, model.getResource(HAS_ORDER.toString())));
      assertTrue(model.contains(null, OWL2.minQualifiedCardinality));
      assertTrue(model.contains(null, OWL2.onClass, model.getResource(ORDER.toString())));
    } finally {
      model.close();
    }
  }

  @Test
  void writesUnionAsRdfCollection() {
    final OntologyExpression union =
        new OntologyExpression()
            .withKind(OntologyExpressionKind.UNION)
            .withOperands(
                List.of(
                    namedClass(URI.create("https://example.org/Person")),
                    namedClass(URI.create("https://example.org/Organization"))));
    final OntologyAxiom axiom =
        new OntologyAxiom()
            .withAxiomType(OntologyAxiomType.EQUIVALENT_CLASS)
            .withSubjectIri(CUSTOMER)
            .withExpressions(List.of(union));

    final Model model = ModelFactory.createDefaultModel();
    try {
      writer.write(model, axiom);

      assertTrue(model.contains(null, OWL2.unionOf));
      assertTrue(model.contains(model.getResource(CUSTOMER.toString()), OWL2.equivalentClass));
    } finally {
      model.close();
    }
  }

  private static OntologyExpression namedClass(final URI iri) {
    return new OntologyExpression().withKind(OntologyExpressionKind.NAMED_CLASS).withClassIri(iri);
  }
}
