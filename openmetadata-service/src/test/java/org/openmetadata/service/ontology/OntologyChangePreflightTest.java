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

package org.openmetadata.service.ontology;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.ws.rs.BadRequestException;
import java.net.URI;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.entity.data.OntologyChangeSet;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.OntologyAxiomType;
import org.openmetadata.schema.type.OntologyChangeOperation;
import org.openmetadata.schema.type.OntologyChangeOperationType;
import org.openmetadata.schema.type.OntologyExpression;
import org.openmetadata.schema.type.OntologyExpressionKind;
import org.openmetadata.schema.type.OntologyPropertyKind;
import org.openmetadata.schema.type.OntologyRelationship;
import org.openmetadata.service.exception.EntityNotFoundException;

class OntologyChangePreflightTest {
  @Test
  void refusesAnImportedRelationshipWhoseNewConceptIsNotInTheChangeSet() {
    final URI account = URI.create("https://example.org/Account");
    final OntologyChangeOperation relationship = axiomNeeding(account);
    final OntologyChangePreflight preflight =
        new OntologyChangePreflight(
            (entityType, id) -> {
              throw new AssertionError("New definitions are not loaded");
            });

    final BadRequestException refusal =
        assertThrows(
            BadRequestException.class,
            () -> preflight.validate(nativeChangeSet(), List.of(relationship)));

    assertEquals(
        "Ontology operation '"
            + relationship.getId()
            + "' needs the concept https://example.org/Account, which is not part of this change set",
        refusal.getMessage());
  }

  @Test
  void acceptsAnImportedRelationshipWhenItsNewConceptIsApplied() {
    final URI account = URI.create("https://example.org/Account");
    final OntologyChangeOperation concept =
        new OntologyChangeOperation()
            .withId(UUID.randomUUID())
            .withOperationType(OntologyChangeOperationType.UPSERT_CONCEPT)
            .withConcept(new OntologyConcept().withId(UUID.randomUUID()).withIri(account));
    final OntologyChangePreflight preflight =
        new OntologyChangePreflight(
            (entityType, id) -> {
              throw new AssertionError("New definitions are not loaded");
            });

    assertDoesNotThrow(
        () -> preflight.validate(nativeChangeSet(), List.of(concept, axiomNeeding(account))));
  }

  @Test
  void derivesTheMissingConceptFromAnAxiomWhoseOperationOmitsRequiresConceptIris() {
    final OntologyChangeOperation axiom = axiomNeeding(URI.create("https://example.org/Account"));
    assertTrue(axiom.getRequiresConceptIris().isEmpty());

    final BadRequestException refusal =
        assertThrows(
            BadRequestException.class,
            () -> preflightWithoutConcepts().validate(nativeChangeSet(), List.of(axiom)));

    assertEquals(
        "Ontology operation '"
            + axiom.getId()
            + "' needs the concept https://example.org/Account, which is not part of this change set",
        refusal.getMessage());
  }

  @Test
  void derivesTheMissingConceptFromAPropertyDomainWhoseOperationOmitsRequiresConceptIris() {
    final OntologyChangeOperation property =
        propertyRanging(
            URI.create("https://example.org/Account"),
            URI.create("http://www.w3.org/2001/XMLSchema#string"));

    final BadRequestException refusal =
        assertThrows(
            BadRequestException.class,
            () -> preflightWithoutConcepts().validate(nativeChangeSet(), List.of(property)));

    assertEquals(
        "Ontology operation '"
            + property.getId()
            + "' needs the concept https://example.org/Account, which is not part of this change set",
        refusal.getMessage());
  }

  @Test
  void acceptsAnAxiomOnAConceptTheOntologyAlreadyDeclares() {
    final URI account = URI.create("https://example.org/Account");
    final UUID ontologyId = UUID.randomUUID();
    final OntologyChangeSet changeSet =
        new OntologyChangeSet()
            .withOntology(new EntityReference().withId(ontologyId).withType("ontology"));
    final OntologyChangePreflight preflight =
        new OntologyChangePreflight(
            (entityType, id) -> {
              throw new AssertionError("New definitions are not loaded");
            },
            (id, iris) -> id.equals(ontologyId) ? iris : Set.of());

    assertDoesNotThrow(() -> preflight.validate(changeSet, List.of(axiomNeeding(account))));
  }

