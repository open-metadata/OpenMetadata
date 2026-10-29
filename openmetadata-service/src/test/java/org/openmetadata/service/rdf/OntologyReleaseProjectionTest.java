package org.openmetadata.service.rdf;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.ByteArrayOutputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.RDFList;
import org.apache.jena.riot.RDFDataMgr;
import org.apache.jena.vocabulary.DCTerms;
import org.apache.jena.vocabulary.OWL2;
import org.apache.jena.vocabulary.RDF;
import org.apache.jena.vocabulary.RDFS;
import org.apache.jena.vocabulary.SKOS;
import org.apache.jena.vocabulary.XSD;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.data.ConceptMapping;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.OntologyAxiomType;
import org.openmetadata.schema.type.OntologyConceptType;
import org.openmetadata.schema.type.OntologyExpression;
import org.openmetadata.schema.type.OntologyExpressionKind;
import org.openmetadata.schema.type.OntologyLiteral;
import org.openmetadata.schema.type.OntologyPrefix;
import org.openmetadata.schema.type.OntologyPropertyKind;
import org.openmetadata.schema.type.OntologyReleaseMember;
import org.openmetadata.schema.type.OntologyReleaseMember.MemberKind;
import org.openmetadata.schema.type.OntologyRestrictionKind;
import org.openmetadata.schema.type.OntologyState;
import org.openmetadata.schema.type.RelationshipCharacteristic;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.ontology.OntologyReleaseManifest;
import org.openmetadata.service.ontology.OntologyReleaseReader;
import org.openmetadata.service.ontology.OntologyStructureValidator;
import org.openmetadata.service.ontology.OntologyWorkingSnapshot;
import org.semanticweb.owlapi.model.AxiomType;

class OntologyReleaseProjectionTest {
  private static final String EX = "https://example.org/model/";
  private static final Ontology ROOT =
      new Ontology()
          .withId(UUID.randomUUID())
          .withName("model")
          .withFullyQualifiedName("model")
          .withIri(URI.create(EX))
          .withNamespace(URI.create(EX))
          .withPrefixes(
              List.of(new OntologyPrefix().withPrefix("ex").withNamespace(URI.create(EX))));

  @ParameterizedTest
  @EnumSource(RdfSerializationFormat.class)
  void fullNativeExportReimportsAsNoOpAcrossSerializations(RdfSerializationFormat format) {
    final Bundle bundle =
        bundle(
            List.of(
                concept("Customer")
                    .withConceptType(OntologyConceptType.BOTH)
                    .withSynonyms(Set.of("Client"))
                    .withConceptMappings(
                        List.of(
                            new ConceptMapping()
                                .withMappingType(ConceptMapping.ConceptMappingType.EXACT_MATCH)
                                .withConceptIri(URI.create(EX + "external")))),
                property("code")
                    .withKind(OntologyPropertyKind.DATA)
                    .withEnumValues(
                        List.of(
                            new OntologyLiteral()
                                .withValue("01")
                                .withDatatypeIri(URI.create(XSD.integer.getURI())),
                            new OntologyLiteral()
                                .withValue("Gold")
                                .withDatatypeIri(URI.create(XSD.xstring.getURI()))))
                    .withUnit("kg")
                    .withIsIdentifier(true),
                property("related")
                    .withPropertyChain(List.of(URI.create(EX + "first"), URI.create(EX + "second")))
                    .withInverse(URI.create(EX + "inverse")),
                axiom("subclass")));
    assertNativeReimportIsNoOp(bundle, format);
  }

  @ParameterizedTest
  @EnumSource(OntologyAxiomType.class)
  void everyAxiomKindReimportsWithoutDuplicateOperations(OntologyAxiomType kind) {
    final OntologyAxiom value = axiom("meaning").withAxiomType(kind);
    switch (kind) {
      case OBJECT_PROPERTY_ASSERTION -> value
          .withExpressions(List.of())
          .withPropertyIri(URI.create(EX + "knows"))
          .withTargetIri(URI.create(EX + "person"));
      case DATA_PROPERTY_ASSERTION -> value
          .withExpressions(List.of())
          .withPropertyIri(URI.create(EX + "age"))
          .withLiteral(
              new OntologyLiteral()
                  .withValue("7")
                  .withDatatypeIri(URI.create(XSD.integer.getURI())));
      default -> {}
    }
    assertNativeReimportIsNoOp(bundle(List.of(value)), RdfSerializationFormat.N_TRIPLES);
  }

