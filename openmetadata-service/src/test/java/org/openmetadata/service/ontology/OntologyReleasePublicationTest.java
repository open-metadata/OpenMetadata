package org.openmetadata.service.ontology;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.openmetadata.schema.api.data.CaptureOntologyRelease;
import org.openmetadata.schema.api.data.CaptureOntologyRelease.VersionBump;
import org.openmetadata.schema.type.OntologyState;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.exception.PreconditionFailedException;

class OntologyReleasePublicationTest {
  @ParameterizedTest
  @CsvSource({
    "0.0.0, major, 1.0.0",
    "0.0.0, minor, 0.1.0",
    "0.0.0, patch, 0.0.1",
    "1.2.3, major, 2.0.0",
    "1.2.3, minor, 1.3.0",
    "1.2.3, patch, 1.2.4",
    "1.9.9, minor, 1.10.0",
    "999999999999999999999.2.3, major, 1000000000000000000000.0.0"
  })
  void allocatesStrictSemanticVersions(String current, String bump, String expected) {
    assertEquals(
        expected, OntologyReleasePublication.nextVersion(current, VersionBump.fromValue(bump)));
  }

  @Test
  void firstMajorVersionStartsAtOne() {
    assertEquals("1.0.0", OntologyReleasePublication.nextVersion(null, VersionBump.MAJOR));
  }

  @Test
  void legacyRequestsDoNotNeedALatestReleaseFence() {
    assertDoesNotThrow(
        () -> OntologyReleasePublication.validate(new CaptureOntologyRelease(), state(12)));
  }

  @Test
  void versionedRequestsRequireTheObservedLatestReleaseRevision() {
    final var request = new CaptureOntologyRelease().withVersionBump(VersionBump.MINOR);
    assertThrows(
        BadRequestException.class, () -> OntologyReleasePublication.validate(request, state(12)));
    request.setExpectedLatestReleaseRevision(11L);
    assertThrows(
        PreconditionFailedException.class,
        () -> OntologyReleasePublication.validate(request, state(12)));
    request.setExpectedLatestReleaseRevision(12L);
    assertDoesNotThrow(() -> OntologyReleasePublication.validate(request, state(12)));
  }

  @Test
  void notesPreserveWhitespaceAtTheMaximumLength() {
    final String notes = " \n" + "n".repeat(16_380) + "\n ";
    final var request = new CaptureOntologyRelease().withReleaseNotes(notes);
    assertDoesNotThrow(() -> OntologyReleasePublication.validate(request, state(0)));
    assertEquals(notes, request.getReleaseNotes());
    request.setReleaseNotes(notes + "n");
    assertThrows(
        BadRequestException.class, () -> OntologyReleasePublication.validate(request, state(0)));
  }

  @ParameterizedTest
  @CsvSource({"01.2.3", "1.2", "1.2.3-preview", "-1.2.3", "1.2.3.4"})
  void failsClosedForInvalidStoredVersions(String current) {
    assertThrows(
        IllegalStateException.class,
        () -> OntologyReleasePublication.nextVersion(current, VersionBump.PATCH));
  }

  private static OntologyState state(long latest) {
    return new OntologyState().withLastReleaseRevision(latest);
  }
}
