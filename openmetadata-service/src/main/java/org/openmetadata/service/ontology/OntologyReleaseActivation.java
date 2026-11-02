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
import org.openmetadata.service.jdbi3.OntologyRepository;
import org.openmetadata.service.rdf.OntologyActiveGraph;
import org.openmetadata.service.util.FreshReadScope;

/** Commits the active pointer, audit evidence and projection outbox as one module transaction. */
public final class OntologyReleaseActivation {
  private final OntologyRepository ontologies;
  private final CollectionDAO dao;
  private final Clock clock;
  private final Consumer<UUID> enqueue;

  public record Access(String user, Consumer<List<? extends OntologyDefinition>> authorize) {}

  public OntologyReleaseActivation(
      final OntologyRepository ontologies, final Clock clock, final Consumer<UUID> enqueue) {
    this.ontologies = ontologies;
    this.dao = ontologies.getDaoCollection();
    this.clock = clock;
    this.enqueue = enqueue;
  }

  public OntologyState activate(
      final UUID ontologyId, final ActivateOntologyRelease request, final Access access) {
    final var release = dao.ontologyReleaseDAO().findEntityById(request.getReleaseId());
    requireApprovedOwner(ontologyId, release);
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
    final var releases = dao.ontologyReleaseDAO();
    final var release =
        releases.jsonToEntity(
            releases.findJsonByIdForUpdate(request.getReleaseId(), Include.NON_DELETED),
            request.getReleaseId());
    requireApprovedOwner(ontologyId, release);
    return commit(previous, release, access.user());
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

  private static void requireApprovedOwner(final UUID ontologyId, final OntologyRelease release) {
    if (!ontologyId.equals(release.getOntology().getId())
        || release.getSealedAt() == null
        || release.getEntityStatus() != EntityStatus.APPROVED) {
      throw new BadRequestException(
          "Activation requires an approved, sealed release of this ontology");
    }
  }
}