  @Test
  void duplicateEquivalentAxiomsReimportWithoutAddingCopies() {
    assertNativeReimportIsNoOp(
        bundle(List.of(axiom("first"), axiom("second"))), RdfSerializationFormat.N_TRIPLES);
  }

  @ParameterizedTest
  @MethodSource("nativeExpressionCases")
  void nativeExpressionFormsReimportWithoutChanges(OntologyExpression expression) {
    assertNativeReimportIsNoOp(
        bundle(
            List.of(
                property("age").withKind(OntologyPropertyKind.DATA),
                axiom("expression").withExpressions(List.of(expression)))),
        RdfSerializationFormat.N_TRIPLES);
  }

  static Stream<OntologyExpression> nativeExpressionCases() {
    final OntologyExpression person = named(EX + "Person");
    final OntologyExpression organization = named(EX + "Organization");
    return Stream.of(
        new OntologyExpression()
            .withKind(OntologyExpressionKind.UNION)
            .withOperands(List.of(person, organization)),
        new OntologyExpression()
            .withKind(OntologyExpressionKind.INTERSECTION)
            .withOperands(List.of(person, organization)),
        new OntologyExpression()
            .withKind(OntologyExpressionKind.ONE_OF)
            .withIndividualIris(List.of(URI.create(EX + "one"), URI.create(EX + "two"))),
        new OntologyExpression()
            .withKind(OntologyExpressionKind.RESTRICTION)
            .withPropertyIri(URI.create(EX + "related"))
            .withRestrictionKind(OntologyRestrictionKind.SOME)
            .withFiller(person),
        new OntologyExpression()
            .withKind(OntologyExpressionKind.RESTRICTION)
            .withPropertyIri(URI.create(EX + "related"))
            .withRestrictionKind(OntologyRestrictionKind.ONLY)
            .withFiller(person),
        new OntologyExpression()
            .withKind(OntologyExpressionKind.RESTRICTION)
            .withPropertyIri(URI.create(EX + "related"))
            .withRestrictionKind(OntologyRestrictionKind.VALUE)
            .withIndividualIri(URI.create(EX + "one")),
        new OntologyExpression()
            .withKind(OntologyExpressionKind.RESTRICTION)
            .withPropertyIri(URI.create(EX + "age"))
            .withRestrictionKind(OntologyRestrictionKind.VALUE)
            .withLiteral(
                new OntologyLiteral()
                    .withValue("7")
                    .withDatatypeIri(URI.create(XSD.integer.getURI()))),
        new OntologyExpression()
            .withKind(OntologyExpressionKind.RESTRICTION)
            .withPropertyIri(URI.create(EX + "age"))
            .withRestrictionKind(OntologyRestrictionKind.MIN)
            .withCardinality(2)
            .withFiller(named(XSD.integer.getURI())));
  }

  private static OntologyExpression named(final String iri) {
    return new OntologyExpression()
        .withKind(OntologyExpressionKind.NAMED_CLASS)
        .withClassIri(URI.create(iri));
  }

  private static void assertNativeReimportIsNoOp(
      final Bundle bundle, final RdfSerializationFormat format) {
    final Model exported =
        new OntologyReleaseProjection().build(bundle.release(), bundle.members());
    try {
      final ByteArrayOutputStream bytes = new ByteArrayOutputStream();
      RDFDataMgr.write(bytes, exported, format.rdfFormat());
      final NativeOntologyRdfImporter importer = new NativeOntologyRdfImporter();
      final Model parsed = importer.parse(bytes.toString(StandardCharsets.UTF_8), format);
      try {
        final var working =
            new OntologyWorkingSnapshot.Snapshot(
                new OntologyState()
                    .withOntologyId(ROOT.getId())
                    .withWorkingRevision(1L)
                    .withActivationRevision(0L)
                    .withLastReleaseRevision(1L),
                bundle.members().stream()
                    .map(
                        member ->
                            new OntologyWorkingSnapshot.Entry(
                                member.getMemberKind(),
                                OntologyReleaseReader.definition(bundle.release(), member)))
                    .toList());
        assertEquals(0, importer.reconcile(parsed, working).getOperations().size());
      } finally {
        parsed.close();
      }
    } finally {
      exported.close();
    }
  }

