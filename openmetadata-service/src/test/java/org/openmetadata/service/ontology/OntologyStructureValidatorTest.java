package org.openmetadata.service.ontology;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.IntStream;
import org.apache.jena.vocabulary.OWL2;
import org.apache.jena.vocabulary.RDFS;
import org.apache.jena.vocabulary.SKOS;
import org.apache.jena.vocabulary.XSD;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.schema.OntologyDefinition;
import org.openmetadata.schema.api.data.ConceptMapping;
import org.openmetadata.schema.api.data.OntologyReleaseStructureReport;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.OntologyAxiomType;
import org.openmetadata.schema.type.OntologyConceptType;
import org.openmetadata.schema.type.OntologyExpression;
import org.openmetadata.schema.type.OntologyExpressionKind;
import org.openmetadata.schema.type.OntologyProfileViolationCode;
import org.openmetadata.schema.type.OntologyPropertyKind;
import org.openmetadata.schema.type.OntologyReleaseMember;
import org.openmetadata.schema.type.OntologyReleaseMember.MemberKind;
import org.openmetadata.schema.type.OntologyRestrictionKind;
import org.openmetadata.schema.type.RelationshipCharacteristic;
import org.openmetadata.schema.utils.JsonUtils;

class OntologyStructureValidatorTest {
  private static final URI PROPERTY = URI.create("urn:property");
  private static final URI INVERSE = URI.create("urn:inverse");
  private static final OntologyRelease RELEASE =
      new OntologyRelease().withId(UUID.randomUUID()).withContentDigest("a".repeat(64));

  @Test
  void declarationsCannotRedefineReservedVocabularyOrInventDatatypes() {
    assertFalse(validate(concept("Reserved").withIri(URI.create(XSD.xstring.getURI()))).getValid());
    final var data = property(PROPERTY, OntologyPropertyKind.DATA);
    assertTrue(validate(data.withRange(List.of(URI.create(XSD.xstring.getURI())))).getValid());
    assertFalse(validate(data.withRange(List.of(URI.create("urn:UnknownDatatype")))).getValid());
    assertFalse(validate(data.withRange(List.of(URI.create(XSD.date.getURI())))).getValid());
  }

  @Test
  void namedSubclassHierarchyRejectsCyclesButAllowsMultipleParents() {
    OntologyConcept customer = concept("Customer");
    OntologyConcept party = concept("Party");
    OntologyConcept legalEntity = concept("LegalEntity");
    OntologyAxiom parents = subclass(customer, party, legalEntity);
    assertTrue(validate(customer, party, legalEntity, parents).getValid());
    assertFalse(
        validate(customer, party, legalEntity, parents, subclass(party, customer)).getValid());
    assertFalse(validate(customer, subclass(customer, customer)).getValid());
  }

  @Test
  void targetedValidationRejectsEveryEdgeInOverlappingCycles() {
    final var first = concept("First");
    final var second = concept("Second");
    final var third = concept("Third");
    final var leaf = concept("Leaf");
    final var edges =
        List.of(subclass(first, second, third), subclass(second, first), subclass(third, second));
    final List<OntologyDefinition> definitions =
        new ArrayList<>(List.of(first, second, third, leaf));
    definitions.addAll(edges);
    final var outside = subclass(leaf, first);
    definitions.add(outside);
    for (final var edge : edges) {
      assertFalse(
          OntologyStructureValidator.validateWorking(definitions, Set.of(edge.getId())).getValid(),
          "Must reject a cycle when editing " + edge.getSubjectIri());
    }
    assertTrue(
        OntologyStructureValidator.validateWorking(definitions, Set.of(outside.getId()))
            .getValid());
  }

  @Test
  void classReferencesMustBeDeclaredAndHaveClassSemantics() {
    OntologyConcept customer = concept("Customer");
    OntologyConcept party = concept("Party");
    OntologyAxiom relation = subclass(customer, party);
    assertFalse(validate(customer, relation).getValid());
    assertFalse(
        validate(customer, party.withConceptType(OntologyConceptType.SKOS_CONCEPT), relation)
            .getValid());
    assertFalse(
        validate(
                customer.withConceptType(OntologyConceptType.SKOS_CONCEPT),
                party.withConceptType(OntologyConceptType.OWL_CLASS),
                relation)
            .getValid());
    assertTrue(
        validate(customer.withConceptType(OntologyConceptType.BOTH), party, relation).getValid());
  }