  @Test
  void refusesAConceptTheOntologyDoesNotDeclareEvenWhenAnotherOneIsDeclared() {
    final OntologyChangeOperation axiom = axiomNeeding(URI.create("https://example.org/Account"));
    final OntologyChangePreflight preflight =
        new OntologyChangePreflight(
            (entityType, id) -> {
              throw new AssertionError("New definitions are not loaded");
            },
            (id, iris) -> Set.of("https://example.org/Other"));

    assertThrows(
        BadRequestException.class, () -> preflight.validate(nativeChangeSet(), List.of(axiom)));
  }

  @Test
  void acceptsAPropertyRangedOverAnXsdDatatypeAndDomainedOnACreatedConcept() {
    final URI account = URI.create("https://example.org/Account");
    final OntologyChangeOperation concept =
        new OntologyChangeOperation()
            .withId(UUID.randomUUID())
            .withOperationType(OntologyChangeOperationType.UPSERT_CONCEPT)
            .withConcept(new OntologyConcept().withId(UUID.randomUUID()).withIri(account));
    final OntologyChangeOperation property =
        propertyRanging(account, URI.create("http://www.w3.org/2001/XMLSchema#string"));

    assertDoesNotThrow(
        () -> preflightWithoutConcepts().validate(nativeChangeSet(), List.of(concept, property)));
  }

  private static OntologyChangePreflight preflightWithoutConcepts() {
    return new OntologyChangePreflight(
        (entityType, id) -> {
          throw new AssertionError("New definitions are not loaded");
        });
  }

  private static OntologyChangeSet nativeChangeSet() {
    return new OntologyChangeSet()
        .withOntology(new EntityReference().withId(UUID.randomUUID()).withType("ontology"));
  }

  private static OntologyChangeOperation axiomNeeding(final URI concept) {
    return new OntologyChangeOperation()
        .withId(UUID.randomUUID())
        .withOperationType(OntologyChangeOperationType.UPSERT_AXIOM)
        .withAxiom(
            new OntologyAxiom()
                .withId(UUID.randomUUID())
                .withAxiomType(OntologyAxiomType.SUBCLASS_OF)
                .withSubjectIri(concept));
  }

  private static OntologyChangeOperation propertyRanging(final URI domain, final URI range) {
    return new OntologyChangeOperation()
        .withId(UUID.randomUUID())
        .withOperationType(OntologyChangeOperationType.UPSERT_PROPERTY)
        .withProperty(
            new OntologyProperty()
                .withId(UUID.randomUUID())
                .withKind(OntologyPropertyKind.DATA)
                .withDomain(List.of(domain))
                .withRange(List.of(range)));
  }

  private static OntologyChangeOperation upsertAxiom(final OntologyAxiom axiom) {
    return new OntologyChangeOperation()
        .withId(UUID.randomUUID())
        .withOperationType(OntologyChangeOperationType.UPSERT_AXIOM)
        .withAxiom(axiom.withId(UUID.randomUUID()));
  }

  private static OntologyChangeOperation upsertProperty(final OntologyProperty property) {
    return new OntologyChangeOperation()
        .withId(UUID.randomUUID())
        .withOperationType(OntologyChangeOperationType.UPSERT_PROPERTY)
        .withProperty(property.withId(UUID.randomUUID()));
  }

  private static OntologyExpression namedClass(final String iri) {
    return new OntologyExpression()
        .withKind(OntologyExpressionKind.NAMED_CLASS)
        .withClassIri(URI.create(iri));
  }

  private static void assertNeedsConcept(
      final OntologyChangeOperation operation, final String iri) {
    final BadRequestException refusal =
        assertThrows(
            BadRequestException.class,
            () -> preflightWithoutConcepts().validate(nativeChangeSet(), List.of(operation)));
    assertEquals(
        "Ontology operation '"
            + operation.getId()
            + "' needs the concept "
            + iri
            + ", which is not part of this change set",
        refusal.getMessage());
  }

  private static final URI INDIVIDUAL = URI.create("https://example.org/i");

  private static OntologyChangeOperation hasValueAxiom(final List<URI> requires) {
    return upsertAxiom(
            new OntologyAxiom()
                .withAxiomType(OntologyAxiomType.SUBCLASS_OF)
                .withSubjectIri(URI.create("http://www.w3.org/2002/07/owl#Thing"))
                .withExpressions(
                    List.of(
                        new OntologyExpression()
                            .withKind(OntologyExpressionKind.RESTRICTION)
                            .withPropertyIri(URI.create("https://example.org/owns"))
                            .withIndividualIri(INDIVIDUAL))))
        .withRequiresConceptIris(requires);
  }

  private static OntologyChangeOperation upsertConcept(final URI iri) {
    return new OntologyChangeOperation()
        .withId(UUID.randomUUID())
        .withOperationType(OntologyChangeOperationType.UPSERT_CONCEPT)
        .withConcept(new OntologyConcept().withId(UUID.randomUUID()).withIri(iri));
  }