  @ParameterizedTest
  @EnumSource(OntologyConceptType.class)
  void retainsExplicitConceptKindsAndLabels(OntologyConceptType type) {
    var concept =
        concept("Customer")
            .withConceptType(type)
            .withDisplayName("Customer label")
            .withDescription("An organizational customer")
            .withSynonyms(Set.of("Client"));
    Model model = projection(concept);
    try {
      var customer = model.createResource(EX + "Customer");
      assertEquals(
          type != OntologyConceptType.SKOS_CONCEPT, model.contains(customer, RDF.type, OWL2.Class));
      assertEquals(
          type != OntologyConceptType.OWL_CLASS, model.contains(customer, RDF.type, SKOS.Concept));
      assertTrue(model.contains(customer, RDFS.label, "Customer label"));
      assertTrue(model.contains(customer, SKOS.altLabel, "Client"));
      assertTrue(model.contains(customer, RDFS.comment, "An organizational customer"));
      assertEquals(EX, model.getNsPrefixURI("ex"));
      assertEquals(List.of(), OwlApiProjection.dlViolations(OwlApiProjection.parse(model)));
    } finally {
      model.close();
    }
  }

  @ParameterizedTest
  @EnumSource(OntologyPropertyKind.class)
  void propertiesKeepTheirKindsAndDomainRangeMeaning(OntologyPropertyKind kind) {
    URI range = URI.create(kind == OntologyPropertyKind.DATA ? XSD.xstring.getURI() : EX + "Party");
    var property =
        property("value")
            .withKind(kind)
            .withDomain(List.of(URI.create(EX + "Customer")))
            .withRange(List.of(range));
    Model model = projection(property);
    try {
      var expected =
          switch (kind) {
            case OBJECT -> OWL2.ObjectProperty;
            case DATA -> OWL2.DatatypeProperty;
            case ANNOTATION -> OWL2.AnnotationProperty;
          };
      var value = model.createResource(EX + "value");
      assertTrue(model.contains(value, RDF.type, expected));
      assertTrue(model.contains(value, RDFS.range, model.createResource(range.toString())));
      assertFalse(model.contains(model.createResource(XSD.xstring.getURI()), RDF.type, OWL2.Class));
      assertEquals(List.of(), OwlApiProjection.dlViolations(OwlApiProjection.parse(model)));
    } finally {
      model.close();
    }
  }

  @ParameterizedTest
  @EnumSource(RelationshipCharacteristic.class)
  void retainsPropertyCharacteristics(RelationshipCharacteristic characteristic) {
    Model model = projection(property("knows").withCharacteristics(Set.of(characteristic)));
    try {
      assertEquals(1, OwlApiProjection.parse(model).getLogicalAxiomCount());
      assertEquals(List.of(), OwlApiProjection.dlViolations(OwlApiProjection.parse(model)));
    } finally {
      model.close();
    }
  }

