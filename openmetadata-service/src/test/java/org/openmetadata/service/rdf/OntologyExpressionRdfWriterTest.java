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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.apache.jena.datatypes.xsd.XSDDatatype;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.rdf.model.RDFNode;
import org.apache.jena.rdf.model.Resource;
import org.apache.jena.vocabulary.OWL2;
import org.apache.jena.vocabulary.RDF;
import org.apache.jena.vocabulary.RDFS;
import org.apache.jena.vocabulary.XSD;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.type.OntologyAxiomType;
import org.openmetadata.schema.type.OntologyExpression;
import org.openmetadata.schema.type.OntologyExpressionKind;
import org.openmetadata.schema.type.OntologyLiteral;
import org.openmetadata.schema.type.OntologyRestrictionKind;
import org.semanticweb.owlapi.apibinding.OWLManager;
import org.semanticweb.owlapi.model.IRI;
import org.semanticweb.owlapi.model.OWLAxiom;
import org.semanticweb.owlapi.model.OWLClass;
import org.semanticweb.owlapi.model.OWLClassExpression;
import org.semanticweb.owlapi.model.OWLDataFactory;
import org.semanticweb.owlapi.model.OWLDataProperty;
import org.semanticweb.owlapi.model.OWLDatatype;
import org.semanticweb.owlapi.model.OWLEntity;
import org.semanticweb.owlapi.model.OWLNamedIndividual;
import org.semanticweb.owlapi.model.OWLObjectProperty;
import org.semanticweb.owlapi.model.OWLOntology;
import org.semanticweb.owlapi.model.OWLProperty;
import org.semanticweb.owlapi.vocab.OWL2Datatype;

/**
 * Every authorable expression and axiom construct is written through the writer, parsed by OWL API
 * as the reasoner worker parses it, and compared axiom for axiom with the intended OWL; each output
 * must also pass the OWL 2 DL profile check.
 */
class OntologyExpressionRdfWriterTest {
  private static final String EX = "https://example.org/";
  private static final OWLDataFactory OWL = OWLManager.getOWLDataFactory();
  private static final OWLClass CUSTOMER = owlClass("Customer");
  private static final OWLClass PARTY = owlClass("Party");
  private static final OWLClass PERSON = owlClass("Person");
  private static final OWLClass ORGANIZATION = owlClass("Organization");
  private static final OWLClass ORDER = owlClass("Order");
  private static final OWLClass EMAIL = owlClass("EmailAddress");
  private static final OWLClass STATUS = owlClass("Status");
  private static final OWLObjectProperty HAS_ORDER = objectProperty("hasOrder");
  private static final OWLObjectProperty HAS_CONTACT = objectProperty("hasContact");
  private static final OWLObjectProperty HAS_STATUS = objectProperty("hasStatus");
  private static final OWLDataProperty CUSTOMER_CODE = dataProperty("customerCode");
  private static final OWLDataProperty AGE = dataProperty("age");
  private static final OWLNamedIndividual ACTIVE = individual("active");
  private static final OWLNamedIndividual INACTIVE = individual("inactive");
  private static final OWLNamedIndividual ALICE = individual("alice");
  private static final OWLNamedIndividual ORDER_1 = individual("order1");
  private static final OWLDatatype XSD_STRING = OWL2Datatype.XSD_STRING.getDatatype(OWL);
  private static final OWLDatatype XSD_INTEGER = OWL2Datatype.XSD_INTEGER.getDatatype(OWL);

  private final OntologyExpressionRdfWriter writer =
      new OntologyExpressionRdfWriter(iri -> iri.equals(CUSTOMER_CODE.getIRI().toString()));

  @ParameterizedTest(name = "{0}")
  @MethodSource("constructs")
  void roundTripsThroughOwlApiAsDlValidOwl(
      final String construct, final OntologyAxiom axiom, final Set<OWLAxiom> expected) {
    final Model model = ModelFactory.createDefaultModel();
    try {
      writer.write(model, axiom);
      final OWLOntology ontology = OwlApiProjection.parse(model);

      assertEquals(expected, ontology.logicalAxioms().collect(Collectors.toSet()), construct);
      assertEquals(List.of(), OwlApiProjection.dlViolations(ontology), construct);
    } finally {
      model.close();
    }
  }

  static Stream<Arguments> constructs() {
    return Stream.of(classAxioms(), booleanExpressions(), objectRestrictions(), dataRestrictions())
        .flatMap(stream -> stream);
  }

