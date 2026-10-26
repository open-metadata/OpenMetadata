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
import org.openmetadata.schema.type.OntologyReleaseChangeSummary;
import org.openmetadata.schema.type.OntologyReleaseMember;
import org.openmetadata.schema.type.OntologyReleaseMember.MemberKind;
import org.openmetadata.schema.type.OntologyState;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.exception.PreconditionFailedException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.OntologyEntityRepository;
import org.openmetadata.service.jdbi3.OntologyReleaseRepository;
import org.openmetadata.service.jdbi3.OntologyRepository;
import org.openmetadata.service.util.FullyQualifiedName;

/** Captures bounded working content while holding the same module lock as its writers. */
public final class OntologyReleaseCapture {
  private static final Duration CAPTURE_TIMEOUT = Duration.ofSeconds(30);
  private final CollectionDAO dao;
  private final OntologyReleaseRepository releases;
  private final OntologyRepository ontologies;
  private final OntologyWorkingSnapshot snapshot;
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
    this.snapshot = new OntologyWorkingSnapshot(ontologies, definitions);
    this.clock = clock;
  }

  public OntologyRelease capture(
      final UUID ontologyId, final CaptureOntologyRelease request, final Access access) {
    return snapshot.read(
        ontologyId,
        access.authorize(),
        working -> captureLocked(ontologyId, request, access, working));
  }

  public OntologyWorkingSnapshot snapshot() {
    return snapshot;
  }

  private OntologyRelease captureLocked(
      final UUID ontologyId,
      final CaptureOntologyRelease request,
      final Access access,
      final OntologyWorkingSnapshot.Snapshot working) {
    final OntologyState state = working.state();
    if (request.getExpectedWorkingRevision() == null
        || request.getExpectedWorkingRevision().longValue() != state.getWorkingRevision()) {
      throw new PreconditionFailedException(
          "Ontology changed; reload its working revision before capture");
    }
    if (request.getExpectedActivationRevision() != null
        && request.getExpectedActivationRevision().longValue() != state.getActivationRevision()) {
      throw new PreconditionFailedException(
          "Ontology activation changed; reload its working diff before capture");
    }
    OntologyReleasePublication.validate(request, state);
    final Ontology ontology = working.root();
    final OntologyRelease release = header(ontology, state, access.user());
    setPublicationMetadata(release, request);
    final Members members = new Members(release.getId());
    working.entries().forEach(entry -> members.add(entry.kind(), entry.definition()));
    OntologyStructureValidator.requireValid(release, members.values);
    release.setChangeSummary(changeSummary(state, members.values, access));
    members.requireTimeRemaining();
    seal(release, state, members);
    return release;
  }

  private OntologyReleaseChangeSummary changeSummary(
      final OntologyState state, final List<OntologyReleaseMember> proposed, final Access access) {
    final List<OntologyReleaseMember> base =
        state.getActiveReleaseId() == null
            ? List.of()
            : new OntologyReleaseReader(dao)
                .read(
                    releases.get(
                        null,
                        state.getActiveReleaseId(),
                        releases.getFields("owners,reviewers"),
                        Include.NON_DELETED,
                        false),
                    access.authorize());
    return OntologyReleaseComparison.summarize(base, proposed);
  }

  private void setPublicationMetadata(
      final OntologyRelease release, final CaptureOntologyRelease request) {
    release.setReleaseNotes(request.getReleaseNotes());
    if (request.getVersionBump() != null) {
      final String latest =
          dao.ontologyReleaseDAO().findLatestSemanticVersion(release.getOntology().getId());
      release.setSemanticVersion(
          OntologyReleasePublication.nextVersion(latest, request.getVersionBump()));
    }
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
    private final long deadline = System.nanoTime() + CAPTURE_TIMEOUT.toNanos();
    private final List<OntologyReleaseMember> values = new ArrayList<>();
    private long bytes;

    private Members(final UUID releaseId) {
      this.releaseId = releaseId;
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