  @Test
  void refusesAValueRestrictionWhoseDeclaredIndividualIsNotInTheSet() {
    assertNeedsConcept(hasValueAxiom(List.of(INDIVIDUAL)), INDIVIDUAL.toString());
  }

  @Test
  void refusesAClassAssertionWhoseDeclaredIndividualIsNotInTheSet() {
    final OntologyChangeOperation assertion =
        upsertAxiom(
                new OntologyAxiom()
                    .withAxiomType(OntologyAxiomType.CLASS_ASSERTION)
                    .withSubjectIri(INDIVIDUAL)
                    .withExpressions(List.of(namedClass("http://www.w3.org/2002/07/owl#Thing"))))
            .withRequiresConceptIris(List.of(INDIVIDUAL));

    assertNeedsConcept(assertion, INDIVIDUAL.toString());
  }

  @Test
  void acceptsAValueRestrictionWhenTheSetCreatesItsDeclaredIndividual() {
    assertDoesNotThrow(
        () ->
            preflightWithoutConcepts()
                .validate(
                    nativeChangeSet(),
                    List.of(upsertConcept(INDIVIDUAL), hasValueAxiom(List.of(INDIVIDUAL)))));
  }

  @Test
  void acceptsAValueRestrictionWhenTheOntologyDeclaresItsIndividual() {
    final OntologyChangePreflight preflight =
        new OntologyChangePreflight(
            (entityType, id) -> {
              throw new AssertionError("New definitions are not loaded");
            },
            (id, iris) -> iris);

    assertDoesNotThrow(
        () -> preflight.validate(nativeChangeSet(), List.of(hasValueAxiom(List.of(INDIVIDUAL)))));
  }

  @Test
  void acceptsASubclassOfASkosClassWithoutAConceptForIt() {
    final OntologyChangeOperation term =
        upsertAxiom(
            new OntologyAxiom()
                .withAxiomType(OntologyAxiomType.SUBCLASS_OF)
                .withSubjectIri(URI.create("https://example.org/Term"))
                .withExpressions(
                    List.of(namedClass("http://www.w3.org/2004/02/skos/core#Concept"))));
    final OntologyChangeOperation created =
        new OntologyChangeOperation()
            .withId(UUID.randomUUID())
            .withOperationType(OntologyChangeOperationType.UPSERT_CONCEPT)
            .withConcept(
                new OntologyConcept()
                    .withId(UUID.randomUUID())
                    .withIri(URI.create("https://example.org/Term")));

    assertDoesNotThrow(
        () -> preflightWithoutConcepts().validate(nativeChangeSet(), List.of(created, term)));
  }

  @Test
  void acceptsAnAnnotationPropertyWhoseDomainIsNotAConcept() {
    final OntologyChangeOperation property =
        upsertProperty(
            new OntologyProperty()
                .withKind(OntologyPropertyKind.ANNOTATION)
                .withDomain(List.of(URI.create("https://example.org/NotAConcept"))));

    assertDoesNotThrow(
        () -> preflightWithoutConcepts().validate(nativeChangeSet(), List.of(property)));
  }

  @Test
  void acceptsAClassAssertionWhoseIndividualIsNotDeclared() {
    final OntologyChangeOperation assertion =
        upsertAxiom(
            new OntologyAxiom()
                .withAxiomType(OntologyAxiomType.CLASS_ASSERTION)
                .withSubjectIri(URI.create("https://example.org/someone"))
                .withTargetIri(URI.create("https://example.org/other"))
                .withExpressions(List.of(namedClass("http://www.w3.org/2002/07/owl#Thing"))));

    assertDoesNotThrow(
        () -> preflightWithoutConcepts().validate(nativeChangeSet(), List.of(assertion)));
  }

  @Test
  void refusesASubclassExpressionNamingADeselectedClass() {
    final OntologyChangeOperation axiom =
        upsertAxiom(
            new OntologyAxiom()
                .withAxiomType(OntologyAxiomType.SUBCLASS_OF)
                .withSubjectIri(URI.create("http://www.w3.org/2002/07/owl#Thing"))
                .withExpressions(
                    List.of(
                        new OntologyExpression()
                            .withKind(OntologyExpressionKind.INTERSECTION)
                            .withOperands(List.of(namedClass("https://example.org/Parent"))))));

    assertNeedsConcept(axiom, "https://example.org/Parent");
  }

