package org.openmetadata.service.events.consumer.ledger;

import java.util.List;
import java.util.Objects;
import java.util.function.Predicate;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.AccessControlDAOs.ChangeEventDAO.ChangeEventRecord;
import org.openmetadata.service.util.ChangeEventJsonUtils;
import org.openmetadata.service.util.PerRequestContextCleaner;

/**
 * The events an alert has not processed yet, for diagnostics. Each one is evaluated against the
 * alert's rules, so one count evaluates at most {@link #MAX_EVALUATED} of them, in one read, and
 * says when more are unread. Every evaluation that runs on a pooled thread starts and ends with
 * cleared per-request caches, because those threads never pass the request filter that clears them.
 */
final class UnprocessedEvents {

  static final int MAX_EVALUATED = 500;

  private UnprocessedEvents() {}

  static PendingCount countMatching(
      long afterOffset, long latestOffset, Predicate<ChangeEvent> matches) {
    List<ChangeEventRecord> read =
        Entity.getCollectionDAO().changeEventDAO().listWithOffset(MAX_EVALUATED, afterOffset);
    // Up to the latest offset read with the position only: events written since may fill the read
    // in place of older ones, and a count of them could not say that it stopped short.
    List<ChangeEventRecord> counted =
        read.stream().takeWhile(row -> row.offset() <= latestOffset).toList();
    long count =
        counted.parallelStream().filter(row -> matchesCleanly(row.json(), matches)).count();
    boolean moreUnread =
        counted.size() == read.size() && !read.isEmpty() && read.getLast().offset() < latestOffset;
    return new PendingCount(count, moreUnread);
  }

  // Each event is parsed once for both lists. The rules read its entity, which is then left out,
  // as every alert event listing leaves it out.
  static AlertProgress.UnreadPage page(List<String> rows, Predicate<ChangeEvent> matches) {
    List<ChangeEvent> all =
        rows.parallelStream()
            .map(json -> ChangeEventJsonUtils.readOrNull(json, ChangeEvent.class))
            .filter(Objects::nonNull)
            .toList();
    List<ChangeEvent> relevant =
        all.parallelStream().filter(event -> evaluateCleanly(event, matches)).toList();
    all.forEach(event -> event.setEntity(null));
    return new AlertProgress.UnreadPage(relevant, all);
  }

  private static boolean matchesCleanly(String json, Predicate<ChangeEvent> matches) {
    ChangeEvent event = ChangeEventJsonUtils.readOrNull(json, ChangeEvent.class);
    return event != null && evaluateCleanly(event, matches);
  }

  private static boolean evaluateCleanly(ChangeEvent event, Predicate<ChangeEvent> matches) {
    PerRequestContextCleaner.clear();
    try {
      return matches.test(event);
    } finally {
      PerRequestContextCleaner.clear();
    }
  }
}
