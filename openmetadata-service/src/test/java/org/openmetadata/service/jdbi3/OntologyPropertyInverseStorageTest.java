package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertAll;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.openmetadata.service.jdbi3.OntologyCaptureFixture.withCapture;

import java.net.URI;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.apache.jena.vocabulary.SKOS;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.schema.entity.data.OntologyProperty;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.OntologyLiteral;
import org.openmetadata.schema.type.OntologyPropertyKind;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

/** The reciprocity finalizer and the restore exception, at the repository, on both engines. */
class OntologyPropertyInverseStorageTest {
  /** Every order of three properties' ids, lowest first: a write applies its changes by id. */
  private static final List<List<String>> ID_ORDERS =
      List.of(
          List.of("hasPart", "partOf", "wholeOf"),
          List.of("hasPart", "wholeOf", "partOf"),
          List.of("partOf", "hasPart", "wholeOf"),
          List.of("partOf", "wholeOf", "hasPart"),
          List.of("wholeOf", "hasPart", "partOf"),
          List.of("wholeOf", "partOf", "hasPart"));

  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void rejectedDeletionRollsBackThePartnerUpdate(ConnectionType dialect) {
    withCapture(
        dialect,
        fixture -> {
          final var properties = new OntologyPropertyRepository();
          final var hasPart = properties.create(null, property(fixture, "hasPart"));
          final var partOf =
              properties.create(null, property(fixture, "partOf").withInverse(hasPart.getIri()));
          final long revision =
              fixture.ontologies.getState(fixture.ontology.getId()).getWorkingRevision();
          final var rejected =
              new OntologyPropertyRepository() {
                @Override
                protected void preDelete(final OntologyProperty property, final String deletedBy) {
                  super.preDelete(property, deletedBy);
                  throw new BadRequestException("Rejected delete");
                }
              };

          assertThrows(
              BadRequestException.class,
              () -> rejected.delete("admin", partOf.getId(), false, true));

          assertEquals(hasPart.getIri(), inverseOf(properties, partOf));
          final var partner = properties.find(hasPart.getId(), Include.NON_DELETED);
          assertEquals(partOf.getIri(), partner.getInverse());
          assertEquals("admin", partner.getUpdatedBy());
          assertEquals(
              revision, fixture.ontologies.getState(fixture.ontology.getId()).getWorkingRevision());
        });
  }

  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void nonObjectPropertiesRetainTheirMetadataWithoutInverseLinks(ConnectionType dialect) {
    withCapture(
        dialect,
        fixture -> {
          final var properties = new OntologyPropertyRepository();
          final var integer = URI.create("http://www.w3.org/2001/XMLSchema#integer");
          final var values =
              List.of(
                  new OntologyLiteral().withValue("1").withDatatypeIri(integer),
                  new OntologyLiteral().withValue("2").withDatatypeIri(integer));
          final var count =
              properties.create(
                  null,
                  property(fixture, "count")
                      .withKind(OntologyPropertyKind.DATA)
                      .withRange(List.of(integer))
                      .withEnumValues(values)
                      .withUnit("items")
                      .withIsIdentifier(true));
          final var stored = properties.find(count.getId(), Include.NON_DELETED);
          assertEquals(values, stored.getEnumValues());
          assertEquals("items", stored.getUnit());
          assertEquals(true, stored.getIsIdentifier());
          assertNull(stored.getInverse());

          final var note =
              properties.create(
                  null, property(fixture, "note").withKind(OntologyPropertyKind.ANNOTATION));
          assertEquals(
              OntologyPropertyKind.ANNOTATION,
              properties.find(note.getId(), Include.NON_DELETED).getKind());
          assertNull(inverseOf(properties, note));
        });
  }

  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void deleteClearsThePartnerAndRestoreRelinksOrDropsTheLink(ConnectionType dialect) {
    withCapture(
        dialect,
        fixture -> {
          final var properties = new OntologyPropertyRepository();
          final var hasPart = properties.create(null, property(fixture, "hasPart"));
          final var partOf =
              properties.create(null, property(fixture, "partOf").withInverse(hasPart.getIri()));
          assertEquals(partOf.getIri(), inverseOf(properties, hasPart));

          properties.delete("admin", partOf.getId(), false, false);
          assertNull(inverseOf(properties, hasPart));

          properties.restoreEntity("admin", partOf.getId());
          assertEquals(hasPart.getIri(), inverseOf(properties, partOf));
          assertEquals(partOf.getIri(), inverseOf(properties, hasPart));

          properties.delete("admin", partOf.getId(), false, false);
          properties.delete("admin", hasPart.getId(), false, false);
          assertNull(properties.restoreEntity("admin", partOf.getId()).getEntity().getInverse());
          assertNull(inverseOf(properties, partOf));
        });
  }

  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void restoringTheOntologyKeepsTheLinkBetweenItsProperties(ConnectionType dialect) {
    withCapture(
        dialect,
        fixture -> {
          final var properties = new OntologyPropertyRepository();
          final var hasPart = properties.create(null, property(fixture, "hasPart"));
          final var partOf =
              properties.create(null, property(fixture, "partOf").withInverse(hasPart.getIri()));

          fixture.ontologies.delete("admin", fixture.ontology.getId(), true, false);
          fixture.ontologies.restoreEntity("admin", fixture.ontology.getId());

          assertEquals(
              partOf.getIri(), properties.find(hasPart.getId(), Include.NON_DELETED).getInverse());
          assertEquals(
              hasPart.getIri(), properties.find(partOf.getId(), Include.NON_DELETED).getInverse());
        });
  }

  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void restoringTheOntologyDropsALinkItsPartnerNoLongerNamesBack(ConnectionType dialect) {
    withCapture(
        dialect,
        fixture -> {
          final var properties = new OntologyPropertyRepository();
          final Map<List<String>, Map<String, OntologyProperty>> cases = new LinkedHashMap<>();
          for (int i = 0; i < ID_ORDERS.size(); i++) {
            final List<String> idOrder = ID_ORDERS.get(i);
            final Map<String, UUID> idOf = idsByRank(idOrder);
            final var hasPart =
                properties.create(
                    null, property(fixture, "hasPart" + i).withId(idOf.get("hasPart")));
            final var partOf =
                properties.create(
                    null,
                    property(fixture, "partOf" + i)
                        .withId(idOf.get("partOf"))
                        .withInverse(hasPart.getIri()));
            properties.delete("admin", partOf.getId(), false, false);
            final var wholeOf =
                properties.create(
                    null,
                    property(fixture, "wholeOf" + i)
                        .withId(idOf.get("wholeOf"))
                        .withInverse(hasPart.getIri()));
            assertEquals(hasPart.getIri(), inverseOf(properties, partOf));
            cases.put(idOrder, Map.of("hasPart", hasPart, "partOf", partOf, "wholeOf", wholeOf));
          }

          fixture.ontologies.delete("admin", fixture.ontology.getId(), true, false);
          fixture.ontologies.restoreEntity("admin", fixture.ontology.getId());

          assertAll(
              cases.entrySet().stream()
                  .map(
                      restored ->
                          () ->
                              assertEquals(
                                  "hasPart -> wholeOf, partOf -> null, wholeOf -> hasPart",
                                  partners(properties, restored.getValue()),
                                  "ids ascending " + restored.getKey())));
        });
  }

  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void restoringTheOntologyDropsClaimsThatCompeteForALivePartner(ConnectionType dialect) {
    withCapture(
        dialect,
        fixture -> {
          final var properties = new OntologyPropertyRepository();
          final Map<List<String>, Map<String, OntologyProperty>> cases = new LinkedHashMap<>();
          for (int i = 0; i < ID_ORDERS.size(); i++) {
            final List<String> idOrder = ID_ORDERS.get(i);
            final Map<String, UUID> idOf = idsByRank(idOrder);
            final var hasPart =
                properties.create(
                    null, property(fixture, "hasPart" + i).withId(idOf.get("hasPart")));
            final var partOf =
                properties.create(
                    null,
                    property(fixture, "partOf" + i)
                        .withId(idOf.get("partOf"))
                        .withInverse(hasPart.getIri()));
            properties.delete("admin", partOf.getId(), false, false);
            final var wholeOf =
                properties.create(
                    null,
                    property(fixture, "wholeOf" + i)
                        .withId(idOf.get("wholeOf"))
                        .withInverse(hasPart.getIri()));
            properties.delete("admin", wholeOf.getId(), false, false);
            assertEquals(hasPart.getIri(), inverseOf(properties, partOf));
            assertEquals(hasPart.getIri(), inverseOf(properties, wholeOf));
            cases.put(idOrder, Map.of("hasPart", hasPart, "partOf", partOf, "wholeOf", wholeOf));
          }
          fixture.ontologies.delete("admin", fixture.ontology.getId(), true, false);
          for (final var restored : cases.values()) {
            assertNull(
                properties
                    .restoreEntity("admin", restored.get("hasPart").getId())
                    .getEntity()
                    .getInverse());
          }

          fixture.ontologies.restoreEntity("admin", fixture.ontology.getId());

          assertAll(
              cases.entrySet().stream()
                  .map(
                      restored ->
                          () ->
                              assertEquals(
                                  "hasPart -> null, partOf -> null, wholeOf -> null",
                                  partners(properties, restored.getValue()),
                                  "ids ascending " + restored.getKey())));
        });
  }

  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void restoringTheOntologyRelinksALoneClaimOnALivePartner(ConnectionType dialect) {
    withCapture(
        dialect,
        fixture -> {
          final var properties = new OntologyPropertyRepository();
          final var hasPart = properties.create(null, property(fixture, "hasPart"));
          final var partOf =
              properties.create(null, property(fixture, "partOf").withInverse(hasPart.getIri()));
          properties.delete("admin", partOf.getId(), false, false);
          fixture.ontologies.delete("admin", fixture.ontology.getId(), true, false);
          assertNull(properties.restoreEntity("admin", hasPart.getId()).getEntity().getInverse());

          fixture.ontologies.restoreEntity("admin", fixture.ontology.getId());

          assertEquals(
              "hasPart -> partOf, partOf -> hasPart",
              partners(properties, Map.of("hasPart", hasPart, "partOf", partOf)));
        });
  }

  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void restoringTheOntologyKeepsClaimsOnAVocabularyProperty(ConnectionType dialect) {
    withCapture(
        dialect,
        fixture -> {
          final var properties = new OntologyPropertyRepository();
          final var broader = URI.create(SKOS.broader.getURI());
          final var narrower =
              properties.create(null, property(fixture, "narrower").withInverse(broader));
          final var specializes =
              properties.create(null, property(fixture, "specializes").withInverse(broader));

          fixture.ontologies.delete("admin", fixture.ontology.getId(), true, false);
          fixture.ontologies.restoreEntity("admin", fixture.ontology.getId());

          assertAll(
              () -> assertEquals(broader, inverseOf(properties, narrower)),
              () -> assertEquals(broader, inverseOf(properties, specializes)));
        });
  }

  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void aSelfInverseSurvivesItsRestore(ConnectionType dialect) {
    withCapture(
        dialect,
        fixture -> {
          final var properties = new OntologyPropertyRepository();
          final var iri = URI.create(fixture.ontology.getNamespace() + "adjacentTo");
          final var adjacentTo =
              properties.create(
                  null, property(fixture, "adjacentTo").withIri(iri).withInverse(iri));
          assertEquals(iri, adjacentTo.getInverse());

          properties.delete("admin", adjacentTo.getId(), false, false);
          assertEquals(
              iri, properties.restoreEntity("admin", adjacentTo.getId()).getEntity().getInverse());
          assertEquals(iri, inverseOf(properties, adjacentTo));
        });
  }