  @Test
  void refusesANonAnnotationPropertyDomainNamingADeselectedClass() {
    final OntologyChangeOperation property =
        upsertProperty(
            new OntologyProperty()
                .withKind(OntologyPropertyKind.DATA)
                .withDomain(List.of(URI.create("https://example.org/Account"))));

    assertNeedsConcept(property, "https://example.org/Account");
  }

  @Test
  void refusesAnObjectPropertyRangeNamingADeselectedClass() {
    final OntologyChangeOperation property =
        upsertProperty(
            new OntologyProperty()
                .withKind(OntologyPropertyKind.OBJECT)
                .withRange(List.of(URI.create("https://example.org/Customer"))));

    assertNeedsConcept(property, "https://example.org/Customer");
  }

  @Test
  void acceptsADataRestrictionFillerNamingAnXsdDatatype() {
    final URI hasAge = URI.create("https://example.org/hasAge");
    final OntologyChangeOperation age =
        upsertProperty(new OntologyProperty().withKind(OntologyPropertyKind.DATA).withIri(hasAge));
    final OntologyChangeOperation axiom =
        upsertAxiom(
            new OntologyAxiom()
                .withAxiomType(OntologyAxiomType.SUBCLASS_OF)
                .withSubjectIri(URI.create("http://www.w3.org/2002/07/owl#Thing"))
                .withExpressions(
                    List.of(
                        new OntologyExpression()
                            .withKind(OntologyExpressionKind.RESTRICTION)
                            .withPropertyIri(hasAge)
                            .withFiller(namedClass("http://www.w3.org/2001/XMLSchema#integer")))));

    assertDoesNotThrow(
        () -> preflightWithoutConcepts().validate(nativeChangeSet(), List.of(age, axiom)));
  }

  @Test
  void rejectsAProposalWhoseSourceMemoryWasRetired() {
    final UUID glossaryId = UUID.randomUUID();
    final UUID memoryId = UUID.randomUUID();
    final OntologyChangeOperation proposal =
        createOperation(storedTerm(glossaryId, null)).withSourceMemoryIds(Set.of(memoryId));

    for (final ContextMemoryStatus status :
        List.of(ContextMemoryStatus.DEPRECATED, ContextMemoryStatus.REJECTED)) {
      final OntologyChangePreflight preflight =
          new OntologyChangePreflight(
              (entityType, id) -> new ContextMemory().withId(id).withEntityStatus(status));

      assertThrows(
          BadRequestException.class,
          () -> preflight.validate(changeSet(glossaryId), List.of(proposal)));
    }
  }

  @Test
  void acceptsAnOperationThatAnotherApprovedSourceStillGrounds() {
    final UUID glossaryId = UUID.randomUUID();
    final UUID retired = UUID.randomUUID();
    final UUID approved = UUID.randomUUID();
    final OntologyChangeOperation proposal =
        createOperation(storedTerm(glossaryId, null))
            .withSourceMemoryIds(Set.of(retired, approved));
    final OntologyChangePreflight preflight =
        new OntologyChangePreflight(
            (entityType, id) ->
                new ContextMemory()
                    .withId(id)
                    .withEntityStatus(
                        id.equals(retired)
                            ? ContextMemoryStatus.REJECTED
                            : ContextMemoryStatus.APPROVED));

    assertDoesNotThrow(() -> preflight.validate(changeSet(glossaryId), List.of(proposal)));
  }

  @Test
  void rejectsAProposalWhoseOnlySourceMemoryNoLongerExists() {
    final UUID glossaryId = UUID.randomUUID();
    final OntologyChangeOperation proposal =
        createOperation(storedTerm(glossaryId, null))
            .withSourceMemoryIds(Set.of(UUID.randomUUID()));
    final OntologyChangePreflight preflight =
        new OntologyChangePreflight(
            (entityType, id) -> {
              throw EntityNotFoundException.byMessage("contextMemory " + id + " not found");
            });

    assertThrows(
        BadRequestException.class,
        () -> preflight.validate(changeSet(glossaryId), List.of(proposal)));
  }

  @Test
  void acceptsScopedTargetAtExpectedVersion() {
    final UUID glossaryId = UUID.randomUUID();
    final GlossaryTerm stored = storedTerm(glossaryId, 0.3);
    final OntologyChangeOperation operation = updateOperation(stored, 0.3);
    final OntologyChangePreflight preflight =
        new OntologyChangePreflight((entityType, id) -> stored);

    assertDoesNotThrow(() -> preflight.validate(changeSet(glossaryId), List.of(operation)));
  }

