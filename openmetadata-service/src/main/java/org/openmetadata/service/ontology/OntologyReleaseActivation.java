package org.openmetadata.service.ontology;

import jakarta.ws.rs.ClientErrorException;
import jakarta.ws.rs.core.Response;
import java.time.Clock;
import java.util.List;
import java.util.UUID;
import java.util.function.Consumer;
import org.openmetadata.schema.OntologyDefinition;
import org.openmetadata.schema.api.data.ActivateOntologyRelease;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.OntologyReleaseEvent;
import org.openmetadata.schema.type.OntologyState;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.OntologyReleaseRepository;
import org.openmetadata.service.jdbi3.OntologyRepository;
import org.openmetadata.service.rdf.OntologyActiveGraph;
import org.openmetadata.service.util.FreshReadScope;

/** Commits the active pointer, audit evidence and projection outbox as one module transaction. */
public final class OntologyReleaseActivation {
  private final OntologyRepository ontologies;
  private final OntologyReleaseRepository releases;
  private final CollectionDAO dao;
  private final Clock clock;
  private final Consumer<UUID> enqueue;

  public record Access(String user, Consumer<List<? extends OntologyDefinition>> authorize) {}

  public OntologyReleaseActivation(
      final OntologyRepository ontologies,
      final OntologyReleaseRepository releases,
      final Clock clock,
      final Consumer<UUID> enqueue) {
    this.ontologies = ontologies;
    this.releases = releases;
    this.dao = ontologies.getDaoCollection();
    this.clock = clock;
    this.enqueue = enqueue;
  }

  public OntologyState activate(
      final UUID ontologyId, final ActivateOntologyRelease request, final Access access) {
    final var release = dao.ontologyReleaseDAO().findEntityById(request.getReleaseId());
    if (release.getEntityStatus() == EntityStatus.DRAFT) {
      requireOwnedSealed(ontologyId, release);
    } else {
      requireApprovedOwner(ontologyId, release);
    }
    final var members = new OntologyReleaseReader(dao).read(release, access.authorize());
    OntologyStructureValidator.requireValid(release, members);
    OntologyActiveGraph.requireProjectable(release, members);
    return ontologies.executeInTransaction(
        () -> {
          try (FreshReadScope.Handle ignored = FreshReadScope.enter()) {
            return activateLocked(ontologyId, request, access);
          }
        });
  }

  private OntologyState activateLocked(
      final UUID ontologyId, final ActivateOntologyRelease request, final Access access) {
    dao.ontologyStateDAO().initialize(ontologyId);
    final var previous = dao.ontologyStateDAO().lock(ontologyId);
    final var roots = dao.ontologyEntityDAO();
    roots.jsonToEntity(roots.findJsonByIdForUpdate(ontologyId, Include.NON_DELETED), ontologyId);
    requireExpectedRevision(previous, request);
    final var releaseDao = dao.ontologyReleaseDAO();
    var release =
        releaseDao.jsonToEntity(
            releaseDao.findJsonByIdForUpdate(request.getReleaseId(), Include.NON_DELETED),
            request.getReleaseId());
    if (release.getId().equals(previous.getActiveReleaseId())) {
      return previous;
    }
    OntologyReleasePublication.requireUnpublishedVersion(dao, ontologyId, release);
    if (release.getEntityStatus() == EntityStatus.DRAFT) {
      release = publishWithoutReview(ontologyId, release, access.user());
    }
    requireApprovedOwner(ontologyId, release);
    return commit(previous, release, access.user());
  }

  /**
   * An ontology without reviewers has nobody to ask, so an author with edit rights approves its
   * Draft by publishing it. Reviewers are read under the state lock that reviewer changes also
   * take, so a reviewer added after capture sends the Draft to review instead.
   */
  private OntologyRelease publishWithoutReview(
      final UUID ontologyId, final OntologyRelease draft, final String user) {
    requireOwnedSealed(ontologyId, draft);
    if (draft.getReviewTask() != null) {
      throw new BadRequestException(
          "Activation requires an approved, sealed release of this ontology");
    }
    if (ontologies.hasReviewers(ontologyId)) {
      throw new ClientErrorException(
          "Reviewers are configured. Request a review.", Response.Status.CONFLICT);
    }
    ontologies
        .findOpenReview(ontologyId)
        .ifPresent(
            open -> {
              throw new ClientErrorException(
                  "Ontology release "
                      + open.getName()
                      + " already has an open review; close it before publishing",
                  Response.Status.CONFLICT);
            });
    return releases.approveWithoutReview(draft, user, clock.millis());
  }

  private OntologyState commit(
      final OntologyState previous, final OntologyRelease release, final String user) {
    if (dao.ontologyStateDAO()
            .activate(previous.getOntologyId(), release.getId(), previous.getActivationRevision())
        != 1) {
      throw new ClientErrorException(
          "Ontology activation changed; reload its state", Response.Status.CONFLICT);
    }
    final var active = dao.ontologyStateDAO().get(previous.getOntologyId());
    dao.ontologyReleaseDAO()
        .appendEvent(
            new OntologyReleaseEvent()
                .withId(UUID.randomUUID())
                .withOntologyId(previous.getOntologyId())
                .withReleaseId(release.getId())
                .withEventType(OntologyReleaseEvent.EventType.ACTIVATED)
                .withCreatedAt(clock.millis())
                .withCreatedBy(user)
                .withContentDigest(release.getContentDigest())
                .withActivationRevision(active.getActivationRevision())
                .withPreviousReleaseId(previous.getActiveReleaseId()));
    // The enqueue fence is acquired last so its order matches the activation commit order.
    enqueue.accept(previous.getOntologyId());
    return active;
  }

  private static void requireExpectedRevision(
      final OntologyState state, final ActivateOntologyRelease request) {
    if (request.getExpectedActivationRevision() == null
        || request.getExpectedActivationRevision().longValue() != state.getActivationRevision()) {
      throw new ClientErrorException(
          "Ontology activation changed; reload its state", Response.Status.CONFLICT);
    }
  }

  private static void requireOwnedSealed(final UUID ontologyId, final OntologyRelease release) {
    if (!ontologyId.equals(release.getOntology().getId()) || release.getSealedAt() == null) {
      throw new BadRequestException(
          "Activation requires an approved, sealed release of this ontology");
    }
  }

  private static void requireApprovedOwner(final UUID ontologyId, final OntologyRelease release) {
    if (!ontologyId.equals(release.getOntology().getId())
        || release.getSealedAt() == null
        || release.getEntityStatus() != EntityStatus.APPROVED) {
      throw new BadRequestException(
          "Activation requires an approved, sealed release of this ontology");
    }
  }
}
