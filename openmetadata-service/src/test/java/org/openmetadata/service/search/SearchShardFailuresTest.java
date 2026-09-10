package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.openmetadata.sdk.exception.SearchException;

class SearchShardFailuresTest {

  private static final List<String> NPE_ON_TABLE_INDEX =
      List.of("table_search_index[0]: null_pointer_exception");

  @Test
  void healthySearchIsUntouched() {
    assertDoesNotThrow(() -> SearchShardFailures.check(0, 24, true, List.of()));
  }

  @Test
  void degradedSearchThatStillReturnedDocumentsIsAllowedThrough() {
    assertDoesNotThrow(() -> SearchShardFailures.check(5, 24, false, NPE_ON_TABLE_INDEX));
  }

  /** The #32255 shape: shards threw, every match was on one of them, engine still answered 200. */
  @Test
  void partialFailureWithNoDocumentsIsRejected() {
    SearchException thrown =
        assertThrows(
            SearchException.class,
            () -> SearchShardFailures.check(5, 24, true, NPE_ON_TABLE_INDEX));

    assertTrue(
        thrown.getMessage().contains("null_pointer_exception"),
        "the engine's reason must reach the caller, not just a shard count: "
            + thrown.getMessage());
    assertTrue(
        thrown.getMessage().contains("table_search_index"),
        "the failing index must reach the caller: " + thrown.getMessage());
  }

  @Test
  void failureCountWithoutDetailStillRejectsAnEmptyResult() {
    assertThrows(SearchException.class, () -> SearchShardFailures.check(1, 3, true, List.of()));
    assertThrows(SearchException.class, () -> SearchShardFailures.check(1, 3, true, null));
  }

  /**
   * A wide cluster can fail enough shards to turn the message into kilobytes of near-identical
   * text, and it is echoed into an HTTP 500 body as well as the log.
   */
  @Test
  void longFailureListIsTruncatedInTheMessage() {
    List<String> manyFailures =
        IntStream.range(0, 40)
            .mapToObj(shard -> "idx[" + shard + "]: circuit_breaking_exception")
            .toList();

    SearchException thrown =
        assertThrows(
            SearchException.class, () -> SearchShardFailures.check(40, 40, true, manyFailures));

    assertTrue(thrown.getMessage().contains("... (35 more)"), thrown.getMessage());
    assertTrue(
        thrown.getMessage().contains("idx[4]"), "first entries kept: " + thrown.getMessage());
    assertFalse(
        thrown.getMessage().contains("idx[39]"), "tail must be summarised: " + thrown.getMessage());
  }
}
