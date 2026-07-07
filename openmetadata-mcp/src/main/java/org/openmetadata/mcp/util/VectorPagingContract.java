package org.openmetadata.mcp.util;

import java.util.Map;
import java.util.Optional;
import org.openmetadata.service.search.vector.utils.DTOs.VectorSearchResponse;

public final class VectorPagingContract {

  private VectorPagingContract() {}

  public static void attach(
      Map<String, Object> result,
      int from,
      int rawCount,
      int requestedSize,
      VectorSearchResponse response,
      String pageMessage) {
    int returned =
        result.get("returnedCount") instanceof Number number ? number.intValue() : rawCount;
    boolean budgetTrimmed = returned < rawCount;
    boolean fullPage = rawCount >= requestedSize;
    boolean moreInIndex = hasMoreInIndex(response, from, rawCount, fullPage);
    if (budgetTrimmed || (fullPage && moreInIndex)) {
      result.put(McpResponseTrim.HAS_MORE_KEY, Boolean.TRUE);
      result.put(McpResponseTrim.NEXT_CURSOR_KEY, PageCursor.encodeOffset(from + returned));
    }
    if (fullPage && !budgetTrimmed && moreInIndex && pageMessage != null) {
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

  static boolean hasMoreInIndex(
      VectorSearchResponse response, int from, int rawCount, boolean fullPage) {
    if (response.getTotalHits() != null) {
      return (long) from + rawCount < response.getTotalHits();
    }
    if (response.getHasMore() != null) {
      return response.getHasMore();
    }
    return fullPage;
  }
}
