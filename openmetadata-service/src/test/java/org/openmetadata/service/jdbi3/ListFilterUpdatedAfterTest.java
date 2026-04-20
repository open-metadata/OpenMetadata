package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;

class ListFilterUpdatedAfterTest {

  @Test
  void conditionUsesNamedBindParameterNotLiteralValue() {
    long ts = 1_700_000_000_000L;
    ListFilter filter = new ListFilter().addUpdatedAfter(ts);
    String condition = filter.getCondition(null);

    // Must use JDBI bind parameter — the literal timestamp must never appear in the SQL string.
    assertFalse(condition.contains(String.valueOf(ts)), "Literal timestamp must not be in SQL");
    assertTrue(condition.contains(":updatedAfter"), "Named bind parameter must be present");
  }

  @Test
  void conditionUsesInclusiveBoundary() {
    ListFilter filter = new ListFilter().addUpdatedAfter(1_700_000_000_000L);
    String condition = filter.getCondition(null);

    assertTrue(
        condition.contains(">="),
        "Boundary must be inclusive (>=) to avoid missing entities updated at exactly lastRunTimestamp");
  }
}
