package org.openmetadata.mcp.tools;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** Contracts a caller relies on to know what it did and did not receive. */
class SearchMetadataCleanTest {

  private static Map<String, Object> hit(Map<String, Object> source) {
    return SearchMetadataTool.cleanSearchResult(new HashMap<>(source), List.of());
  }

  @Test
  void aCutDescriptionSaysThatItWasCut() {
    String long1 = "x".repeat(900);
    Map<String, Object> cleaned = hit(Map.of("entityType", "table", "description", long1));

    assertTrue(
        cleaned.get("description").toString().length() < long1.length(), "long text is shortened");
    assertEquals(
        Boolean.TRUE,
        cleaned.get("descriptionTruncated"),
        "a silent cut reads as the complete text - a caller reported a truncated description as "
            + "the whole field and lost the sentence that mattered");
  }

  @Test
  void aShortDescriptionCarriesNoTruncationMarker() {
    Map<String, Object> cleaned =
        hit(Map.of("entityType", "table", "description", "One row per customer address."));

    assertEquals("One row per customer address.", cleaned.get("description"));
    assertNull(
        cleaned.get("descriptionTruncated"), "an untouched field must not claim to be truncated");
  }

  @Test
  void aTestThatNeverRanIsFlaggedWithoutInventingAStatus() {
    Map<String, Object> cleaned = hit(Map.of("entityType", "testCase", "name", "row_count_check"));

    assertEquals(
        Boolean.TRUE,
        cleaned.get("neverRun"),
        "absence is ambiguous: callers spent extra calls on a test suite summary purely to learn "
            + "that a missing status meant the test had never executed");
    assertNull(
        cleaned.get("testCaseStatus"),
        "testCaseStatus is a closed schema enum (Success/Failed/Aborted/Queued) with a generated "
            + "parser behind it - writing 'NeverRun' into it invents a value that exists nowhere "
            + "in OpenMetadata and throws in any client that parses the field");
  }

  @Test
  void anExecutedTestKeepsItsRealStatusAndIsNotFlagged() {
    Map<String, Object> cleaned = hit(Map.of("entityType", "testCase", "testCaseStatus", "Failed"));

    assertEquals("Failed", cleaned.get("testCaseStatus"), "a real result is never overwritten");
    assertNull(cleaned.get("neverRun"), "a test that ran must not be flagged as never run");
  }

  @Test
  void nonTestEntitiesAreNotGivenATestStatus() {
    Map<String, Object> cleaned = hit(Map.of("entityType", "table", "name", "dim_address"));

    assertNull(cleaned.get("testCaseStatus"), "a table has no test status of its own");
  }
}
