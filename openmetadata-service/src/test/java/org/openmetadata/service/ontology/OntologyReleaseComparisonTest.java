package org.openmetadata.service.ontology;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.util.Collections;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.OntologyDefinition;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.OntologyConceptType;
import org.openmetadata.schema.type.OntologyPropertyKind;
import org.openmetadata.schema.type.OntologyReleaseChangeType;
import org.openmetadata.schema.type.OntologyReleaseMember;
import org.openmetadata.schema.type.OntologyReleaseMember.MemberKind;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.BadRequestException;

class OntologyReleaseComparisonTest {
  private static final UUID ONTOLOGY_ID = UUID.randomUUID();
  private static final UUID BASE_ID = UUID.randomUUID();
  private static final UUID RELEASE_ID = UUID.randomUUID();

  @Test
  void operationalChangesAndReferenceDisplayFieldsDoNotChangeGovernedContent() {
    final var before = concept();
    final var after =
        JsonUtils.deepCopy(before, OntologyConcept.class)
            .withVersion(0.8)
            .withUpdatedBy("reviewer")
            .withUpdatedAt(20L);
    after.getOntology().withName("Hydrated owner").withHref(URI.create("https://catalog/owner"));
    assertTrue(
        OntologyReleaseComparison.compareMembers(
                List.of(member(BASE_ID, before)), List.of(member(RELEASE_ID, after)))
            .isEmpty());
  }

  @Test
  void changedMeaningRetainsBothSnapshotAddresses() {
    final var before = concept();
    final var after = JsonUtils.deepCopy(before, OntologyConcept.class).withDescription("Revised");
    final var changes =
        OntologyReleaseComparison.compareMembers(
            List.of(member(BASE_ID, before)), List.of(member(RELEASE_ID, after)));
    assertEquals(1, changes.size());
    final var change = changes.getFirst();
    assertEquals(OntologyReleaseChangeType.CHANGED, change.getChangeType());
    assertEquals(BASE_ID, change.getBeforeReleaseId());
    assertEquals(RELEASE_ID, change.getAfterReleaseId());
    assertEquals(before.getId(), change.getEntity().getId());
    assertEquals(ONTOLOGY_ID, change.getOntologyId());
    assertNull(change.getEntity().getDescription());
  }

  @Test
  void replacementUnderTheSameNameAndIriIsAnAdditionAndRemoval() {
    final var before = concept();
    final var after = JsonUtils.deepCopy(before, OntologyConcept.class).withId(UUID.randomUUID());
    final var changes =
        OntologyReleaseComparison.compareMembers(
            List.of(member(BASE_ID, before)), List.of(member(RELEASE_ID, after)));
    assertEquals(2, changes.size());
    final var removed =
        changes.stream()
            .filter(change -> change.getEntity().getId().equals(before.getId()))
            .findFirst()
            .orElseThrow();
    assertEquals(OntologyReleaseChangeType.REMOVED, removed.getChangeType());
    assertNull(removed.getAfterReleaseId());
    final var added =
        changes.stream()
            .filter(change -> change.getEntity().getId().equals(after.getId()))
            .findFirst()
            .orElseThrow();
    assertEquals(OntologyReleaseChangeType.ADDED, added.getChangeType());
    assertNull(added.getBeforeReleaseId());
  }

  @Test
  void exactIriSpellingAndOrderedPropertyChainsRemainSignificant() {
    final var before = concept().withIri(URI.create("HTTPS://EXAMPLE.org/Customer"));
    final var after =
        JsonUtils.deepCopy(before, OntologyConcept.class)
            .withIri(URI.create("https://example.org/Customer"));
    assertEquals(
        1,
        OntologyReleaseComparison.compareMembers(
                List.of(member(BASE_ID, before)), List.of(member(RELEASE_ID, after)))
            .size());
    final var property =
        new OntologyProperty()
            .withId(UUID.randomUUID())
            .withName("chain")
            .withOntology(before.getOntology())
            .withKind(OntologyPropertyKind.OBJECT)
            .withPropertyChain(List.of(URI.create("urn:first"), URI.create("urn:second")));
    final var reordered =
        JsonUtils.deepCopy(property, OntologyProperty.class)
            .withPropertyChain(property.getPropertyChain().reversed());
    assertEquals(
        1,
        OntologyReleaseComparison.compareMembers(
                List.of(member(BASE_ID, property)), List.of(member(RELEASE_ID, reordered)))
            .size());
  }

  @Test
  void memberKindDisambiguatesIdentityAndOrderingDoesNotDependOnInputOrder() {
    final var concept = concept();
    final var property =
        new OntologyProperty()
            .withId(concept.getId())
            .withName("property")
            .withOntology(concept.getOntology());
    final var first = member(RELEASE_ID, concept);
    final var second = member(RELEASE_ID, property);
    final var changes = OntologyReleaseComparison.compareMembers(List.of(), List.of(second, first));
    assertEquals(
        List.of(MemberKind.CONCEPT, MemberKind.PROPERTY),
        changes.stream().map(change -> change.getMemberKind()).toList());
    assertEquals(
        changes, OntologyReleaseComparison.compareMembers(List.of(), List.of(first, second)));
  }

  @Test
  void duplicateIdentityAndOversizedClosuresAreRejected() {
    final var member = member(RELEASE_ID, concept());
    assertThrows(
        BadRequestException.class,
        () -> OntologyReleaseComparison.compareMembers(List.of(), List.of(member, member)));
    assertThrows(
        BadRequestException.class,
        () ->
            OntologyReleaseComparison.compareMembers(
                List.of(), Collections.nCopies(10_001, member)));
  }

  private static OntologyConcept concept() {
    return new OntologyConcept()
        .withId(UUID.randomUUID())
        .withName("Customer")
        .withFullyQualifiedName("Sales.Customer")
        .withIri(URI.create("urn:Customer"))
        .withOntology(new EntityReference().withId(ONTOLOGY_ID).withType("ontology"))
        .withConceptType(OntologyConceptType.OWL_CLASS)
        .withVersion(0.1)
        .withUpdatedAt(1L)
        .withUpdatedBy("author");
  }

  private static OntologyReleaseMember member(UUID releaseId, OntologyDefinition entity) {
    return OntologyReleaseManifest.member(
        releaseId,
        entity instanceof OntologyProperty ? MemberKind.PROPERTY : MemberKind.CONCEPT,
        entity.getId(),
        JsonUtils.getObjectMapper().valueToTree(entity));
  }
}
