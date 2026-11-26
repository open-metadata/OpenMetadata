package org.openmetadata.service.ontology;

import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.OntologyReleaseDAO.RoleCandidate;

/**
 * Which sealed release plays which role for each ontology of a page. One statement serves the
 * whole page, whatever its size.
 */
public final class OntologyReleaseRoles {
  /** Each release is null when the ontology has none in that role. */
  public record Roles(
      OntologyRelease active,
      OntologyRelease latest,
      OntologyRelease latestApproved,
      OntologyRelease inReview) {
    public static final Roles NONE = new Roles(null, null, null, null);

    /** The releases whose membership decides a definition's status. */
    public List<OntologyRelease> deciding() {
      return Stream.of(active, latestApproved, inReview).filter(Objects::nonNull).toList();
    }
  }

  private final CollectionDAO dao;

  public OntologyReleaseRoles(final CollectionDAO dao) {
    this.dao = dao;
  }

  public Map<UUID, Roles> read(final Collection<UUID> ontologyIds) {
    final List<String> ids = ontologyIds.stream().distinct().map(UUID::toString).toList();
    if (ids.isEmpty()) {
      return Map.of();
    }
    final Map<String, List<RoleCandidate>> byOntology =
        EntityDAO.queryInChunks(ids, dao.ontologyReleaseDAO()::listRoleCandidates).stream()
            .collect(Collectors.groupingBy(RoleCandidate::ontologyId));
    final Map<UUID, Roles> roles = new HashMap<>();
    byOntology.forEach((ontologyId, rows) -> roles.put(UUID.fromString(ontologyId), roles(rows)));
    return roles;
  }

  private static Roles roles(final List<RoleCandidate> rows) {
    final String activeId = rows.getFirst().activeReleaseId();
    final Map<UUID, OntologyRelease> releases = new HashMap<>();
    rows.forEach(
        row -> {
          final OntologyRelease release = JsonUtils.readValue(row.json(), OntologyRelease.class);
          releases.putIfAbsent(release.getId(), release);
        });
    return new Roles(
        activeId == null ? null : releases.get(UUID.fromString(activeId)),
        newest(releases, null),
        newest(releases, EntityStatus.APPROVED),
        newest(releases, EntityStatus.IN_REVIEW));
  }

  private static OntologyRelease newest(
      final Map<UUID, OntologyRelease> releases, final EntityStatus status) {
    return releases.values().stream()
        .filter(release -> status == null || release.getEntityStatus() == status)
        .max(Comparator.comparingLong(OntologyRelease::getReleaseRevision))
        .orElse(null);
  }
}
