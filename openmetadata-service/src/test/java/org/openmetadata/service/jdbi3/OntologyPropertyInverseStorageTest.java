package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.openmetadata.service.jdbi3.OntologyCaptureFixture.withCapture;

import java.net.URI;
import java.util.List;
import java.util.UUID;
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
              () -> rejected.delete("reviewer", partOf.getId(), false, true));

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
          final var values = List.of(new OntologyLiteral().withValue("1").withDatatypeIri(integer));
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