  @ParameterizedTest
  @MethodSource("enumeratedValues")
  void dataEnumerationsRetainTypedValuesAndIdentifierIntent(final List<OntologyLiteral> values) {
    final OntologyProperty definition =
        property("code")
            .withKind(OntologyPropertyKind.DATA)
            .withEnumValues(values)
            .withUnit("kg")
            .withIsIdentifier(true);
    final Model model = projection(definition);
    try {
      final var property = model.createResource(EX + "code");
      final var range = model.getProperty(property, RDFS.range).getResource();
      assertTrue(model.contains(range, RDF.type, RDFS.Datatype));
      assertTrue(range.getURI().endsWith(":PROPERTY:" + definition.getId() + ":values"));
      final var projected =
          range
              .getProperty(OWL2.equivalentClass)
              .getResource()
              .getProperty(OWL2.oneOf)
              .getResource()
              .as(RDFList.class)
              .asJavaList();
      assertEquals(
          values.stream().map(OntologyLiteral::getValue).toList(),
          projected.stream().map(node -> node.asLiteral().getLexicalForm()).toList());
      assertEquals(
          values.stream()
              .map(
                  value ->
                      value.getDatatypeIri() == null
                          ? XSD.xstring.getURI()
                          : value.getDatatypeIri().toString())
              .toList(),
          projected.stream().map(node -> node.asLiteral().getDatatypeURI()).toList());
      assertTrue(
          model.contains(
              property,
              model.createProperty("https://open-metadata.org/ontology/unitAnnotation"),
              "kg"));
      assertTrue(
          model.contains(
              property,
              model.createProperty("https://open-metadata.org/ontology/identifierIntent"),
              model.createTypedLiteral(true)));
      assertFalse(model.contains(property, RDF.type, OWL2.FunctionalProperty));
      assertFalse(model.contains(null, OWL2.hasKey));
      assertEquals(List.of(), OwlApiProjection.dlViolations(OwlApiProjection.parse(model)));
    } finally {
      model.close();
    }
  }

  private static Stream<List<OntologyLiteral>> enumeratedValues() {
    return Stream.of(
        List.of(new OntologyLiteral().withValue(""), new OntologyLiteral().withValue("Gold")),
        List.of(
            new OntologyLiteral().withValue("01").withDatatypeIri(URI.create(XSD.integer.getURI())),
            new OntologyLiteral().withValue("2").withDatatypeIri(URI.create(XSD.integer.getURI()))),
        List.of(
            new OntologyLiteral()
                .withValue("2026-10-15T00:00:00Z")
                .withDatatypeIri(URI.create(XSD.dateTime.getURI()))));
  }

  @Test
  void retainsOrderedChainsInversesAndDisjointProperties() {
    Model model =
        projection(
            property("related")
                .withInverse(URI.create(EX + "inverse"))
                .withPropertyChain(List.of(URI.create(EX + "first"), URI.create(EX + "second"))),
            property("different").withDisjointWith(List.of(URI.create(EX + "disjoint"))));
    try {
      var ontology = OwlApiProjection.parse(model);
      assertEquals(3, ontology.getLogicalAxiomCount());
      assertTrue(
          model.contains(
              model.createResource(EX + "related"),
              OWL2.inverseOf,
              model.createResource(EX + "inverse")));
      assertEquals(
          List.of(EX + "first", EX + "second"),
          model
              .getProperty(model.createResource(EX + "related"), OWL2.propertyChainAxiom)
              .getResource()
              .as(RDFList.class)
              .asJavaList()
              .stream()
              .map(node -> node.asResource().getURI())
              .toList());
      assertEquals(List.of(), OwlApiProjection.dlViolations(ontology));
    } finally {
      model.close();
    }
  }

  @ParameterizedTest
  @EnumSource(ConceptMapping.ConceptMappingType.class)
  void retainsEveryExplicitMappingKind(ConceptMapping.ConceptMappingType type) {
    Model model =
        projection(
            concept("Customer")
                .withConceptType(OntologyConceptType.BOTH)
                .withConceptMappings(
                    List.of(
                        new ConceptMapping()
                            .withMappingType(type)
                            .withConceptIri(URI.create(EX + "external")))));
    try {
      var ontology = OwlApiProjection.parse(model);
      assertTrue(
          model
              .listStatements(
                  model.createResource(EX + "Customer"),
                  null,
                  model.createResource(EX + "external"))
              .hasNext());
      assertEquals(List.of(), OwlApiProjection.dlViolations(ontology));
    } finally {
      model.close();
    }
  }

