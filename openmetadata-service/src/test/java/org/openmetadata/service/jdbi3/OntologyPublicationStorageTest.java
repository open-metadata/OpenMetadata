package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.openmetadata.service.jdbi3.OntologyCaptureFixture.withCapture;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.schema.api.data.CaptureOntologyRelease;
import org.openmetadata.schema.api.data.CaptureOntologyRelease.VersionBump;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.exception.PreconditionFailedException;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.ontology.OntologyReleaseCapture;
import org.openmetadata.service.ontology.OntologyReleaseHistory;

class OntologyPublicationStorageTest {
  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void rejectedCandidatesKeepTheirVersionAcrossLegacyCaptures(ConnectionType dialect) {
    withCapture(
        dialect,
        fixture -> {
          final String notes = " \nExact notes\t\n ";
          final var first =
              capture(
                  fixture,
                  request(fixture).withVersionBump(VersionBump.MAJOR).withReleaseNotes(notes));
          assertEquals("1.0.0", first.getSemanticVersion());
          assertEquals(
              notes, fixture.releases.getDao().findEntityById(first.getId()).getReleaseNotes());
          fixture.releases.getDao().update(first.withEntityStatus(EntityStatus.REJECTED));
          final var legacy = fixture.capture(ignored -> {});
          assertNull(legacy.getSemanticVersion());
          final var next = capture(fixture, request(fixture).withVersionBump(VersionBump.MINOR));
          assertEquals("1.1.0", next.getSemanticVersion());
          assertEquals(3L, next.getReleaseRevision());
          assertEquals(first.getContentDigest(), next.getContentDigest());
          assertEquals(first.getContentDigest(), legacy.getContentDigest());
        });
  }

  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void staleLatestRevisionCannotAllocateAnotherVersion(ConnectionType dialect) {
    withCapture(
        dialect,
        fixture -> {
          final var stale = request(fixture).withVersionBump(VersionBump.MAJOR);
          capture(fixture, stale);
          assertThrows(PreconditionFailedException.class, () -> capture(fixture, stale));
          assertEquals(
              1L, fixture.ontologies.getState(fixture.ontology.getId()).getLastReleaseRevision());
          assertEquals(1, fixture.rowCount("ontology_release_entity"));
          assertEquals(1, fixture.rowCount("ontology_release_event"));
        });
  }

  @ParameterizedTest
  @EnumSource(
      value = ConnectionType.class,
      names = {"MYSQL", "POSTGRES"})
  void chronologicalPagesKeepTheOriginalHighWaterAndNumericOrder(ConnectionType dialect) {
    withCapture(
        dialect,
        fixture -> {
          for (int index = 0; index < 12; index++) {
            fixture.capture(ignored -> {});
          }
          final var first =
              new OntologyReleaseHistory(fixture.releases.getDaoCollection().ontologyReleaseDAO())
                  .list(fixture.ontology.getId(), 5, null);
          assertEquals(
              List.of(12L, 11L, 10L, 9L, 8L),
              first.getData().stream().map(OntologyRelease::getReleaseRevision).toList());
          fixture.capture(ignored -> {});
          final var second =
              new OntologyReleaseHistory(fixture.releases.getDaoCollection().ontologyReleaseDAO())
                  .list(fixture.ontology.getId(), 5, first.getPaging().getAfter());
          assertEquals(12, second.getPaging().getTotal());
          assertEquals(
              List.of(7L, 6L, 5L, 4L, 3L),
              second.getData().stream().map(OntologyRelease::getReleaseRevision).toList());
          final var third =
              new OntologyReleaseHistory(fixture.releases.getDaoCollection().ontologyReleaseDAO())
                  .list(fixture.ontology.getId(), 5, second.getPaging().getAfter());
          assertEquals(
              List.of(2L, 1L),
              third.getData().stream().map(OntologyRelease::getReleaseRevision).toList());
          assertNull(third.getPaging().getAfter());
          assertThrows(
              BadRequestException.class,
              () ->
                  new OntologyReleaseHistory(
                          fixture.releases.getDaoCollection().ontologyReleaseDAO())
                      .list(UUID.randomUUID(), 5, first.getPaging().getAfter()));
          assertThrows(
              BadRequestException.class,
              () ->
                  new OntologyReleaseHistory(
                          fixture.releases.getDaoCollection().ontologyReleaseDAO())
                      .list(fixture.ontology.getId(), 101, null));
        });
  }

  private static CaptureOntologyRelease request(OntologyCaptureFixture.Fixture fixture) {
    final var state = fixture.ontologies.getState(fixture.ontology.getId());
    return new CaptureOntologyRelease()
        .withExpectedWorkingRevision(state.getWorkingRevision())
        .withExpectedLatestReleaseRevision(state.getLastReleaseRevision());
  }

  private static OntologyRelease capture(
      OntologyCaptureFixture.Fixture fixture, CaptureOntologyRelease request) {
    return fixture.capture.capture(
        fixture.ontology.getId(),
        request,
        new OntologyReleaseCapture.Access("admin", ignored -> {}));
  }
}
