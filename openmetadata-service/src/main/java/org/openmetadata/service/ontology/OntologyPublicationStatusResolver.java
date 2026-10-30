package org.openmetadata.service.ontology;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.OntologyActiveRelease;
import org.openmetadata.schema.type.OntologyLatestRelease;
import org.openmetadata.schema.type.OntologyPublicationStage;
import org.openmetadata.schema.type.OntologyPublicationStatus;
import org.openmetadata.schema.type.OntologyReviewLock;
import org.openmetadata.schema.type.OntologyReviewLockRelease;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityDAO;

/** Derives the publication status of a page of ontologies in a constant number of queries. */
public final class OntologyPublicationStatusResolver {
  private final CollectionDAO dao;
  private final OntologyReleaseRoles roles;
  private final OntologyUnpublishedChanges unpublished;

  public OntologyPublicationStatusResolver(final CollectionDAO dao) {
    this.dao = dao;
    roles = new OntologyReleaseRoles(dao);
    unpublished = new OntologyUnpublishedChanges(dao);
  }

  /** The stage table. Releases only ever reach these four statuses. */
  public static OntologyPublicationStage stage(final EntityStatus status, final boolean active) {
    return switch (status) {
      case DRAFT -> OntologyPublicationStage.DRAFT;
      case IN_REVIEW -> OntologyPublicationStage.IN_REVIEW;
      case REJECTED -> OntologyPublicationStage.CHANGES_REQUESTED;
      case APPROVED -> active
          ? OntologyPublicationStage.PUBLISHED
          : OntologyPublicationStage.APPROVED;
      default -> throw new IllegalStateException("An ontology release never reaches " + status);
    };
  }

  public static OntologyPublicationStatus assemble(
      final OntologyReleaseRoles.Roles roles,
      final Long activatedAt,
      final int unpublishedChanges) {
    final OntologyRelease active = roles.active();
    final OntologyRelease latest = roles.latest();
    final OntologyRelease inReview = roles.inReview();
    return new OntologyPublicationStatus()
        .withReviewLock(
            new OntologyReviewLock()
                .withInReview(
                    inReview == null
                        ? null
                        : new OntologyReviewLockRelease()
                            .withReleaseId(inReview.getId())
                            .withReleaseRevision(inReview.getReleaseRevision())
                            .withSemanticVersion(inReview.getSemanticVersion())))
        .withActive(
            active == null
                ? null
                : new OntologyActiveRelease()
                    .withReleaseId(active.getId())
                    .withReleaseRevision(active.getReleaseRevision())
                    .withSemanticVersion(active.getSemanticVersion())
                    .withActivatedAt(activatedAt))
        .withLatest(
            latest == null
                ? null
                : new OntologyLatestRelease()
                    .withReleaseId(latest.getId())
                    .withReleaseRevision(latest.getReleaseRevision())
                    .withSemanticVersion(latest.getSemanticVersion())
                    .withStage(
                        stage(
                            latest.getEntityStatus(),
                            active != null && active.getId().equals(latest.getId()))))
        .withUnpublishedChanges(unpublishedChanges);
  }

  public Map<UUID, OntologyPublicationStatus> resolve(final List<Ontology> ontologies) {
    final List<UUID> ids = ontologies.stream().map(Ontology::getId).distinct().toList();
    if (ids.isEmpty()) {
      return Map.of();
    }
    final Map<UUID, OntologyReleaseRoles.Roles> byOntology = roles.read(ids);
    final Map<UUID, Long> activatedAt = new HashMap<>();
    EntityDAO.queryInChunks(
            ids.stream().map(UUID::toString).toList(), dao.ontologyStateDAO()::listActivated)
        .forEach(row -> activatedAt.put(row.state().getOntologyId(), row.activatedAt()));
    final Map<UUID, UUID> activeRelease = new HashMap<>();
    ids.forEach(
        id -> {
          final OntologyRelease active =
              byOntology.getOrDefault(id, OntologyReleaseRoles.Roles.NONE).active();
          activeRelease.put(id, active == null ? null : active.getId());
        });
    final Map<UUID, Integer> counts = unpublished.count(activeRelease);
    final Map<UUID, OntologyPublicationStatus> statuses = new HashMap<>();
    ids.forEach(
        id ->
            statuses.put(
                id,
                assemble(
                    byOntology.getOrDefault(id, OntologyReleaseRoles.Roles.NONE),
                    activatedAt.get(id),
                    counts.getOrDefault(id, 0))));
    return statuses;
  }
}