  @Test
  void aKnownDataPropertyKeepsUnqualifiedCardinalityAndCustomDatatypeFillers() {
    var restriction =
        new OntologyExpression()
            .withKind(OntologyExpressionKind.RESTRICTION)
            .withPropertyIri(URI.create(EX + "code"))
            .withRestrictionKind(OntologyRestrictionKind.EXACT)
            .withCardinality(1);
    var axiom = axiom("restriction").withExpressions(List.of(restriction));
    Model unqualified = projection(property("code").withKind(OntologyPropertyKind.DATA), axiom);
    try {
      assertTrue(modelHasDataCardinality(unqualified));
    } finally {
      unqualified.close();
    }
    restriction.setFiller(
        new OntologyExpression()
            .withKind(OntologyExpressionKind.NAMED_CLASS)
            .withClassIri(URI.create(EX + "Code")));
    Model qualified = projection(property("code").withKind(OntologyPropertyKind.DATA), axiom);
    try {
      assertTrue(qualified.contains(null, OWL2.onDataRange, qualified.createResource(EX + "Code")));
      assertTrue(
          qualified.contains(qualified.createResource(EX + "Code"), RDF.type, RDFS.Datatype));
      assertFalse(qualified.contains(qualified.createResource(EX + "Code"), RDF.type, OWL2.Class));
      assertTrue(modelHasDataCardinality(qualified));
    } finally {
      qualified.close();
    }
  }

  @ParameterizedTest
  @MethodSource("fixedVocabularyRestrictions")
  void fixedVocabularyDataRestrictionsKeepTheirMeaning(
      String propertyIri, OntologyExpressionKind fillerKind) {
    final var restriction =
        new OntologyExpression()
            .withKind(OntologyExpressionKind.RESTRICTION)
            .withPropertyIri(URI.create(propertyIri))
            .withRestrictionKind(OntologyRestrictionKind.EXACT)
            .withCardinality(1);
    if (fillerKind != null) {
      restriction.withFiller(
          new OntologyExpression()
              .withKind(fillerKind)
              .withOperands(
                  List.of(XSD.xstring, XSD.integer).stream()
                      .map(
                          datatype ->
                              new OntologyExpression()
                                  .withKind(OntologyExpressionKind.NAMED_CLASS)
                                  .withClassIri(URI.create(datatype.getURI())))
                      .toList()));
    }
    final var bundle =
        bundle(
            List.of(
                concept("Customer"), axiom("restriction").withExpressions(List.of(restriction))));
    final var report = OntologyStructureValidator.validate(bundle.release(), bundle.members());
    assertTrue(report.getValid(), () -> report.getViolations().toString());
    final Model model = new OntologyReleaseProjection().build(bundle.release(), bundle.members());
    try {
      assertFalse(model.contains(null, OWL2.onClass));
      assertEquals(fillerKind != null, model.contains(null, OWL2.onDataRange));
      assertTrue(modelHasDataCardinality(model));
      assertEquals(List.of(), OwlApiProjection.dlViolations(OwlApiProjection.parse(model)));
    } finally {
      model.close();
    }
  }

  static Stream<Arguments> fixedVocabularyRestrictions() {
    return Stream.of(SKOS.notation.getURI(), OWL2.bottomDataProperty.getURI())
        .flatMap(
            iri ->
                Stream.of(null, OntologyExpressionKind.UNION, OntologyExpressionKind.INTERSECTION)
                    .map(kind -> Arguments.of(iri, kind)));
  }

  @Test
  void everyAuthoredAxiomHasItsFrozenSourceAndDuplicateMeaningKeepsBothSources() {
    var first = axiom("first");
    var second = axiom("second");
    Bundle bundle = bundle(List.of(first, second));
    Model model = new OntologyReleaseProjection().build(bundle.release(), bundle.members());
    try {
      var ontology = OwlApiProjection.parse(model);
      var subclassAxioms = ontology.axioms(AxiomType.SUBCLASS_OF).toList();
      assertEquals(2, subclassAxioms.size());
      assertEquals(
          Set.of(
              source(bundle.release(), MemberKind.AXIOM, first.getId()),
              source(bundle.release(), MemberKind.AXIOM, second.getId())),
          subclassAxioms.stream()
              .flatMap(axiom -> axiom.annotations())
              .map(annotation -> annotation.getValue().toString())
              .collect(Collectors.toSet()));
      assertTrue(model.contains(null, OWL2.annotatedProperty, RDFS.subClassOf));
      assertTrue(model.contains(DCTerms.source, RDF.type, OWL2.AnnotationProperty));
      assertEquals(List.of(), OwlApiProjection.dlViolations(ontology));
    } finally {
      model.close();
    }
  }

