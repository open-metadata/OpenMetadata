package org.openmetadata.service.events.consumer.ledger;

import java.util.List;
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
    long count = read.parallelStream().filter(row -> matchesCleanly(row.json(), matches)).count();
    boolean moreUnread = !read.isEmpty() && read.getLast().offset() < latestOffset;
    return new PendingCount(count, moreUnread);
  }

  static List<ChangeEvent> matching(List<String> rows, Predicate<ChangeEvent> matches) {
    return rows.parallelStream()
        .map(json -> ChangeEventJsonUtils.readOrNull(json, ChangeEvent.class))
        .filter(event -> event != null && evaluateCleanly(event, matches))
        .toList();
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