  @Test
  void classKindsCannotUseIndividualIdentityMappings() {
    OntologyConcept customer =
        concept("Customer")
            .withConceptMappings(
                List.of(
                    new ConceptMapping()
                        .withMappingType(ConceptMapping.ConceptMappingType.SAME_AS)
                        .withConceptIri(URI.create("urn:external:Customer"))));
    assertFalse(validate(customer).getValid());
    assertFalse(validate(customer.withConceptType(OntologyConceptType.BOTH)).getValid());
    assertTrue(validate(customer.withConceptType(OntologyConceptType.SKOS_CONCEPT)).getValid());
  }

  @Test
  void aReplacementMustBeAnotherDefinitionOfTheSameKind() {
    final var account = concept("Account");
    final var identifier = property(URI.create("urn:identifier"), OntologyPropertyKind.DATA);
    final var self = concept("Self");
    assertEquals(
        List.of(), violations(concept("Customer").withReplacedBy(account.getIri()), account));
    assertEquals(
        List.of(),
        violations(
            property(PROPERTY, OntologyPropertyKind.DATA).withReplacedBy(identifier.getIri()),
            identifier));
    assertEquals(
        List.of("UNDECLARED_CLASS /replacedBy"),
        violations(concept("Customer").withReplacedBy(account.getIri())));
    assertEquals(
        List.of("UNDECLARED_CLASS /replacedBy"),
        violations(concept("Customer").withReplacedBy(identifier.getIri()), identifier));
    assertEquals(
        List.of("UNDECLARED_PROPERTY /replacedBy"),
        violations(
            property(PROPERTY, OntologyPropertyKind.DATA).withReplacedBy(account.getIri()),
            account));
    assertEquals(
        List.of("UNDECLARED_CLASS /replacedBy"), violations(self.withReplacedBy(self.getIri())));
  }

  @Test
  void classRolesInPropertyDomainsAndRangesRequireDeclarations() {
    OntologyConcept customer = concept("Customer");
    OntologyProperty owns =
        property(PROPERTY, OntologyPropertyKind.OBJECT)
            .withDomain(List.of(customer.getIri()))
            .withRange(List.of(URI.create(OWL2.Thing.getURI())));
    assertFalse(validate(owns).getValid());
    assertTrue(validate(customer, owns).getValid());
    assertFalse(
        validate(customer.withConceptType(OntologyConceptType.SKOS_CONCEPT), owns).getValid());
  }

  @Test
  void deepNamedHierarchiesDoNotUseTheJavaCallStack() {
    final var definitions = new ArrayList<OntologyDefinition>();
    final var concepts =
        IntStream.range(0, 4000).mapToObj(index -> concept("Class" + index)).toList();
    definitions.addAll(concepts);
    for (int index = 1; index < concepts.size(); index++) {
      definitions.add(subclass(concepts.get(index), concepts.get(index - 1)));
    }
    assertTrue(validate(definitions.toArray(OntologyDefinition[]::new)).getValid());
    definitions.add(subclass(concepts.getFirst(), concepts.getLast()));
    assertFalse(validate(definitions.toArray(OntologyDefinition[]::new)).getValid());
  }

  @Test
  void classResolutionKeepsExactIriSpellingAndChecksIdentityMappingTargets() {
    final var source = concept("Source");
    final var target = concept("Target").withIri(URI.create("https://example.org/Class%2f"));
    final var relation = subclass(source, target);
    assertTrue(validate(source, target, relation).getValid());
    target.setIri(URI.create("https://example.org/Class%2F"));
    assertFalse(validate(source, target, relation).getValid());
    source
        .withConceptType(OntologyConceptType.SKOS_CONCEPT)
        .withConceptMappings(
            List.of(
                new ConceptMapping()
                    .withMappingType(ConceptMapping.ConceptMappingType.SAME_AS)
                    .withConceptIri(target.getIri())));
    assertFalse(validate(source, target).getValid());
  }