  @ParameterizedTest
  @EnumSource(OntologyAxiomType.class)
  void everyAxiomKindRetainsItsLogicalMeaningAndProvenance(OntologyAxiomType kind) {
    var axiom = axiom("meaning").withAxiomType(kind);
    switch (kind) {
      case OBJECT_PROPERTY_ASSERTION -> axiom
          .withExpressions(List.of())
          .withPropertyIri(URI.create(EX + "knows"))
          .withTargetIri(URI.create(EX + "person"));
      case DATA_PROPERTY_ASSERTION -> axiom
          .withExpressions(List.of())
          .withPropertyIri(URI.create(EX + "age"))
          .withLiteral(
              new OntologyLiteral()
                  .withValue("7")
                  .withDatatypeIri(URI.create(XSD.integer.getURI())));
      default -> {}
    }
    Model model = projection(axiom);
    try {
      var parsed = OwlApiProjection.parse(model);
      assertEquals(1, parsed.getLogicalAxiomCount());
      assertEquals(1L, parsed.logicalAxioms().flatMap(value -> value.annotations()).count());
      assertEquals(List.of(), OwlApiProjection.dlViolations(parsed));
    } finally {
      model.close();
    }
  }

  @Test
  void dataPropertiesRetainFunctionalAndDisjointSemantics() {
    Model model =
        projection(
            property("code")
                .withKind(OntologyPropertyKind.DATA)
                .withCharacteristics(Set.of(RelationshipCharacteristic.FUNCTIONAL))
                .withDisjointWith(List.of(URI.create(EX + "otherCode"))));
    try {
      var parsed = OwlApiProjection.parse(model);
      assertEquals(2, parsed.getLogicalAxiomCount());
      assertTrue(
          model.contains(model.createResource(EX + "otherCode"), RDF.type, OWL2.DatatypeProperty));
      assertEquals(List.of(), OwlApiProjection.dlViolations(parsed));
    } finally {
      model.close();
    }
  }

  @Test
  void exportPreservesAnInvalidCandidateForValidationInsteadOfDroppingItsAxioms() {
    Model model =
        projection(
            property("related")
                .withDisjointWith(List.of(URI.create(EX + "different")))
                .withPropertyChain(List.of(URI.create(EX + "first"), URI.create(EX + "second"))));
    try {
      var parsed = OwlApiProjection.parse(model);
      assertEquals(2, parsed.getLogicalAxiomCount());
      assertFalse(OwlApiProjection.dlViolations(parsed).isEmpty());
    } finally {
      model.close();
    }
  }

  @ParameterizedTest
  @MethodSource("regularChains")
  void acceptedPropertyChainsAlsoPassTheIndependentOwl2DlProfile(
      List<OntologyProperty> properties) {
    final var bundle = bundle(properties);
    assertTrue(OntologyStructureValidator.validate(bundle.release(), bundle.members()).getValid());
    final var model = new OntologyReleaseProjection().build(bundle.release(), bundle.members());
    try {
      assertEquals(List.of(), OwlApiProjection.dlViolations(OwlApiProjection.parse(model)));
    } finally {
      model.close();
    }
  }

  static Stream<List<OntologyProperty>> regularChains() {
    final URI first = URI.create(EX + "first");
    final URI second = URI.create(EX + "second");
    final URI related = URI.create(EX + "related");
    return Stream.of(
        List.of(
            property("related").withPropertyChain(List.of(first, second)),
            property("first"),
            property("second")),
        List.of(property("related").withPropertyChain(List.of(related, related))),
        List.of(property("related").withPropertyChain(List.of(related, first)), property("first")),
        List.of(property("related").withPropertyChain(List.of(first, related)), property("first")),
        List.of(
            property("related")
                .withPropertyChain(List.of(first, second))
                .withInverse(URI.create(EX + "inverse")),
            property("inverse"),
            property("first"),
            property("second")));
  }