  private static Stream<Arguments> classAxioms() {
    return Stream.of(
        construct(
            "subclass of a named class",
            classAxiom(OntologyAxiomType.SUBCLASS_OF, named(PARTY)),
            OWL.getOWLSubClassOfAxiom(CUSTOMER, PARTY)),
        construct(
            "equivalent named class",
            classAxiom(OntologyAxiomType.EQUIVALENT_CLASS, named(PARTY)),
            OWL.getOWLEquivalentClassesAxiom(CUSTOMER, PARTY)),
        construct(
            "pairwise disjointness",
            classAxiom(OntologyAxiomType.DISJOINT_WITH, named(ORDER), named(STATUS)),
            OWL.getOWLDisjointClassesAxiom(CUSTOMER, ORDER),
            OWL.getOWLDisjointClassesAxiom(CUSTOMER, STATUS)));
  }

  private static Stream<Arguments> booleanExpressions() {
    final OntologyExpression nested =
        union(named(PERSON), intersection(named(ORGANIZATION), some(HAS_CONTACT, named(EMAIL))));
    return Stream.of(
        construct(
            "intersection with an existential",
            classAxiom(
                OntologyAxiomType.EQUIVALENT_CLASS,
                intersection(named(PERSON), some(HAS_CONTACT, named(EMAIL)))),
            OWL.getOWLEquivalentClassesAxiom(
                CUSTOMER,
                OWL.getOWLObjectIntersectionOf(
                    PERSON, OWL.getOWLObjectSomeValuesFrom(HAS_CONTACT, EMAIL)))),
        construct(
            "union",
            classAxiom(OntologyAxiomType.SUBCLASS_OF, union(named(PERSON), named(ORGANIZATION))),
            OWL.getOWLSubClassOfAxiom(CUSTOMER, OWL.getOWLObjectUnionOf(PERSON, ORGANIZATION))),
        construct(
            "enumeration of named individuals",
            classAxiom(
                OntologyAxiomType.EQUIVALENT_CLASS,
                new OntologyExpression()
                    .withKind(OntologyExpressionKind.ONE_OF)
                    .withIndividualIris(Set.of(iri(ACTIVE), iri(INACTIVE)))),
            OWL.getOWLEquivalentClassesAxiom(CUSTOMER, OWL.getOWLObjectOneOf(ACTIVE, INACTIVE))),
        construct(
            "nested expression inside a restriction filler",
            classAxiom(OntologyAxiomType.SUBCLASS_OF, only(HAS_ORDER, nested)),
            OWL.getOWLSubClassOfAxiom(
                CUSTOMER, OWL.getOWLObjectAllValuesFrom(HAS_ORDER, nestedExpression()))));
  }

  private static Stream<Arguments> objectRestrictions() {
    return Stream.of(
        construct(
            "existential",
            classAxiom(OntologyAxiomType.SUBCLASS_OF, some(HAS_ORDER, named(ORDER))),
            OWL.getOWLSubClassOfAxiom(CUSTOMER, OWL.getOWLObjectSomeValuesFrom(HAS_ORDER, ORDER))),
        construct(
            "universal",
            classAxiom(OntologyAxiomType.SUBCLASS_OF, only(HAS_ORDER, named(ORDER))),
            OWL.getOWLSubClassOfAxiom(CUSTOMER, OWL.getOWLObjectAllValuesFrom(HAS_ORDER, ORDER))),
        construct(
            "has-value individual",
            classAxiom(
                OntologyAxiomType.SUBCLASS_OF,
                restriction(HAS_STATUS.getIRI(), OntologyRestrictionKind.VALUE)
                    .withIndividualIri(iri(ACTIVE))),
            OWL.getOWLSubClassOfAxiom(CUSTOMER, OWL.getOWLObjectHasValue(HAS_STATUS, ACTIVE))),
        construct(
            "qualified minimum",
            classAxiom(
                OntologyAxiomType.SUBCLASS_OF,
                cardinality(HAS_ORDER.getIRI(), OntologyRestrictionKind.MIN, 1, named(ORDER))),
            OWL.getOWLSubClassOfAxiom(
                CUSTOMER, OWL.getOWLObjectMinCardinality(1, HAS_ORDER, ORDER))),
        construct(
            "unqualified maximum",
            classAxiom(
                OntologyAxiomType.SUBCLASS_OF,
                cardinality(HAS_ORDER.getIRI(), OntologyRestrictionKind.MAX, 5, null)),
            OWL.getOWLSubClassOfAxiom(CUSTOMER, OWL.getOWLObjectMaxCardinality(5, HAS_ORDER))),
        construct(
            "qualified exact",
            classAxiom(
                OntologyAxiomType.SUBCLASS_OF,
                cardinality(HAS_STATUS.getIRI(), OntologyRestrictionKind.EXACT, 1, named(STATUS))),
            OWL.getOWLSubClassOfAxiom(
                CUSTOMER, OWL.getOWLObjectExactCardinality(1, HAS_STATUS, STATUS))));
  }