  @ParameterizedTest
  @EnumSource(OntologyPropertyKind.class)
  void assertionsUseDeclarationsFromAnyMemberRelease(OntologyPropertyKind kind) {
    var declaration = property(PROPERTY, kind);
    var assertion = assertion();
    var imported = member(UUID.randomUUID(), declaration);
    var report =
        OntologyStructureValidator.validate(
            RELEASE, List.of(imported, member(RELEASE.getId(), assertion)));
    assertEquals(kind == OntologyPropertyKind.OBJECT, report.getValid());
    assertEquals(RELEASE.getContentDigest(), report.getContentDigest());
    if (kind != OntologyPropertyKind.OBJECT) {
      var finding = report.getViolations().getFirst();
      assertEquals(RELEASE.getId(), finding.getReleaseId());
      assertEquals(assertion.getId(), finding.getMemberId());
      assertEquals(MemberKind.AXIOM, finding.getMemberKind());
      assertEquals(OntologyProfileViolationCode.ILLEGAL_PUNNING, finding.getViolation().getCode());
    }
  }

  @Test
  void conflictingDeclarationsAreReportedOnBothMembers() {
    var object = property(PROPERTY, OntologyPropertyKind.OBJECT);
    var data = property(PROPERTY, OntologyPropertyKind.DATA);
    var report = validate(object, data);
    assertFalse(report.getValid());
    assertEquals(2, report.getViolationCount());
    assertTrue(
        report.getViolations().stream()
            .allMatch(
                issue ->
                    issue.getViolation().getCode()
                        == OntologyProfileViolationCode.ILLEGAL_PUNNING));
    assertTrue(validate(object, property(PROPERTY, OntologyPropertyKind.OBJECT)).getValid());
  }

  @Test
  void inverseClosureCarriesNonSimplicityAcrossModulesAndCycles() {
    var transitive =
        property(PROPERTY, OntologyPropertyKind.OBJECT)
            .withCharacteristics(Set.of(RelationshipCharacteristic.TRANSITIVE))
            .withInverse(INVERSE);
    var inverse = property(INVERSE, OntologyPropertyKind.OBJECT).withInverse(PROPERTY);
    var report =
        validate(
            concept("Subject").withIri(URI.create("urn:subject")),
            transitive,
            inverse,
            cardinality(INVERSE));
    assertEquals(1, report.getViolationCount());
    assertEquals(
        OntologyProfileViolationCode.NON_SIMPLE_CARDINALITY,
        report.getViolations().getFirst().getViolation().getCode());
  }

  @Test
  void chainElementsStaySimpleWhileTheirSuperpropertyDoesNot() {
    var first = property(URI.create("urn:first"), OntologyPropertyKind.OBJECT);
    var second = property(URI.create("urn:second"), OntologyPropertyKind.OBJECT);
    var composed =
        property(PROPERTY, OntologyPropertyKind.OBJECT)
            .withPropertyChain(List.of(first.getIri(), second.getIri()));
    var subject = concept("Subject").withIri(URI.create("urn:subject"));
    assertTrue(validate(subject, first, second, composed, cardinality(first.getIri())).getValid());
    assertFalse(validate(subject, first, second, composed, cardinality(PROPERTY)).getValid());
  }

  @Test
  void propertyChainsRequireARegularOrderAcrossTheirInverseClosure() {
    var first = property(URI.create("urn:first"), OntologyPropertyKind.OBJECT);
    var second = property(URI.create("urn:second"), OntologyPropertyKind.OBJECT);
    var composed =
        property(PROPERTY, OntologyPropertyKind.OBJECT)
            .withPropertyChain(List.of(first.getIri(), second.getIri()));
    assertTrue(validate(first, second, composed).getValid());
    first.setPropertyChain(List.of(second.getIri(), PROPERTY));
    assertFalse(validate(first, second, composed).getValid());
    first.setPropertyChain(List.of());
    var inverse =
        property(INVERSE, OntologyPropertyKind.OBJECT)
            .withInverse(PROPERTY)
            .withPropertyChain(List.of(first.getIri(), second.getIri()));
    first.setPropertyChain(List.of(second.getIri(), INVERSE));
    assertFalse(validate(first, second, composed, inverse).getValid());
  }

