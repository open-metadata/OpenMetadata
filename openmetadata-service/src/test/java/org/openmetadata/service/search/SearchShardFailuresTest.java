package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.sdk.exception.SearchException;

class SearchShardFailuresTest {

  private static final List<String> NPE_ON_TABLE_INDEX =
      List.of("table_search_index[0]: null_pointer_exception");

  @Test
  void healthySearchIsUntouched() {
    assertDoesNotThrow(() -> SearchShardFailures.check(0, 24, 0L, List.of()));
  }

  @Test
  void degradedSearchThatStillFoundSomethingIsAllowedThrough() {
    assertDoesNotThrow(() -> SearchShardFailures.check(5, 24, 12L, NPE_ON_TABLE_INDEX));
  }

  /** The #32255 shape: shards threw, every match was on one of them, engine still answered 200. */
  @Test
  void partialFailureWithNoHitsIsRejected() {
    SearchException thrown =
        assertThrows(
            SearchException.class, () -> SearchShardFailures.check(5, 24, 0L, NPE_ON_TABLE_INDEX));

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
    assertThrows(SearchException.class, () -> SearchShardFailures.check(1, 3, 0L, List.of()));
    assertThrows(SearchException.class, () -> SearchShardFailures.check(1, 3, 0L, null));
  }
}