  private static Stream<Arguments> dataRestrictions() {
    return Stream.of(
        construct(
            "data has-value literal",
            classAxiom(
                OntologyAxiomType.SUBCLASS_OF,
                restriction(CUSTOMER_CODE.getIRI(), OntologyRestrictionKind.VALUE)
                    .withLiteral(new OntologyLiteral().withValue("C-1"))),
            OWL.getOWLSubClassOfAxiom(
                CUSTOMER, OWL.getOWLDataHasValue(CUSTOMER_CODE, OWL.getOWLLiteral("C-1")))),
        construct(
            "data existential over a datatype",
            classAxiom(OntologyAxiomType.SUBCLASS_OF, some(AGE, datatype(XSD_INTEGER))),
            OWL.getOWLSubClassOfAxiom(CUSTOMER, OWL.getOWLDataSomeValuesFrom(AGE, XSD_INTEGER))),
        construct(
            "data universal over a datatype",
            classAxiom(OntologyAxiomType.SUBCLASS_OF, only(AGE, datatype(XSD_INTEGER))),
            OWL.getOWLSubClassOfAxiom(CUSTOMER, OWL.getOWLDataAllValuesFrom(AGE, XSD_INTEGER))),
        construct(
            "qualified data minimum on a datatype",
            classAxiom(
                OntologyAxiomType.SUBCLASS_OF,
                cardinality(
                    CUSTOMER_CODE.getIRI(), OntologyRestrictionKind.MIN, 1, datatype(XSD_STRING))),
            OWL.getOWLSubClassOfAxiom(
                CUSTOMER, OWL.getOWLDataMinCardinality(1, CUSTOMER_CODE, XSD_STRING))),
        construct(
            "unqualified data exact on a known data property",
            classAxiom(
                OntologyAxiomType.SUBCLASS_OF,
                cardinality(CUSTOMER_CODE.getIRI(), OntologyRestrictionKind.EXACT, 1, null)),
            OWL.getOWLSubClassOfAxiom(CUSTOMER, OWL.getOWLDataExactCardinality(1, CUSTOMER_CODE))));
  }

  @ParameterizedTest(name = "{0}")
  @MethodSource("assertions")
  void roundTripsExplicitAssertions(
      final String construct, final OntologyAxiom axiom, final Set<OWLAxiom> expected) {
    roundTripsThroughOwlApiAsDlValidOwl(construct, axiom, expected);
  }

  static Stream<Arguments> assertions() {
    return Stream.of(
        construct(
            "class assertion of a complex expression",
            new OntologyAxiom()
                .withAxiomType(OntologyAxiomType.CLASS_ASSERTION)
                .withSubjectIri(iri(ALICE))
                .withExpressions(List.of(intersection(named(PERSON), named(CUSTOMER)))),
            OWL.getOWLClassAssertionAxiom(OWL.getOWLObjectIntersectionOf(PERSON, CUSTOMER), ALICE)),
        construct(
            "object property assertion",
            new OntologyAxiom()
                .withAxiomType(OntologyAxiomType.OBJECT_PROPERTY_ASSERTION)
                .withSubjectIri(iri(ALICE))
                .withPropertyIri(URI.create(HAS_ORDER.getIRI().toString()))
                .withTargetIri(iri(ORDER_1)),
            OWL.getOWLObjectPropertyAssertionAxiom(HAS_ORDER, ALICE, ORDER_1)),
        construct(
            "typed data property assertion",
            new OntologyAxiom()
                .withAxiomType(OntologyAxiomType.DATA_PROPERTY_ASSERTION)
                .withSubjectIri(iri(ALICE))
                .withPropertyIri(URI.create(AGE.getIRI().toString()))
                .withLiteral(
                    new OntologyLiteral()
                        .withValue("42")
                        .withDatatypeIri(URI.create(XSD.integer.getURI()))),
            OWL.getOWLDataPropertyAssertionAxiom(
                AGE, ALICE, OWL.getOWLLiteral("42", XSD_INTEGER))));
  }

  @Test
  void typesCardinalitiesAsNonNegativeIntegers() {
    final Model model = ModelFactory.createDefaultModel();
    try {
      writer.write(
          model,
          classAxiom(
              OntologyAxiomType.SUBCLASS_OF,
              cardinality(HAS_ORDER.getIRI(), OntologyRestrictionKind.MIN, 2, named(ORDER))));
      final RDFNode cardinality = model.listObjectsOfProperty(OWL2.minQualifiedCardinality).next();

      assertEquals(
          XSDDatatype.XSDnonNegativeInteger.getURI(), cardinality.asLiteral().getDatatypeURI());
      assertEquals(2, cardinality.asLiteral().getInt());
    } finally {
      model.close();
    }
  }

