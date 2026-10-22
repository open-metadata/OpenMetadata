package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.function.Executable;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateOntologyAxiom;
import org.openmetadata.schema.api.data.CreateOntologyConcept;
import org.openmetadata.schema.api.data.CreateOntologyProperty;
import org.openmetadata.schema.api.data.OntologyWorkingDiff;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyConcept;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.type.OntologyAxiomType;
import org.openmetadata.schema.type.OntologyConceptChange;
import org.openmetadata.schema.type.OntologyConceptType;
import org.openmetadata.schema.type.OntologyExpression;
import org.openmetadata.schema.type.OntologyExpressionKind;
import org.openmetadata.schema.type.OntologyLiteral;
import org.openmetadata.schema.type.OntologyPropertyKind;
import org.openmetadata.schema.type.OntologyReleaseMember.MemberKind;
import org.openmetadata.schema.type.OntologyReleaseMemberChange;
import org.openmetadata.schema.type.RelationProvenance;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;

@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class IndependentOntologyClassModelIT extends BaseOntologyApprovalIT {
  private static final URI SOURCE = URI.create("https://standards.example.org/payments#transfer");
  private static final String ENUMERATION_MINIMUM =
      "An enumeration needs at least two allowed values";
  private static final String REPLACEMENT =
      "A replacement must be another definition of the same kind in this ontology";

  @Test
  void classAndPropertyFieldsRoundTripAndDefaultToUnset(TestNamespace ns) {
    final Ontology ontology = createOntology(ns);
    final var concepts = SdkClients.adminClient().ontologyConcepts();
    final OntologyConcept account = concept(ontology, "Account");
    assertEquals(Boolean.FALSE, account.getAbstract());
    assertEquals(Boolean.FALSE, account.getDeprecated());
    assertNull(account.getDefinitionSource());
    assertNull(account.getReplacedBy());

    final OntologyConcept customer =
        concepts.create(
            conceptRequest(ontology, "Customer")
                .withAbstract(true)
                .withDefinitionSource(SOURCE)
                .withDeprecated(true)
                .withReplacedBy(account.getIri()));
    final OntologyConcept stored = concepts.get(customer.getId().toString());
    assertEquals(Boolean.TRUE, stored.getAbstract());
    assertEquals(SOURCE, stored.getDefinitionSource());
    assertEquals(Boolean.TRUE, stored.getDeprecated());
    assertEquals(account.getIri(), stored.getReplacedBy());

    concepts.update(
        stored.getId(),
        stored
            .withAbstract(false)
            .withDefinitionSource(null)
            .withDeprecated(false)
            .withReplacedBy(null));
    final OntologyConcept restored = concepts.get(customer.getId().toString());
    assertEquals(Boolean.FALSE, restored.getAbstract());
    assertNull(restored.getDefinitionSource());
    assertEquals(Boolean.FALSE, restored.getDeprecated());
    assertNull(restored.getReplacedBy());

    final var properties = SdkClients.adminClient().ontologyProperties();
    final OntologyProperty identifier = property(ontology, "identifier", account);
    assertEquals(Boolean.FALSE, identifier.getDeprecated());
    assertNull(identifier.getReplacedBy());
    final OntologyProperty code =
        properties.create(
            propertyRequest(ontology, "code", account)
                .withDeprecated(true)
                .withReplacedBy(identifier.getIri()));
    final OntologyProperty storedCode = properties.get(code.getId().toString());
    assertEquals(Boolean.TRUE, storedCode.getDeprecated());
    assertEquals(identifier.getIri(), storedCode.getReplacedBy());
  }

  @Test
  void anEnumerationNeedsAtLeastTwoAllowedValues(TestNamespace ns) {
    final Ontology ontology = createOntology(ns);
    final var properties = SdkClients.adminClient().ontologyProperties();
    final var gold = new OntologyLiteral().withValue("Gold");
    final var silver = new OntologyLiteral().withValue("Silver");
    final CreateOntologyProperty request =
        new CreateOntologyProperty()
            .withOntology(ontology.getFullyQualifiedName())
            .withName("tier")
            .withKind(OntologyPropertyKind.DATA)
            .withEnumValues(List.of(gold));
    assertRefused(400, ENUMERATION_MINIMUM, () -> properties.create(request));

    final OntologyProperty created =
        properties.create(request.withEnumValues(List.of(gold, silver)));
    assertEquals(List.of(gold, silver), created.getEnumValues());
    final OntologyProperty stored = properties.get(created.getId().toString());
    assertRefused(
        400,
        ENUMERATION_MINIMUM,
        () -> properties.update(stored.getId(), stored.withEnumValues(List.of(silver))));
    assertEquals(List.of(gold, silver), properties.get(created.getId().toString()).getEnumValues());
  }

  @Test
  void aStoredOneValueEnumerationStaysEditableUntilItsValuesChange(TestNamespace ns) {
    final Ontology ontology = createOntology(ns);
    final var properties = SdkClients.adminClient().ontologyProperties();
    final var gold = new OntologyLiteral().withValue("Gold");
    final var silver = new OntologyLiteral().withValue("Silver");
    final OntologyProperty created =
        properties.create(
            new CreateOntologyProperty()
                .withOntology(ontology.getFullyQualifiedName())
                .withName("tier")
                .withKind(OntologyPropertyKind.DATA)
                .withEnumValues(List.of(gold, silver)));
    final OntologyProperty legacy =
        properties.get(created.getId().toString()).withEnumValues(List.of(gold));
    Entity.getCollectionDAO().ontologyPropertyDAO().update(legacy);
    EntityRepository.invalidateCacheForEntity(
        Entity.ONTOLOGY_PROPERTY, legacy.getId(), legacy.getFullyQualifiedName());

    final OntologyProperty stored = properties.get(created.getId().toString());
    assertEquals(List.of(gold), stored.getEnumValues());
    properties.update(stored.getId(), stored.withDescription("Still editable"));
    final OntologyProperty edited = properties.get(created.getId().toString());
    assertEquals("Still editable", edited.getDescription());
    assertEquals(List.of(gold), edited.getEnumValues());
    assertRefused(
        400,
        ENUMERATION_MINIMUM,
        () -> properties.update(edited.getId(), edited.withEnumValues(List.of(silver))));
  }

  @Test
  void aReplacementMustBeTheSameKindInTheSameOntology(TestNamespace ns) {
    final Ontology ontology = createOntology(ns);
    final Ontology other = createOntology(ns, "otherOntology");
    final OntologyConcept foreign = concept(other, "Foreign");
    final OntologyProperty foreignProperty = property(other, "foreignCode", foreign);
    final OntologyConcept account = concept(ontology, "Account");
    final OntologyProperty code = property(ontology, "code", account);
    final var client = SdkClients.adminClient();

    for (final URI replacement : List.of(foreign.getIri(), code.getIri())) {
      assertRefused(
          400,
          REPLACEMENT,
          () ->
              client
                  .ontologyConcepts()
                  .create(conceptRequest(ontology, "Customer").withReplacedBy(replacement)));
    }
    for (final URI replacement : List.of(foreignProperty.getIri(), account.getIri())) {
      assertRefused(
          400,
          REPLACEMENT,
          () ->
              client
                  .ontologyProperties()
                  .create(
                      propertyRequest(ontology, "number", account).withReplacedBy(replacement)));
    }

    final OntologyConcept customer =
        client
            .ontologyConcepts()
            .create(conceptRequest(ontology, "Customer").withReplacedBy(account.getIri()));
    assertRefused(400, REPLACEMENT, () -> client.ontologyConcepts().delete(account.getId()));
    assertEquals(
        account.getIri(),
        client.ontologyConcepts().get(customer.getId().toString()).getReplacedBy());
  }

  @Test
  void deprecatingAPublishedClassIsReportedAsDeprecated(TestNamespace ns) {
    final Ontology ontology = createOntology(ns);
    final OntologyConcept party = concept(ontology, "Party");
    final OntologyConcept customer = concept(ontology, "Customer");
    final OntologyConcept account = concept(ontology, "Account");
    subclass(ontology, customer, party);
    property(ontology, "code", customer);
    final OntologyRelease published = activate(ns, ontology);
    final var client = SdkClients.adminClient();
    client
        .ontologyConcepts()
        .update(customer.getId(), customer.withDeprecated(true).withReplacedBy(account.getIri()));

    assertEquals(
        List.of(customer.getId() + " DEPRECATED"),
        client.ontologies().workingDiff(ontology.getId(), 10, null).getData().stream()
            .map(IndependentOntologyClassModelIT::describe)
            .toList());
    final OntologyWorkingDiff grouped = groupedDiff(ontology, 10, null);
    assertEquals(List.of(), grouped.getData());
    assertEquals(1, grouped.getPaging().getTotal());
    final OntologyConceptChange row = grouped.getGroups().getFirst();
    assertEquals("Customer", row.getConcept());
    assertEquals(customer.getIri(), row.getIri());
    assertEquals("DEPRECATED", row.getChangeType().value());
    assertEquals(List.of("Party"), row.getParents());
    assertEquals(1, row.getPropertyCount());
    assertEquals(
        List.of(customer.getId() + " DEPRECATED"),
        row.getChanges().stream().map(IndependentOntologyClassModelIT::describe).toList());

    final OntologyRelease next = capture(ontology);
    assertEquals(
        List.of(customer.getId() + " DEPRECATED"),
        client.ontologyReleases().diff(next.getId(), published.getId(), 10, null).getData().stream()
            .map(IndependentOntologyClassModelIT::describe)
            .toList());
  }

  @Test
  void groupedDiffPagesByConceptAndBindsItsCursorToTheRevision(TestNamespace ns) {
    final Ontology ontology = createOntology(ns);
    final OntologyConcept alpha = concept(ontology, "Alpha");
    final OntologyConcept bravo = concept(ontology, "Bravo");
    concept(ontology, "Charlie");
    subclass(ontology, bravo, alpha);
    property(ontology, "alphaCode", alpha);
    property(ontology, "sharedCode", alpha, bravo);

    final OntologyWorkingDiff first = groupedDiff(ontology, 2, null);
    assertEquals(4, first.getPaging().getTotal());
    assertEquals(List.of("Alpha", "Bravo"), labels(first));
    assertEquals(List.of(List.of(), List.of("Alpha")), parents(first));
    assertEquals(List.of(2, 1), propertyCounts(first));
    assertEquals(
        List.of(
            List.of(MemberKind.CONCEPT, MemberKind.PROPERTY, MemberKind.PROPERTY),
            List.of(MemberKind.CONCEPT, MemberKind.AXIOM)),
        memberKinds(first));
    final String after = first.getPaging().getAfter();
    assertFalse(after == null || after.isBlank());

    final OntologyWorkingDiff second = groupedDiff(ontology, 2, after);
    assertEquals(Arrays.asList("Charlie", null), labels(second));
    assertEquals(
        List.of(List.of(MemberKind.CONCEPT), List.of(MemberKind.ONTOLOGY)), memberKinds(second));
    assertNull(second.getPaging().getAfter());

    final var client = SdkClients.adminClient();
    final String plainCursor =
        client.ontologies().workingDiff(ontology.getId(), 1, null).getPaging().getAfter();
    assertRefused(400, "Invalid cursor", () -> groupedDiff(ontology, 2, plainCursor));
    assertRefused(
        400, "Invalid cursor", () -> client.ontologies().workingDiff(ontology.getId(), 2, after));
    assertRefused(400, "Invalid groupBy", () -> diff(ontology, "property", 2, null));

    concept(ontology, "Delta");
    assertRefused(412, "Ontology changed", () -> groupedDiff(ontology, 2, after));
  }

  private static void assertRefused(int status, String message, Executable call) {
    final var failure = assertThrows(OpenMetadataException.class, call);
    assertEquals(status, failure.getStatusCode());
    assertTrue(failure.getMessage().contains(message), failure.getMessage());
  }

  private static OntologyWorkingDiff groupedDiff(Ontology ontology, int limit, String after) {
    return diff(ontology, "concept", limit, after);
  }

  private static OntologyWorkingDiff diff(
      Ontology ontology, String groupBy, int limit, String after) {
    final var options =
        RequestOptions.builder()
            .queryParam("groupBy", groupBy)
            .queryParam("limit", Integer.toString(limit));
    if (after != null) {
      options.queryParam("after", after);
    }
    return SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.GET,
            "/v1/ontologies/" + ontology.getId() + "/working/diff",
            null,
            OntologyWorkingDiff.class,
            options.build());
  }

  private static String describe(OntologyReleaseMemberChange change) {
    return change.getEntity().getId() + " " + change.getChangeType().value();
  }

  private static List<String> labels(OntologyWorkingDiff diff) {
    return diff.getGroups().stream().map(OntologyConceptChange::getConcept).toList();
  }

  private static List<List<String>> parents(OntologyWorkingDiff diff) {
    return diff.getGroups().stream().map(OntologyConceptChange::getParents).toList();
  }

  private static List<Integer> propertyCounts(OntologyWorkingDiff diff) {
    return diff.getGroups().stream().map(OntologyConceptChange::getPropertyCount).toList();
  }

  private static List<List<MemberKind>> memberKinds(OntologyWorkingDiff diff) {
    return diff.getGroups().stream()
        .map(
            row ->
                row.getChanges().stream()
                    .map(OntologyReleaseMemberChange::getMemberKind)
                    .sorted()
                    .toList())
        .toList();
  }

  private static CreateOntologyConcept conceptRequest(Ontology ontology, String name) {
    return new CreateOntologyConcept()
        .withOntology(ontology.getFullyQualifiedName())
        .withName(name)
        .withConceptType(OntologyConceptType.OWL_CLASS);
  }

  private static OntologyConcept concept(Ontology ontology, String name) {
    return SdkClients.adminClient().ontologyConcepts().create(conceptRequest(ontology, name));
  }

  private static CreateOntologyProperty propertyRequest(
      Ontology ontology, String name, OntologyConcept... domain) {
    return new CreateOntologyProperty()
        .withOntology(ontology.getFullyQualifiedName())
        .withName(name)
        .withKind(OntologyPropertyKind.OBJECT)
        .withDomain(Arrays.stream(domain).map(OntologyConcept::getIri).toList());
  }

  private static OntologyProperty property(
      Ontology ontology, String name, OntologyConcept... domain) {
    return SdkClients.adminClient()
        .ontologyProperties()
        .create(propertyRequest(ontology, name, domain));
  }

  private static void subclass(Ontology ontology, OntologyConcept child, OntologyConcept parent) {
    SdkClients.adminClient()
        .ontologyAxioms()
        .create(
            new CreateOntologyAxiom()
                .withName(child.getName() + "Is" + parent.getName() + UUID.randomUUID())
                .withDisplayName("Subclass")
                .withDescription("A named subclass assertion")
                .withOntology(ontology.getFullyQualifiedName())
                .withAxiomType(OntologyAxiomType.SUBCLASS_OF)
                .withProvenance(RelationProvenance.MANUAL)
                .withSubjectIri(child.getIri())
                .withExpressions(
                    List.of(
                        new OntologyExpression()
                            .withKind(OntologyExpressionKind.NAMED_CLASS)
                            .withClassIri(parent.getIri()))));
  }
}
