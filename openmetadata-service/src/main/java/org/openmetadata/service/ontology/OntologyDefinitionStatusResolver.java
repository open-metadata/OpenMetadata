package org.openmetadata.service.ontology;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.BooleanSupplier;
import org.openmetadata.schema.OntologyDefinition;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.type.OntologyDefinitionStatus;
import org.openmetadata.schema.type.OntologyReleaseMember;
import org.openmetadata.schema.type.OntologyReleaseMember.MemberKind;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.OntologyReleaseDAO.MemberVersion;

/**
 * Derives the review status of working definitions from release membership. A definition is a
 * member of a release when it exists and its governed content equals the member's, the same
 * identity the working diff uses. An equal entity version proves that without reading the member
 * payload, because capture projected exactly that stored revision.
 */
public final class OntologyDefinitionStatusResolver {
  public enum Match {
    ABSENT,
    SAME,
    DIFFERENT
  }

  public record Slots(Match active, Match latestApproved, Match inReview) {}

  private record Key(UUID releaseId, UUID memberId) {}

  private final OntologyReleaseRoles roles;
  private final CollectionDAO dao;

  public OntologyDefinitionStatusResolver(final CollectionDAO dao) {
    this.dao = dao;
    roles = new OntologyReleaseRoles(dao);
  }

  /**
   * The status table. A definition in the active or the latest approved release is Approved. One
   * in the release under review is InReview. Every other definition, including a deleted one, is
   * Draft.
   */
  public static OntologyDefinitionStatus status(final boolean deleted, final Slots slots) {
    if (deleted) {
      return OntologyDefinitionStatus.DRAFT;
    }
    if (slots.active() == Match.SAME || slots.latestApproved() == Match.SAME) {
      return OntologyDefinitionStatus.APPROVED;
    }
    return slots.inReview() == Match.SAME
        ? OntologyDefinitionStatus.IN_REVIEW
        : OntologyDefinitionStatus.DRAFT;
  }

  /** Entity versions move in tenths, so two versions are the same when their tenths agree. */
  public static boolean sameVersion(final Double working, final Double member) {
    return working != null
        && member != null
        && Math.round(working * 10.0) == Math.round(member * 10.0);
  }

  public static Match decide(
      final Double workingVersion, final Double memberVersion, final BooleanSupplier sameContent) {
    return sameVersion(workingVersion, memberVersion) || sameContent.getAsBoolean()
        ? Match.SAME
        : Match.DIFFERENT;
  }

  /**
   * Statuses for one page of definitions of one kind. It reads the page's release roles, then the
   * member versions of the page in those releases, then the member payloads of the pairs whose
   * versions differ. That is at most three queries however many definitions the page holds.
   */
  public Map<UUID, OntologyDefinitionStatus> resolve(
      final List<? extends OntologyDefinition> definitions, final MemberKind kind) {
    final Map<UUID, OntologyReleaseRoles.Roles> byOntology =
        roles.read(
            definitions.stream()
                .filter(definition -> definition.getOntology() != null)
                .map(definition -> definition.getOntology().getId())
                .toList());
    final List<? extends OntologyDefinition> live =
        definitions.stream()
            .filter(definition -> !Boolean.TRUE.equals(definition.getDeleted()))
            .toList();
    final Map<Key, Double> versions = memberVersions(live, byOntology, kind);
    final Map<Key, OntologyReleaseMember> payloads =
        memberPayloads(live, byOntology, versions, kind);
    final Map<UUID, OntologyDefinitionStatus> statuses = new HashMap<>();
    for (final OntologyDefinition definition : definitions) {
      final OntologyReleaseRoles.Roles page =
          definition.getOntology() == null
              ? OntologyReleaseRoles.Roles.NONE
              : byOntology.getOrDefault(
                  definition.getOntology().getId(), OntologyReleaseRoles.Roles.NONE);
      statuses.put(
          definition.getId(),
          status(
              Boolean.TRUE.equals(definition.getDeleted()),
              new Slots(
                  match(definition, page.active(), versions, payloads),
                  match(definition, page.latestApproved(), versions, payloads),
                  match(definition, page.inReview(), versions, payloads))));
    }
    return statuses;
  }

  private Map<Key, Double> memberVersions(
      final List<? extends OntologyDefinition> definitions,
      final Map<UUID, OntologyReleaseRoles.Roles> byOntology,
      final MemberKind kind) {
    final List<String> releaseIds = releaseIds(byOntology);
    final List<String> memberIds = definitions.stream().map(d -> d.getId().toString()).toList();
    if (releaseIds.isEmpty() || memberIds.isEmpty()) {
      return Map.of();
    }
    final Map<Key, Double> versions = new HashMap<>();
    for (final MemberVersion member :
        EntityDAO.queryInChunks(
            memberIds,
            chunk ->
                dao.ontologyReleaseDAO().listMemberVersions(releaseIds, kind.value(), chunk))) {
      versions.put(
          new Key(UUID.fromString(member.releaseId()), UUID.fromString(member.memberId())),
          member.sourceVersion());
    }
    return versions;
  }

  private Map<Key, OntologyReleaseMember> memberPayloads(
      final List<? extends OntologyDefinition> definitions,
      final Map<UUID, OntologyReleaseRoles.Roles> byOntology,
      final Map<Key, Double> versions,
      final MemberKind kind) {
    final Set<String> stale = new LinkedHashSet<>();
    for (final OntologyDefinition definition : definitions) {
      for (final OntologyRelease release : decidingReleases(definition, byOntology)) {
        final Key key = new Key(release.getId(), definition.getId());
        if (versions.containsKey(key) && !sameVersion(definition.getVersion(), versions.get(key))) {
          stale.add(definition.getId().toString());
        }
      }
    }
    if (stale.isEmpty()) {
      return Map.of();
    }
    final List<String> releaseIds = releaseIds(byOntology);
    final Map<Key, OntologyReleaseMember> payloads = new HashMap<>();
    for (final OntologyReleaseMember member :
        EntityDAO.queryInChunks(
            new ArrayList<>(stale),
            chunk ->
                dao.ontologyReleaseDAO().listMemberPayloads(releaseIds, kind.value(), chunk))) {
      payloads.put(new Key(member.getReleaseId(), member.getMemberId()), member);
    }
    return payloads;
  }

  private static Match match(
      final OntologyDefinition definition,
      final OntologyRelease release,
      final Map<Key, Double> versions,
      final Map<Key, OntologyReleaseMember> payloads) {
    if (release == null) {
      return Match.ABSENT;
    }
    final Key key = new Key(release.getId(), definition.getId());
    if (!versions.containsKey(key)) {
      return Match.ABSENT;
    }
    return decide(
        definition.getVersion(),
        versions.get(key),
        () ->
            payloads.containsKey(key)
                && OntologyReleaseComparison.sameContent(
                    definition, OntologyReleaseReader.definition(payloads.get(key))));
  }

  private static List<OntologyRelease> decidingReleases(
      final OntologyDefinition definition, final Map<UUID, OntologyReleaseRoles.Roles> byOntology) {
    return definition.getOntology() == null
        ? List.of()
        : byOntology
            .getOrDefault(definition.getOntology().getId(), OntologyReleaseRoles.Roles.NONE)
            .deciding();
  }

  private static List<String> releaseIds(final Map<UUID, OntologyReleaseRoles.Roles> byOntology) {
    return byOntology.values().stream()
        .flatMap(page -> page.deciding().stream())
        .map(release -> release.getId().toString())
        .distinct()
        .toList();
  }
}