  @Test
  void qualifiesDataCardinalityWithOnDataRangeAndObjectCardinalityWithOnClass() {
    final Model model = ModelFactory.createDefaultModel();
    try {
      writer.write(
          model,
          classAxiom(
              OntologyAxiomType.SUBCLASS_OF,
              cardinality(
                  CUSTOMER_CODE.getIRI(), OntologyRestrictionKind.MAX, 1, datatype(XSD_STRING)),
              cardinality(HAS_ORDER.getIRI(), OntologyRestrictionKind.MAX, 1, named(ORDER))));

      assertTrue(model.contains(null, OWL2.onDataRange, model.getResource(XSD.xstring.getURI())));
      assertTrue(model.contains(null, OWL2.onClass, model.getResource(ORDER.getIRI().toString())));
      assertFalse(model.contains(model.getResource(XSD.xstring.getURI()), null, (RDFNode) null));
    } finally {
      model.close();
    }
  }

  @Test
  void owlApiGateRejectsTheFormerUndeclaredIntCardinalityEncoding() {
    final Model model = ModelFactory.createDefaultModel();
    try {
      final Resource restriction =
          model
              .createResource()
              .addProperty(RDF.type, OWL2.Restriction)
              .addProperty(OWL2.onProperty, model.createResource(HAS_ORDER.getIRI().toString()))
              .addLiteral(OWL2.minQualifiedCardinality, model.createTypedLiteral(1))
              .addProperty(OWL2.onClass, model.createResource(ORDER.getIRI().toString()));
      model.createResource(CUSTOMER.getIRI().toString()).addProperty(RDFS.subClassOf, restriction);

      final AssertionError rejection =
          assertThrows(AssertionError.class, () -> OwlApiProjection.parse(model));

      assertTrue(rejection.getMessage().contains("malformed constructs"), rejection::getMessage);
    } finally {
      model.close();
    }
  }

  private static OWLClassExpression nestedExpression() {
    return OWL.getOWLObjectUnionOf(
        PERSON,
        OWL.getOWLObjectIntersectionOf(
            ORGANIZATION, OWL.getOWLObjectSomeValuesFrom(HAS_CONTACT, EMAIL)));
  }

  private static Arguments construct(
      final String name, final OntologyAxiom axiom, final OWLAxiom... expected) {
    return Arguments.of(name, axiom, Set.of(expected));
  }

  private static OntologyAxiom classAxiom(
      final OntologyAxiomType type, final OntologyExpression... expressions) {
    return new OntologyAxiom()
        .withAxiomType(type)
        .withSubjectIri(iri(CUSTOMER))
        .withExpressions(List.of(expressions));
  }

  private static OntologyExpression named(final OWLClass owlClass) {
    return new OntologyExpression()
        .withKind(OntologyExpressionKind.NAMED_CLASS)
        .withClassIri(iri(owlClass));
  }

  private static OntologyExpression datatype(final OWLDatatype datatype) {
    return new OntologyExpression()
        .withKind(OntologyExpressionKind.NAMED_CLASS)
        .withClassIri(URI.create(datatype.getIRI().toString()));
  }

  private static OntologyExpression intersection(final OntologyExpression... operands) {
    return new OntologyExpression()
        .withKind(OntologyExpressionKind.INTERSECTION)
        .withOperands(List.of(operands));
  }

  private static OntologyExpression union(final OntologyExpression... operands) {
    return new OntologyExpression()
        .withKind(OntologyExpressionKind.UNION)
        .withOperands(List.of(operands));
  }

  private static OntologyExpression some(
      final OWLProperty property, final OntologyExpression filler) {
    return restriction(property.getIRI(), OntologyRestrictionKind.SOME).withFiller(filler);
  }

  private static OntologyExpression only(
      final OWLProperty property, final OntologyExpression filler) {
    return restriction(property.getIRI(), OntologyRestrictionKind.ONLY).withFiller(filler);
  }

  private static OntologyExpression cardinality(
      final IRI property,
      final OntologyRestrictionKind kind,
      final int cardinality,
      final OntologyExpression filler) {
    return restriction(property, kind).withCardinality(cardinality).withFiller(filler);
  }

  private static OntologyExpression restriction(
      final IRI property, final OntologyRestrictionKind kind) {
    return new OntologyExpression()
        .withKind(OntologyExpressionKind.RESTRICTION)
        .withPropertyIri(URI.create(property.toString()))
        .withRestrictionKind(kind);
  }

  private static URI iri(final OWLEntity entity) {
    return URI.create(entity.getIRI().toString());
  }

  private static OWLClass owlClass(final String name) {
    return OWL.getOWLClass(IRI.create(EX + name));
  }

  private static OWLObjectProperty objectProperty(final String name) {
    return OWL.getOWLObjectProperty(IRI.create(EX + name));
  }

  private static OWLDataProperty dataProperty(final String name) {
    return OWL.getOWLDataProperty(IRI.create(EX + name));
  }

  private static OWLNamedIndividual individual(final String name) {
    return OWL.getOWLNamedIndividual(IRI.create(EX + name));
  }
}
