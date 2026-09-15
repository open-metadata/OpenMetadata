package org.openmetadata.service.entity.history;

import java.util.UUID;
import org.openmetadata.service.util.RestUtil;

record HistoryCursor(String condition, String sortOrder, Long updatedAt, String id) {
  private static final String NEWEST_FIRST = "DESC";
  private static final String OLDEST_FIRST = "ASC";
  private static final String OLDER =
      "AND (updatedAt < :cursorUpdatedAt OR (updatedAt = :cursorUpdatedAt AND id < :cursorId))";
  private static final String NEWER =
      "AND (updatedAt > :cursorUpdatedAt OR (updatedAt = :cursorUpdatedAt AND id > :cursorId))";

  static HistoryCursor of(final String after, final String before) {
    if (before != null) {
      return keyset(NEWER, OLDEST_FIRST, before);
    }
    if (after != null) {
      return keyset(OLDER, NEWEST_FIRST, after);
    }
    return new HistoryCursor("", NEWEST_FIRST, null, null);
  }

  private static HistoryCursor keyset(
      final String condition, final String order, final String cursor) {
    final String[] parts = decode(cursor).split(":");
    return new HistoryCursor(condition, order, Long.parseLong(parts[0]), parts[1]);
  }

  boolean isBackward() {
    return OLDEST_FIRST.equals(sortOrder);
  }

  boolean isFirstPage() {
    return updatedAt == null;
  }

  private static String decode(final String cursor) {
    final String decoded = RestUtil.decodeCursor(cursor);
    if (!decoded.contains(":")) {
      throw new RuntimeException("Cursor is not a valid cursor: " + cursor);
    }
    final String[] parts = decoded.split(":");
    try {
      Long.parseLong(parts[0]);
      UUID.fromString(parts[1]);
    } catch (IllegalArgumentException exception) {
      throw new IllegalArgumentException("Cursor is not a valid cursor: " + cursor);
    }
    return decoded;
  }
}
