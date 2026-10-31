package org.openmetadata.service.ontology;

import java.util.ArrayList;
import java.util.List;
import java.util.function.BiFunction;
import org.openmetadata.service.jdbi3.EntityDAO;

/**
 * Runs a query that filters on a list of release ids and a list of member ids, keeping the two
 * lists together under one bind-parameter budget. Chunking only the member list is not enough: the
 * release list is bound whole into every chunk and can pass the database ceiling on its own.
 */
final class OntologyReleaseMemberQuery {
  private OntologyReleaseMemberQuery() {}

  static <R> List<R> run(
      final List<String> releaseIds,
      final List<String> memberIds,
      final BiFunction<List<String>, List<String>, List<R>> query) {
    return run(releaseIds, memberIds, EntityDAO.MAX_IN_LIST_CHUNK_SIZE, query);
  }

  static <R> List<R> run(
      final List<String> releaseIds,
      final List<String> memberIds,
      final int budget,
      final BiFunction<List<String>, List<String>, List<R>> query) {
    final List<String> releases = releaseIds.stream().distinct().toList();
    final List<String> members = memberIds.stream().distinct().toList();
    if (releases.isEmpty() || members.isEmpty()) {
      return List.of();
    }
    if (releases.size() + members.size() <= budget) {
      return query.apply(releases, members);
    }
    final int releaseChunk = Math.min(releases.size(), budget / 2);
    final int memberChunk = budget - releaseChunk;
    final List<R> result = new ArrayList<>();
    for (int r = 0; r < releases.size(); r += releaseChunk) {
      final List<String> releasePart =
          releases.subList(r, Math.min(r + releaseChunk, releases.size()));
      for (int m = 0; m < members.size(); m += memberChunk) {
        result.addAll(
            query.apply(
                releasePart, members.subList(m, Math.min(m + memberChunk, members.size()))));
      }
    }
    return result;
  }
}
