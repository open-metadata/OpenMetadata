package org.openmetadata.service.events.scheduled;

import java.util.List;
import java.util.function.Predicate;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.AccessControlDAOs.ChangeEventDAO.ChangeEventRecord;
import org.openmetadata.service.util.ChangeEventJsonUtils;
import org.openmetadata.service.util.PerRequestContextCleaner;

/**
 * The events an alert has not processed yet, for diagnostics. They are read in pages of a fixed
 * size, so memory stays bounded while the count stays exact, and every evaluation that runs on a
 * pooled thread starts and ends with cleared per-request caches, because those threads never pass
 * the request filter that clears them.
 */
final class UnprocessedEvents {

  static final int PAGE_SIZE = 500;

  private UnprocessedEvents() {}

  static long countMatching(long afterOffset, Predicate<ChangeEvent> matches) {
    long count = 0;
    long cursor = afterOffset;
    List<ChangeEventRecord> page = readPage(cursor);
    while (!page.isEmpty()) {
      count += page.parallelStream().filter(row -> matchesCleanly(row.json(), matches)).count();
      cursor = page.getLast().offset();
      page = readPage(cursor);
    }
    return count;
  }

  static List<ChangeEvent> matching(List<String> rows, Predicate<ChangeEvent> matches) {
    return rows.parallelStream()
        .map(json -> ChangeEventJsonUtils.readOrNull(json, ChangeEvent.class))
        .filter(event -> event != null && evaluateCleanly(event, matches))
        .toList();
  }

  private static List<ChangeEventRecord> readPage(long afterOffset) {
    return Entity.getCollectionDAO().changeEventDAO().listWithOffset(PAGE_SIZE, afterOffset);
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
