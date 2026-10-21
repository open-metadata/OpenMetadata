package org.openmetadata.service.ontology;

import java.math.BigInteger;
import java.util.Objects;
import java.util.regex.Pattern;
import org.openmetadata.schema.api.data.CaptureOntologyRelease;
import org.openmetadata.schema.api.data.CaptureOntologyRelease.VersionBump;
import org.openmetadata.schema.type.OntologyState;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.exception.PreconditionFailedException;

final class OntologyReleasePublication {
  private static final int MAX_NOTES_LENGTH = 16_384;
  private static final Pattern VERSION =
      Pattern.compile("(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)");

  private OntologyReleasePublication() {}

  static void validate(final CaptureOntologyRelease request, final OntologyState state) {
    if (request.getReleaseNotes() != null
        && request.getReleaseNotes().length() > MAX_NOTES_LENGTH) {
      throw new BadRequestException("Ontology release notes exceed the 16384 character limit");
    }
    if (request.getVersionBump() != null && request.getExpectedLatestReleaseRevision() == null) {
      throw new BadRequestException("A semantic version bump requires the latest release revision");
    }
    if (request.getExpectedLatestReleaseRevision() != null
        && !Objects.equals(
            request.getExpectedLatestReleaseRevision(), state.getLastReleaseRevision())) {
      throw new PreconditionFailedException("Ontology releases changed; reload before capture");
    }
  }

  static String nextVersion(final String latest, final VersionBump bump) {
    final var matcher = VERSION.matcher(latest == null ? "0.0.0" : latest);
    if (!matcher.matches()) {
      throw new IllegalStateException(
          "The latest ontology release has an invalid semantic version");
    }
    final var major = new BigInteger(matcher.group(1));
    final var minor = new BigInteger(matcher.group(2));
    final var patch = new BigInteger(matcher.group(3));
    return switch (bump) {
      case MAJOR -> major.add(BigInteger.ONE) + ".0.0";
      case MINOR -> major + "." + minor.add(BigInteger.ONE) + ".0";
      case PATCH -> major + "." + minor + "." + patch.add(BigInteger.ONE);
    };
  }
}