  @Test
  void rejectsOutOfScopeAndStaleTargets() {
    final UUID glossaryId = UUID.randomUUID();
    final GlossaryTerm stored = storedTerm(UUID.randomUUID(), 0.4);
    final OntologyChangeOperation operation = updateOperation(stored, 0.3);
    final OntologyChangePreflight preflight =
        new OntologyChangePreflight((entityType, id) -> stored);

    assertThrows(
        BadRequestException.class,
        () -> preflight.validate(changeSet(glossaryId), List.of(operation)));

    stored.setGlossary(new EntityReference().withId(glossaryId));
    assertThrows(
        BadRequestException.class,
        () -> preflight.validate(changeSet(glossaryId), List.of(operation)));
  }

  @Test
  void acceptsRelationshipsBetweenTermsCreatedEarlierInTheSamePlan() {
    final UUID glossaryId = UUID.randomUUID();
    final GlossaryTerm source = storedTerm(glossaryId, null);
    final GlossaryTerm target = storedTerm(glossaryId, null);
    final OntologyChangeOperation createSource = createOperation(source);
    final OntologyChangeOperation createTarget = createOperation(target);
    final OntologyChangeOperation relationship = relationshipOperation(source, target);
    final OntologyChangePreflight preflight =
        new OntologyChangePreflight(
            (entityType, id) -> {
              throw new AssertionError("Planned terms must not be loaded from persistence");
            });

    assertDoesNotThrow(
        () ->
            preflight.validate(
                changeSet(glossaryId), List.of(createSource, createTarget, relationship)));
  }

  @Test
  void acceptsGlossaryAndTermCreatedInTheSamePlanWithoutLoadingEither() {
    final UUID glossaryId = UUID.randomUUID();
    final OntologyChangeOperation createGlossary =
        new OntologyChangeOperation()
            .withId(UUID.randomUUID())
            .withOperationType(OntologyChangeOperationType.CREATE_GLOSSARY)
            .withGlossary(new Glossary().withId(glossaryId));
    final OntologyChangeOperation createTerm = createOperation(storedTerm(glossaryId, null));
    final OntologyChangePreflight preflight =
        new OntologyChangePreflight(
            (entityType, id) -> {
              throw new AssertionError("Planned entities must not be loaded from persistence");
            });

    assertDoesNotThrow(
        () -> preflight.validate(changeSet(glossaryId), List.of(createGlossary, createTerm)));
  }

  @Test
  void rejectsConflictingBaseVersionsForOneStoredTarget() {
    final UUID glossaryId = UUID.randomUUID();
    final GlossaryTerm stored = storedTerm(glossaryId, 0.3);
    final OntologyChangeOperation first = updateOperation(stored, 0.3);
    final OntologyChangeOperation second = updateOperation(stored, 0.4);
    final OntologyChangePreflight preflight =
        new OntologyChangePreflight((entityType, id) -> stored);

    assertThrows(
        BadRequestException.class,
        () -> preflight.validate(changeSet(glossaryId), List.of(first, second)));
  }

  private static OntologyChangeSet changeSet(final UUID glossaryId) {
    return new OntologyChangeSet()
        .withGlossaries(List.of(new EntityReference().withId(glossaryId)));
  }

  private static OntologyChangeOperation createOperation(final GlossaryTerm term) {
    return new OntologyChangeOperation()
        .withId(UUID.randomUUID())
        .withOperationType(OntologyChangeOperationType.CREATE_TERM)
        .withTerm(term);
  }

  private static OntologyChangeOperation relationshipOperation(
      final GlossaryTerm source, final GlossaryTerm target) {
    final OntologyRelationship relationship =
        new OntologyRelationship()
            .withFromTerm(source.getEntityReference())
            .withToTerm(target.getEntityReference());
    return new OntologyChangeOperation()
        .withId(UUID.randomUUID())
        .withOperationType(OntologyChangeOperationType.ADD_RELATIONSHIP)
        .withTargetId(source.getId())
        .withRelationship(relationship);
  }

  private static OntologyChangeOperation updateOperation(
      final GlossaryTerm term, final double baseVersion) {
    return new OntologyChangeOperation()
        .withId(UUID.randomUUID())
        .withOperationType(OntologyChangeOperationType.UPDATE_TERM)
        .withTargetId(term.getId())
        .withBaseVersion(baseVersion)
        .withTerm(term);
  }

  private static GlossaryTerm storedTerm(final UUID glossaryId, final Double version) {
    return new GlossaryTerm()
        .withId(UUID.randomUUID())
        .withName("Customer")
        .withGlossary(new EntityReference().withId(glossaryId))
        .withVersion(version);
  }
}