  @Test
  void chainsPermitTransitivityAndOneRecursiveEndButNotAnInteriorRecursion() {
    var first = property(URI.create("urn:first"), OntologyPropertyKind.OBJECT);
    var second = property(URI.create("urn:second"), OntologyPropertyKind.OBJECT);
    var composed = property(PROPERTY, OntologyPropertyKind.OBJECT);
    for (var chain :
        List.of(
            List.of(PROPERTY, PROPERTY),
            List.of(PROPERTY, first.getIri()),
            List.of(first.getIri(), PROPERTY))) {
      assertTrue(validate(first, composed.withPropertyChain(chain)).getValid());
    }
    assertFalse(
        validate(
                first,
                second,
                composed.withPropertyChain(List.of(first.getIri(), PROPERTY, second.getIri())))
            .getValid());
    assertFalse(
        validate(first, composed.withPropertyChain(List.of(PROPERTY, first.getIri(), PROPERTY)))
            .getValid());
  }

  @Test
  void inverseChainAndDisjointReferencesRequireCompatibleProperties() {
    var object =
        property(PROPERTY, OntologyPropertyKind.OBJECT)
            .withInverse(INVERSE)
            .withPropertyChain(List.of(INVERSE, PROPERTY))
            .withDisjointWith(List.of(INVERSE));
    assertEquals(
        4, validate(object, property(INVERSE, OntologyPropertyKind.DATA)).getViolationCount());
    assertEquals(
        3,
        validate(object).getViolations().stream()
            .filter(
                issue ->
                    issue.getViolation().getCode()
                        == OntologyProfileViolationCode.UNDECLARED_PROPERTY)
            .count());
  }

  @ParameterizedTest
  @EnumSource(
      value = RelationshipCharacteristic.class,
      names = {"FUNCTIONAL", "INVERSE_FUNCTIONAL", "ASYMMETRIC", "IRREFLEXIVE"})
  void nonSimplePropertiesCannotCarrySimpleOnlyCharacteristics(RelationshipCharacteristic kind) {
    var property =
        property(PROPERTY, OntologyPropertyKind.OBJECT)
            .withCharacteristics(Set.of(RelationshipCharacteristic.TRANSITIVE, kind));
    var report = validate(property);
    assertEquals(1, report.getViolationCount());
    assertEquals(
        OntologyProfileViolationCode.NON_SIMPLE_PROPERTY,
        report.getViolations().getFirst().getViolation().getCode());
  }

  @Test
  void unknownPropertiesAndExactIriSpellingAreNotSilentlyAccepted() {
    assertEquals(
        OntologyProfileViolationCode.UNDECLARED_PROPERTY,
        validate(assertion()).getViolations().getFirst().getViolation().getCode());
    var declared = property(URI.create("https://example.org/p%2f"), OntologyPropertyKind.OBJECT);
    var assertion = assertion().withPropertyIri(URI.create("https://example.org/p%2F"));
    assertFalse(validate(declared, assertion).getValid());
    assertTrue(validate(declared, assertion.withPropertyIri(declared.getIri())).getValid());
  }

  @Test
  void vocabularyPropertiesKeepTheirFixedKindsWithoutRedeclarations() {
    assertTrue(
        validate(assertion().withPropertyIri(URI.create(OWL2.topObjectProperty.getURI())))
            .getValid());
    assertTrue(validate(assertion().withPropertyIri(URI.create(SKOS.related.getURI()))).getValid());
    assertFalse(
        validate(assertion().withPropertyIri(URI.create(OWL2.topDataProperty.getURI())))
            .getValid());
    assertFalse(
        validate(assertion().withPropertyIri(URI.create(SKOS.prefLabel.getURI()))).getValid());
    assertFalse(validate(assertion().withPropertyIri(URI.create(RDFS.label.getURI()))).getValid());
  }

  @Test
  void explicitDeclarationsCannotChangeFixedVocabularyKinds() {
    var related = URI.create(SKOS.related.getURI());
    assertTrue(validate(property(related, OntologyPropertyKind.OBJECT)).getValid());
    var report = validate(property(related, OntologyPropertyKind.DATA));
    assertFalse(report.getValid());
    assertEquals(
        OntologyProfileViolationCode.ILLEGAL_PUNNING,
        report.getViolations().getFirst().getViolation().getCode());
  }

