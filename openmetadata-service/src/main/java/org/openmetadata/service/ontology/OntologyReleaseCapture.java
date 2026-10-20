package org.openmetadata.service.ontology;

import java.net.URI;
import java.time.Clock;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Consumer;
import org.openmetadata.schema.OntologyDefinition;
import org.openmetadata.schema.api.data.CaptureOntologyRelease;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.OntologyReleaseMember;
import org.openmetadata.schema.type.OntologyReleaseMember.MemberKind;
import org.openmetadata.schema.type.OntologyState;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.exception.PreconditionFailedException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.OntologyEntityRepository;
import org.openmetadata.service.jdbi3.OntologyReleaseRepository;
import org.openmetadata.service.jdbi3.OntologyRepository;
import org.openmetadata.service.util.FreshReadScope;
import org.openmetadata.service.util.FullyQualifiedName;

/** Captures bounded working content while holding the same module lock as its writers. */
public final class OntologyReleaseCapture {
  private static final int PAGE_SIZE = 100;
  private static final Duration CAPTURE_TIMEOUT = Duration.ofSeconds(30);
  private final CollectionDAO dao;
  private final OntologyReleaseRepository releases;
  private final OntologyRepository ontologies;
  private final Map<MemberKind, OntologyEntityRepository<?>> definitions;
  private final Clock clock;

  public record Access(String user, Consumer<List<? extends OntologyDefinition>> authorize) {}

  public OntologyReleaseCapture(
      final OntologyReleaseRepository releases,
      final OntologyRepository ontologies,
      final Map<MemberKind, OntologyEntityRepository<?>> definitions,
      final Clock clock) {
    this.releases = releases;
    this.dao = releases.getDaoCollection();
    this.ontologies = ontologies;
    this.definitions = Map.copyOf(definitions);
    this.clock = clock;
  }

  public OntologyRelease capture(
      final UUID ontologyId, final CaptureOntologyRelease request, final Access access) {
    return ontologies.executeInTransaction(
        () -> {
          try (FreshReadScope.Handle ignored = FreshReadScope.enter()) {
            return captureLocked(ontologyId, request, access);
          }
        });
  }

  private OntologyRelease captureLocked(
      final UUID ontologyId, final CaptureOntologyRelease request, final Access access) {
    dao.ontologyStateDAO().initialize(ontologyId);
    final OntologyState state = dao.ontologyStateDAO().lock(ontologyId);
    if (request.getExpectedWorkingRevision() == null
        || request.getExpectedWorkingRevision().longValue() != state.getWorkingRevision()) {
      throw new PreconditionFailedException(
          "Ontology changed; reload its working revision before capture");
    }
    final Ontology ontology =
        ontologies.get(
            null, ontologyId, ontologies.getFields("owners,reviewers"), Include.NON_DELETED, false);
    final OntologyRelease release = header(ontology, state, access.user());
    final Members members = new Members(release.getId(), access);
    access.authorize().accept(List.of(ontology));
    members.add(MemberKind.ONTOLOGY, ontology);
    definitions.forEach((kind, repository) -> members.add(repository, kind, ontologyId));
    OntologyStructureValidator.requireValid(release, members.values);
    seal(release, state, members);
    return release;
  }

  private OntologyRelease header(
      final Ontology ontology, final OntologyState state, final String user) {
    final long revision = Math.incrementExact(state.getLastReleaseRevision());
    final UUID id = UUID.randomUUID();
    final String name = "release-" + revision;
    final OntologyRelease release =
        new OntologyRelease()
            .withId(id)
            .withName(name)
            .withFullyQualifiedName(FullyQualifiedName.add(ontology.getFullyQualifiedName(), name))
            .withOntology(ontology.getEntityReference())
            .withOwners(ontology.getOwners())
            .withReviewers(ontology.getReviewers())
            .withOntologyIri(ontology.getIri())
            .withVersionIri(URI.create("urn:openmetadata:ontology-release:" + id))
            .withReleaseRevision(revision)
            .withSourceWorkingRevision(state.getWorkingRevision())
            .withBaseReleaseId(state.getActiveReleaseId())
            .withEncodingVersion(
                OntologyRelease.EncodingVersion.fromValue(OntologyReleaseManifest.ENCODING_VERSION))
            .withVersion(0.1)
            .withUpdatedAt(clock.millis())
            .withUpdatedBy(user)
            .withSealedBy(user);
    OntologyReview.initialize(release);
    return release;
  }

  private void seal(
      final OntologyRelease release, final OntologyState state, final Members members) {
    final String digest = OntologyReleaseManifest.digest(members.values);
    members.requireTimeRemaining();
    if (dao.ontologyStateDAO()
            .allocateReleaseRevision(state.getOntologyId(), state.getLastReleaseRevision())
        != 1) {
      throw new PreconditionFailedException("Ontology release allocation changed");
    }
    dao.ontologyReleaseDAO().insert(release, release.getFullyQualifiedName());
    for (final OntologyReleaseMember member : members.values) {
      if (dao.ontologyReleaseDAO().insertMember(member) != 1) {
        throw new PreconditionFailedException("Ontology release was sealed during capture");
      }
      members.requireTimeRemaining();
    }
    sealHeader(release, digest, members);
  }

  private void sealHeader(
      final OntologyRelease release, final String digest, final Members members) {
    release
        .withContentDigest(digest)
        .withMemberCount(members.values.size())
        .withTotalBytes(members.bytes)
        .withSealedAt(clock.millis());
    if (dao.ontologyReleaseDAO()
            .seal(release.getId(), JsonUtils.pojoToJson(release), members.values.size())
        != 1) {
      throw new PreconditionFailedException("Ontology release membership changed before sealing");
    }
    releases.recordCapture(release);
    members.requireTimeRemaining();
  }

  private static final class Members {
    private final UUID releaseId;
    private final Access access;
    private final long deadline = System.nanoTime() + CAPTURE_TIMEOUT.toNanos();
    private final List<OntologyReleaseMember> values = new ArrayList<>();
    private long bytes;

    private Members(final UUID releaseId, final Access access) {
      this.releaseId = releaseId;
      this.access = access;
    }

    private <T extends OntologyDefinition> void add(
        final EntityRepository<T> repository, final MemberKind kind, final UUID ontologyId) {
      final ListFilter filter =
          new ListFilter(Include.NON_DELETED).addQueryParam("ontologyId", ontologyId.toString());
      String after = null;
      do {
        requireTimeRemaining();
        final ResultList<T> page =
            repository.listAfter(null, repository.getFields(""), filter, PAGE_SIZE, after);
        access.authorize().accept(page.getData());
        page.getData().forEach(entity -> add(kind, entity));
        after = page.getPaging().getAfter();
      } while (after != null);
    }

    private void add(final MemberKind kind, final OntologyDefinition entity) {
      requireTimeRemaining();
      if (values.size() >= OntologyReleaseManifest.MAX_MEMBERS) {
        throw new BadRequestException("An ontology release exceeds the 10000 member limit");
      }
      final OntologyReleaseMember member =
          OntologyReleaseManifest.member(
                  releaseId, kind, entity.getId(), OntologyReleaseContent.project(entity))
              .withSourceVersion(entity.getVersion());
      bytes += member.getPayloadBytes();
      if (bytes > OntologyReleaseManifest.MAX_RELEASE_BYTES) {
        throw new BadRequestException("Ontology release content exceeds the 64 MiB limit");
      }
      values.add(member);
    }

    private void requireTimeRemaining() {
      if (System.nanoTime() >= deadline) {
        throw new BadRequestException("Ontology capture exceeded its 30 second transaction budget");
      }
    }
  }
}