  @Test
  void rejectsAValidDigestWhenPayloadIdentityOrOwnershipIsWrong() {
    Bundle bundle = bundle(List.of(concept("Customer")));
    var member = bundle.members().getLast();
    member.setMemberId(UUID.randomUUID());
    reseal(bundle);
    assertThrows(
        BadRequestException.class,
        () -> new OntologyReleaseProjection().build(bundle.release(), bundle.members()));

    Bundle foreign =
        bundle(
            List.of(
                concept("Customer")
                    .withOntology(
                        new EntityReference().withId(UUID.randomUUID()).withType("ontology"))));
    assertThrows(
        BadRequestException.class,
        () -> new OntologyReleaseProjection().build(foreign.release(), foreign.members()));
  }

  @Test
  void unsupportedMembersAndMissingRootsCannotDisappearFromExport() {
    Bundle bundle = bundle(List.of(concept("Customer")));
    bundle.members().getLast().setMemberKind(MemberKind.SHAPE);
    reseal(bundle);
    assertThrows(
        BadRequestException.class,
        () -> new OntologyReleaseProjection().build(bundle.release(), bundle.members()));
    bundle.members().getLast().setMemberKind(MemberKind.CONCEPT);
    bundle.members().removeFirst();
    reseal(bundle);
    assertThrows(
        BadRequestException.class,
        () -> new OntologyReleaseProjection().build(bundle.release(), bundle.members()));
  }

  @Test
  void projectionIsIndependentOfMemberOrderAndRetainsExactIris() {
    Bundle bundle =
        bundle(
            List.of(
                concept("one").withIri(URI.create("HTTPS://EXAMPLE.org/Customer")),
                concept("two").withIri(URI.create("https://example.org/Customer"))));
    Model first = new OntologyReleaseProjection().build(bundle.release(), bundle.members());
    List<OntologyReleaseMember> reversed = new ArrayList<>(bundle.members());
    Collections.reverse(reversed);
    Model second = new OntologyReleaseProjection().build(bundle.release(), reversed);
    try {
      assertTrue(first.isIsomorphicWith(second));
      assertTrue(
          first.contains(
              first.createResource("HTTPS://EXAMPLE.org/Customer"), RDF.type, OWL2.Class));
      assertTrue(
          first.contains(
              first.createResource("https://example.org/Customer"), RDF.type, OWL2.Class));
    } finally {
      first.close();
      second.close();
    }
  }

  @ParameterizedTest(name = "{0}")
  @MethodSource("invalidBundles")
  void refusesCorruptOrUnsupportedBundles(String reason, Consumer<Bundle> corrupt) {
    Bundle bundle = bundle(List.of(concept("Customer")));
    corrupt.accept(bundle);
    assertThrows(
        BadRequestException.class,
        () -> new OntologyReleaseProjection().build(bundle.release(), bundle.members()),
        reason);
  }

  static Stream<Arguments> invalidBundles() {
    return Stream.of(
        invalid("unsealed", bundle -> bundle.release().setSealedAt(null)),
        invalid("wrong encoding", bundle -> bundle.release().setEncodingVersion(null)),
        invalid("wrong digest", bundle -> bundle.release().setContentDigest("0".repeat(64))),
        invalid("wrong count", bundle -> bundle.release().setMemberCount(9)),
        invalid("wrong bytes", bundle -> bundle.release().setTotalBytes(1L)),
        invalid("wrong release", bundle -> bundle.release().setId(UUID.randomUUID())),
        invalid(
            "wrong ontology", bundle -> bundle.release().getOntology().setId(UUID.randomUUID())),
        invalid(
            "wrong ontology IRI",
            bundle -> bundle.release().setOntologyIri(URI.create("urn:other"))),
        invalid(
            "wrong version IRI", bundle -> bundle.release().setVersionIri(URI.create("urn:other"))),
        invalid("missing root", bundle -> bundle.members().removeFirst()),
        invalid(
            "changed member",
            bundle ->
                ((com.fasterxml.jackson.databind.node.ObjectNode)
                        bundle.members().getLast().getPayload())
                    .put("description", "tampered")));
  }

