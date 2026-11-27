package org.openmetadata.service.ontology;

import java.net.URI;
import java.time.Clock;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import java.util.function.Consumer;
import org.openmetadata.schema.OntologyDefinition;
import org.openmetadata.schema.api.data.CaptureOntologyRelease;
import org.openmetadata.schema.entity.data.Ontology;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.type.EntityStatus;
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

  /** Working content shaped as a release so the release projections can write it; never stored. */
  public record DraftContent(OntologyRelease release, List<OntologyReleaseMember> members) {}

  /**
   * The unpublished working content as an unstored release. It takes no revision number and writes
   * no row, so exporting a draft leaves the release history as it was.
   */
  public DraftContent draftContent(final OntologyWorkingSnapshot.Snapshot working) {
    final Ontology ontology = working.root();
    final UUID id = UUID.randomUUID();
    final Members members = new Members(id);
    working.entries().forEach(entry -> members.add(entry.kind(), entry.definition()));
    final OntologyRelease release =
        new OntologyRelease()
            .withId(id)
            .withName("draft")
            .withFullyQualifiedName(
                FullyQualifiedName.add(ontology.getFullyQualifiedName(), "draft"))
            .withOntology(ontology.getEntityReference())
            .withOntologyIri(ontology.getIri())
            .withVersionIri(URI.create("urn:openmetadata:ontology-release:" + id))
            .withReleaseRevision(working.state().getLastReleaseRevision())
            .withSourceWorkingRevision(working.state().getWorkingRevision())
            .withEncodingVersion(
                OntologyRelease.EncodingVersion.fromValue(OntologyReleaseManifest.ENCODING_VERSION))
            .withContentDigest(OntologyReleaseManifest.digest(members.values))
            .withMemberCount(members.values.size())
            .withTotalBytes(members.bytes)
            .withSealedAt(clock.millis());
    return new DraftContent(release, List.copyOf(members.values));
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
    OntologyReleasePublication.validateRequest(request);
    final Ontology ontology = working.root();
    final String version = targetVersion(request, state);
    final OntologyRelease existing = reusableDraft(draftsOf(ontology.getId()), state, version);
    if (existing != null) {
      return releases.get(
          null,
          existing.getId(),
          releases.getFields("owners,reviewers"),
          Include.NON_DELETED,
          false);
    }
    OntologyReleasePublication.requireLatestRevision(request, state);
    final OntologyRelease release = header(ontology, state, access.user());
    release.setReleaseNotes(request.getReleaseNotes());
    release.setSemanticVersion(version);
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

  /**
   * The bump applies to the active release, so a draft never moves the next suggestion. A version
   * a release already published is stepped past: after a rollback the active release trails the
   * newest one, and suggesting its successor would collide with a published version.
   */
  private String targetVersion(final CaptureOntologyRelease request, final OntologyState state) {
    if (request.getVersionBump() == null) {
      return null;
    }
    final String active =
        state.getActiveReleaseId() == null
            ? null
            : releases
                .get(
                    null,
                    state.getActiveReleaseId(),
                    releases.getFields(""),
                    Include.NON_DELETED,
                    false)
                .getSemanticVersion();
    final Set<String> taken =
        OntologyReleasePublication.publishedVersions(dao, state.getOntologyId());
    String candidate = OntologyReleasePublication.nextVersion(active, request.getVersionBump());
    while (taken.contains(candidate)) {
      candidate = OntologyReleasePublication.nextVersion(candidate, request.getVersionBump());
    }
    return candidate;
  }

  private List<OntologyRelease> draftsOf(final UUID ontologyId) {
    return dao.ontologyReleaseDAO().listByStatus(ontologyId, EntityStatus.DRAFT.value()).stream()
        .map(json -> JsonUtils.readValue(json, OntologyRelease.class))
        .toList();
  }

  /**
   * A capture that would seal the same working revision on the same base under the same version
   * as an open draft is that draft; sealing it again only mints a release nobody asked for.
   */
  static OntologyRelease reusableDraft(
      final List<OntologyRelease> drafts, final OntologyState state, final String version) {
    return drafts.stream()
        .filter(draft -> draft.getSealedAt() != null)
        .filter(
            draft -> Objects.equals(draft.getSourceWorkingRevision(), state.getWorkingRevision()))
        .filter(draft -> Objects.equals(draft.getBaseReleaseId(), state.getActiveReleaseId()))
        .filter(draft -> Objects.equals(draft.getSemanticVersion(), version))
        .max(Comparator.comparing(OntologyRelease::getReleaseRevision))
        .orElse(null);
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
    if (dao.ontologyReleaseDAO().insertMembers(members.values) != members.values.size()) {
      throw new PreconditionFailedException("Ontology release was sealed during capture");
    }
    members.requireTimeRemaining();
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
        throw new BadRequestException(
            OntologyReleaseManifest.memberLimitMessage("An ontology release"));
      }
      final OntologyReleaseMember member =
          OntologyReleaseManifest.member(
                  releaseId, kind, entity.getId(), OntologyReleaseContent.project(entity))
              .withSourceVersion(entity.getVersion());
      bytes += member.getPayloadBytes();
      if (bytes > OntologyReleaseManifest.MAX_RELEASE_BYTES) {
        throw new BadRequestException(
            OntologyReleaseManifest.byteLimitMessage("Ontology release content"));
      }
      values.add(member);
    }

    private void requireTimeRemaining() {
      if (System.nanoTime() >= deadline) {
        throw new BadRequestException(
            "Ontology capture exceeded its "
                + CAPTURE_TIMEOUT.toSeconds()
                + " second transaction budget");
      }
    }
  }
}
