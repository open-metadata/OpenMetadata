package org.openmetadata.mcp.util;

import java.util.Map;
import java.util.Optional;
import org.openmetadata.service.search.vector.utils.DTOs.VectorSearchResponse;

public final class VectorPagingContract {

  private VectorPagingContract() {}

  /**
   * One page of ranked hits: {@code rawCount} came back from the index at offset {@code from}, and
   * the first {@code consumed} of them are behind this page. {@code consumed} is what the cursor
   * advances by; it can exceed {@code returnedCount} when hits were dropped before returning.
   */
  public record Window(int from, int rawCount, int consumed, int requestedSize) {}

  public static void attach(
      Map<String, Object> result,
      int from,
      int rawCount,
      int requestedSize,
      VectorSearchResponse response,
      String pageMessage) {
    int returned =
        result.get("returnedCount") instanceof Number number ? number.intValue() : rawCount;
    attach(result, new Window(from, rawCount, returned, requestedSize), response, pageMessage);
  }

  /** As above, but with the cursor advancing by {@code window.consumed()} rather than the count. */
  public static void attach(
      Map<String, Object> result,
      Window window,
      VectorSearchResponse response,
      String pageMessage) {
    int consumed = window.consumed();
    boolean budgetTrimmed = consumed < window.rawCount();
    boolean fullPage = window.rawCount() >= window.requestedSize();
    boolean moreInIndex = hasMoreInIndex(response, window.from(), window.rawCount());
    boolean canAdvance = consumed > 0;
    if (canAdvance && (budgetTrimmed || (fullPage && moreInIndex))) {
      result.put(McpResponseTrim.HAS_MORE_KEY, Boolean.TRUE);
      result.put(
          McpResponseTrim.NEXT_CURSOR_KEY, PageCursor.encodeOffset(window.from() + consumed));
    } else if (!canAdvance) {
      result.remove(McpResponseTrim.HAS_MORE_KEY);
      result.remove(McpResponseTrim.MESSAGE_KEY);
    }
    if (fullPage && !budgetTrimmed && moreInIndex && pageMessage != null) {
      int returned =
          result.get("returnedCount") instanceof Number number ? number.intValue() : consumed;
      result.put(McpResponseTrim.MESSAGE_KEY, String.format(pageMessage, returned));
    }
  }

  public static int cursorOffsetOrDefault(Map<String, Object> params, int defaultFrom) {
    String token = params.get("cursor") instanceof String value ? value : null;
    Optional<PageCursor.Cursor> cursor = PageCursor.decode(token);
    int from = defaultFrom;
    if (cursor.isPresent() && cursor.get().isOffset()) {
      from = cursor.get().offset();
    }
    return from;
  }

  // hasMore is preferred over totalHits because the vector service groups chunks by parent entity;
  // totalHits reflects raw ES hits (multiple chunks per parent) and overstates paginable results.
  static boolean hasMoreInIndex(VectorSearchResponse response, int from, int rawCount) {
    if (response.getHasMore() != null) {
      return response.getHasMore();
    }
    if (response.getTotalHits() != null) {
      return (long) from + rawCount < response.getTotalHits();
    }
    return false;
  }
}