  private static Arguments invalid(String reason, Consumer<Bundle> corrupt) {
    return Arguments.of(reason, corrupt);
  }

  private static boolean modelHasDataCardinality(Model model) {
    return OwlApiProjection.parse(model)
        .logicalAxioms()
        .anyMatch(axiom -> axiom.toString().contains("DataExactCardinality"));
  }

  private static Model projection(EntityInterface<?>... definitions) {
    Bundle bundle = bundle(List.of(definitions));
    return new OntologyReleaseProjection().build(bundle.release(), bundle.members());
  }

  private static OntologyConcept concept(String name) {
    return new OntologyConcept()
        .withId(UUID.randomUUID())
        .withName(name)
        .withIri(URI.create(EX + name))
        .withOntology(ROOT.getEntityReference())
        .withConceptType(OntologyConceptType.OWL_CLASS);
  }

  private static OntologyProperty property(String name) {
    return new OntologyProperty()
        .withId(UUID.randomUUID())
        .withName(name)
        .withIri(URI.create(EX + name))
        .withOntology(ROOT.getEntityReference())
        .withKind(OntologyPropertyKind.OBJECT);
  }

  private static OntologyAxiom axiom(String name) {
    return new OntologyAxiom()
        .withId(UUID.randomUUID())
        .withName(name)
        .withOntology(ROOT.getEntityReference())
        .withAxiomType(OntologyAxiomType.SUBCLASS_OF)
        .withSubjectIri(URI.create(EX + "Customer"))
        .withExpressions(
            List.of(
                new OntologyExpression()
                    .withKind(OntologyExpressionKind.NAMED_CLASS)
                    .withClassIri(URI.create(EX + "Party"))));
  }

  private static Bundle bundle(List<? extends EntityInterface<?>> definitions) {
    UUID id = UUID.randomUUID();
    var members = new ArrayList<OntologyReleaseMember>();
    members.add(member(id, MemberKind.ONTOLOGY, ROOT));
    for (var entity : definitions) {
      MemberKind kind =
          switch (entity) {
            case OntologyConcept ignored -> MemberKind.CONCEPT;
            case OntologyProperty ignored -> MemberKind.PROPERTY;
            case OntologyAxiom ignored -> MemberKind.AXIOM;
            default -> throw new IllegalArgumentException();
          };
      members.add(member(id, kind, entity));
    }
    var release =
        new OntologyRelease()
            .withId(id)
            .withOntology(ROOT.getEntityReference())
            .withOntologyIri(ROOT.getIri())
            .withVersionIri(URI.create("urn:openmetadata:ontology-release:" + id))
            .withSealedAt(1L)
            .withEncodingVersion(
                OntologyRelease.EncodingVersion.fromValue(OntologyReleaseManifest.ENCODING_VERSION))
            .withMemberCount(members.size())
            .withTotalBytes(
                members.stream().mapToLong(OntologyReleaseMember::getPayloadBytes).sum())
            .withContentDigest(OntologyReleaseManifest.digest(members));
    return new Bundle(release, members);
  }

  private static OntologyReleaseMember member(
      UUID release, MemberKind kind, EntityInterface<?> entity) {
    return OntologyReleaseManifest.member(
        release, kind, entity.getId(), JsonUtils.getObjectMapper().valueToTree(entity));
  }

  private static String source(OntologyRelease release, MemberKind kind, UUID id) {
    return release.getVersionIri() + ":" + kind + ":" + id;
  }

  private static void reseal(Bundle bundle) {
    bundle
        .release()
        .withMemberCount(bundle.members().size())
        .withTotalBytes(
            bundle.members().stream().mapToLong(OntologyReleaseMember::getPayloadBytes).sum())
        .withContentDigest(OntologyReleaseManifest.digest(bundle.members()));
  }

  private record Bundle(OntologyRelease release, List<OntologyReleaseMember> members) {}
}
