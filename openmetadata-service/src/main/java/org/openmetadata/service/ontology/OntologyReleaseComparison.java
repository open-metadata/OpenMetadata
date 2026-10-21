package org.openmetadata.service.ontology;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.stream.Stream;
import org.openmetadata.schema.OntologyDefinition;
import org.openmetadata.schema.api.data.OntologyReleaseDiff;
import org.openmetadata.schema.api.data.OntologyWorkingDiff;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.OntologyReleaseChangeType;
import org.openmetadata.schema.type.OntologyReleaseMember;
import org.openmetadata.schema.type.OntologyReleaseMember.MemberKind;
import org.openmetadata.schema.type.OntologyReleaseMemberChange;
import org.openmetadata.schema.type.OntologyState;
import org.openmetadata.schema.type.Paging;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.exception.PreconditionFailedException;
import org.openmetadata.service.jdbi3.OntologyReleaseRepository;
import org.openmetadata.service.util.RestUtil;

/** Compares governed content from authorized, verified releases. */
public final class OntologyReleaseComparison {
  private final OntologyReleaseReader reader;
  private final OntologyReleaseRepository releases;

  public OntologyReleaseComparison(final OntologyReleaseRepository releases) {
    this.releases = releases;
    reader = new OntologyReleaseReader(releases.getDaoCollection());
  }

  public OntologyWorkingDiff compareWorking(
      final OntologyWorkingSnapshot.Snapshot working,
      final int limit,
      final String after,
      final Consumer<List<? extends OntologyDefinition>> authorize) {
    requireLimit(limit);
    final var state = working.state();
    final var activeId = state.getActiveReleaseId();
    final List<OntologyReleaseMember> previous;
    if (activeId == null) {
      previous = List.of();
    } else {
      final var active =
          releases.get(
              null, activeId, releases.getFields("owners,reviewers"), Include.NON_DELETED, false);
      previous = reader.read(active, authorize);
    }
    final var before = indexMembers(previous);
    final var proposed = indexWorking(working.entries());
    final var changes =
        keys(before, proposed)
            .map(key -> memberChange(before.get(key), proposed.get(key)))
            .filter(Objects::nonNull)
            .toList();
    final String prefix =
        "working-diff-v1:"
            + state.getOntologyId()
            + ":"
            + state.getWorkingRevision()
            + ":"
            + state.getActivationRevision()
            + ":";
    final int start = workingOffset(after, state, changes.size());
    final int end = Math.min(start + limit, changes.size());
    return new OntologyWorkingDiff()
        .withState(state)
        .withData(List.copyOf(changes.subList(start, end)))
        .withPaging(
            new Paging()
                .withTotal(changes.size())
                .withAfter(end < changes.size() ? RestUtil.encodeCursor(prefix + end) : null));
  }

  public OntologyReleaseDiff compare(
      final OntologyRelease release,
      final OntologyRelease base,
      final int limit,
      final String after,
      final Consumer<List<? extends OntologyDefinition>> authorize) {
    requireLimit(limit);
    if (base != null
        && !Objects.equals(release.getOntology().getId(), base.getOntology().getId())) {
      throw new BadRequestException("Compared releases must belong to the same ontology");
    }
    final var proposed = reader.read(release, authorize);
    final var previous =
        base == null ? List.<OntologyReleaseMember>of() : reader.read(base, authorize);
    final var changes = compareMembers(previous, proposed);
    final String prefix =
        "release-diff-v1:" + release.getId() + ":" + (base == null ? "empty" : base.getId()) + ":";
    final int start = offset(after, prefix, changes.size());
    final int end = Math.min(start + limit, changes.size());
    return new OntologyReleaseDiff()
        .withReleaseId(release.getId())
        .withContentDigest(release.getContentDigest())
        .withBaseReleaseId(base == null ? null : base.getId())
        .withBaseContentDigest(base == null ? null : base.getContentDigest())
        .withData(List.copyOf(changes.subList(start, end)))
        .withPaging(
            new Paging()
                .withTotal(changes.size())
                .withAfter(end < changes.size() ? RestUtil.encodeCursor(prefix + end) : null));
  }

  static List<OntologyReleaseMemberChange> compareMembers(
      final List<OntologyReleaseMember> before, final List<OntologyReleaseMember> after) {
    final var previous = indexMembers(before);
    final var proposed = indexMembers(after);
    return keys(previous, proposed)
        .map(key -> memberChange(previous.get(key), proposed.get(key)))
        .filter(Objects::nonNull)
        .toList();
  }