  private static URI inverseOf(OntologyPropertyRepository properties, OntologyProperty property) {
    return properties.find(property.getId(), Include.ALL).getInverse();
  }

  /** Fresh ids for the named properties, the lowest to the first name. */
  private static Map<String, UUID> idsByRank(List<String> idOrder) {
    final List<UUID> ascending =
        Stream.generate(UUID::randomUUID).limit(idOrder.size()).sorted().toList();
    final Map<String, UUID> idOf = new HashMap<>();
    for (int rank = 0; rank < idOrder.size(); rank++) {
      idOf.put(idOrder.get(rank), ascending.get(rank));
    }
    return idOf;
  }

  /** Each live property's partner, named by role, in the roles' alphabetical order. */
  private static String partners(
      OntologyPropertyRepository properties, Map<String, OntologyProperty> byRole) {
    final Map<URI, String> roles = new HashMap<>();
    byRole.forEach((role, property) -> roles.put(property.getIri(), role));
    return byRole.keySet().stream()
        .sorted()
        .map(
            role -> {
              final URI inverse =
                  properties.find(byRole.get(role).getId(), Include.NON_DELETED).getInverse();
              return role + " -> " + roles.getOrDefault(inverse, String.valueOf(inverse));
            })
        .collect(Collectors.joining(", "));
  }

  private static OntologyProperty property(OntologyCaptureFixture.Fixture fixture, String name) {
    return new OntologyProperty()
        .withId(UUID.randomUUID())
        .withName(name)
        .withOntology(fixture.ontology.getEntityReference())
        .withKind(OntologyPropertyKind.OBJECT)
        .withVersion(0.1)
        .withUpdatedAt(1L)
        .withUpdatedBy("admin");
  }
}
