package org.openmetadata.service.ontology;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Consumer;
import java.util.stream.Stream;
import org.openmetadata.schema.OntologyDefinition;
import org.openmetadata.schema.api.data.OntologyReleaseDiff;
import org.openmetadata.schema.entity.data.OntologyRelease;
import org.openmetadata.schema.type.OntologyReleaseChangeType;
import org.openmetadata.schema.type.OntologyReleaseMember;
import org.openmetadata.schema.type.OntologyReleaseMemberChange;
import org.openmetadata.schema.type.Paging;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.jdbi3.OntologyReleaseRepository;
import org.openmetadata.service.util.RestUtil;

/** Compares governed content from authorized, verified releases. */
public final class OntologyReleaseComparison {
  private final OntologyReleaseReader reader;

  public OntologyReleaseComparison(final OntologyReleaseRepository releases) {
    reader = new OntologyReleaseReader(releases.getDaoCollection());
  }

  public OntologyReleaseDiff compare(
      final OntologyRelease release,
      final OntologyRelease base,
      final int limit,
      final String after,
      final Consumer<OntologyDefinition> authorize) {
    if (limit < 1 || limit > 1000) {
      throw new BadRequestException("A release comparison page requires a limit from 1 to 1000");
    }
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

  private static Map<String, Snapshot> indexMembers(final List<OntologyReleaseMember> members) {
    OntologyReleaseReader.requireBounds(
        members.size(), members.stream().mapToLong(OntologyReleaseMember::getPayloadBytes).sum());
    final Map<String, Snapshot> indexed = new HashMap<>();
    for (final var member : members) {
      final String key = member.getMemberKind().value() + ":" + member.getMemberId();
      final var snapshot = new Snapshot(member, OntologyReleaseReader.definition(member));
      if (indexed.putIfAbsent(key, snapshot) != null) {
        throw new BadRequestException(
            "Ontology release closure contains a duplicate member identity");
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
        .withMemberKind(selected.member().getMemberKind())
        .withChangeType(changeType(before, after))
        .withBeforeReleaseId(before == null ? null : before.member().getReleaseId())
        .withAfterReleaseId(after == null ? null : after.member().getReleaseId());
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

  private record Snapshot(OntologyReleaseMember member, OntologyDefinition definition) {}
}
