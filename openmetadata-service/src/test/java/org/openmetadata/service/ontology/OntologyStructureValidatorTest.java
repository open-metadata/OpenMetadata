package org.openmetadata.service.ontology;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
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
import org.openmetadata.schema.type.OntologyProfileViolationSeverity;
import org.openmetadata.schema.type.OntologyPropertyKind;
import org.openmetadata.schema.type.OntologyReleaseMember;
import org.openmetadata.schema.type.OntologyReleaseMember.MemberKind;
import org.openmetadata.schema.type.OntologyRestrictionKind;
import org.openmetadata.schema.type.RelationshipCharacteristic;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.OntologyValidationException;

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
  void superpropertiesMustBeDeclaredPropertiesOfTheSameKind() {
    final var child = property(PROPERTY, OntologyPropertyKind.OBJECT);
    final var parent = property(URI.create("urn:parent"), OntologyPropertyKind.OBJECT);
    child.setSuperProperties(List.of(parent.getIri()));
    assertEquals(List.of("UNDECLARED_PROPERTY /superProperties"), violations(child));
    assertEquals(List.of(), violations(child, parent));
    assertEquals(
        List.of("ILLEGAL_PUNNING /superProperties"),
        violations(child, parent.withKind(OntologyPropertyKind.DATA)));
    final var note =
        property(URI.create("urn:note"), OntologyPropertyKind.ANNOTATION)
            .withSuperProperties(List.of(URI.create(RDFS.comment.getURI())));
    assertEquals(List.of(), violations(note));
    final var top =
        property(URI.create("urn:top"), OntologyPropertyKind.OBJECT)
            .withSuperProperties(List.of(URI.create(OWL2.topObjectProperty.getURI())));
    assertEquals(List.of(), violations(top));
  }

  @Test
  void superpropertyLinksAllowSeveralParentsButNotACycle() {
    final var first = property(URI.create("urn:first"), OntologyPropertyKind.DATA);
    final var second = property(URI.create("urn:second"), OntologyPropertyKind.DATA);
    final var third = property(URI.create("urn:third"), OntologyPropertyKind.DATA);
    final var leaf = property(URI.create("urn:leaf"), OntologyPropertyKind.DATA);
    first.setSuperProperties(List.of(second.getIri(), third.getIri()));
    assertEquals(List.of(), violations(first, second, third, leaf));
    second.setSuperProperties(List.of(third.getIri()));
    third.setSuperProperties(List.of(first.getIri()));
    leaf.setSuperProperties(List.of(first.getIri()));
    assertEquals(
        List.of(
            "SUBPROPERTY_CYCLE /superProperties",
            "SUBPROPERTY_CYCLE /superProperties",
            "SUBPROPERTY_CYCLE /superProperties"),
        violations(first, second, third, leaf));
    assertEquals(
        List.of(
            "Superproperty links must not form a cycle: urn:first",
            "Superproperty links must not form a cycle: urn:second",
            "Superproperty links must not form a cycle: urn:third"),
        messages(first, second, third, leaf));
  }

  @Test
  void aCompositeSubpropertyMakesEverySuperpropertyAboveItNonSimple() {
    final var transitive =
        property(PROPERTY, OntologyPropertyKind.OBJECT)
            .withCharacteristics(Set.of(RelationshipCharacteristic.TRANSITIVE))
            .withSuperProperties(List.of(URI.create("urn:parent")));
    final var parent =
        property(URI.create("urn:parent"), OntologyPropertyKind.OBJECT)
            .withSuperProperties(List.of(URI.create("urn:grandparent")))
            .withInverse(INVERSE);
    final var inverse = property(INVERSE, OntologyPropertyKind.OBJECT).withInverse(parent.getIri());
    final var grandparent =
        property(URI.create("urn:grandparent"), OntologyPropertyKind.OBJECT)
            .withCharacteristics(Set.of(RelationshipCharacteristic.FUNCTIONAL));
    final var subject = concept("Subject").withIri(URI.create("urn:subject"));
    assertEquals(
        List.of(
            "NON_SIMPLE_CARDINALITY /expressions/0/propertyIri",
            "NON_SIMPLE_PROPERTY /characteristics",
            "NON_SIMPLE_PROPERTY /superProperties",
            "NON_SIMPLE_PROPERTY /superProperties"),
        sortedViolations(subject, transitive, parent, inverse, grandparent, cardinality(INVERSE)));
    // The subproperty and its parent each name the ancestor they make non-simple; the parent's
    // inverse has no superproperty link of its own to blame.
    assertEquals(
        List.of(
            "A non-simple object property cannot be functional, inverse-functional, asymmetric, irreflexive or disjoint",
            "A non-simple object property cannot specialize a functional, inverse-functional, asymmetric, irreflexive or disjoint property: urn:grandparent",
            "A non-simple object property cannot specialize a functional, inverse-functional, asymmetric, irreflexive or disjoint property: urn:grandparent"),
        messages(transitive, parent, inverse, grandparent));
    transitive.setCharacteristics(Set.of());
    assertEquals(List.of(), violations(subject, transitive, parent, inverse, grandparent));
  }

  @Test
  void editingOnlyTheSubpropertyRefusesASimpleOnlyAncestorItWouldMakeNonSimple() {
    final var chained =
        property(PROPERTY, OntologyPropertyKind.OBJECT)
            .withPropertyChain(List.of(URI.create("urn:first"), URI.create("urn:second")))
            .withSuperProperties(List.of(URI.create("urn:parent")));
    final var parent =
        property(URI.create("urn:parent"), OntologyPropertyKind.OBJECT)
            .withDisjointWith(List.of(URI.create("urn:other")));
    final var other = property(URI.create("urn:other"), OntologyPropertyKind.OBJECT);
    final var first = property(URI.create("urn:first"), OntologyPropertyKind.OBJECT);
    final var second = property(URI.create("urn:second"), OntologyPropertyKind.OBJECT);
    final List<OntologyDefinition> model = List.of(chained, parent, other, first, second);
    final var thrown =
        assertThrows(
            OntologyValidationException.class,
            () -> OntologyStructureValidator.requireValidWorking(model, Set.of(chained.getId())));
    assertEquals(1, thrown.getError().getViolationCount());
    assertTrue(thrown.getMessage().contains("urn:parent"), thrown.getMessage());
    parent.setDisjointWith(List.of());
    OntologyStructureValidator.requireValidWorking(model, Set.of(chained.getId()));
  }

  /**
   * OWL 2 DL puts every chain element below the chain's superproperty and forbids placing a
   * property below one of its own subproperties; superproperty links alone never break the order.
   */
  @Test
  void aChainMustNotPlaceAPropertyBelowItsOwnSubproperty() {
    var first = property(URI.create("urn:first"), OntologyPropertyKind.OBJECT);
    var second = property(URI.create("urn:second"), OntologyPropertyKind.OBJECT);
    var composed =
        property(PROPERTY, OntologyPropertyKind.OBJECT)
            .withPropertyChain(List.of(first.getIri(), second.getIri()));
    first.setSuperProperties(List.of(PROPERTY));
    assertEquals(List.of(), violations(first, second, composed));
    first.setSuperProperties(List.of());
    composed.setSuperProperties(List.of(first.getIri()));
    assertEquals(
        List.of("PROPERTY_CHAIN_REGULARITY /propertyChain"), violations(first, second, composed));
    composed.setSuperProperties(List.of());
    var inverse = property(INVERSE, OntologyPropertyKind.OBJECT).withInverse(PROPERTY);
    composed.setInverse(INVERSE);
    second.setSuperProperties(List.of(INVERSE));
    assertEquals(List.of(), violations(first, second, composed, inverse));
    second.setSuperProperties(List.of());
    inverse.setSuperProperties(List.of(second.getIri()));
    assertEquals(
        List.of(
            "PROPERTY_CHAIN_REGULARITY /propertyChain",
            "PROPERTY_CHAIN_REGULARITY /superProperties"),
        sortedViolations(first, second, composed, inverse));
  }

  @Test
  void superpropertyLinksThroughAnInverseAreNotAChainCycle() {
    var left = property(URI.create("urn:left"), OntologyPropertyKind.OBJECT).withInverse(INVERSE);
    var inverse = property(INVERSE, OntologyPropertyKind.OBJECT).withInverse(left.getIri());
    var right =
        property(URI.create("urn:right"), OntologyPropertyKind.OBJECT)
            .withSuperProperties(List.of(INVERSE));
    left.setSuperProperties(List.of(right.getIri()));
    assertEquals(List.of(), violations(left, inverse, right));
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

  @Test
  void deletionImpactListsChildrenRelationshipsRulesAndBlockers() {
    final var animal = named(concept("Animal"), "Animal");
    final var dog = named(concept("Dog"), "Dog");
    final var cat = named(concept("Cat"), "Cat");
    final var plant = named(concept("Plant"), "Plant");
    final var dogIsAnimal = named(subclass(dog, animal), "dog-is-animal");
    final var catIsAnimal = named(subclass(cat, animal), "cat-is-animal");
    final var animalOwnsPlant = named(subclass(animal, plant), "animal-is-plant-ish");
    final var plantDisjointAnimal =
        named(subclass(plant, animal).withAxiomType(OntologyAxiomType.DISJOINT_WITH), "plant-vs");
    final var eats = named(property(URI.create("urn:eats"), OntologyPropertyKind.OBJECT), "eats");
    eats.withRange(List.of(animal.getIri()));

    final var impact =
        OntologyStructureValidator.deletionImpact(
            animal,
            List.of(
                animal,
                dog,
                cat,
                plant,
                dogIsAnimal,
                catIsAnimal,
                animalOwnsPlant,
                plantDisjointAnimal,
                eats));

    assertEquals(List.of("Cat", "Dog"), names(impact.getChildren()));
    assertEquals(
        List.of("animal-is-plant-ish", "cat-is-animal", "dog-is-animal"),
        names(impact.getRelationships()));
    assertEquals(List.of("plant-vs"), names(impact.getRules()));
    assertEquals(List.of("eats"), names(impact.getBlockers()));
  }

  @Test
  void deletionImpactIgnoresDefinitionsThatDoNotNameTheConcept() {
    final var animal = named(concept("Animal"), "Animal");
    final var dog = named(concept("Dog"), "Dog");
    final var plant = named(concept("Plant"), "Plant");
    final var impact =
        OntologyStructureValidator.deletionImpact(
            animal, List.of(animal, dog, plant, named(subclass(dog, plant), "dog-is-plant")));

    assertEquals(List.of(), impact.getChildren());
    assertEquals(List.of(), impact.getRelationships());
    assertEquals(List.of(), impact.getRules());
    assertEquals(List.of(), impact.getBlockers());
  }

  @Test
  void restrictionFillerIsARelationshipButNotAChild() {
    final var animal = named(concept("Animal"), "Animal");
    final var owner = named(concept("Owner"), "Owner");
    final var owns = URI.create("urn:owns");
    final var ownsAnimal =
        named(
            subclass(owner)
                .withExpressions(
                    List.of(
                        new OntologyExpression()
                            .withKind(OntologyExpressionKind.RESTRICTION)
                            .withRestrictionKind(OntologyRestrictionKind.SOME)
                            .withPropertyIri(owns)
                            .withFiller(
                                new OntologyExpression()
                                    .withKind(OntologyExpressionKind.NAMED_CLASS)
                                    .withClassIri(animal.getIri())))),
            "owner-owns-animal");

    final var impact =
        OntologyStructureValidator.deletionImpact(animal, List.of(animal, owner, ownsAnimal));

    assertEquals(List.of("owner-owns-animal"), names(impact.getRelationships()));
    assertEquals(List.of(), impact.getChildren());
  }

  @Test
  void removingTheListedAxiomsLeavesTheRestOfTheModelValid() {
    final var animal = named(concept("Animal"), "Animal");
    final var dog = named(concept("Dog"), "Dog");
    final var plant = named(concept("Plant"), "Plant");
    final var dogIsAnimal = named(subclass(dog, animal), "dog-is-animal");
    final var plantDisjointAnimal =
        named(subclass(plant, animal).withAxiomType(OntologyAxiomType.DISJOINT_WITH), "plant-vs");
    final List<OntologyDefinition> model = List.of(dog, plant, dogIsAnimal, plantDisjointAnimal);

    final var left =
        assertThrows(
            OntologyValidationException.class,
            () -> OntologyStructureValidator.requireValidWorking(model));
    assertEquals(2, left.getError().getViolationCount());

    final var impact =
        OntologyStructureValidator.deletionImpact(
            animal, List.of(animal, dog, plant, dogIsAnimal, plantDisjointAnimal));
    final var removed = new java.util.HashSet<UUID>();
    impact.getRelationships().forEach(reference -> removed.add(reference.getId()));
    impact.getRules().forEach(reference -> removed.add(reference.getId()));
    final var remaining = model.stream().filter(value -> !removed.contains(value.getId())).toList();

    assertEquals(List.of(dog, plant), remaining);
    OntologyStructureValidator.requireValidWorking(remaining);
  }

  private static List<String> names(List<EntityReference> references) {
    return references.stream().map(EntityReference::getName).toList();
  }

  private static <T extends OntologyDefinition> T named(T definition, String name) {
    definition.setName(name);
    return definition;
  }

  @Test
  void aClassDisjointWithItsAncestorIsAClashNamingBoth() {
    OntologyConcept animal = concept("Animal");
    OntologyConcept dog = concept("Dog");
    var report = validate(animal, dog, subclass(dog, animal), disjoint(dog, animal));
    assertFalse(report.getValid());
    assertEquals(1, report.getViolationCount());
    var issue = report.getViolations().getFirst();
    assertEquals(OntologyProfileViolationCode.DISJOINT_CLASH, issue.getViolation().getCode());
    assertEquals(
        "urn:class:Dog is disjoint with its ancestor urn:class:Animal",
        issue.getViolation().getMessage());
    assertEquals(dog.getId(), issue.getMemberId());
    assertEquals(List.of(dog.getId(), animal.getId()), issue.getViolation().getConceptIds());
  }

  @Test
  void validateDraftReportsOneClashRowWithBothConceptIds() {
    OntologyConcept animal = concept("Animal");
    OntologyConcept dog = concept("Dog");
    var report =
        OntologyStructureValidator.validateDraft(
            List.of(animal, dog, subclass(dog, animal), disjoint(dog, animal)));
    assertFalse(report.getValid());
    assertEquals(1, report.getViolations().size());
    var violation = report.getViolations().getFirst();
    assertEquals(OntologyProfileViolationCode.DISJOINT_CLASH, violation.getCode());
    assertEquals(List.of(dog.getId(), animal.getId()), violation.getConceptIds());
  }

  @Test
  void aClassUnderTwoDisjointAncestorsIsAClashAndTheDiamondReportsOnce() {
    OntologyConcept left = concept("Left");
    OntologyConcept right = concept("Right");
    OntologyConcept bottom = concept("Bottom");
    OntologyConcept below = concept("Below");
    var report =
        validate(
            left,
            right,
            bottom,
            below,
            subclass(bottom, left, right),
            subclass(below, bottom),
            disjoint(left, right));
    assertEquals(1, report.getViolationCount());
    var issue = report.getViolations().getFirst();
    assertEquals(bottom.getId(), issue.getMemberId());
    assertEquals(
        "urn:class:Bottom has disjoint ancestors urn:class:Left and urn:class:Right",
        issue.getViolation().getMessage());
    assertEquals(
        List.of(bottom.getId(), left.getId(), right.getId()), issue.getViolation().getConceptIds());
  }

  @Test
  void aTwoHundredLevelChainReportsTheClashOnceWithoutRecursing() {
    List<OntologyConcept> chain =
        IntStream.range(0, 200).mapToObj(level -> concept("Level" + level)).toList();
    List<OntologyDefinition> definitions = new ArrayList<>(chain);
    IntStream.range(1, 200)
        .forEach(level -> definitions.add(subclass(chain.get(level), chain.get(level - 1))));
    definitions.add(disjoint(chain.get(0), chain.get(199)));
    var report = validate(definitions.toArray(OntologyDefinition[]::new));
    assertEquals(1, report.getViolationCount());
    assertEquals(chain.get(199).getId(), report.getViolations().getFirst().getMemberId());
  }

  @Test
  void disjointnessBetweenUnrelatedClassesIsNotAClash() {
    OntologyConcept animal = concept("Animal");
    OntologyConcept plant = concept("Plant");
    OntologyConcept dog = concept("Dog");
    var report = validate(animal, plant, dog, subclass(dog, animal), disjoint(animal, plant));
    assertTrue(report.getValid());
    assertEquals(List.of(), report.getViolations());
  }

  @Test
  void workingValidationWarnsOnAClashWithoutBlockingTheSave() {
    OntologyConcept animal = concept("Animal");
    OntologyConcept dog = concept("Dog");
    var report =
        OntologyStructureValidator.validateWorking(
            List.of(animal, dog, subclass(dog, animal), disjoint(dog, animal)));
    assertTrue(report.getValid());
    assertEquals(1, report.getViolations().size());
    assertEquals(
        OntologyProfileViolationSeverity.WARNING, report.getViolations().getFirst().getSeverity());
    assertEquals(
        "urn:class:Dog is disjoint with its ancestor urn:class:Animal",
        report.getViolations().getFirst().getMessage());
    OntologyStructureValidator.requireValidWorking(
        List.of(animal, dog, subclass(dog, animal), disjoint(dog, animal)));
  }

  @Test
  void draftValidationReportsEveryClashAsAnErrorThatASingleSaveCouldNotSee() {
    OntologyConcept animal = concept("Animal");
    OntologyConcept plant = concept("Plant");
    OntologyConcept dog = concept("Dog");
    OntologyConcept puppy = concept("Puppy");
    var definitions =
        List.<OntologyDefinition>of(
            animal,
            plant,
            dog,
            puppy,
            subclass(puppy, dog),
            subclass(dog, plant),
            subclass(dog, animal),
            disjoint(animal, plant));
    var report = OntologyStructureValidator.validateDraft(definitions);
    assertFalse(report.getValid());
    assertEquals(1, report.getViolations().size());
    var clash = report.getViolations().getFirst();
    assertEquals(OntologyProfileViolationCode.DISJOINT_CLASH, clash.getCode());
    assertEquals(OntologyProfileViolationSeverity.ERROR, clash.getSeverity());
    assertEquals(
        "urn:class:Dog has disjoint ancestors urn:class:Animal and urn:class:Plant",
        clash.getMessage());
    assertEquals(List.of(dog.getId(), animal.getId(), plant.getId()), clash.getConceptIds());
    assertTrue(
        OntologyStructureValidator.validateDraft(List.of(animal, plant, dog, subclass(dog, animal)))
            .getValid());
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

  /** Sorted, because the report orders members by their generated ids. */
  private static List<String> sortedViolations(OntologyDefinition... definitions) {
    return violations(definitions).stream().sorted().toList();
  }

  /** Sorted, because the report orders members by their generated ids. */
  private static List<String> messages(OntologyDefinition... definitions) {
    return validate(definitions).getViolations().stream()
        .map(issue -> issue.getViolation().getMessage())
        .sorted()
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

  private static OntologyAxiom disjoint(OntologyConcept subject, OntologyConcept other) {
    return subclass(subject, other).withAxiomType(OntologyAxiomType.DISJOINT_WITH);
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
