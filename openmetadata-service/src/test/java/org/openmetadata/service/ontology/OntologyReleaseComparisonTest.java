package org.openmetadata.service.ontology;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.OntologyDefinition;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.OntologyAxiomType;
import org.openmetadata.schema.type.OntologyConceptChange;
import org.openmetadata.schema.type.OntologyConceptType;
import org.openmetadata.schema.type.OntologyExpression;
import org.openmetadata.schema.type.OntologyExpressionKind;
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

  @Test
  void turningDeprecationOnIsReportedAsDeprecated() {
    final var concept = concept();
    final var property = property("code");
    assertEquals(
        List.of(OntologyReleaseChangeType.DEPRECATED, OntologyReleaseChangeType.DEPRECATED),
        changeTypes(
            List.of(concept, property),
            List.of(
                JsonUtils.deepCopy(concept, OntologyConcept.class).withDeprecated(true),
                JsonUtils.deepCopy(property, OntologyProperty.class).withDeprecated(true))));
  }

  @Test
  void editingOrRestoringADeprecatedDefinitionIsAChange() {
    final var deprecated = concept().withDeprecated(true);
    assertEquals(
        List.of(OntologyReleaseChangeType.CHANGED),
        changeTypes(
            List.of(deprecated),
            List.of(
                JsonUtils.deepCopy(deprecated, OntologyConcept.class).withDescription("Revised"))));
    assertEquals(
        List.of(OntologyReleaseChangeType.CHANGED),
        changeTypes(
            List.of(deprecated),
            List.of(JsonUtils.deepCopy(deprecated, OntologyConcept.class).withDeprecated(false))));
  }

  @Test
  void conceptRowsGatherTheirAxiomsAndPropertiesUnderLabelledParents() {
    final var party = concept("Party").withDisplayName("Business party");
    final var customer = concept("Customer");
    final var customerIsParty = subclass("Customer", "Party");
    final var code = property("code", "Customer");
    assertEquals(
        List.of(
            "Account ADDED [] 1 [CONCEPT:Account:ADDED, PROPERTY:number:ADDED]",
            "Customer DEPRECATED [Business party] 2 [CONCEPT:Customer:DEPRECATED, PROPERTY:code:CHANGED]",
            "null ADDED [] 0 [AXIOM:External-Party:ADDED]"),
        grouped(
            List.of(party, customer, customerIsParty, code),
            List.of(
                party,
                JsonUtils.deepCopy(customer, OntologyConcept.class).withDeprecated(true),
                customerIsParty,
                JsonUtils.deepCopy(code, OntologyProperty.class).withDescription("Revised"),
                concept("Account"),
                property("number", "Account", "Customer"),
                subclass("External", "Party"))));
  }

  @Test
  void aRemovedConceptKeepsItsLastLabelAndAnAxiomOnlyEditIsAChange() {
    final var party = concept("Party");
    final var legacy = concept("Legacy");
    final var customer = concept("Customer");
    assertEquals(
        List.of(
            "Customer CHANGED [Party] 0 [AXIOM:Customer-Party:ADDED]",
            "Legacy REMOVED [Party] 0 [AXIOM:Legacy-Party:REMOVED, CONCEPT:Legacy:REMOVED]"),
        grouped(
            List.of(party, legacy, subclass("Legacy", "Party"), customer),
            List.of(party, customer, subclass("Customer", "Party"))));
  }

  private static List<OntologyReleaseChangeType> changeTypes(
      final List<OntologyDefinition> before, final List<OntologyDefinition> after) {
    return OntologyReleaseComparison.compareMembers(
            before.stream().map(entity -> member(BASE_ID, entity)).toList(),
            after.stream().map(entity -> member(RELEASE_ID, entity)).toList())
        .stream()
        .map(change -> change.getChangeType())
        .toList();
  }

  private static List<String> grouped(
      final List<OntologyDefinition> before, final List<OntologyDefinition> after) {
    return OntologyConceptChanges.group(
            index(before),
            index(after),
            OntologyReleaseComparison.compareMembers(
                before.stream().map(entity -> member(BASE_ID, entity)).toList(),
                after.stream().map(entity -> member(RELEASE_ID, entity)).toList()))
        .stream()
        .map(OntologyReleaseComparisonTest::describe)
        .toList();
  }

  private static Map<String, OntologyDefinition> index(final List<OntologyDefinition> definitions) {
    return definitions.stream()
        .collect(
            Collectors.toMap(
                entity -> OntologyReleaseComparison.key(kind(entity), entity.getId()),
                entity -> entity));
  }

  private static String describe(final OntologyConceptChange row) {
    return String.join(
        " ",
        String.valueOf(row.getConcept()),
        row.getChangeType().toString(),
        row.getParents().toString(),
        row.getPropertyCount().toString(),
        row.getChanges().stream()
            .map(
                change ->
                    change.getMemberKind()
                        + ":"
                        + change.getEntity().getName()
                        + ":"
                        + change.getChangeType())
            .toList()
            .toString());
  }

  private static OntologyConcept concept(final String name) {
    return concept()
        .withName(name)
        .withFullyQualifiedName("Sales." + name)
        .withIri(URI.create("urn:" + name));
  }

  private static OntologyProperty property(final String name, final String... domain) {
    return new OntologyProperty()
        .withId(UUID.randomUUID())
        .withName(name)
        .withFullyQualifiedName("Sales." + name)
        .withIri(URI.create("urn:" + name))
        .withOntology(new EntityReference().withId(ONTOLOGY_ID).withType("ontology"))
        .withKind(OntologyPropertyKind.OBJECT)
        .withDomain(Stream.of(domain).map(iri -> URI.create("urn:" + iri)).toList());
  }

  private static OntologyAxiom subclass(final String child, final String parent) {
    return new OntologyAxiom()
        .withId(UUID.randomUUID())
        .withName(child + "-" + parent)
        .withFullyQualifiedName("Sales." + child + "-" + parent)
        .withOntology(new EntityReference().withId(ONTOLOGY_ID).withType("ontology"))
        .withAxiomType(OntologyAxiomType.SUBCLASS_OF)
        .withSubjectIri(URI.create("urn:" + child))
        .withExpressions(
            List.of(
                new OntologyExpression()
                    .withKind(OntologyExpressionKind.NAMED_CLASS)
                    .withClassIri(URI.create("urn:" + parent))));
  }

  private static MemberKind kind(final OntologyDefinition entity) {
    return switch (entity) {
      case OntologyProperty ignored -> MemberKind.PROPERTY;
      case OntologyAxiom ignored -> MemberKind.AXIOM;
      default -> MemberKind.CONCEPT;
    };
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
        releaseId, kind(entity), entity.getId(), JsonUtils.getObjectMapper().valueToTree(entity));
  }
}