  @Test
  void individualIdentityAssertionsDoNotRequirePropertyDeclarations() {
    assertTrue(validate(assertion().withPropertyIri(URI.create(OWL2.sameAs.getURI()))).getValid());
    assertTrue(
        validate(assertion().withPropertyIri(URI.create(OWL2.differentFrom.getURI()))).getValid());
    assertFalse(validate(cardinality(URI.create(OWL2.sameAs.getURI()))).getValid());
  }

  @Test
  void classKindsCannotUseIndividualIdentityAssertions() {
    final var customer = concept("Customer");
    final var same = assertion().withPropertyIri(URI.create(OWL2.sameAs.getURI()));
    assertFalse(validate(customer, same.withSubjectIri(customer.getIri())).getValid());
    assertFalse(
        validate(
                customer,
                same.withSubjectIri(URI.create("urn:external")).withTargetIri(customer.getIri()))
            .getValid());
    assertTrue(
        validate(customer.withConceptType(OntologyConceptType.SKOS_CONCEPT), same).getValid());
  }

  @Test
  void reportSizeIsBoundedWithoutLosingTheFailureOrTotalCount() {
    var members =
        IntStream.range(0, 1001).mapToObj(index -> member(RELEASE.getId(), assertion())).toList();
    var report = OntologyStructureValidator.validate(RELEASE, members);
    assertFalse(report.getValid());
    assertEquals(1001, report.getViolationCount());
    assertEquals(1000, report.getViolations().size());
  }

  private static OntologyReleaseStructureReport validate(OntologyDefinition... definitions) {
    return OntologyStructureValidator.validate(
        RELEASE, Arrays.stream(definitions).map(value -> member(RELEASE.getId(), value)).toList());
  }

  private static List<String> violations(OntologyDefinition... definitions) {
    return validate(definitions).getViolations().stream()
        .map(issue -> issue.getViolation().getCode() + " " + issue.getViolation().getPath())
        .toList();
  }

  private static OntologyReleaseMember member(UUID releaseId, OntologyDefinition definition) {
    return OntologyReleaseManifest.member(
        releaseId,
        switch (definition) {
          case OntologyProperty property -> MemberKind.PROPERTY;
          case OntologyConcept concept -> MemberKind.CONCEPT;
          default -> MemberKind.AXIOM;
        },
        definition.getId(),
        JsonUtils.getObjectMapper().valueToTree(definition));
  }

  private static OntologyProperty property(URI iri, OntologyPropertyKind kind) {
    return new OntologyProperty().withId(UUID.randomUUID()).withIri(iri).withKind(kind);
  }

  private static OntologyConcept concept(String name) {
    return new OntologyConcept()
        .withId(UUID.randomUUID())
        .withIri(URI.create("urn:class:" + name))
        .withConceptType(OntologyConceptType.OWL_CLASS)
        .withOntology(new EntityReference().withId(RELEASE.getId()).withType("ontology"));
  }

  private static OntologyAxiom subclass(OntologyConcept subject, OntologyConcept... parents) {
    return assertion()
        .withAxiomType(OntologyAxiomType.SUBCLASS_OF)
        .withSubjectIri(subject.getIri())
        .withPropertyIri(null)
        .withTargetIri(null)
        .withExpressions(
            Arrays.stream(parents)
                .map(
                    parent ->
                        new OntologyExpression()
                            .withKind(OntologyExpressionKind.NAMED_CLASS)
                            .withClassIri(parent.getIri()))
                .toList());
  }

  private static OntologyAxiom assertion() {
    return new OntologyAxiom()
        .withId(UUID.randomUUID())
        .withOntology(new EntityReference().withId(UUID.randomUUID()).withType("ontology"))
        .withSubjectIri(URI.create("urn:subject"))
        .withAxiomType(OntologyAxiomType.OBJECT_PROPERTY_ASSERTION)
        .withPropertyIri(PROPERTY)
        .withTargetIri(URI.create("urn:target"));
  }

  private static OntologyAxiom cardinality(URI property) {
    return assertion()
        .withAxiomType(OntologyAxiomType.SUBCLASS_OF)
        .withPropertyIri(null)
        .withTargetIri(null)
        .withExpressions(
            List.of(
                new OntologyExpression()
                    .withKind(OntologyExpressionKind.RESTRICTION)
                    .withPropertyIri(property)
                    .withRestrictionKind(OntologyRestrictionKind.EXACT)
                    .withCardinality(1)));
  }
}