  private static void requireLimit(final int limit) {
    if (limit < 1 || limit > 1000) {
      throw new BadRequestException("An ontology comparison page requires a limit from 1 to 1000");
    }
  }

  private static Map<String, Snapshot> indexMembers(final List<OntologyReleaseMember> members) {
    OntologyReleaseReader.requireBounds(
        members.size(), members.stream().mapToLong(OntologyReleaseMember::getPayloadBytes).sum());
    final Map<String, Snapshot> indexed = new HashMap<>();
    for (final var member : members) {
      final String key = member.getMemberKind().value() + ":" + member.getMemberId();
      final var snapshot =
          new Snapshot(
              member.getMemberKind(),
              OntologyReleaseReader.definition(member),
              member.getReleaseId());
      if (indexed.putIfAbsent(key, snapshot) != null) {
        throw new BadRequestException(
            "Ontology release closure contains a duplicate member identity");
      }
    }
    return indexed;
  }

  private static Map<String, Snapshot> indexWorking(
      final List<OntologyWorkingSnapshot.Entry> entries) {
    final Map<String, Snapshot> indexed = new HashMap<>();
    for (final var entry : entries) {
      final String key = entry.kind().value() + ":" + entry.definition().getId();
      if (indexed.putIfAbsent(key, new Snapshot(entry.kind(), entry.definition(), null)) != null) {
        throw new BadRequestException(
            "Ontology working content contains duplicate member identity");
      }
    }
    return indexed;
  }

  private static OntologyReleaseMemberChange memberChange(
      final Snapshot before, final Snapshot after) {
    if (before != null
        && after != null
        && OntologyReview.digest(before.definition())
            .equals(OntologyReview.digest(after.definition()))) {
      return null;
    }
    final Snapshot selected = after == null ? before : after;
    final OntologyDefinition entity = selected.definition();
    return new OntologyReleaseMemberChange()
        .withEntity(entity.getEntityReference().withDescription(null).withHref(null))
        .withOntologyId(
            entity.getOntology() == null ? entity.getId() : entity.getOntology().getId())
        .withMemberKind(selected.kind())
        .withChangeType(changeType(before, after))
        .withBeforeReleaseId(before == null ? null : before.releaseId())
        .withAfterReleaseId(after == null ? null : after.releaseId());
  }

  private static Stream<String> keys(final Map<String, ?> before, final Map<String, ?> after) {
    return Stream.concat(before.keySet().stream(), after.keySet().stream()).distinct().sorted();
  }

  private static OntologyReleaseChangeType changeType(final Object before, final Object after) {
    return before == null
        ? OntologyReleaseChangeType.ADDED
        : after == null ? OntologyReleaseChangeType.REMOVED : OntologyReleaseChangeType.CHANGED;
  }

  private static int offset(final String after, final String prefix, final int total) {
    if (after == null) {
      return 0;
    }
    try {
      final String decoded = after.length() > 256 ? null : RestUtil.decodeCursor(after);
      if (decoded == null || !decoded.startsWith(prefix)) {
        throw new IllegalArgumentException();
      }
      final int offset = Integer.parseInt(decoded.substring(prefix.length()));
      if (offset < 0 || offset > total) {
        throw new IllegalArgumentException();
      }
      return offset;
    } catch (IllegalArgumentException exception) {
      throw new BadRequestException("Invalid cursor for this ontology release comparison");
    }
  }

  private static int workingOffset(final String after, final OntologyState state, final int total) {
    if (after == null) {
      return 0;
    }
    try {
      final String decoded = after.length() > 256 ? null : RestUtil.decodeCursor(after);
      final String[] parts = decoded == null ? new String[0] : decoded.split(":", -1);
      if (parts.length != 5
          || !"working-diff-v1".equals(parts[0])
          || !state.getOntologyId().equals(UUID.fromString(parts[1]))) {
        throw new IllegalArgumentException();
      }
      final long workingRevision = Long.parseLong(parts[2]);
      final long activationRevision = Long.parseLong(parts[3]);
      final int pageOffset = Integer.parseInt(parts[4]);
      if (workingRevision != state.getWorkingRevision()
          || activationRevision != state.getActivationRevision()) {
        throw new PreconditionFailedException("Ontology changed; reload the working diff");
      }
      if (pageOffset < 0 || pageOffset > total) {
        throw new IllegalArgumentException();
      }
      return pageOffset;
    } catch (IllegalArgumentException exception) {
      throw new BadRequestException("Invalid cursor for this ontology working comparison");
    }
  }

  private record Snapshot(MemberKind kind, OntologyDefinition definition, UUID releaseId) {}
}
