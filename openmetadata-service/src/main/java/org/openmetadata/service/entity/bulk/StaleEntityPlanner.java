package org.openmetadata.service.entity.bulk;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.jdbi3.EntityDAO.EntityIdFqnPair;
import org.openmetadata.service.util.FullyQualifiedName;

/** Selects unseen rows in stable ancestor-first order using the stored FQN hash semantics. */
@Slf4j
public final class StaleEntityPlanner {
  public record Candidate(UUID id, String fqn, String hash, int depth) {}

  private StaleEntityPlanner() {}

  public static List<Candidate> plan(
      final List<EntityIdFqnPair> rows, final List<String> seenFqns) {
    if (rows.isEmpty()) {
      return List.of();
    }
    final Set<String> seenHashes = seenHashes(seenFqns);
    return rows.stream()
        .map(StaleEntityPlanner::candidate)
        .filter(candidate -> !seenHashes.contains(candidate.hash()))
        .sorted(Comparator.comparingInt(Candidate::depth))
        .toList();
  }

  private static Candidate candidate(final EntityIdFqnPair row) {
    final String[] parts = FullyQualifiedName.split(row.fqn);
    return new Candidate(row.id, row.fqn, FullyQualifiedName.buildHash(parts), parts.length);
  }

  private static Set<String> seenHashes(final List<String> seenFqns) {
    final Set<String> hashes = new HashSet<>();
    for (final String fqn : listOrEmpty(seenFqns)) {
      try {
        hashes.add(FullyQualifiedName.buildHash(fqn));
      } catch (RuntimeException exception) {
        LOG.warn("Ignoring malformed seen FQN '{}' in stale deletion request", fqn);
      }
    }
    return hashes;
  }

  public static boolean isCovered(final String hash, final Set<String> deletedHashes) {
    if (deletedHashes.isEmpty()) {
      return false;
    }
    int separator = hash.lastIndexOf('.');
    while (separator > 0) {
      final String ancestor = hash.substring(0, separator);
      if (deletedHashes.contains(ancestor)) {
        return true;
      }
      separator = ancestor.lastIndexOf('.');
    }
    return false;
  }
}
