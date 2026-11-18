package org.openmetadata.service.ontology;

import jakarta.ws.rs.ClientErrorException;
import jakarta.ws.rs.core.Response;
import java.math.BigInteger;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import org.openmetadata.schema.api.data.CaptureOntologyRelease;
import org.openmetadata.schema.api.data.CaptureOntologyRelease.VersionBump;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.type.OntologyState;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.exception.PreconditionFailedException;
import org.openmetadata.service.jdbi3.CollectionDAO;

final class OntologyReleasePublication {
  private static final int MAX_NOTES_LENGTH = 16_384;
  private static final Pattern VERSION =
      Pattern.compile("(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)\\.(0|[1-9][0-9]*)");

  private OntologyReleasePublication() {}

  static void validate(final CaptureOntologyRelease request, final OntologyState state) {
    validateRequest(request);
    requireLatestRevision(request, state);
  }

  static void validateRequest(final CaptureOntologyRelease request) {
    if (request.getReleaseNotes() != null
        && request.getReleaseNotes().length() > MAX_NOTES_LENGTH) {
      throw new BadRequestException("Ontology release notes exceed the 16384 character limit");
    }
    if (request.getVersionBump() != null && request.getExpectedLatestReleaseRevision() == null) {
      throw new BadRequestException("A semantic version bump requires the latest release revision");
    }
  }

  /**
   * Checked after draft reuse: a second session holding the pre-capture revision is asking for the
   * draft the first one just sealed, not for a competing version.
   */
  static void requireLatestRevision(
      final CaptureOntologyRelease request, final OntologyState state) {
    if (request.getExpectedLatestReleaseRevision() != null
        && !Objects.equals(
            request.getExpectedLatestReleaseRevision(), state.getLastReleaseRevision())) {
      throw new PreconditionFailedException("Ontology releases changed; reload before capture");
    }
  }

  /**
   * Releases of the ontology that were activated at least once. A rollback leaves the newer
   * release's version taken, so reuse is judged on every activation ever made, not on the active
   * release alone.
   */
  private static List<OntologyRelease> published(final CollectionDAO dao, final UUID ontologyId) {
    return dao.ontologyReleaseDAO().listPublished(ontologyId).stream()
        .map(json -> JsonUtils.readValue(json, OntologyRelease.class))
        .toList();
  }

  static Set<String> publishedVersions(final CollectionDAO dao, final UUID ontologyId) {
    return published(dao, ontologyId).stream()
        .map(OntologyRelease::getSemanticVersion)
        .filter(Objects::nonNull)
        .collect(Collectors.toSet());
  }

  static void requireUnpublishedVersion(
      final CollectionDAO dao, final UUID ontologyId, final OntologyRelease release) {
    final String version = release.getSemanticVersion();
    final boolean taken =
        version != null
            && published(dao, ontologyId).stream()
                .anyMatch(
                    other ->
                        !other.getId().equals(release.getId())
                            && version.equals(other.getSemanticVersion()));
    if (taken) {
      throw new ClientErrorException(
          "Version "
              + version
              + " is already published by another release of this ontology. "
              + "Capture again with an unused version.",
          Response.Status.CONFLICT);
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
